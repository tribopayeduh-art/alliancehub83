import {validCommissionRequest} from '../shared/withdrawalRules.ts';
import {supabaseStore,type SupabaseStore} from './supabaseStore.ts';
const fail=(message:string,status=409)=>Object.assign(new Error(message),{status});
/** Reserve earned commissions and create the review request in a single database transaction. */
export async function reserveInfluencerCommission(affiliateId:string,record:Record<string,any>,store:SupabaseStore=supabaseStore){
 return store.transaction(async tx=>{
  const ur=store.collection('users').doc(record.influencerUserId),ar=store.collection('affiliates').doc(affiliateId),rr=store.collection('influencerCommissionRequests').doc(record.id);
  const user=(await tx.get(ur)).data(),affiliate=(await tx.get(ar)).data(),previous=(await tx.get(rr)).data();
  if(!user?.isInfluencer||user.isBlocked||(user as any).financialReviewHold||Number((user as any).financialDebt)>0||Number((affiliate as any)?.commissionDebt)>0||user.withdrawBlocked||!affiliate||affiliate.userId!==record.influencerUserId)throw fail('Esta conta não pode solicitar comissões.',403);
  if(previous){if(previous.influencerUserId!==record.influencerUserId||previous.amount!==record.amount||previous.pixKey!==record.pixKey||previous.pixKeyType!==record.pixKeyType)throw fail('Identificador já usado em outro pedido.');return {balance:Number(affiliate.affiliateBalance||0),replayed:true};}
  const amount=Number(record.amount),balance=Number(affiliate.affiliateBalance||0);
  if(!validCommissionRequest(amount)||!Number.isFinite(balance)||amount>balance)throw fail('Saldo de comissões insuficiente ou valor inválido.');
  const next=Math.round((balance-amount)*100)/100;
  tx.set(ar,{...affiliate,affiliateBalance:next});tx.set(rr,{...record,walletSource:'referral_commissions'});
  return {balance:next,replayed:false};
 });
}
