import { ArrowRight, BarChart3, Link2, Wallet, LayoutDashboard, ChevronDown } from 'lucide-react';
import logo from './components/inex-logo.svg';
import './styles/alliance-landing.css';

const features = [
  { icon: Link2, title: 'Links de indicação', body: 'Encontre seus links em um só lugar e compartilhe cada indicação pelo canal que você usa.' },
  { icon: BarChart3, title: 'Desempenho da rede', body: 'Acompanhe cadastros, atividade e resultados das suas indicações no painel.' },
  { icon: Wallet, title: 'Comissões e carteira', body: 'Consulte suas comissões, revise o histórico e acompanhe suas solicitações de saque.' },
];

export default function AllianceLanding() {
  const query = window.location.search;
  return <div className="alliance-public">
    <header className="ah-top ah-wrap">
      <a href="/" aria-label="iNEX — início"><img src={logo} alt="iNEX" width="82" height="34"/></a>
      <nav aria-label="Navegação principal"><a href="#recursos">Recursos</a><a href="#como-funciona">Como funciona</a></nav>
      <a className="ah-button ah-outline" href="/login">Entrar <ArrowRight size={16}/></a>
    </header>
    <main>
      <section className="ah-hero ah-wrap">
        <div><p className="ah-kicker">ALLIANCE HUB · PORTAL DE AFILIADOS</p>
          <h1>Sua rede de afiliados.<br/>Tudo sob controle.</h1>
          <p className="ah-lead">Acompanhe indicações, resultados e comissões no painel iNEX, do primeiro link até a gestão da sua carteira.</p>
          <div className="ah-actions"><a className="ah-button" href={'/cadastro'+query}>Criar minha conta <ArrowRight size={18}/></a><a className="ah-button ah-outline" href="/painel">Acessar painel</a></div>
        </div>
        <aside className="ah-preview" aria-label="Prévia ilustrativa do painel">
          <div className="ah-preview-title"><LayoutDashboard size={21}/><div><strong>Visão geral</strong><small>Prévia do painel</small></div></div>
          {features.map(({icon:Icon,title},i)=><div className="ah-row" key={title}><Icon size={21}/><span>{title}</span><small>0{i+1}</small></div>)}
        </aside>
      </section>
      <section className="ah-wrap ah-section" id="recursos"><p className="ah-kicker">RECURSOS</p><h2>O que você encontra no painel</h2><div className="ah-grid">{features.map(({icon:Icon,title,body})=><article key={title}><Icon size={24}/><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="ah-wrap ah-section" id="como-funciona"><p className="ah-kicker">PRIMEIROS PASSOS</p><h2>Do cadastro à primeira indicação</h2><div className="ah-grid ah-steps">{['Crie sua conta','Copie seu link de indicação','Acompanhe sua rede no painel'].map((step,i)=><div key={step}><span>0{i+1}</span><h3>{step}</h3></div>)}</div></section>
      <section className="ah-wrap ah-section"><h2>Perguntas frequentes</h2><div className="ah-faq">
        <details><summary>Já tenho conta. Por onde entro?<ChevronDown size={18}/></summary><p>Acesse <a href="/login">/login</a> com seus dados para entrar no painel.</p></details>
        <details><summary>Onde vejo minhas comissões?<ChevronDown size={18}/></summary><p>Após entrar, consulte a área financeira e o histórico da sua carteira.</p></details>
      </div></section>
      <section className="ah-wrap ah-section"><div className="ah-cta"><h2>Comece a organizar suas indicações.</h2><a className="ah-button" href={'/cadastro'+query}>Criar conta <ArrowRight size={18}/></a></div></section>
    </main>
    <footer className="ah-wrap ah-footer"><span>iNEX · Alliance Hub</span><a href="/login">Login</a><a href={'/cadastro'+query}>Cadastro</a></footer>
  </div>;
}
