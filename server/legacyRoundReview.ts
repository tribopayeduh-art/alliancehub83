import {supabaseStore} from './supabaseStore.ts';
import {AUTHORITATIVE_GAMES} from './roundAuthority.ts';
export async function refundLegacyRound(id:string,actor:string,note:string,store:any=supabaseStore){
 if(!note||note.trim().length<10)throw new Error('Informe a justificativa da conciliação.');
 return store.runTransaction(async(tx:any)=>{
  const br=store.collection('gameBets').doc(id),bet=(await tx.get(br)).data(),proof=(await tx.get(store.collection('roundAuthorities').doc(id))).data(),rr=store.collection('legacy_round_refunds').doc(id),old=(await tx.get(rr)).data();
  if(old)return{replayed:true};if(!bet||!AUTHORITATIVE_GAMES.has(bet.gameId)||proof||bet.status!=='active')throw new Error('Somente rodadas antigas ativas sem autorização podem ser conciliadas.');
  const ur=store.collection('users').doc(bet.userId),u=(await tx.get(ur)).data(),cr=store.collection('gameConfigs').doc(bet.gameId),cfg=(await tx.get(cr)).data();
  if(!u||!Number.isFinite(bet.betAmount)||bet.betAmount<=0)throw new Error('Registro financeiro inconsistente.');
  const receipt={id,userId:bet.userId,amount:bet.betAmount,actor,note:note.trim().slice(0,1000),createdAt:new Date().toISOString()};
  tx.update(ur,{balance:Math.round((Number(u.balance)+bet.betAmount)*100)/100});tx.update(br,{status:'cancelled',payoutAmount:0,profitAmount:0,cancelledAt:receipt.createdAt});tx.create(rr,receipt);
  if(cfg)tx.update(cr,{totalWagered:Math.max(0,Math.round((Number(cfg.totalWagered||0)-bet.betAmount)*100)/100),totalBetsCount:Math.max(0,Number(cfg.totalBetsCount||0)-1)});
  tx.create(store.collection('transactions').doc('legacy_refund_'+id),{id:'legacy_refund_'+id,userId:bet.userId,type:'adjustment',direction:'credit',status:'approved',amount:bet.betAmount,description:'Devolução auditada de entrada de rodada antiga',createdAt:receipt.createdAt});return{success:true};
 });
}
