import {decideSupportTicket} from './supportDecision.ts';
import type {Express, RequestHandler} from 'express';
import {randomUUID} from 'node:crypto';
import {supabaseStore} from './supabaseStore.ts';
import {supportTopics,type SupportTicket,type SupportTopic} from '../shared/supportGuide.ts';
import {diagnoseSupport,inferSupportTopic} from './supportDiagnosis.ts';

export function registerSupport(app:Express,auth:RequestHandler,admin:RequestHandler,canManage:(req:any)=>boolean,getMovements:(id:string)=>Promise<any[]>){
 const tickets=supabaseStore.collection('support_tickets');
 const wrap=(fn:(req:any,res:any)=>Promise<any>):RequestHandler=>(req,res)=>{
  res.set('Cache-Control','private, no-store');
  void fn(req,res).catch((error)=>{console.error('[support]',error?.code||'unavailable');if(!res.headersSent)res.status(503).json({error:'Não foi possível acessar o suporte. Tente novamente.'});});
 };
 const own=(item:SupportTicket)=>({id:item.id,topic:item.topic,status:item.status,question:item.question,createdAt:item.createdAt,reply:item.status==='approved'?item.reply:undefined});
 const recent=async(filter:Record<string,string>,limit:number)=> (await supabaseStore.recent('support_tickets',limit,filter)).map(r=>r.data as SupportTicket);
 const throttle=new Map<string,number>();
 app.post('/api/support/chat',auth,wrap(async(req,res)=>{
  const question=typeof req.body?.question==='string'?req.body.question.trim():'';
  const selected=req.body?.topic as SupportTopic;
  const topic=selected==='outro'?inferSupportTopic(question):selected;
  if(!question||question.length>800||!supportTopics.includes(topic))return res.status(400).json({error:'Selecione um assunto e escreva uma mensagem de até 800 caracteres.'});
  const now=Date.now();
  for(const [key,until] of throttle)if(until<=now)throttle.delete(key);
  if(throttle.has(req.userId))return res.status(429).json({error:'Aguarde alguns segundos antes de enviar outra mensagem.'});
  throttle.set(req.userId,now+1800);
  let result:ReturnType<typeof diagnoseSupport>;
  try{
   const movements=topic==='saque'||topic==='deposito'?await getMovements(req.userId):[];
   result=diagnoseSupport(question,topic,movements,req.user||{});
  }catch{
   result={answer:'Não consegui confirmar o status no extrato agora. Vou encaminhar para análise sem assumir o resultado da operação.',suggestion:'Consultar o extrato da conta e confirmar o status pelo identificador informado antes de orientar.',escalate:true};
  }
  if(!result.escalate&&req.body?.ticket!==true)return res.json({answer:result.answer});
  const plan=(await supabaseStore.collection('affiliate_plan_accounts').doc(req.userId).get()).data();

  const candidate:SupportTicket={id:randomUUID(),userId:req.userId,topic,question,diagnosis:result.answer,suggestion:result.suggestion,priority:plan?.planId==='escale',status:'open',createdAt:new Date(now).toISOString(),...(result.transactionId?{transactionId:result.transactionId}:{})};
  const open=(await recent({userId:req.userId,status:'open'},20)).find(t=>t.topic===topic&&(candidate.transactionId ? t.transactionId===candidate.transactionId : t.question===question));
  if(open)return res.json({answer:result.answer,ticket:own(open)});
  await tickets.doc(candidate.id).set(candidate);
  return res.json({answer:result.answer,ticket:own(candidate)});
 }));
 app.get('/api/support/tickets',auth,wrap(async(req,res)=>res.json({items:(await recent({userId:req.userId},35)).map(own)})));
 app.get('/api/admin/support/tickets',admin,wrap(async(req,res)=>{
  if(!canManage(req))return res.sendStatus(403);
  const status=req.query.status==='approved'||req.query.status==='rejected'?req.query.status:'open';
  const [priority,latest]=await Promise.all([recent({status,priority:true} as any,75),recent({status},75)]);
  return res.json({items:[...new Map([...priority,...latest].map(t=>[t.id,t])).values()].slice(0,75)});
 }));
 app.post('/api/admin/support/tickets/:id/decision',admin,wrap(async(req,res)=>{
  if(!canManage(req))return res.sendStatus(403);
  if(!/^[a-f\d-]{36}$/i.test(req.params.id))return res.sendStatus(400);
  const approve=req.body?.decision==='approve',reject=req.body?.decision==='reject';
  const reply=typeof req.body?.reply==='string'?req.body.reply.trim():'';
  if((!approve&&!reject)||(approve&&(!reply||reply.length>1250)))return res.status(400).json({error:'Informe uma orientação de até 1.250 caracteres para aprovar.'});
  const updated=await decideSupportTicket(supabaseStore,req.params.id,req.userId,approve?'approve':'reject',reply);
  return updated?res.json(updated):res.status(409).json({error:'Este ticket já foi analisado ou não existe.'});
 }));
}
