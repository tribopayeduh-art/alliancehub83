import {affiliateOfferDay,affiliateOfferId} from './affiliatePlanOffer.ts';
import crypto from 'node:crypto';
import type {Express} from 'express';
import {affiliatePlans,findAffiliatePlan,planDifference,planGames,type AffiliatePlanId} from '../shared/affiliatePlans.ts';
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

export function registerAffiliatePlanCheckout(app:Express){
 app.get('/api/affiliate-plans',async(req:any,res)=>{
  res.set('Cache-Control','no-store');
  try {
   const account=(await accounts(supabaseStore).doc(req.userId).get()).data();
   const order=account?.orderRef?(await collection(supabaseStore).doc(account.orderRef).get()).data() as Order:undefined;
   const offer=account?.planId==='starter'?(await supabaseStore.collection('affiliate_plan_offers').doc(affiliateOfferId(req.userId,affiliateOfferDay())).get()).data():null;
   const upgrade=offer?.count===6?{day:offer.day,differenceCents:offer.differenceCents,priceCents:planDifference('escale','starter')}:null;
   return res.json({upgrade,required:!!req.user?.affiliatePlanRequired&&!account?.planId,planId:account?.planId??null,games:account?.games??[],plans:affiliatePlans,catalog:planGames,order:order?.status==='pending'?order:null});
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
