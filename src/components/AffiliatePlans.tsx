import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,CreditCard,Gamepad2} from 'lucide-react';
import QRCode from 'qrcode';
import {affiliatePlans,planDifference,planGames,type AffiliatePlanId} from '../../shared/affiliatePlans';
import {requestJson} from '../lib/requestJson';
import {Modal} from './Modal';
import './affiliate-plans.css';

export type PlanAccount={required:boolean;planId:AffiliatePlanId|null;games:string[];order?:{planId:AffiliatePlanId;games?:string[];qrcode?:string;cents:number;expiresAt?:string|null}};
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function AffiliatePlans({token,account,reload,onBack,onExit}:{token:string;account:PlanAccount;reload:()=>Promise<void>;onBack?:()=>void;onExit:()=>void}){
 const [selected,setSelected]=useState<string[]>(account.games);
 const [target,setTarget]=useState<AffiliatePlanId>(account.order?.planId??account.planId??'starter');
 const [upgrade,setUpgrade]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [copy,setCopy]=useState(false);
 const order=account.order;
 const [qr,setQr]=useState('');
 useEffect(()=>{let active=true;setQr('');if(order?.qrcode)void QRCode.toDataURL(order.qrcode,{width:184,margin:2}).then(url=>{if(active)setQr(url);}).catch(()=>{});return()=>{active=false;};},[order?.qrcode]);
 useEffect(()=>{
  if(!order)return;
  const id=window.setInterval(()=>{if(!document.hidden)void reload().catch(()=>{});},5000);
  return()=>clearInterval(id);
 },[Boolean(order),reload]);
 const changeGame=(id:string)=>{
  if(selected.includes(id)){setSelected(selected.filter(x=>x!==id));return;}
  if(selected.length===3){setUpgrade(true);return;}
  setSelected([...selected,id]);
 };
 const checkout=async()=>{
  setBusy(true);setError('');
  try{
   await requestJson('/api/affiliate-plans/checkout',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({planId:order?.planId??target,games:order?.games??(target==='starter'?selected:[])})});
   await reload();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar o PIX.');void reload().catch(()=>{});}
  finally{setBusy(false);}
 };
 const difference=planDifference(target,account.planId??undefined);
 return <section className="affiliate-plans">
  <div className="plan-top"><strong>iNEX / Afiliados</strong><button type="button" onClick={onBack??onExit}><ArrowLeft size={15}/>{onBack?'Voltar':'Sair'}</button></div>
  <header><span className="plan-kicker">PAGAMENTO ÚNICO</span><h1>{account.planId?'Seu plano de afiliado':'Escolha seu plano de afiliado'}</h1><p>Selecione o plano e pague via PIX. A liberação acontece após a confirmação do Pixup.</p></header>
  <div className="plan-grid">
   {affiliatePlans.map(p=><button type="button" key={p.id} className="plan-card" aria-pressed={target===p.id} disabled={!!order||busy||planDifference(p.id,account.planId??undefined)<0} onClick={()=>{setTarget(p.id);setError('');}}><span>{p.name}{p.id===account.planId&&<small>Plano atual</small>}</span><strong>{money(p.priceCents)}</strong><b>{p.commissionPercent}% de comissão</b><ul>{p.benefits.map(b=><li key={b}><Check size={15}/>{b}</li>)}</ul></button>)}
  </div>
  {target==='starter'&&!order&&<div className="plan-selection"><h2><Gamepad2 size={20}/> Escolha até 3 jogos <small>{selected.length}/3</small></h2><p>Esta seleção define os jogos que você poderá indicar no Starter.</p><div>{planGames.map(g=><button type="button" key={g.id} aria-pressed={selected.includes(g.id)} onClick={()=>changeGame(g.id)}>{g.name}{selected.includes(g.id)&&<Check size={15}/>}</button>)}</div></div>}
  {order?.qrcode?<div className="plan-payment" aria-live="polite"><CreditCard size={22}/><h2>PIX aguardando confirmação</h2><strong>{money(order.cents)}</strong>{qr&&<img src={qr} width={184} height={184} alt="QR Code do pagamento PIX"/>}<button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(order.qrcode!);setCopy(true);}catch{setError('Selecione e copie o código abaixo.');}}}>{copy?'Código copiado':'Copiar código PIX'}</button><input aria-label="Código PIX" readOnly value={order.qrcode} onFocus={e=>e.target.select()}/><button type="button" onClick={()=>void reload().catch(e=>setError(e.message))}>Verificar pagamento</button></div>
    : difference>0||order?<div className="plan-action"><button type="button" disabled={busy||(!order&&target==='starter'&&!selected.length)} onClick={()=>void checkout()}>{busy?'Gerando PIX…':order?'Retomar PIX':`Pagar ${money(difference)} via PIX`} <ArrowUpRight size={17}/></button></div>:null}
  {error&&<p role="alert" className="plan-error">{error}</p>}
  <Modal isOpen={upgrade} onClose={()=>setUpgrade(false)} title="Adicione mais jogos"><p>O Starter inclui até três jogos. O Alliance libera os cinco jogos atuais e oferece 75% de comissão.</p><p>{account.planId==='starter'?'Pague só a diferença: '+money(planDifference('alliance','starter'))+'.':'Escolha o Alliance por '+money(12700)+'. São '+money(planDifference('alliance','starter'))+' a mais que o Starter.'}</p><button type="button" className="plan-upgrade" onClick={()=>{setTarget('alliance');setUpgrade(false);}}>Escolher Alliance <ArrowUpRight size={16}/></button></Modal>
 </section>;
}
