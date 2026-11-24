import {advanceAffiliateOffer,affiliateOfferDay,affiliateOfferId} from './affiliatePlanOffer.ts';
import {findAffiliatePlan} from '../shared/affiliatePlans.ts';
import crypto from 'node:crypto';
import {supabaseStore} from './supabaseStore.ts';
import {getPartnerCutFromAffiliateRevShare} from './partnerCommission.ts';
const fail=(s:string,status=409)=>Object.assign(new Error(s),{status});
export const cashKind=(t:any)=>{
 if(t.type==='win'||t.type==='bet'||/^(game_|stake_)/.test(String(t.id||''))||/prêmio de jogo|entrada de jogo|lucro do jogo|vitória gen dino|lucro blockwin|demo|ajuste administrativo/i.test(t.description||''))return t.type==='withdrawal'||t.type==='bet'?'bet':'win';
 return t.type;
};
export async function prepareDepositLedger(tx:any,user:any,id:string,amount:number,store:any=supabaseStore){
 const receipt=store.collection('deposit_allocations').doc(id),existing=(await tx.get(receipt)).data();if(existing?.state==='completed')return ()=>{};
 const read=async(c:string,k:string)=>k?(await tx.get(store.collection(c).doc(k))).data():null;
 const affiliate=async(id?:string,uid?:string)=>{let a=id?await read('affiliates',id):null;if(!a&&uid){const q=await store.collection('affiliates').where('userId','==',uid).get();if(q.docs[0])a=await read('affiliates',q.docs[0].id);}return a;};
 let hub=await affiliate(user.parentAffiliateId||user.affiliateId,user.parentAffiliateUserId),inf=user.influencerUserId?await read('users',user.influencerUserId):null;
 if(hub?.userId===user.id)hub=null;
 const hu=hub?await read('users',hub.userId):null;
 if(!inf&&hu?.isInfluencer){inf=hu;hub=await affiliate(hu.parentAffiliateId,hu.parentAffiliateUserId);}
 const owner=hub?await read('users',hub.userId):null;
 let starterOwner:string|undefined;
 const rates:any[]=[];let issue=inf?.id===user.id?'SELF_REFERRAL_REVIEW':'';
 const rate=(n:any,fallback=0)=>{const v=Number(n??fallback);if(!Number.isFinite(v)||v<0||v>100){issue='INVALID_COMMISSION_RATE';return 0;}return v;};
 if(hub&&owner){
  if(owner.id===user.id||String(owner.email||'').toLowerCase()===String(user.email||'').toLowerCase()){issue='SELF_REFERRAL_REVIEW';}
  const entitlement=owner.affiliatePlanRequired?await read('affiliate_plan_accounts',owner.id):null;
  const tier=findAffiliatePlan(entitlement?.planId);
  if(tier?.id==='starter')starterOwner=owner.id;
  const gross=rate(tier?.commissionPercent??hub.revSharePercent,70),ir=inf&&inf.id!==hub.userId?rate(inf.influencerRate):0;
  if(ir>gross)issue='INFLUENCER_RATE_EXCEEDS_HUB_RATE';
  rates.push({affiliate:hub,rate:Math.max(0,gross-ir),kind:'hub'});
  if(inf&&ir>0){const ia=await affiliate(user.influencerAffiliateId,inf.id);if(!ia)issue='INFLUENCER_WALLET_MISSING';else rates.push({affiliate:ia,rate:ir,kind:'influencer'});}
  const master=owner.affiliateId&&owner.affiliateId!==hub.id?await affiliate(owner.affiliateId,owner.affiliateId):null;
  if(master&&master.userId!==hub.userId&&master.userId!==user.id)rates.push({affiliate:master,rate:rate(master.revSharePercent),kind:'master'});
  const pid=owner.partnerUserId||owner.partnerId;if(pid&&pid!==hub.userId){const partner=await read('users',pid);if(partner&&(partner.isPartner||partner.partnerApproved)){const pa=await affiliate(undefined,pid);if(!pa)issue='PARTNER_WALLET_MISSING';else rates.push({affiliate:pa,rate:getPartnerCutFromAffiliateRevShare(gross),kind:'partner'});}}
 }
 const totalRate=rates.reduce((a,r)=>a+r.rate,0);if(totalRate>100.000001)issue='TOTAL_COMMISSION_EXCEEDS_DEPOSIT';
 const cents=Math.round(amount*100),legs=rates.map(r=>({affiliateId:r.affiliate.id,userId:r.affiliate.userId,rate:r.rate,kind:r.kind,amountCents:Math.floor(cents*r.rate/100)}));
 const firstRef=store.collection('first_cash_deposit').doc(user.id),first=(await tx.get(firstRef)).data();
 const offerAt=new Date(), offerDay=affiliateOfferDay(offerAt);
 const offerRef=starterOwner&&!issue&&legs.some(l=>l.kind==='hub'&&l.amountCents>0)
  ?store.collection('affiliate_plan_offers').doc(affiliateOfferId(starterOwner,offerDay)):null;
 const offer=offerRef?advanceAffiliateOffer((await tx.get(offerRef)).data(),cents):null;
 return ()=>{
  if(!first)tx.set(firstRef,{transactionId:id,createdAt:new Date().toISOString()});
  tx.set(receipt,{id,userId:user.id,amountCents:cents,legs,state:issue?'review':'completed',reason:issue||null,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),isFtd:existing?.isFtd??!first});
  if(issue)return;
  if(offerRef&&offer)tx.set(offerRef,{...offer,userId:starterOwner,day:offerDay,updatedAt:offerAt.toISOString()});
  const grouped=new Map<string,any>();for(const r of rates){const a=grouped.get(r.affiliate.id)||{affiliate:r.affiliate,cents:0};a.cents+=Math.floor(cents*r.rate/100);grouped.set(r.affiliate.id,a);}
  for(const [aid,g] of grouped){const value=g.cents/100,repay=Math.min(Number(g.affiliate.commissionDebt||0),value);tx.update(store.collection('affiliates').doc(aid),{commissionDebt:Math.round((Number(g.affiliate.commissionDebt||0)-repay)*100)/100,affiliateBalance:Math.round((Number(g.affiliate.affiliateBalance||0)+value-repay)*100)/100,commissionTotal:Math.round((Number(g.affiliate.commissionTotal||0)+value)*100)/100});const cid='ledger_'+crypto.createHash('sha256').update(id+':'+aid).digest('hex');tx.set(store.collection('affiliateCommissions').doc(cid),{id:cid,affiliateId:aid,referrerUserId:g.affiliate.userId,buyerUserId:user.id,transactionId:id,amount:value,isKilled:false,createdAt:new Date().toISOString(),source:'deposit-ledger-v1'});}
 };
}
export async function reservePlayerCashout(userId:string,body:any,key?:string,store:any=supabaseStore){
 const amount=body.amountCents!==undefined?Number(body.amountCents)/100:Number(body.amount);
 if(!Number.isFinite(amount)||amount<=0||amount>100000||Math.abs(amount*100-Math.round(amount*100))>1e-6)throw fail('Valor de saque inválido.',400);
 if(key&&!/^[a-zA-Z0-9_-]{16,100}$/.test(key))throw fail('Identificador inválido.',400);
 return store.runTransaction(async(tx:any)=>{
  const ur=store.collection('users').doc(userId),u=(await tx.get(ur)).data();
  if(!u||u.isBlocked||u.withdrawBlocked||u.financialReviewHold||Number(u.financialDebt)>0||u.isInfluencer||u.hasAffiliateDemoBalance||u.role==='affiliate'||u.isAffiliate||u.registeredGame==='alliance_hub')throw fail('Esta conta não pode sacar saldo de jogos. Use a carteira de comissões quando aplicável.',403);
  const cents=Math.round(amount*100),min=Number(u.minWithdraw??100),fee=Number(u.withdrawFee??8);
  if(!Number.isFinite(min)||!Number.isFinite(fee)||fee<0||amount<min||fee>=amount)throw fail('Valor fora dos limites ou taxa inválida.',400);
  let raw=body.pixKey||body.pixKeyId||u.pixKey||u.pixKeys?.[0];let chosen=typeof raw==='object'?raw:null;
  if(!chosen&&u.pixKeys?.length)chosen=u.pixKeys.find((k:any)=>k.id===raw||k.key===raw);
  const pixKey=String(chosen?.key||raw||'').trim(),pixType=String(body.pixKeyType||body.pixType||chosen?.type||u.pixKeyType||(pixKey.includes('@')?'email':/^\d{11}$/.test(pixKey)?'cpf':/^\d{14}$/.test(pixKey)?'cnpj':pixKey.startsWith('+')?'phone':'random')).toLowerCase();
  if(!pixKey||pixKey.length>200||!['cpf','cnpj','email','phone','random','evp'].includes(pixType))throw fail('Cadastre uma chave PIX válida.',400);
  const ar=store.collection('player_cashout_active').doc(userId),active=(await tx.get(ar)).data();
  const stable=key?'player_'+crypto.createHash('sha256').update(userId+':'+key).digest('hex'):'player_'+crypto.randomUUID();
  const ref=store.collection('transactions').doc(stable),old=(await tx.get(ref)).data();
  const pending=active?.id?(await tx.get(store.collection('transactions').doc(active.id))).data():null;
  if(old){if(old.amount!==amount||old.pixKey!==pixKey)throw fail('Identificador já utilizado com outros dados.');return{transaction:old,balance:Number(u.balance),replayed:true};}
  if(pending?.status==='pending'){if(pending.amount===amount&&pending.pixKey===pixKey)return{transaction:pending,balance:Number(u.balance),replayed:true};throw fail('Você já possui um saque pendente. Aguarde a conclusão.');}
  const rows=await store.collection('transactions').where('userId','==',userId).get();const bets=await store.collection('gameBets').where('userId','==',userId).get();
  const deposits=rows.docs.reduce((s:any,r:any)=>{const v=r.data();return s+(cashKind({...v,id:r.id})==='deposit'&&v.status==='approved'?Number(v.amount||0):0);},0),wagered=bets.docs.reduce((s:any,r:any)=>s+(r.data().status==='cancelled'?0:Number(r.data().betAmount||0)),0);
  if(wagered+.001<deposits)throw fail('Movimente seus depósitos em apostas antes de solicitar saque.',400);
  const balanceCents=Math.round(Number(u.balance)*100);if(!Number.isSafeInteger(balanceCents)||cents>balanceCents)throw fail('Saldo insuficiente.',400);
  const transaction={id:stable,userId,type:'withdrawal',status:'pending',walletKind:'player',amount,fee,netAmount:Math.round((amount-fee)*100)/100,pixKey,pixType,paymentMethod:'PIX',description:'Saque PIX · aguardando análise da administração',isAutoCashout:false,createdAt:new Date().toISOString()};
  tx.update(ur,{balance:(balanceCents-cents)/100});tx.create(ref,transaction);tx.set(ar,{id:stable});
  return {transaction,balance:(balanceCents-cents)/100,replayed:false};
 });
}
