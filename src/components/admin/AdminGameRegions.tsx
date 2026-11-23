import React,{useEffect,useState} from 'react';
import {regionGames,brazilianLink} from '../../../shared/gameRegions';
import {requestJson} from '../../lib/requestJson';
type Edition={br:string;mx:string;active:boolean};
export function AdminGameRegions({token}:{token:string}){
 const [enabled,E]=useState(false),[games,G]=useState<Record<string,Edition>>({}),[ready,R]=useState(false),[busy,B]=useState(false),[msg,M]=useState(''),[error,F]=useState(false);
 const call=(method='GET',body?:any)=>requestJson('/api/admin/game-regions',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const run=async(save=false)=>{B(true);F(false);M('');try{if(save){await call('PUT',{enabled,games});M('Configurações publicadas neste ambiente.');}else{const d=await call();E(d.enabled===true);G(d.games||{});R(true);}}catch(e:any){F(true);M(e.message);}finally{B(false);}};
 useEffect(()=>{void run();},[token]);
 const update=(key:string,field:keyof Edition,value:string|boolean)=>G(old=>({...old,[key]:{br:'',mx:'',active:false,...old[key],[field]:value}}));
 return <section className="adm-surface adm-regions-dense"><form onSubmit={e=>{e.preventDefault();void run(true);}}><header className="adm-regions-header"><div><h2 className="text-lg font-semibold">Configurações por país</h2><p className="text-sm my-2">Gerencie os links dos jogos. A edição mexicana precisa de uma URL já traduzida e configurada em MXN. Os saldos em BRL permanecem separados.</p></div><button type="button" className="adm-region-control" disabled={busy} onClick={()=>run()}>Recarregar</button></header>{msg&&<p role={error?'alert':'status'} className="my-3">{msg}</p>}
 <fieldset disabled={!ready||busy} className="grid gap-3 mt-3"><div className="adm-regions-tools"><label><input type="checkbox" checked={enabled} onChange={e=>E(e.target.checked)}/> Habilitar México para jogos configurados</label>
 <a href="/mex" target="_blank" rel="noreferrer">🇲🇽 Abrir catálogo /mex</a></div>
 <div className="adm-regions-grid">
 {regionGames.map(([key,name])=>{const g=games[key];return <article key={key} className="adm-region-card"><h3 className="font-semibold">{name}</h3>
 <label className="grid gap-1">🇧🇷 Brasil · Português · BRL<input className="border rounded-lg p-2 w-full" value={g?.br||''} onChange={e=>update(key,'br',e.target.value)} placeholder={brazilianLink(key)}/></label>
 <label className="grid gap-1">🇲🇽 México · Español · MXN<input className="border rounded-lg p-2 w-full" type="url" value={g?.mx||''} onChange={e=>update(key,'mx',e.target.value)} placeholder="https://…"/></label>
 <label><input type="checkbox" checked={g?.active||false} onChange={e=>update(key,'active',e.target.checked)}/> Disponibilizar edição mexicana</label>
 <a href={'/mex/'+key} target="_blank" rel="noreferrer">Abrir /mex/{key}</a></article>;})}</div>
 <button type="submit" className="rounded-lg bg-slate-900 text-white p-3">{busy?'Aguarde…':'Salvar configurações'}</button>
 </fieldset></form></section>;
}
