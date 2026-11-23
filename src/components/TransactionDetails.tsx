import React, {useState} from 'react';
import {Bookmark, CheckCircle2, Copy, Download} from 'lucide-react';
import './transaction-details.css';

export const brl = (value:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);

export function TransactionDetails({id,amount,title,status,createdAt,fields=[],receipt=false,marked,onMark}:{
 id:string; amount:number; title:string; status:string; createdAt:string;
 fields?:{label:string;value:string}[]; receipt?:boolean; marked?:boolean; onMark?:()=>Promise<void>;
}) {
 const [feedback,setFeedback]=useState('');
 const [saving,setSaving]=useState(false);
 const date=new Date(createdAt);
 const dateText=Number.isFinite(date.getTime())?date.toLocaleString('pt-BR'):'Não informada';
 const rows=[{label:'Data e hora',value:dateText},...fields,{label:'Identificador',value:id}];
 const receiptText=['iNEX · Comprovante interno PIS IO',title,'Valor: '+brl(amount),'Status: '+status,...rows.map(row=>row.label+': '+row.value),'','Transferência interna entre contas iNEX.'].join('\n');
 const download=()=>{
  const url=URL.createObjectURL(new Blob([receiptText],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='comprovante-pis-io-'+id.slice(0,12)+'.txt';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 };
 return <div className="inex-tx-detail">
  <div className="inex-tx-total"><span>{title}</span><strong>{brl(amount)}</strong><small>{receipt&&<CheckCircle2 size={14}/>} {status}</small></div>
  <dl>{rows.map(({label,value})=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  {receipt&&<p className="inex-tx-note">Comprovante interno de transferência entre contas iNEX.</p>}
  <div className="inex-tx-actions">
   <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(receipt?receiptText:id);setFeedback('Copiado.');}catch{setFeedback('Não foi possível copiar. Você pode selecionar o texto acima.');}}}><Copy size={15}/>{receipt?'Copiar comprovante':'Copiar ID'}</button>
   {receipt&&<button type="button" onClick={download}><Download size={15}/>Baixar comprovante</button>}
   {onMark&&<button type="button" aria-pressed={Boolean(marked)} disabled={saving} onClick={async()=>{setSaving(true);setFeedback('');try{await onMark();setFeedback(marked?'Marcação removida.':'Marcado com comprovante.');}catch(e){setFeedback(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setSaving(false);}}}><Bookmark size={15}/>{marked?'Remover marcação':'Marcar com comprovante'}</button>}
  </div>
  <p role="status" className="inex-tx-feedback">{feedback}</p>
 </div>;
}
