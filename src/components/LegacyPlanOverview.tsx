import {useId,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,Gamepad2,Headphones,TrendingUp} from 'lucide-react';
import {findAffiliatePlan,planDifference} from '../../shared/affiliatePlans';
import {Modal} from './Modal';
import './affiliate-plans.css';
import './legacy-plan-overview.css';

const alliance=findAffiliatePlan('alliance')!,escale=findAffiliatePlan('escale')!;
const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const features=[
 {icon:TrendingUp,title:'85% de comissão padrão',detail:'10 pontos percentuais acima do Alliance na mesma base elegível.'},
 {icon:Gamepad2,title:'Catálogo completo',detail:'Acesso aos jogos atuais e aos novos lançamentos.'},
 {icon:Headphones,title:'Atendimento humano prioritário',detail:'Seus chamados entram na fila com prioridade Escale.'},
];

export function LegacyPlanOverview({onBack}:{onBack:()=>void}){
 const [base,setBase]=useState(1000);
 const [details,setDetails]=useState(false);
 const slider=useId();
 const current=Math.floor(base*100*alliance.commissionPercent/100)/100;
 const next=Math.floor(base*100*escale.commissionPercent/100)/100;
 return <main className="affiliate-plans legacy-plan">
   <div className="plan-top"><strong>iNEX / Meu plano</strong><button type="button" onClick={onBack}><ArrowLeft size={16}/> Mais</button></div>
   <header className="legacy-intro"><span className="plan-kicker">AFILIADOS / PLANOS</span><h1>Meu plano</h1></header>
   <article className="legacy-current-line">
     <span className="legacy-section-icon"><Check size={17}/></span>
     <div><h2>{alliance.name}</h2><p>Plano atual · acesso incluído</p></div>
     <strong>{alliance.commissionPercent}%</strong>
   </article>
   <article className="legacy-hero">
     <div className="legacy-hero-copy">
       <span className="legacy-hero-label">UPGRADE DISPONÍVEL PARA COMPARAÇÃO</span>
       <h2>{escale.name}</h2><p>Mais jogos e atendimento humano prioritário.</p>
     </div>
     <div className="legacy-gauge" aria-label="85% de comissão padrão">
       <svg viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="56" r="49" className="legacy-gauge-track"/><circle cx="56" cy="56" r="49" pathLength="100" className="legacy-gauge-fill"/></svg>
       <strong>{escale.commissionPercent}%</strong>
     </div>
     <div className="legacy-hero-footer">
       <button type="button" className="plan-upgrade" onClick={()=>setDetails(true)}>Explorar Escale <ArrowUpRight size={17}/></button>
       <span>+10 pontos percentuais na taxa padrão</span>
     </div>
   </article>
   <section className="legacy-simulator" aria-labelledby="legacy-simulator-title">
     <div className="legacy-section-icon"><TrendingUp size={20}/></div>
     <div><h2 id="legacy-simulator-title">Compare a comissão</h2><p>Use uma base hipotética para comparar as taxas padrão.</p></div>
     <label htmlFor={slider}>Base elegível simulada <strong>{brl.format(base)}</strong></label>
     <input type="range" id={slider} min={100} max={10000} step={100} value={base} aria-valuetext={brl.format(base)} onChange={e=>setBase(Number(e.currentTarget.value))}/>
     <div className="legacy-presets" aria-label="Valores rápidos">{[1000,3000,5000].map(value=><button type="button" key={value} aria-pressed={base===value} onClick={()=>setBase(value)}>{brl.format(value)}</button>)}</div>
     <dl><div><dt>Alliance · 75%</dt><dd>{brl.format(current)}</dd><span className="legacy-meter legacy-meter-alliance" aria-hidden="true"/> </div><div><dt>Escale · 85%</dt><dd>{brl.format(next)}</dd><span className="legacy-meter legacy-meter-escale" aria-hidden="true"/></div><div className="legacy-delta"><dt>Diferença estimada</dt><dd aria-live="polite"><span key={base}>+{brl.format(next-current)}</span></dd></div></dl>
     <p className="legacy-note">Simulação bruta antes de eventuais divisões. Taxas personalizadas e valores reais podem variar.</p>
   </section>
   <section className="legacy-perks" aria-labelledby="escale-perks"><h2 id="escale-perks">O que muda no Escale</h2>
    <div>{features.map(({icon:Icon,title,detail})=><article key={title}><div className="legacy-section-icon"><Icon size={19}/></div><div><h3>{title}</h3><p>{detail}</p></div></article>)}</div>
   </section>
   <Modal isOpen={details} onClose={()=>setDetails(false)} title="Upgrade para Escale">
    <div className="legacy-upgrade-detail">
      <div className="legacy-modal-rate"><span>Comissão padrão</span><strong>75% <ArrowUpRight size={21} aria-hidden="true"/> <b>85%</b></strong></div>
      <ul>{features.slice(1).map(({icon:Icon,title})=><li key={title}><Icon size={17}/>{title}</li>)}</ul>
      <div className="legacy-modal-price"><span>Diferença entre os preços de tabela</span><strong>{brl.format(planDifference('escale','alliance')/100)}</strong></div>
      <p role="status">Checkout ainda indisponível. Seu Alliance segue ativo.</p>
      <button type="button" className="plan-upgrade" onClick={()=>setDetails(false)}>Voltar à comparação <ArrowLeft size={16}/></button>
    </div>
   </Modal>
 </main>;
}
