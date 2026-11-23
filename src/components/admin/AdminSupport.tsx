import React,{useEffect,useRef,useState} from 'react';
import {LifeBuoy,RefreshCw} from 'lucide-react';
import type {SupportTicket} from '../../../shared/supportGuide';
import {supportRequest,ticketLabels,topicLabels} from '../SupportCenter';

export function AdminSupport({token,onTutorial,onReview}:{token:string;onTutorial:()=>void;onReview:(topic:string)=>void}){
 const [status,setStatus]=useState<SupportTicket['status']>('open'),[items,setItems]=useState<SupportTicket[]>([]);
 const [selected,setSelected]=useState(''),[reply,setReply]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const revision=useRef(0),saving=useRef(false);
 async function load(s:SupportTicket['status']){
  const request=++revision.current;setLoading(true);
  try{const data=await supportRequest('/api/admin/support/tickets?status='+s,token);if(request===revision.current){setItems(data.items);setError('');}}
  catch(e:any){if(request===revision.current){setItems([]);setError(e.message);}}
  finally{if(request===revision.current)setLoading(false);}
 }
 useEffect(()=>{void load(status);return()=>{revision.current++;};},[status,token]);
 async function decide(t:SupportTicket,decision:'approve'|'reject'){
  if(saving.current)return;
  saving.current=true;setBusy(true);setError('');
  try{
   await supportRequest('/api/admin/support/tickets/'+t.id+'/decision',token,{decision,reply});
   setSelected('');await load(status);
  }catch(e:any){setError(e.message);}
  finally{setBusy(false);saving.current=false;}
 }
 return <div className="support-admin adm-workspace">
  <article><h2><LifeBuoy size={17} style={{display:'inline'}}/> Fila de atendimento</h2><p>Revise o diagnóstico e a sugestão. Ao aprovar, o texto revisado aparece em Meus tickets para o usuário.</p>
   <div className="support-admin-actions"><label><span className="sr-only">Status do ticket</span><select value={status} disabled={busy} onChange={e=>{setItems([]);setSelected('');setStatus(e.target.value as typeof status);}}>{Object.entries(ticketLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button onClick={()=>void load(status)} disabled={loading||busy}><RefreshCw size={14}/> Atualizar</button><button onClick={onTutorial}>Iniciar tutorial do painel</button></div>
  </article>
  {error&&<p role="alert">{error}</p>}
  {loading&&!items.length&&<p role="status">Buscando tickets…</p>}
  {!loading&&!items.length&&!error&&<p>Nenhum ticket nesta situação.</p>}
  {items.map(t=><article key={t.id}>
    <header><h3>{topicLabels[t.topic]} · #{t.id.slice(0,8)}</h3><small>{new Date(t.createdAt).toLocaleString('pt-BR')} · {ticketLabels[t.status]}</small></header>
    <p><strong>Conta:</strong> {t.userId}{t.transactionId&&<><br/><strong>Movimentação:</strong> {t.transactionId}</>}</p>
    <p><strong>Relato:</strong> {t.question}</p>
    <p><strong>Diagnóstico:</strong> {t.diagnosis}</p>
    <p><strong>Sugestão interna:</strong> {t.suggestion}</p>
    {t.reply&&<p className="support-reply"><strong>Resposta publicada:</strong> {t.reply}</p>}
    {t.decidedAt&&<small>Revisado em {new Date(t.decidedAt).toLocaleString('pt-BR')} · {t.decidedBy}</small>}
    {t.status==='open'&&(selected===t.id?<><label>Orientação para enviar ao usuário<textarea value={reply} rows={3} maxLength={1250} onChange={e=>setReply(e.target.value)} disabled={busy}/></label><div className="support-admin-actions"><button className="support-primary" onClick={()=>void decide(t,'approve')} disabled={busy||!reply.trim()}>Aprovar e publicar</button><button onClick={()=>void decide(t,'reject')} disabled={busy}>Recusar e encerrar</button><button onClick={()=>setSelected('')} disabled={busy}>Cancelar</button></div></>:<div className="support-admin-actions"><button onClick={()=>{setSelected(t.id);setReply(t.diagnosis);setError('');}} disabled={busy}>Revisar sugestão</button>{(t.topic==='saque'||t.topic==='deposito')&&<button onClick={()=>onReview(t.topic)}>Abrir seção financeira</button>}</div>)}
  </article>)}
 </div>;
}
