import React, {useEffect, useState} from 'react';
import {Modal} from './Modal';
import {UserPlus, CheckCircle2, Users, TrendingUp, Send, ArrowDownLeft, MousePointer2} from 'lucide-react';
import type {IndicationItem} from '../types';

type Clicks = {total:number; days:{date:string;count:number}[]};
type Metrics = {registrations:number; ftds:number; influencers:number; conversion:number; deposits:number; rows:IndicationItem[]};
const money = (value:number|undefined) => (value ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const number = new Intl.NumberFormat('pt-BR');
const dayLabel = (date:string) => date.slice(8,10) + '/' + date.slice(5,7);

export function GameMetricsSheet({game,gameId,authToken,metrics,onClose,onShare}:{
  game:{title:string;image:string}; gameId:string; authToken?:string|null; metrics:Metrics|null; onClose:()=>void; onShare:()=>void;
}) {
  const [clicks,setClicks] = useState<Clicks|null>(null);
  const [failed,setFailed] = useState(false);
  const [reload,setReload] = useState(0);
  useEffect(() => {
    if (!authToken) { setFailed(true); return; }
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(() => controller.abort(),10000);
    setClicks(null);
    setFailed(false);
    fetch('/api/affiliates/game-clicks?' + new URLSearchParams({game:gameId}), {
      headers:{Authorization:`Bearer ${authToken}`}, signal:controller.signal,
    }).then(async res => {
      if (!res.ok) throw new Error('clicks_unavailable');
      const result:Clicks = await res.json();
      if (!disposed) setClicks(result);
    }).catch(() => { if (!disposed) setFailed(true); }).finally(() => clearTimeout(timer));
    return () => { disposed = true; clearTimeout(timer); controller.abort(); };
  },[authToken,gameId,reload]);

  const sum = clicks?.days.reduce((total,day)=>total+day.count,0) ?? 0;
  const peak = Math.max(1,...(clicks?.days.map(day=>day.count) ?? []));
  const cards = metrics ? [
    {label:'Cadastros na rede',value:metrics.registrations,Icon:UserPlus},
    {label:'Primeiros depósitos',value:metrics.ftds,Icon:CheckCircle2},
    {label:'Influenciadores',value:metrics.influencers,Icon:Users},
    {label:'Cadastro → depósito',value:metrics.conversion.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%',Icon:TrendingUp},
  ] : [];
  return <Modal isOpen onClose={onClose} title="Desempenho do jogo" maxWidth={580}>
    <div className="inex-game-metrics">
      <div className="gm-identity"><img src={game.image} alt=""/><div><span>SUAS INDICAÇÕES</span><h2>{game.title}</h2><p>Acompanhe os resultados da sua rede neste jogo.</p></div></div>
      <section className="gm-clicks" aria-labelledby="gm-click-title">
        <h3 id="gm-click-title"><MousePointer2 size={16}/> Cliques no link</h3>
        {failed ? <div role="status"><p>Não foi possível carregar os cliques.</p><button type="button" onClick={()=>setReload(value=>value+1)}>Tentar novamente</button></div>
          : !clicks ? <p role="status">Carregando cliques…</p>
          : <>
            <div className="gm-click-totals"><div><strong>{number.format(sum)}</strong><small>Últimos 30 dias</small></div><div><strong>{number.format(clicks.total)}</strong><small>Desde o início do registro</small></div></div>
            {sum > 0 ? <>
              <div className="gm-click-chart" aria-hidden="true">{clicks.days.map(day=><i key={day.date} title={`${dayLabel(day.date)}: ${day.count} cliques`} style={{height:`${Math.max(3,100*day.count/peak)}%`}}/>)}</div>
              <div className="gm-click-dates"><span>{dayLabel(clicks.days[0].date)}</span><span>{dayLabel(clicks.days[clicks.days.length-1].date)}</span></div>
              <details className="gm-click-daily"><summary>Ver cliques por dia (UTC)</summary><ul>{[...clicks.days].reverse().map(day=><li key={day.date}><time dateTime={day.date}>{dayLabel(day.date)}</time><span>{number.format(day.count)}</span></li>)}</ul></details>
            </> : <p>Nenhum clique registrado nos últimos 30 dias.</p>}
          </>}
        <p className="gm-click-note">Os cliques começam a contar com os novos links copiados aqui. Reaberturas no mesmo navegador em até 30 minutos não contam novamente se os cookies estiverem ativos.</p>
      </section>
      {metrics ? <>
        <div className="gm-deposits"><span><ArrowDownLeft size={15}/>Depósitos confirmados</span><strong>{money(metrics.deposits)}</strong><small>Volume da rede atribuída ao jogo de cadastro</small></div>
        <div className="gm-stat-grid">{cards.map(({label,value,Icon})=><article key={label}><Icon size={16}/><strong>{value}</strong><span>{label}</span></article>)}</div>
        <section className="gm-activity"><header><h3>Atividade da rede</h3><span>{metrics.rows.length} registros</span></header>{metrics.rows.length?<div className="gm-activity-list">{metrics.rows.slice(0,20).map(item=><article key={item.id}><i>{item.referredName?.charAt(0)||'A'}</i><div><strong>{item.referredName||'Indicação'}</strong><small>{item.isInfluencer?'Influenciador':'Jogador'}</small></div><b>{money(item.isInfluencer?item.subNetworkDeposits:item.totalDeposited)}</b></article>)}</div>:<p className="gm-empty">Ainda não há indicações para este jogo.</p>}</section>
      </> : <p className="gm-empty">Os dados da sua rede ainda não estão disponíveis.</p>}
      <footer className="gm-footer"><button type="button" onClick={onShare}><Send size={15}/>Copiar link de indicação</button></footer>
    </div>
  </Modal>;
}
