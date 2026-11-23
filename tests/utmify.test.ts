import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {buildUtmifyOrder,stageUtmify,drainUtmify,utmifyRequest,safeUtmJob,cleanTracking} from '../server/utmify.ts';
import {encryptSensitiveData} from '../server/security.ts';
process.env.SYSTEM_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString('hex');
const now=()=>new Date().toISOString();
const charge=()=>({userId:'player',correlationID:'dep-1',value:12345,valueInReais:123.45,qrCode:'pix',createdAt:now(),trackingParameters:{utm_source:'Meta'}});
const user={id:'player',name:'Jogador',email:'player@example.com',phone:'(11) 99999-9999',parentAffiliateUserId:'hub',influencerUserId:'influencer',registeredGame:'g_block_puzzle'};
function fixture(){
 const data=new Map<string,any>([['utmify_integrations/influencer',{enabled:true,tokenEncrypted:encryptSensitiveData('test-token'),activatedAt:new Date(Date.now()-10000).toISOString()}],['utmify_integrations/hub',{enabled:true,tokenEncrypted:encryptSensitiveData('hub-token')}]]);
 let chain=Promise.resolve();const ref=(c:string,id:string):any=>({key:c+'/'+id,id,get:async()=>({data:()=>structuredClone(data.get(c+'/'+id))})});
 const collection=(c:string,filters:any[]=[]):any=>({doc:(id:string)=>ref(c,id),where:(k:string,o:string,v:any)=>collection(c,[...filters,[k,v]]),get:async()=>({docs:[...data].filter(([k,v])=>k.startsWith(c+'/')&&filters.every(([f,w])=>v[f]===w)).map(([k,v])=>({id:k.split('/')[1],ref:ref(c,k.split('/')[1]),data:()=>structuredClone(v)}))})});
 const store:any={collection,runTransaction:(fn:any)=>{const task=chain.then(async()=>{let writes=false;const copy=new Map([...data].map(([k,v])=>[k,structuredClone(v)]));const tx={get:async(r:any)=>{assert.equal(writes,false);return{data:()=>structuredClone(copy.get(r.key))};},set:(r:any,v:any,o:any)=>{writes=true;copy.set(r.key,o?.merge?{...copy.get(r.key),...v}:v);},update:(r:any,v:any)=>{writes=true;copy.set(r.key,{...copy.get(r.key),...v});}};const result=await fn(tx);data.clear();copy.forEach((v,k)=>data.set(k,v));return result;});chain=task.catch(()=>{});return task;}};
 const stage=async(c:any,current:any={},u:any=user,paid=false)=>store.runTransaction(async(tx:any)=>{const commit=await stageUtmify(tx,c,current,u,paid,store);commit();});
 const jobs=()=>[...data].filter(([k])=>k.startsWith('utmify_jobs/')).map(([,v])=>v);
 return{data,store,stage,jobs};
}
test('payload usa centavos, UTC, dados reais e mesmo pedido ao passar de pendente para pago',()=>{
 const c={...charge(),createdAt:'2026-11-22T08:30:00-03:00',paidAt:'2026-11-22T08:35:00-03:00'};const a=buildUtmifyOrder(c,user),b=buildUtmifyOrder(c,user,true);assert.equal(a.orderId,b.orderId);assert.equal(a.createdAt,'2026-11-22 11:30:00');assert.equal(b.approvedDate,'2026-11-22 11:35:00');assert.equal(a.approvedDate,null);assert.equal(b.commission.totalPriceInCents,12345);assert.equal(a.trackingParameters.utm_source,'Meta');assert.equal(a.trackingParameters.utm_campaign,null);assert.equal(a.customer.phone,'11999999999');assert.equal(a.isTest,false);assert.equal(buildUtmifyOrder(c,user,true,true).isTest,true);
});
test('fila atribui somente ao influenciador direto, deduplica e nunca regride pago para pendente',async()=>{
 const f=fixture(),c=charge();await Promise.all([f.stage(c),f.stage(c)]);assert.equal(f.jobs().length,1);assert.equal(f.jobs()[0].ownerId,'influencer');const current={...c,...f.data.get('charges/dep-1'),paidAt:now()};await f.stage({...current,credited:true},current,user,true);await f.stage(c,current);assert.equal(f.jobs()[0].payload.status,'paid');assert.equal(f.jobs()[0].payload.orderId,'inex_dep-1');
});
test('simulações e gerações sem QR Code não entram no envio real',async()=>{
 const f=fixture();await f.stage({...charge(),rawResponse:{simulated:true}});await f.stage({...charge(),qrCode:null});assert.equal(f.jobs().length,0);
});
test('pausar não perde confirmação e retomada envia pago, sem pendente atrasado',async()=>{
 const f=fixture(),c=charge();await f.stage(c);const cfg=f.data.get('utmify_integrations/influencer');cfg.enabled=false;const current={...c,utmifyOwnerId:'influencer',paidAt:now()};await f.stage(current,current,user,true);let sent:any[]=[];const send:any=async(_:any,o:any)=>{sent.push(JSON.parse(o.body));return Response.json({result:'SUCCESS'});};await drainUtmify('influencer',f.store,send);assert.equal(sent.length,0);cfg.enabled=true;f.data.set('utmify_integrations/influencer',cfg);await drainUtmify('influencer',f.store,send);assert.equal(sent[0].status,'paid');assert.equal(f.jobs()[0].state,'sent');
});
test('leases impedem envio concorrente e confirmação em voo permanece para envio seguinte',async()=>{
 const f=fixture(),c=charge();await f.stage(c);let finish:any;const gate=new Promise(r=>finish=r);let started:any;const running=new Promise(r=>started=r);let calls=0;const send:any=async()=>{calls++;started();await gate;return Response.json({result:'SUCCESS'});};const first=drainUtmify('influencer',f.store,send);await running;await drainUtmify('influencer',f.store,send);assert.equal(calls,1);const current={...c,utmifyOwnerId:'influencer',paidAt:now()};await f.stage(current,current,user,true);finish();await first;assert.equal(f.jobs()[0].state,'pending');const delivered:any[]=[];await drainUtmify('influencer',f.store,(async(_:any,o:any)=>{delivered.push(JSON.parse(o.body));return Response.json({result:'SUCCESS'});}) as any);assert.equal(delivered[0].status,'paid');assert.equal(f.jobs()[0].state,'sent');assert.equal(calls,1);
});
test('falha transitória usa backoff; falha de credencial requer correção e não vaza segredos',async()=>{
 const f=fixture();await f.stage(charge());await drainUtmify('influencer',f.store,(async()=>Response.json({reason:'RATE_LIMIT_EXCEEDED'},{status:429,headers:{'Retry-After':'120'}})) as any);let j=f.jobs()[0];assert.equal(j.state,'pending');assert.ok(j.nextAttemptAt>Date.now()+100000);j.nextAttemptAt=0;f.data.set('utmify_jobs/'+j.id,j);await drainUtmify('influencer',f.store,(async()=>Response.json({reason:'API_CREDENTIAL_NOT_FOUND'},{status:401})) as any);j=f.jobs()[0];assert.equal(j.state,'failed');const safe=JSON.stringify(safeUtmJob(j));assert.ok(!safe.includes('test-token'));assert.ok(!safe.includes(user.email));assert.ok(!safe.includes('tokenEncrypted'));
});
test('scope de afiliado não processa pedidos de outra conta e janela antiga é recusada',async()=>{
 const f=fixture();await f.stage(charge());let calls=0;const send:any=async()=>{calls++;return Response.json({result:'SUCCESS'});};await drainUtmify('hub',f.store,send);assert.equal(calls,0);const j=f.jobs()[0];j.payload.createdAt='2020-01-01 00:00:00';f.data.set('utmify_jobs/'+j.id,j);await drainUtmify('influencer',f.store,send);assert.equal(calls,0);assert.equal(f.jobs()[0].lastError,'ORDER_TOO_OLD');
});
test('respostas HTML não viram sucesso; consulta usa domínio e autenticação próprios',async()=>{
 await assert.rejects(()=>utmifyRequest('token',{},undefined,(async()=>new Response('<html>fail</html>',{status:502})) as any));let request:any;await utmifyRequest('query-token',{platforms:['iNEX']},'0123456789abcdef01234567',(async(u:any,o:any)=>{request={u,o};return Response.json({orders:{approved:1}});}) as any);assert.ok(request.u.startsWith('https://query-api.utmify.com.br/'));assert.equal(request.o.headers.Authorization,'Bearer query-token');assert.equal(cleanTracking({utm_source:' a ',token:'secret'}).utm_source,'a');assert.ok(!('token' in cleanTracking({token:'x'})));
});

