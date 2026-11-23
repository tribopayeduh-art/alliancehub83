import crypto from 'node:crypto';
import {supabaseStore,type SupabaseStore} from './supabaseStore.ts';
import {validCommissionRelease} from './influencerWithdrawalPolicy.ts';
const fail=(message:string,status=409)=>Object.assign(new Error(message),{status});
const cents=(n:number)=>Math.round(n*100)/100;
export async function reviewInfluencer(input:{requestId:string;action:string;amount?:number;reason?:string;actorId:string;actorName:string;admin:boolean;sponsorAffiliateId:string;influencerAffiliateId:string},store:SupabaseStore=supabaseStore){
 if(!['approve','reject'].includes(input.action))throw fail('Ação inválida.',400);
 return store.transaction(async tx=>{
  const rr=store.collection('influencerCommissionRequests').doc(input.requestId),hr=store.collection('affiliates').doc(input.sponsorAffiliateId),ir=store.collection('affiliates').doc(input.influencerAffiliateId);
  const r=(await tx.get(rr)).data(),hub=(await tx.get(hr)).data(),inf=(await tx.get(ir)).data();
  if(!r||!hub||!inf||inf.userId!==r.influencerUserId||hub.userId===inf.userId)throw fail('Carteiras responsáveis não encontradas.',404);
  if(![r.affiliateId,r.parentAffiliateId].includes(input.sponsorAffiliateId)&&![r.affiliateUserId,r.parentAffiliateUserId].includes(hub.userId))throw fail('Carteira responsável divergente.');
  if(!input.admin&&hub.userId!==input.actorId)throw fail('Sem permissão para revisar este pedido.',403);
  const id='tx_inf_'+crypto.createHash('sha256').update(r.id).digest('hex').slice(0,40),pr=store.collection('transactions').doc(id),previous=(await tx.get(pr)).data();
  if(previous&&r.status==='pending')throw fail('Pedido e pagamento divergentes; revisão necessária.');
  if(r.status!=='pending'){
   if(r.reviewAction===input.action&& (input.action==='reject'||(input.amount===undefined||r.approvedAmount===input.amount)))return {replayed:true,payout:previous,request:r,hubBalance:Number(hub.affiliateBalance||0)};
   throw fail('Pedido já processado. Atualize o Financeiro.');
  }
  const original=Number(r.amount),balance=Number(hub.affiliateBalance||0),ib=Number(inf.affiliateBalance||0),now=new Date().toISOString();
  if(!Number.isFinite(original)||original<=0||!Number.isFinite(balance)||!Number.isFinite(ib))throw fail('Dados financeiros inválidos.');
  if(input.action==='reject'){
   tx.set(ir,{...inf,affiliateBalance:cents(ib+original)});tx.set(rr,{...r,status:'rejected',reviewAction:'reject',rejectReason:(input.reason||'Recusado pelo responsável.').slice(0,500),processedAt:now,processedByUserId:input.actorId});
   return {replayed:false,payout:null,request:{...r,status:'rejected'},hubBalance:balance};
  }
  const amount=input.amount===undefined?original:input.amount;
  if(!validCommissionRelease(original,amount)||Math.abs(amount*100-Math.round(amount*100))>1e-6)throw fail('Valor deve ser positivo, em centavos, e não superar a reserva.',400);
  if(amount>balance)throw fail('Saldo de comissões do Hub responsável insuficiente.',422);
  const payout={id,userId:r.influencerUserId,type:'withdrawal',status:'pending',amount,netAmount:amount,fee:0,walletKind:'affiliate',walletSource:'referral_commissions',influencerRequestId:r.id,sponsorAffiliateId:input.sponsorAffiliateId,influencerAffiliateId:input.influencerAffiliateId,pixKey:r.pixKey,pixType:r.pixKeyType,paymentMethod:'PIX · Comissões de indicação',createdAt:now,description:'Comissão autorizada pelo Hub; aguardando confirmação bancária.'};
  tx.set(hr,{...hub,affiliateBalance:cents(balance-amount)});tx.set(ir,{...inf,affiliateBalance:cents(ib+original-amount)});tx.set(pr,payout);tx.set(rr,{...r,status:'approved',reviewAction:'approve',approvedAmount:amount,paymentStatus:'pending',payoutTransactionId:id,sponsorAffiliateId:input.sponsorAffiliateId,influencerAffiliateId:input.influencerAffiliateId,processedAt:now,processedByUserId:input.actorId,processedByName:input.actorName});
  return {replayed:false,payout,request:r,hubBalance:cents(balance-amount)};
 });
}
/** Called within the existing bank-confirmation/rejection transaction. Never credits game balances. */
export async function settleInfluencerLedger(tx:any,payout:any,completed:boolean,ref:(c:string,id:string)=>any){
 if(!payout.influencerRequestId)return false;
 const rr=ref('influencerCommissionRequests',payout.influencerRequestId),hr=ref('affiliates',payout.sponsorAffiliateId),ir=ref('affiliates',payout.influencerAffiliateId);
 const r=(await tx.get(rr)).data(),hub=(await tx.get(hr)).data(),inf=(await tx.get(ir)).data();
 if(!r||r.payoutTransactionId!==payout.id||!hub||!inf||hub.userId===inf.userId||inf.userId!==payout.userId)throw fail('Conciliação de comissão divergente.');
 if(r.paymentStatus!=='pending'){if(r.paymentStatus===(completed?'paid':'failed'))return true;throw fail('Confirmação bancária conflitante.');}
 const amount=Number(payout.amount),hb=Number(hub.affiliateBalance||0),ib=Number(inf.affiliateBalance||0);if(![amount,hb,ib].every(Number.isFinite))throw fail('Valores inválidos na conciliação.');
 const now=new Date().toISOString();
 if(!completed){tx.update(hr,{affiliateBalance:cents(hb+amount)});tx.update(ir,{affiliateBalance:cents(ib+amount)});}
 else{const id='hub_'+payout.id;tx.set(ref('transactions',id),{id,userId:hub.userId,type:'withdrawal',status:'approved',amount,paymentMethod:'Repasse de comissão ao influenciador',description:'Repasse confirmado pelo banco; saldo reservado anteriormente.',createdAt:now,relatedTransactionId:payout.id});}
 tx.update(rr,{paymentStatus:completed?'paid':'failed',paymentSettledAt:now});return true;
}
