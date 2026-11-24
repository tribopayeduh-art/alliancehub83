import {useId,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,Gamepad2,Headphones,Sparkles,TrendingUp} from 'lucide-react';
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
   <header><span className="plan-kicker">CENTRAL DE PLANOS</span><h1>Meu plano</h1><p>Confira seu acesso e compare as opções para sua operação.</p></header>
   <div className="legacy-tier-grid">
    <article className="legacy-tier">
     <span className="legacy-tag"><Check size={14}/> Plano atual</span><h2>{alliance.name}</h2>
     <strong>{alliance.commissionPercent}% <small>comissão padrão</small></strong>
     <p>Seu acesso está incluído, sem novo pagamento.</p>
    </article>
    <article className="legacy-tier legacy-premium">
     <span className="legacy-tag"><Sparkles size={14}/> Próximo nível</span><h2>{escale.name}</h2>
     <strong>{escale.commissionPercent}% <small>comissão padrão</small></strong>
     <p>Mais jogos e atendimento prioritário.</p>
     <button type="button" className="plan-upgrade" onClick={()=>setDetails(true)}>Conhecer o Escale <ArrowUpRight size={17}/></button>
    </article>
   </div>
   <section className="legacy-simulator" aria-labelledby="legacy-simulator-title">
     <div className="legacy-section-icon"><TrendingUp size={20}/></div>
     <div><h2 id="legacy-simulator-title">Compare a comissão</h2><p>Use uma base hipotética para comparar as taxas padrão.</p></div>
     <label htmlFor={slider}>Base elegível simulada <strong>{brl.format(base)}</strong></label>
     <input type="range" id={slider} min={100} max={10000} step={100} value={base} aria-valuetext={brl.format(base)} onChange={e=>setBase(Number(e.currentTarget.value))}/>
     <dl><div><dt>Alliance · 75%</dt><dd>{brl.format(current)}</dd></div><div><dt>Escale · 85%</dt><dd>{brl.format(next)}</dd></div><div className="legacy-delta"><dt>Diferença estimada</dt><dd>+{brl.format(next-current)}</dd></div></dl>
     <p className="legacy-note">Simulação bruta antes de eventuais divisões. Taxas personalizadas e valores reais podem variar.</p>
   </section>
   <section className="legacy-perks" aria-labelledby="escale-perks"><h2 id="escale-perks">O que muda no Escale</h2>
    <div>{features.map(({icon:Icon,title,detail})=><article key={title}><div className="legacy-section-icon"><Icon size={19}/></div><div><h3>{title}</h3><p>{detail}</p></div></article>)}</div>
   </section>
   <Modal isOpen={details} onClose={()=>setDetails(false)} title="Upgrade para Escale">
    <div className="legacy-upgrade-detail"><Sparkles size={24}/><h3>{escale.commissionPercent}% de comissão padrão</h3><p>A diferença entre os preços de tabela do Alliance e do Escale é de <strong>{brl.format(planDifference('escale','alliance')/100)}</strong>.</p>
    <p role="status">O checkout do upgrade ainda não está disponível. Seu acesso atual permanece ativo.</p><button type="button" className="plan-upgrade" onClick={()=>setDetails(false)}>Voltar à comparação</button></div>
   </Modal>
 </main>;
}
