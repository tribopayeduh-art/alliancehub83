import React from 'react';
import {Settings,BarChart3} from 'lucide-react';
import type {IndicationItem} from '../types';
import './affiliate-network-list.css';
const currency=(value:number|undefined)=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function origin(item:IndicationItem){
 if(item.registeredGameName||item.lastGameName)return item.registeredGameName||item.lastGameName;
 const id=(item.registeredGame||item.lastGameId||'').toLowerCase();
 if(id.includes('count'))return 'Count Masters';if(id.includes('subway'))return 'Subway Pay';if(id.includes('bubble'))return 'Bubble Blast';if(id.includes('dino'))return 'GEN DINO';if(id.includes('raspa'))return 'Raspa Fortuna';if(id.includes('block'))return 'Block Win';return 'Origem não informada';
}
export const AffiliateNetworkRow:React.FC<{item:IndicationItem;onManage:()=>void;onMetrics:()=>void}>=({item,onManage,onMetrics})=>{
 const extra=[item.partnerApproved?`Parceiro${item.partnerCode?' · '+item.partnerCode:''}`:item.partnerRequested?'Pedido de parceria':null,item.referredByInfluencerName?`Via ${item.referredByInfluencerName}`:null,item.withdrawBlocked||item.hasAffiliateDemoBalance?'Saldo dos jogos não sacável':null].filter(Boolean).join(' / ');
 return <article className="afn-row" aria-label={item.referredName||'Indicação'}>
  <div className="afn-identity"><span className="afn-avatar" aria-hidden="true">{(item.referredName||'U').slice(0,1).toUpperCase()}</span><div><button className="afn-name" onClick={onManage} title={item.referredName}>{item.referredName||'Sem nome'}</button><span className="afn-email" title={item.referredEmail}>{item.referredEmail}</span>{extra&&<span className="afn-note">{extra}</span>}</div></div>
  <div className="afn-origin"><span>{origin(item)}</span><small>{item.isInfluencer?'Influenciador':'Jogador'}{item.isInfluencer&&item.influencerRate!=null?` · ${item.influencerRate}%`:''}</small></div>
  <div className="afn-value"><small>{item.isInfluencer?'Depósitos da rede':'Depósitos'}</small><strong>{currency(item.isInfluencer?item.subNetworkDeposits:item.totalDeposited)}</strong></div>
  <div className="afn-value"><small>{item.isInfluencer?'Comissão disponível':'Saldo do jogo'}</small><strong>{currency(item.isInfluencer?item.affiliateBalance:item.referredBalance)}</strong></div>
  <div className="afn-actions">{item.isInfluencer&&<button type="button" className="afn-metrics" onClick={onMetrics} aria-label={`Ver métricas de ${item.referredName}`}><BarChart3 size={15}/><span>Métricas</span></button>}<button type="button" className="afn-manage" onClick={onManage} aria-label={`Gerenciar ${item.referredName}`}><Settings size={14}/><span>Gerenciar</span></button></div>
 </article>;
}
