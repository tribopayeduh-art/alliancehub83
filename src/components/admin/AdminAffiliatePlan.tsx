import {useEffect,useState} from 'react';
import {affiliatePlans,planGames,type AffiliatePlanId} from '../../../shared/affiliatePlans';
import {requestJson} from '../../lib/requestJson';

type State={planId:AffiliatePlanId|null;games:string[]};
export function AdminAffiliatePlan({userId,token,onSaved}:{userId:string;token:string;onSaved?:()=>void}){
 const [saved,setSaved]=useState<State|null>(null),[plan,setPlan]=useState<AffiliatePlanId>('alliance'),[games,setGames]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const route='/api/admin/affiliate-plans/'+encodeURIComponent(userId);
 useEffect(()=>{
  let active=true;const abort=new AbortController();
  setSaved(null);setError('');setMessage('');
  requestJson(route,{signal:abort.signal,headers:{Authorization:'Bearer '+token}}).then((r:State)=>{if(active){setSaved(r);setPlan(r.planId??'alliance');setGames(r.games);}}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;abort.abort();};
 },[route,token]);
 const save=async()=>{
  if(!saved||busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const next=await requestJson(route,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({planId:plan,games:plan==='starter'?games:[],expected:saved.planId})});
   setSaved(next);setMessage('Plano atualizado. Nenhuma cobrança foi gerada.');onSaved?.();
  }catch(e:any){setError(e.message);}finally{setBusy(false);}
 };
 const changed=saved&&(saved.planId!==plan||plan==='starter'&&JSON.stringify(saved.games)!==JSON.stringify(games));
 return <section className="mb-4 space-y-3 rounded-xl border border-slate-200 p-3" aria-label="Plano do afiliado">
  <header><h3 className="font-semibold">Plano do afiliado</h3><p className="text-xs text-slate-600">Alteração manual de acesso e das próximas comissões, sem cobrança.</p></header>
  {saved?<><label className="block text-sm">Plano<select className="mt-1 block w-full rounded-md border border-slate-300 p-2" value={plan} disabled={busy} onChange={e=>setPlan(e.target.value as AffiliatePlanId)}>{affiliatePlans.map(p=><option key={p.id} value={p.id}>{p.name} · {p.commissionPercent}%</option>)}</select></label>
  {plan==='starter'&&<fieldset disabled={busy}><legend className="text-sm">Escolha de 1 a 3 jogos ({games.length}/3)</legend>{planGames.map(g=><label className="mr-3 inline-flex items-center gap-1 py-1 text-sm" key={g.id}><input type="checkbox" checked={games.includes(g.id)} disabled={!games.includes(g.id)&&games.length>=3} onChange={e=>setGames(list=>e.target.checked?[...list,g.id]:list.filter(id=>id!==g.id))}/>{g.name}</label>)}</fieldset>}
  <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={!changed||busy||plan==='starter'&&!games.length} onClick={()=>void save()}>{busy?'Salvando…':'Aplicar plano'}</button></>:!error&&<p role="status" className="text-sm">Consultando plano…</p>}
  {message&&<p role="status" className="text-sm">{message}</p>}{error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
 </section>;
}
