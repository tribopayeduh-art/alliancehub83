import {affiliateOfferDay,affiliateOfferId} from './affiliatePlanOffer.ts';
import crypto from 'node:crypto';
import type {Express} from 'express';
import {affiliatePlans,findAffiliatePlan,legacyAllianceRate,planDifference,planGames,type AffiliatePlanId} from '../shared/affiliatePlans.ts';
import {supabaseStore} from './supabaseStore.ts';
import {pixupConfigured,requestPixupCashin} from './pixupCashin.ts';
import {pixupPostback} from './pixupWithdrawals.ts';
import {parsePixupDepositEvent} from './pixupDeposits.ts';

export const PLAN_REFERENCE = /^inex-plan-[a-f0-9]{32}$/;
export const affiliatePlansEnabled = () => process.env.AFFILIATE_PLAN_CHECKOUT === 'true';
type Order = {reference:string;userId:string;planId:AffiliatePlanId;games:string[];cents:number;previous?:AffiliatePlanId;status:'pending'|'paid';gatewayId?:string;qrcode?:string;expiresAt?:string|null};
export function validatePlanSelection(plan:AffiliatePlanId, value:unknown) {
 const games = Array.isArray(value) ? [...new Set(value)] : [];
 if(games.some(x=>!planGames.some(g=>g.id===x))) throw new Error('Escolha jogos válidos do catálogo.');
 if(plan==='starter' && (!games.length || games.length>3)) throw new Error('Escolha entre 1 e 3 jogos para o Starter.');
 return plan==='starter'?games as string[]:[];
}
const err=(message:string,status:number)=>Object.assign(new Error(message),{status});
const collection=(store:any)=>store.collection('affiliate_plan_orders');
const accounts=(store:any)=>store.collection('affiliate_plan_accounts');

export async function confirmAffiliatePlan(payload:any,store:any=supabaseStore) {
 const event=parsePixupDepositEvent(payload,'cashin.confirmed',PLAN_REFERENCE);
 if (!event) return false;
 return store.runTransaction(async (tx:any)=>{
  const ref=collection(store).doc(event.reference), order=(await tx.get(ref)).data() as Order|undefined;
  if(!order||order.cents!==event.cents||!order.gatewayId||order.gatewayId!==event.id) throw err('Pagamento não corresponde ao plano.',409);
  if(order.status==='paid')return true;
  const accountRef=accounts(store).doc(order.userId),account=(await tx.get(accountRef)).data();
  const plan=findAffiliatePlan(order.planId);
  const rows=await store.collection('affiliates').where('userId','==',order.userId).get();
  const affiliateRef=rows.docs[0]?.ref;
  const affiliate=affiliateRef?(await tx.get(affiliateRef)).data():null;
  if(!plan||!affiliate||account?.orderRef!==order.reference||account?.planId!==order.previous)throw err('Pedido indisponível para ativação.',409);
  tx.update(ref,{status:'paid',paidAt:new Date().toISOString()});
  tx.set(accountRef,{planId:plan.id,games:order.games,activatedAt:new Date().toISOString()});
  tx.update(affiliateRef,{revSharePercent:plan.commissionPercent,status:'active'});
  return true;
 });
}

export async function assignAffiliatePlan({userId,actorId,planId:target,games:selection,expected}:{userId:string;actorId:string;planId:unknown;games:unknown;expected:unknown},store:any=supabaseStore){
 const plan=findAffiliatePlan(target);
 if(!plan)throw err('Plano inválido.',400);
 let games:string[];
 try{games=validatePlanSelection(plan.id,selection);}catch(e:any){throw err(e.message,400);}
 const rows=await store.collection('affiliates').where('userId','==',userId).get();
 const affiliateRef=rows.docs[0]?.ref;
 if(!affiliateRef)throw err('Conta de afiliado não encontrada.',404);
 const audit=store.collection('affiliate_plan_audit').doc(crypto.randomUUID());
 return store.runTransaction(async(tx:any)=>{
  const userRef=store.collection('users').doc(userId),accountRef=accounts(store).doc(userId);
  const user=(await tx.get(userRef)).data(),account=(await tx.get(accountRef)).data(),affiliate=(await tx.get(affiliateRef)).data();
  if(!user||affiliate?.userId!==userId)throw err('Conta de afiliado não encontrada.',404);
  const previous=account?.planId??(user.affiliatePlanRequired||affiliate.status==='pending'?null:'alliance');
  if(expected!==previous)throw err('O plano mudou. Reabra o painel antes de salvar.',409);
  if(account?.orderRef){
   const order=(await tx.get(collection(store).doc(account.orderRef))).data();
   if(order?.status==='pending')throw err('Há uma cobrança PIX pendente. Concilie o pagamento antes de alterar o plano.',409);
  }
  const at=new Date().toISOString();
  tx.set(accountRef,{planId:plan.id,games,activatedAt:at,source:'admin',assignedBy:actorId});
  tx.update(userRef,{affiliatePlanRequired:true});
  tx.update(affiliateRef,{status:'active',revSharePercent:plan.commissionPercent});
  tx.set(audit,{userId,actorId,previous,previousGames:account?.games??[],planId:plan.id,games,at});
  return {planId:plan.id,games,status:'active'};
 });
}

