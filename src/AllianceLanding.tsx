import { useId, useState } from 'react';
import { ArrowRight, BarChart3, Link2, Wallet, LayoutDashboard, ChevronDown, Check, Bell, MousePointer2, TrendingUp } from 'lucide-react';
import { affiliatePlans } from '../shared/affiliatePlans';
import logo from './components/inex-logo.svg';
import './styles/alliance-landing.css';

const features = [
  { icon: Link2, title: 'Links de indicação', body: 'Encontre seus links em um só lugar e compartilhe cada indicação pelo canal que você usa.' },
  { icon: BarChart3, title: 'Desempenho da rede', body: 'Acompanhe cadastros, atividade e resultados das suas indicações no painel.' },
  { icon: Wallet, title: 'Comissões e carteira', body: 'Consulte suas comissões, revise o histórico e acompanhe suas solicitações de saque.' },
];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const bars = [25, 39, 32, 54, 47, 65, 57, 78, 73, 88, 80, 100];

const views = [
  { name:'Atividade', label:'Cliques', value:'1.248', second:'Indicações', count:'86', chart:'Atividade da rede', notice:'Nova indicação registrada', values:bars },
  { name:'Campanhas', label:'Links criados', value:'12', second:'Campanhas ativas', count:'4', chart:'Acessos por campanha', notice:'Novo acesso por indicação', values:[46,22,62,42,77,53,38,67,89,66,96,85] },
  { name:'Carteira', label:'Comissões', value:'R$ 740', second:'Lançamentos', count:'16', chart:'Histórico de comissões', notice:'Comissão registrada', values:[20,37,58,30,49,68,62,71,50,81,66,94] },
];
const steps = [
  ['Crie sua conta','Veja os planos e finalize seu cadastro.'],
  ['Compartilhe seu link','Use o link de indicação do painel para identificar seus acessos.'],
  ['Acompanhe sua rede','Consulte o desempenho das indicações e as comissões registradas.'],
];
export default function AllianceLanding() {
  const [viewIndex, setViewIndex] = useState(0);
  const [base, setBase] = useState(1000);
  const inputId = useId();
  const view = views[viewIndex];
  const query = window.location.search;
  return <div className="alliance-public">
    <header className="ah-top ah-wrap">
      <a href="/" aria-label="iNEX — início"><img src={logo} alt="iNEX" width="82" height="34"/></a>
      <nav aria-label="Navegação principal"><a href="#recursos">Recursos</a><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a></nav>
      <a className="ah-button ah-outline" href="/login">Entrar <ArrowRight size={16}/></a>
    </header>
    <main>
      <section className="ah-hero ah-wrap">
        <div className="ah-hero-copy"><p className="ah-kicker">ALLIANCE HUB · PORTAL DE AFILIADOS</p>
          <h1>Sua rede de afiliados.<br/><span>Tudo sob controle.</span></h1>
          <p className="ah-lead">Acompanhe indicações, resultados e comissões no painel iNEX, do primeiro link até a gestão da sua carteira.</p>
          <div className="ah-actions"><a className="ah-button" href={'/cadastro'+query}>Criar minha conta <ArrowRight size={18}/></a><a className="ah-button ah-outline" href="/painel">Acessar painel</a></div>
        </div>
        <div className="ah-product">
          <div className="ah-orbit" aria-hidden="true"><i/><i/><i/></div>
          <aside className="ah-preview" aria-label="Mockup do painel com dados ilustrativos">
            <div className="ah-preview-title"><LayoutDashboard size={21}/><div><strong>Explore o painel</strong><small>Dados ilustrativos</small></div><span className="ah-preview-dot" aria-hidden="true"/></div>
            <div className="ah-demo-nav" role="group" aria-label="Áreas da demonstração">{views.map(({name},i)=><button type="button" key={name} aria-pressed={i===viewIndex} onClick={()=>setViewIndex(i)}>{name}</button>)}</div>
            <div className="ah-demo-body" key={view.name}>
              <div className="ah-kpis"><div><MousePointer2 size={15}/> {view.label}<strong>{view.value}</strong></div><div><TrendingUp size={15}/> {view.second}<strong>{view.count}</strong></div></div>
              <figure className="ah-chart"><figcaption>{view.chart} <span>Exemplo</span></figcaption><div className="ah-bars" aria-hidden="true">{view.values.map((value,i)=><i key={i} style={{height:value+'%',animationDelay:i*32+'ms'}}/>)}</div></figure>
            </div>
          </aside>
          <div className="ah-notice" key={view.name} aria-hidden="true"><span><Bell size={18}/></span><div><strong>{view.notice}</strong><small>Exemplo de notificação</small></div><Check size={16}/></div>
        </div>
      </section>
      <section className="ah-wrap ah-section" id="recursos"><p className="ah-kicker">RECURSOS</p><h2>O que você encontra no painel</h2><div className="ah-grid">{features.map(({icon:Icon,title,body})=><article key={title}><Icon size={24}/><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="ah-wrap ah-section" id="como-funciona"><p className="ah-kicker">PRIMEIROS PASSOS</p><h2>Do cadastro à primeira indicação</h2><div className="ah-grid ah-steps">{steps.map(([title,body],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{body}</p></div>)}</div></section>
      <section className="ah-wrap ah-section" id="planos"><p className="ah-kicker">PLANOS</p><h2>Escolha como quer começar</h2><p className="ah-plans-note">Compare os valores de tabela e as comissões padrão de cada plano.</p>
        <div className="ah-grid ah-plans">{affiliatePlans.map(plan=><article key={plan.id} data-plan={plan.id}>
          <div className="ah-plan-title"><h3>{plan.name}</h3><span>{plan.commissionPercent}% de comissão padrão</span></div>
          <strong className="ah-price">{brl.format(plan.priceCents/100)}</strong><small>Pagamento único</small>
          <ul>{plan.benefits.map(benefit=><li key={benefit}><Check size={16}/>{benefit}</li>)}</ul>
          <a className="ah-button ah-outline" href={'/cadastro'+query}>Ir para o cadastro <ArrowRight size={16}/></a>
        </article>)}</div>
        <div className="ah-calculator">
          <div><p className="ah-kicker">SIMULAÇÃO</p><h3>Compare a comissão</h3><p>Use a mesma base elegível para os três planos. Valores hipotéticos, antes de ajustes.</p>
            <label htmlFor={inputId}>Base elegível <strong>{brl.format(base)}</strong></label>
            <input id={inputId} type="range" min={100} max={10000} step={100} value={base} aria-valuetext={brl.format(base)} onChange={e=>setBase(Number(e.currentTarget.value))}/>
            <div className="ah-presets">{[1000,3000,5000].map(amount=><button type="button" aria-pressed={amount===base} key={amount} onClick={()=>setBase(amount)}>{brl.format(amount)}</button>)}</div>
          </div>
          <dl>{affiliatePlans.map(plan=><div key={plan.id}><dt>{plan.name} <small>{plan.commissionPercent}%</small></dt><dd>{brl.format(base*plan.commissionPercent/100)}</dd><span className="ah-commission-track" aria-hidden="true"><i style={{width:(base/10000*plan.commissionPercent)+'%'}}/></span></div>)}</dl>
        </div>
      </section>
      <section className="ah-wrap ah-section"><h2>Perguntas frequentes</h2><div className="ah-faq">
        <details><summary>Já tenho conta. Por onde entro?<ChevronDown size={18}/></summary><p>Acesse <a href="/login">/login</a> com seus dados para entrar no painel.</p></details>
        <details><summary>Onde vejo minhas comissões?<ChevronDown size={18}/></summary><p>Após entrar, consulte a área financeira e o histórico da sua carteira.</p></details>
      </div></section>
      <section className="ah-wrap ah-section"><div className="ah-cta"><h2>Comece a organizar suas indicações.</h2><a className="ah-button" href={'/cadastro'+query}>Criar conta <ArrowRight size={18}/></a></div></section>
    </main>
    <footer className="ah-wrap ah-footer"><span>iNEX · Alliance Hub</span><a href="/login">Login</a><a href={'/cadastro'+query}>Cadastro</a></footer>
  </div>;
}
