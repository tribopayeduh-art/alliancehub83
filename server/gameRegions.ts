import {supabaseStore} from './supabaseStore.ts';
import {regionGames,validGameUrl,brazilianLink} from '../shared/gameRegions.ts';
const ref=supabaseStore.collection('settings').doc('game_regions');
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function fromHost(host:string){
 const h=host.toLowerCase();
 return [['bubble','bubbleblast'],['subway','subwaypay'],['dino','gen-dino'],['raspa','raspafortuna'],['block','blockwin'],['zumbla','zumbla'],['countmaster','countmasters']].find(([match])=>h.includes(match))?.[1];
}
export function registerGameRegions(app:any, requireAdmin:any, permitted:any){
 const guard=(req:any,res:any,next:any)=>permitted(req,'canManageGames')?next():res.status(403).json({error:'Sem permissão para configurar jogos.'});
 app.get('/api/admin/game-regions',requireAdmin,guard,async(_req:any,res:any)=>{try{res.set('Cache-Control','no-store').json((await ref.get()).data()||{enabled:false,games:{}});}catch{res.status(503).json({error:'Não foi possível consultar as configurações.'});}});
 app.put('/api/admin/game-regions',requireAdmin,guard,async(req:any,res:any)=>{
  const {enabled,games}=req.body||{};
  if(typeof enabled!=='boolean'||!games||typeof games!=='object'||Array.isArray(games))return res.status(400).json({error:'Configuração inválida.'});
  const clean:Record<string,{br:string;mx:string;active:boolean}>={};
  for(const [key] of regionGames){
   const g=games[key]||{}, br=g.br??'',mx=g.mx??'';
   if(typeof br!=='string'||typeof mx!=='string'||!validGameUrl(br,true)||!validGameUrl(mx)||g.active===true&&!mx)return res.status(400).json({error:'Confira os links HTTPS e a ativação de '+key+'.'});
   clean[key]={br,mx,active:g.active===true};
  }
  try{await ref.set({enabled,games:clean,updatedAt:new Date().toISOString(),updatedBy:req.userId});res.json({ok:true});}catch{res.status(503).json({error:'Não foi possível salvar as configurações.'});}
 });
 app.get(['/mex','/mex/:game'],async(req:any,res:any)=>{
  const id=req.params.game||fromHost(req.hostname), selected=regionGames.find(([key])=>key===id);
  if(id&&!selected)return res.status(404).send('Juego no encontrado.');
  let config:any={};
  try{config=(await ref.get()).data()||{};}catch{res.status(503);}
  const rows=(selected?[selected]:regionGames).map(([key,name])=>{
   const g=config.games?.[key],on=config.enabled&&g?.active&&validGameUrl(g.mx)&&g.mx;
   const br=typeof g?.br==='string'&&validGameUrl(g.br,true)&&g.br?g.br:brazilianLink(key);
   return '<article><h2>'+escape(name)+'</h2><p>🇲🇽 Español de México · MXN</p>'+(selected?(on?'<a class="primary" href="'+escape(g.mx)+'">Abrir edición mexicana</a>':'<p>La edición mexicana todavía no está disponible.</p>'):'<a class="primary" href="/mex/'+key+'">Ver edición mexicana</a>')+' <a href="'+escape(br)+'">🇧🇷 Português</a></article>';
  }).join('');
  res.set('Cache-Control','no-store').type('html').send('<!doctype html><html lang="es-MX"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Juegos · México</title><style>body{margin:0;background:#f5f7fa;color:#172233;font:16px system-ui}main{max-width:1056px;margin:auto;padding:40px 20px}header{margin-bottom:26px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:16px}article{background:white;padding:22px;border:1px solid #dee4ec;border-radius:16px}h2{margin:0;font-size:19px}p{color:#4b5a6d}a{display:inline-block;padding:11px 13px;margin-top:6px;color:#243a56;border-radius:8px}.primary{background:#172233;color:white}small{display:block;margin-top:22px;color:#4b5a6d}</style><main><header><a href="/mex">🇲🇽 México</a><h1>'+escape(selected?.[1]||'Catálogo de juegos')+'</h1><p>Selecciona la edición de tu país.</p></header><section>'+rows+'</section><small>La edición mexicana requiere una versión en español y una operación en pesos mexicanos. Esta página no convierte el saldo brasileño.</small></main></html>');
 });
}
