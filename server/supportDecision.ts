import type {SupabaseStore} from './supabaseStore';
import type {SupportTicket} from '../shared/supportGuide';

export async function decideSupportTicket(store:SupabaseStore,id:string,actor:string,decision:'approve'|'reject',reply:string){
 const ref=store.collection('support_tickets').doc(id);
 return store.runTransaction(async tx=>{
  const item=(await tx.get(ref)).data() as SupportTicket|undefined;
  if(item?.status!=='open')return null;
  const next:SupportTicket={...item,status:decision==='approve'?'approved':'rejected',decidedAt:new Date().toISOString(),decidedBy:actor,...(decision==='approve'?{reply}:{})};
  if(decision==='reject')delete next.reply;
  tx.set(ref,next);return next;
 });
}
