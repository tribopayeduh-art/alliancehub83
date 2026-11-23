import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {LifeBuoy,Send,ChevronRight,ChevronLeft,X} from 'lucide-react';
import {Modal} from './Modal';
import {accountGuide,supportTopics,type SupportTopic,type SupportTicket} from '../../shared/supportGuide';
import {requestJson} from '../lib/requestJson';
import './support-center.css';

export const topicLabels:Record<SupportTopic,string>={saque:'Saques',deposito:'Depósitos',pis:'PIS IO',indicacoes:'Indicações',configuracoes:'Configurações',outro:'Outro assunto'};
export const ticketLabels={open:'Em análise',approved:'Respondido',rejected:'Encerrado'};
export const supportRequest=(url:string,token:string,body?:object)=>requestJson(url,{
 headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
 ...(body?{method:'POST',body:JSON.stringify(body)}:{}),
});

export function SupportCenter({token,open,onClose,onTutorial}:{token:string;open:boolean;onClose:()=>void;onTutorial:()=>void}){
 const [topic,setTopic]=useState<SupportTopic>('outro'),[question,setQuestion]=useState('');
 const [messages,setMessages]=useState<{user:boolean;text:string}[]>([]);
 const [tickets,setTickets]=useState<SupportTicket[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ticketError,setTicketError]=useState('');
 const last=useRef<{question:string;topic:SupportTopic}|null>(null);
 const thread=useRef<HTMLDivElement>(null), inFlight=useRef(false);
 const load=()=>supportRequest('/api/support/tickets',token).then(data=>{setTickets(data.items);setTicketError('');}).catch(e=>setTicketError(e.message));
 useEffect(()=>{
  setMessages([]);setTickets([]);setQuestion('');setTopic('outro');last.current=null;
 },[token]);
 useEffect(()=>{
  if(!open)return;
  void load();
  const interval=window.setInterval(()=>{if(!document.hidden)void load();},20000);
  return()=>window.clearInterval(interval);
 },[open,token]);
 useEffect(()=>{if(thread.current)thread.current.scrollTop=thread.current.scrollHeight;},[messages,busy]);
 async function send(force=false){
  const payload=force ? last.current : {question:question.trim(),topic};
  if(!payload?.question||inFlight.current)return;
  inFlight.current=true;setBusy(true);setError('');
  try{
   const response=await supportRequest('/api/support/chat',token,{...payload,ticket:force});
   last.current=payload;
   setMessages(old=>[...old,...(force?[]:[{user:true,text:payload.question}]),{user:false,text:response.answer+(response.ticket?`\n\nTicket #${response.ticket.id.slice(0,8)} em análise. A resposta da equipe aparecerá em Meus tickets.`:'')}]);
   if(!force)setQuestion('');
   if(response.ticket)await load();
  }catch(e:any){setError(e.message);}
  finally{setBusy(false);inFlight.current=false;}
 }
 return <Modal isOpen={open} onClose={onClose} title="Central de suporte" subtitle="Ajuda com a sua conta iNEX" maxWidth={660}>
  <div className="support-center">
   <section aria-label="Chat com suporte">
    <div className="support-thread" ref={thread} role="log">
     <p><LifeBuoy size={15}/> Olá! Selecione o assunto e me conte o que aconteceu. Para saques e depósitos, posso consultar o seu extrato. Não envie senha nem código de autenticação.</p>
     {messages.map((m,i)=><p key={i} className={m.user?'support-own':''}>{m.text}</p>)}
     {busy&&<p>Consultando…</p>}
    </div>
    <div className="support-topics" aria-label="Assunto da conversa">{supportTopics.map(t=><button type="button" key={t} aria-pressed={t===topic} onClick={()=>setTopic(t)} disabled={busy}>{topicLabels[t]}</button>)}</div>
    <form className="support-compose" onSubmit={e=>{e.preventDefault();void send();}}>
     <textarea rows={2} maxLength={800} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Descreva o problema…" aria-label="Mensagem" disabled={busy}/>
     <button type="submit" disabled={busy||!question.trim()}><Send size={15}/> Enviar</button>
    </form>
    {error&&<p role="alert">{error}</p>}
    <div className="support-options">{messages.length>0&&<button type="button" disabled={busy} onClick={()=>void send(true)}>Encaminhar à equipe</button>}<button type="button" onClick={onTutorial}>Iniciar tutorial opcional <ChevronRight size={15}/></button></div>
   </section>
   <details className="support-history"><summary>Meus tickets ({tickets.length})</summary><button type="button" onClick={()=>void load()}>Atualizar tickets</button>{ticketError&&<p role="alert">{ticketError}</p>}
    {!tickets.length&&!ticketError&&<p>Nenhum ticket aberto por você.</p>}
    {tickets.map(t=><article key={t.id}><strong>#{t.id.slice(0,8)} · {topicLabels[t.topic]}</strong><small>{ticketLabels[t.status]}</small><p>{t.question}</p>{t.reply&&<p className="support-reply">{t.reply}</p>}</article>)}
   </details>
  </div>
 </Modal>;
}

type GuideStep=typeof accountGuide[number];
export function SupportTour({steps=accountGuide,onClose,onStep}:{steps?:GuideStep[];onClose:()=>void;onStep?:(key:string)=>void}){
 const [index,setIndex]=useState(0),[mark,setMark]=useState<{top:number;left:number;width:number;height:number;bottom:number}|null>(null);
 const panel=useRef<HTMLDivElement>(null);
 const close=useRef(onClose);close.current=onClose;
 const navigate=useRef(onStep);navigate.current=onStep;
 const step=steps[index];
 useEffect(()=>{
  const previous=document.activeElement;
  panel.current?.focus({preventScroll:true});
  return()=>{if(previous instanceof HTMLElement && previous.isConnected)previous.focus({preventScroll:true});};
 },[]);
 useLayoutEffect(()=>{
  if(!step)return;
  let target:HTMLElement|null=null;
  const sync=()=>{
   target=Array.from(document.querySelectorAll<HTMLElement>('[data-support-step]')).find(el=>el.dataset.supportStep===step.key&&el.getClientRects().length>0&&((r)=>r.width>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth)(el.getBoundingClientRect()))||null;
   const rect=target?.getBoundingClientRect();
   if(!rect||rect.bottom<=0||rect.top>=innerHeight||rect.right<=0||rect.left>=innerWidth){setMark(null);return;}
   setMark({top:rect.top-4,left:rect.left-4,width:rect.width+8,height:rect.height+8,bottom:rect.bottom+4});
  };
  const frame=requestAnimationFrame(()=>{
   sync();
   const matches=Array.from(document.querySelectorAll<HTMLElement>('.inex-more [data-support-step]'));
   matches.find(el=>el.dataset.supportStep===step.key)?.scrollIntoView({block:'nearest',inline:'nearest'});
  });const later=window.setTimeout(sync,320);
  window.addEventListener('resize',sync);window.addEventListener('scroll',sync,true);
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close.current();}
   if(event.key!=='Tab')return;
   const buttons=Array.from<HTMLElement>(panel.current?.querySelectorAll('button:not(:disabled)')||[]);
   if(!buttons.length)return;
   const i=buttons.indexOf(document.activeElement as HTMLElement);
   if(i<0||(event.shiftKey?i===0:i===buttons.length-1)){event.preventDefault();buttons[event.shiftKey?buttons.length-1:0].focus();}
  };
  document.addEventListener('keydown',key);
  return()=>{cancelAnimationFrame(frame);clearTimeout(later);window.removeEventListener('resize',sync);window.removeEventListener('scroll',sync,true);document.removeEventListener('keydown',key);};
 },[step]);
 if(!step)return null;
 const next=(i:number)=>{setIndex(i);navigate.current?.(steps[i].key);};
 return createPortal(<div className="support-tour">{mark?<div className="support-spot" style={mark}/>:<div className="support-shade"/>}
  <div className={'support-tour-card'+(mark&&mark.bottom>innerHeight*.55?' support-tour-top':'')} role="dialog" aria-modal="true" aria-label="Tutorial opcional" tabIndex={-1} ref={panel}>
   <header><span>PASSO {index+1} DE {steps.length}</span><button type="button" onClick={onClose} aria-label="Fechar tutorial"><X size={18}/></button></header>
   <h2>{step.label}</h2><p>{step.text}</p>
   <footer><button type="button" disabled={index===0} onClick={()=>next(index-1)}><ChevronLeft size={16}/> Voltar</button><button type="button" onClick={()=>index+1===steps.length?onClose():next(index+1)}>{index+1===steps.length?'Concluir':'Próximo'} <ChevronRight size={16}/></button></footer>
  </div>
 </div>,document.body);
}