test('rotas isolam titular, criptografam credenciais e admin só pode pausar sem ler token',async()=>{
 const {default:express}=await import('express');const {registerUtmifyRoutes}=await import('../server/utmify.ts');const f=fixture();
 f.store.recent=async(c:string,limit:number,match:any={})=>[...f.data].filter(([k,v])=>k.startsWith(c+'/')&&Object.entries(match).every(([field,value])=>v[field]===value)).slice(0,limit).map(([k,v])=>({id:k.split('/')[1],data:v}));
 const app=express();app.use(express.json());const auth=(req:any,res:any,next:any)=>{if(!req.get('Authorization'))return res.sendStatus(401);req.userId=req.get('Authorization').replace('Bearer ','');next();};
 registerUtmifyRoutes(app,{store:f.store,requireAuth:auth,requireAdmin:(req:any,res:any,next:any)=>auth(req,res,()=>req.userId==='admin'?next():res.sendStatus(403)),checkAdminPermission:(req:any)=>req.userId==='admin',dbService:{getAffiliateByUserId:async(id:string)=>id==='blocked'?null:{status:'active'},getUserById:async(id:string)=>({id,name:id})}});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const port=(server.address() as any).port;
 const call=(path:string,who='owner',method='GET',body?:any)=>fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{Authorization:`Bearer ${who}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  let r=await call('/api/affiliates/integrations/utmify','owner','PUT',{enabled:true,token:'secret-token',queryToken:'query-secret',dashboardId:'0123456789abcdef01234567'});assert.equal(r.status,200);const persisted=f.data.get('utmify_integrations/owner');assert.ok(persisted.tokenEncrypted.startsWith('enc:v1:'));assert.notEqual(persisted.tokenEncrypted,'secret-token');
  r=await call('/api/affiliates/integrations/utmify');const own=await r.json() as any;assert.equal(own.configured,true);assert.ok(!JSON.stringify(own).includes('secret-token'));assert.ok(!JSON.stringify(own).includes('enc:v1:'));
  r=await call('/api/affiliates/integrations/utmify','blocked');assert.equal(r.status,403);
  await f.stage(charge());const job=f.jobs()[0];r=await call('/api/affiliates/integrations/utmify/jobs/'+job.id+'/retry','owner','POST',{});assert.equal(r.status,404);
  r=await call('/api/admin/integrations/utmify','owner');assert.equal(r.status,403);
  r=await call('/api/admin/integrations/utmify','admin');const admin=await r.json() as any;assert.equal(admin.integrations.length,1);assert.ok(!JSON.stringify(admin).includes('secret-token'));assert.ok(!JSON.stringify(admin).includes('tokenEncrypted'));
  r=await call('/api/admin/integrations/utmify/owner','admin','PUT',{adminPaused:true});assert.equal(r.status,200);assert.equal(f.data.get('utmify_integrations/owner').adminPaused,true);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