export function registerAffiliatePlanCheckout(app:Express){
 // This router is mounted after the server's verified session middleware.
 const canChange=(req:any)=>req.userId&&req.user?.id===req.userId&&(req.user.role==='superadmin'||req.user.role==='admin'&&req.user.adminPermissions?.canManageUsers&&req.user.adminPermissions?.canManageBalances);
 const adminRoute='/api/admin/affiliate-plans/:userId';
 app.get(adminRoute,async(req:any,res)=>{
  res.set('Cache-Control','no-store');
  if(!canChange(req))return res.sendStatus(403);
  try{
   const user=(await supabaseStore.collection('users').doc(req.params.userId).get()).data();
   const rows=await supabaseStore.collection('affiliates').where('userId','==',req.params.userId).get();
   if(!user||!rows.docs.length)return res.status(404).json({error:'Conta de afiliado não encontrada.'});
   const account=(await accounts(supabaseStore).doc(req.params.userId).get()).data();
   const status=rows.docs[0].data()?.status;
   return res.json({planId:account?.planId??(user.affiliatePlanRequired||status==='pending'?null:'alliance'),games:account?.games??[],status});
  }catch{return res.status(503).json({error:'Não foi possível consultar o plano.'});}
 });
 app.put(adminRoute,async(req:any,res)=>{
  res.set('Cache-Control','no-store');
  if(!canChange(req))return res.sendStatus(403);
  try{return res.json(await assignAffiliatePlan({userId:req.params.userId,actorId:req.userId,planId:req.body?.planId,games:req.body?.games,expected:req.body?.expected}));}
  catch(e:any){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível alterar o plano.'});}
 });
 app.get('/api/affiliate-plans',async(req:any,res)=>{
  res.set('Cache-Control','no-store');
  try {
   const account=(await accounts(supabaseStore).doc(req.userId).get()).data();
   const order=account?.orderRef?(await collection(supabaseStore).doc(account.orderRef).get()).data() as Order:undefined;
   const offer=account?.planId==='starter'?(await supabaseStore.collection('affiliate_plan_offers').doc(affiliateOfferId(req.userId,affiliateOfferDay())).get()).data():null;
   const upgrade=offer?.count===6?{day:offer.day,differenceCents:offer.differenceCents,priceCents:planDifference('escale','starter')}:null;
   const legacy=!req.user?.affiliatePlanRequired;
   return res.json({upgrade,legacy,defaultCommission:legacy?legacyAllianceRate(req.user)??75:null,required:!!req.user?.affiliatePlanRequired&&!account?.planId,planId:account?.planId??(legacy?'alliance':null),games:account?.games??[],plans:affiliatePlans,catalog:planGames,order:order?.status==='pending'?order:null});
  }catch{return res.status(503).json({error:'Não foi possível consultar seu plano.'});}
 });
 app.post('/api/affiliate-plans/checkout',async(req:any,res)=>{
  res.set('Cache-Control','no-store');
  const plan=findAffiliatePlan(req.body?.planId),postback=pixupPostback();
  if(!req.user?.affiliatePlanRequired)return res.status(403).json({error:'Sua conta não precisa contratar um plano.'});
  if(!affiliatePlansEnabled()||!postback||!pixupConfigured())return res.status(503).json({error:'Checkout Pixup indisponível.'});
  if(!plan)return res.status(400).json({error:'Plano inválido.'});
  let games:string[];
  try{games=validatePlanSelection(plan.id,req.body?.games);}catch(e:any){return res.status(400).json({error:e.message});}
  try{
   const accountRef=accounts(supabaseStore).doc(req.userId);
   const order:Order=await supabaseStore.runTransaction(async(tx:any)=>{
    const account=(await tx.get(accountRef)).data(),previous=account?.planId as AffiliatePlanId|undefined;
    const cents=planDifference(plan.id,previous);
    if(cents<=0)throw err('Selecione um plano superior.',400);
    const existing=account?.orderRef?(await tx.get(collection(supabaseStore).doc(account.orderRef))).data() as Order:undefined;
    if(existing?.status==='pending'){
     if(existing.planId!==plan.id||JSON.stringify(existing.games)!==JSON.stringify(games))throw err('Já existe um PIX em aberto. Confira o PIX em aberto antes de escolher outro plano.',409);
     return existing;
    }
    const reference='inex-plan-'+crypto.randomBytes(16).toString('hex');
    const created={reference,userId:req.userId,planId:plan.id,games,cents,...(previous?{previous}:{}),status:'pending' as const};
    tx.set(collection(supabaseStore).doc(reference),created);
    tx.set(accountRef,{...account,orderRef:reference});
    return created;
   });
   if(order.qrcode)return res.json(order);
   const result=await requestPixupCashin({amount:order.cents/100,external_id:order.reference,postback_url:postback});
   if('error' in result)return res.status(result.status).json({error:result.error});
   const ref=collection(supabaseStore).doc(order.reference);
   const updated=await supabaseStore.runTransaction(async tx=>{
    const current=(await tx.get(ref)).data();
    if(!current||current.gatewayId&&current.gatewayId!==result.id)throw err('Confirmação Pixup divergente.',409);
    const next={...current,gatewayId:result.id,qrcode:result.qrcode,expiresAt:result.expiresAt};tx.set(ref,next);return next;
   });
   return res.json(updated);
  }catch(e:any){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível gerar o PIX do plano. Tente novamente.'});}
 });
}
