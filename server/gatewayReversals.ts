import crypto from 'node:crypto';
import {supabaseStore} from './supabaseStore.ts';
const fail=(s:string)=>Object.assign(new Error(s),{status:409});
// Only called after gateway-origin validation. Refund and MED messages never fabricate credits.
export async function recordPixupReversal(payload:any,event:string,store:any=supabaseStore){
 const d=payload?.data;if(payload?.event!==event||!d||d.currency!=='BRL'||typeof d.transaction_id!=='string'||payload.transaction_id!==d.transaction_id)throw fail('Evento financeiro inválido.');
 const remote=String(d.original_transaction_id||d.transaction_id),matches=await store.collection('charges').where('chargeId','==',remote).get();
 const cashout=event==='cashout.refunded';let original:any=matches.docs[0]?.data();
 if(cashout){const found=await store.collection('transactions').where('pixupWithdrawalId','==',remote).get();original=found.docs[0]?.data();}
 const rid=crypto.createHash('sha256').update('pixup:'+event+':'+remote+':'+String(d.infraction_id||'')+':'+String(payload.timestamp||'')+':'+String(d.amount_refunded??d.amount??'')).digest('hex');
 return store.runTransaction(async(tx:any)=>{
  const ref=store.collection('gateway_reviews').doc(rid),old=(await tx.get(ref)).data();if(old)return {id:rid,replayed:true};
  const userId=original?.userId,user=userId?(await tx.get(store.collection('users').doc(userId))).data():null;
  const review={id:rid,event,gateway:'pixup',gatewayId:remote,userId:userId||null,originalId:cashout?original?.id:original?.correlationID,state:'pending',amount:Number(d.amount_refunded??d.amount??0),createdAt:new Date().toISOString(),reason:String(d.reason||d.status||event).slice(0,150),infractionId:d.infraction_id||null};
  tx.create(ref,review);if(user)tx.update(store.collection('users').doc(userId),{financialReviewHold:true});return {id:rid,replayed:false};
 });
}
export async function resolveGatewayReview(id:string,actor:string,decision:string,note:string,store:any=supabaseStore){
 if(!['confirm_reversal','release_no_debit'].includes(decision)||typeof note!=='string'||note.trim().length<10)throw fail('Informe a decisão e uma justificativa de pelo menos 10 caracteres.');
 return store.runTransaction(async(tx:any)=>{
  const rr=store.collection('gateway_reviews').doc(id),r=(await tx.get(rr)).data();if(!r)throw fail('Pendência não encontrada.');if(r.state==='resolved')return {replayed:true};if(!r.userId)throw fail('Vincule a transação original pela conciliação do provedor antes de concluir.');
  const ur=store.collection('users').doc(r.userId),u=(await tx.get(ur)).data();if(!u)throw fail('Titular indisponível.');
  const pending=await store.collection('gateway_reviews').where('userId','==',r.userId).where('state','==','pending').get();
  let update:any={},reversed:any=null,utmUpdate:any=null;const affiliateRefunds:any[]=[];const commissionReversals:any[]=[];
  const isRefund=r.event==='cashin.refunded',cashoutRefund=r.event==='cashout.refunded';
  if(decision==='confirm_reversal'&&!isRefund&&!cashoutRefund)throw fail('O evento MED é acompanhado pelo cashin.refunded. Não debite duas vezes: aguarde esse evento ou libere a revisão sem débito após conciliar.');
  if(decision==='confirm_reversal'){
   if(!Number.isFinite(r.amount)||r.amount<=0)throw fail('Valor do estorno inválido.');
   const originalRef=store.collection(cashoutRefund?'transactions':'charges').doc(r.originalId),original=(await tx.get(originalRef)).data();
   if(!original||original.userId!==r.userId||(cashoutRefund?(original.status!=='approved'||original.gatewayRefunded):!original.credited))throw fail('Movimentação original não elegível.');
   if(cashoutRefund){
    if(original.walletKind==='affiliate'){
     const ids=original.influencerRequestId?[original.sponsorAffiliateId,original.influencerAffiliateId]:[];
     if(!ids.length){const found=await store.collection('affiliates').where('userId','==',r.userId).get();if(found.docs[0])ids.push(found.docs[0].id);}
     if(!ids.length||ids.some((x:any)=>!x))throw fail('Carteira de comissões não vinculada.');
     for(const aid of new Set(ids)){const ref=store.collection('affiliates').doc(aid as string),a=(await tx.get(ref)).data();if(!a)throw fail('Carteira não encontrada.');affiliateRefunds.push({ref,a,amount:r.amount});}
    }
    if(Math.round(r.amount*100)!==Math.round(Number(original.netAmount??original.amount)*100))throw fail('Valor devolvido diverge da liquidação.');
    if(original.walletKind!=='affiliate')update.balance=Math.round((Number(u.balance)+r.amount)*100)/100;reversed={ref:originalRef,updates:{gatewayRefunded:true,gatewayRefundedAt:new Date().toISOString(),gatewayRefundAmount:r.amount}};
   }else{
    const available=Math.round(Number(original.valueInReais)*100)-Math.round(Number(original.refundedAmount||0)*100),cents=Math.round(r.amount*100);if(cents>available)throw fail('Estorno excede o valor ainda elegível.');
    const debit=Math.min(Math.round(Number(u.balance)*100),cents),debt=cents-debit;
    update.balance=(Math.round(Number(u.balance)*100)-debit)/100;update.financialDebt=Math.round((Number(u.financialDebt||0)+debt/100)*100)/100;
    reversed={ref:originalRef,updates:{refundedAmount:Math.round((Number(original.refundedAmount||0)+r.amount)*100)/100}};
    if(Math.round((Number(original.refundedAmount||0)+r.amount)*100)===Math.round(original.valueInReais*100)&&original.utmifyOwnerId){
      const jobId=crypto.createHash('sha256').update(original.utmifyOwnerId+':'+original.correlationID).digest('hex'),ref=store.collection('utmify_jobs').doc(jobId),job=(await tx.get(ref)).data();
      if(job?.payload)utmUpdate={ref,job};
    }
    const allocationId='pix_'+crypto.createHash('sha256').update(original.correlationID).digest('hex'),allocation=(await tx.get(store.collection('deposit_allocations').doc(allocationId))).data();
    if(allocation?.state==='completed'){const grouped=new Map<string,number>();for(const leg of allocation.legs||[]){const before=Math.floor(leg.amountCents*Math.round(Number(original.refundedAmount||0)*100)/Math.round(original.valueInReais*100)),after=Math.floor(leg.amountCents*Math.round((Number(original.refundedAmount||0)+r.amount)*100)/Math.round(original.valueInReais*100));grouped.set(leg.affiliateId,(grouped.get(leg.affiliateId)||0)+after-before);}
     for(const [aid,cents] of grouped){const ref=store.collection('affiliates').doc(aid),a=(await tx.get(ref)).data();if(a)commissionReversals.push({ref,a,cents,aid});}
    }
   }
  }
  const debt=Number(update.financialDebt??u.financialDebt??0);update.financialReviewHold=debt>0||pending.docs.some((p:any)=>p.id!==id);
  if(utmUpdate){const {ref,job}=utmUpdate;tx.update(ref,{payload:{...job.payload,status:'refunded',refundedAt:new Date().toISOString().slice(0,19).replace('T',' ')},revision:Number(job.revision||0)+1,state:'pending',attempts:0,nextAttemptAt:0,updatedAt:new Date().toISOString()});}
  for(const f of affiliateRefunds)tx.update(f.ref,{affiliateBalance:Math.round((Number(f.a.affiliateBalance||0)+f.amount)*100)/100});
  for(const c of commissionReversals){const take=Math.min(Math.max(0,Math.round(Number(c.a.affiliateBalance||0)*100)),c.cents);tx.update(c.ref,{affiliateBalance:(Math.round(Number(c.a.affiliateBalance||0)*100)-take)/100,commissionTotal:Math.max(0,Math.round(Number(c.a.commissionTotal||0)*100)-c.cents)/100,commissionDebt:Math.round((Number(c.a.commissionDebt||0)+(c.cents-take)/100)*100)/100});tx.set(store.collection('affiliateCommissions').doc('reverse_'+id+'_'+c.aid),{id:'reverse_'+id+'_'+c.aid,affiliateId:c.aid,referrerUserId:c.a.userId,buyerUserId:r.userId,transactionId:r.originalId,amount:-c.cents/100,createdAt:new Date().toISOString(),source:'refund-ledger-v1'});}
  tx.update(ur,update);if(reversed)tx.update(reversed.ref,reversed.updates);
  tx.update(rr,{state:'resolved',decision,note:note.trim().slice(0,1000),resolvedBy:actor,resolvedAt:new Date().toISOString(),debtAfter:debt});
  tx.create(store.collection('transactions').doc('reversal_'+id),{id:'reversal_'+id,userId:r.userId,type:'adjustment',amount:decision==='confirm_reversal'?r.amount:0,status:'approved',direction:cashoutRefund?'credit':'debit',paymentMethod:'Conciliação Pixup',description:'Conciliação auditada: '+r.event,createdAt:new Date().toISOString()});
  return{success:true,financialReviewHold:update.financialReviewHold,debt};
 });
}
