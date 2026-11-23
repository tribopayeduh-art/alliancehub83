import {waitUntil} from '@vercel/functions';
import crypto from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {supabaseStore} from './supabaseStore.ts';
import {encryptSensitiveData,decryptSensitiveData} from './security.ts';
export const UTM_KEYS=['src','sck','utm_source','utm_campaign','utm_medium','utm_content','utm_term'] as const;
export const utmContext=new AsyncLocalStorage<Record<string,string|null>>();
export const cleanTracking=(value:any)=>Object.fromEntries(UTM_KEYS.map(k=>[k,typeof value?.[k]==='string'?value[k].trim().slice(0,500)||null:null]));
export function utmTrackingMiddleware(req:any,res:any,next:any){
 let saved:any={};try{const raw=req.headers.cookie?.match(/(?:^|;\s*)inex_utm=([^;]+)/)?.[1];if(raw)saved=JSON.parse(decodeURIComponent(raw));}catch{}
 const incoming=cleanTracking(req.query);if(req.method==='GET'&&!req.path.startsWith('/api/')&&Object.values(incoming).some(Boolean)){
  saved=incoming;while(encodeURIComponent(JSON.stringify(saved)).length>3500){const key=UTM_KEYS.reduce((a,b)=>String(saved[a]||'').length>String(saved[b]||'').length?a:b);saved[key]=String(saved[key]).slice(0,Math.floor(String(saved[key]).length/2))||null;}res.cookie('inex_utm',JSON.stringify(saved),{httpOnly:true,sameSite:'lax',secure:req.secure,maxAge:30*86400000,path:'/'});
 }
 utmContext.run(cleanTracking(saved),next);
}
const err=(message:string,status=400)=>Object.assign(new Error(message),{status});
const utc=(date:any)=>{const t=new Date(date);if(!Number.isFinite(t.getTime()))throw err('Data da cobrança inválida.');return t.toISOString().slice(0,19).replace('T',' ');};
export function buildUtmifyOrder(charge:any,user:any,paid=false,isTest=false){
 const amount=Math.round(Number(charge.valueInReais??Number(charge.value)/100)*100);
 if(!Number.isSafeInteger(amount)||amount<=0)throw err('Valor da cobrança inválido.');
 return {orderId:`inex_${charge.correlationID}`,platform:'iNEX',paymentMethod:'pix',status:paid?'paid':'waiting_payment',createdAt:utc(charge.createdAt),approvedDate:paid?utc(charge.paidAt):null,refundedAt:null,
 customer:{name:String(user.name||'').slice(0,150),email:String(user.email||'').slice(0,254),phone:String(user.phone||'').replace(/\D/g,'')||null,document:String(user.cpf||charge.customer?.document||'').replace(/\D/g,'')||null,country:'BR'},
 products:[{id:String(user.registeredGame||'deposito'),name:`Depósito iNEX · ${String(user.registeredGame||'Carteira')}`,planId:null,planName:null,quantity:1,priceInCents:amount}],trackingParameters:cleanTracking(charge.trackingParameters||user.utmAttribution),
 commission:{totalPriceInCents:amount,gatewayFeeInCents:0,userCommissionInCents:amount,currency:'BRL'},isTest};
}
// Called inside the same transaction as the source charge. Reads first, then returns writes.
export async function stageUtmify(tx:any,charge:any,current:any,user:any,paid:boolean,store:any=supabaseStore){
 const nothing=()=>{};
 if(!charge.userId||charge.rawResponse?.simulated||charge.isSimulated||!charge.correlationID||(!paid&&!charge.qrCode&&!charge.paymentLink))return nothing;
 let owner=current?.utmifyOwnerId||user?.influencerUserId||user?.parentAffiliateUserId;
 if(!owner){const aid=user?.influencerAffiliateId||user?.parentAffiliateId||user?.affiliateId;if(aid){const aff=(await tx.get(store.collection('affiliates').doc(aid))).data();owner=aff?.userId;}}
 if(!owner||owner===charge.userId)return nothing;
 const config=(await tx.get(store.collection('utmify_integrations').doc(owner))).data();
 
 const id=crypto.createHash('sha256').update(`${owner}:${charge.correlationID}`).digest('hex'),ref=store.collection('utmify_jobs').doc(id),old=(await tx.get(ref)).data();
 if(!old&&(!config?.enabled||!config?.tokenEncrypted||config.adminPaused||Date.parse(charge.createdAt)<Date.parse(config.activatedAt||config.updatedAt)))return ()=>tx.set(store.collection('charges').doc(charge.correlationID),{utmifyOwnerId:owner},{merge:true});
 // Never regress a confirmed order or recreate deliveries from polling.
 if(old?.payload?.status==='refunded'||old?.payload?.status==='paid'&&!paid)return nothing;
 const enriched={...charge,createdAt:current?.createdAt||charge.createdAt,paidAt:current?.paidAt||charge.paidAt,trackingParameters:Object.values(current?.trackingParameters||charge.trackingParameters||{}).some(Boolean)?(current?.trackingParameters||charge.trackingParameters):user.utmAttribution};
 let payload:any;try{payload=buildUtmifyOrder(enriched,user,paid);}catch{return ()=>{tx.set(ref,{...old,id,ownerId:owner,chargeId:charge.correlationID,payload:{orderId:`inex_${charge.correlationID}`,status:paid?'paid':'waiting_payment'},state:'failed',lastError:'INVALID_SOURCE_DATA',createdAt:old?.createdAt||new Date().toISOString(),revision:Number(old?.revision||0)+1,attempts:0});};}
 if(old?.payload?.status===payload.status)return nothing;
 return ()=>{
  tx.set(ref,{...old,id,ownerId:owner,chargeId:charge.correlationID,amountCents:payload.commission.totalPriceInCents,payload,state:'pending',attempts:0,nextAttemptAt:0,leaseUntil:old?.leaseUntil||0,revision:Number(old?.revision||0)+1,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),lastError:null});
  tx.set(store.collection('charges').doc(charge.correlationID),{utmifyOwnerId:owner},{merge:true});
 };
}
export async function utmifyRequest(token:string,payload:any,queryDashboard?:string,send:typeof fetch=globalThis.fetch){
 const response=await send(queryDashboard?`https://query-api.utmify.com.br/public-api/v1/dashboards/${encodeURIComponent(queryDashboard)}/summary`:'https://api.utmify.com.br/api-credentials/orders',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'iNEX-Integration/1.0',...(queryDashboard?{'Authorization':`Bearer ${token}`}:{'x-api-token':token})},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
 let data:any;try{data=await response.json();}catch{throw Object.assign(err('UTMify retornou uma resposta inválida.',response.status>=400?response.status:502),{retry:response.status<400||response.status===429||response.status>=500,code:'INVALID_RESPONSE'});}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Object.assign(err('Resposta UTMify inválida.',502),{retry:true,code:'INVALID_RESPONSE'});
 if(!response.ok||data?.result==='ERROR'||data?.success===false||data?.error){
  const code=String(data?.reason||data?.error?.code||`HTTP_${response.status}`).replace(/[^\w.-]/g,'').slice(0,90);
  throw Object.assign(err(`UTMify: ${code}. Verifique a credencial, os dados e o plano.`,response.ok?422:response.status),{retry:response.status===429||response.status>=500,code,retryAfter:Math.min(86400,Math.max(30,Number(response.headers.get('Retry-After'))||60))});
 }
 return data;
}
export async function drainUtmify(ownerId?:string,store:any=supabaseStore,send:typeof fetch=globalThis.fetch,chargeId?:string,maxBatch=3){
 let query=store.collection('utmify_jobs').where('state','==','pending');if(ownerId)query=query.where('ownerId','==',ownerId);if(chargeId)query=query.where('chargeId','==',chargeId);
 const rows=await query.get();let count=0;
 for(const s of rows.docs){if(count>=maxBatch)break;const preview=s.data();if(chargeId&&preview.chargeId!==chargeId)continue;if(ownerId&&preview.ownerId!==ownerId)continue;if(Number(preview.nextAttemptAt)>Date.now()||Number(preview.leaseUntil)>Date.now())continue;
  const lease=crypto.randomUUID(),job=await store.runTransaction(async(tx:any)=>{const j=(await tx.get(s.ref)).data();if(!j||j.state!=='pending'||Number(j.nextAttemptAt)>Date.now()||Number(j.leaseUntil)>Date.now())return null;const c=(await tx.get(store.collection('utmify_integrations').doc(j.ownerId))).data();if(!c?.enabled||!c.tokenEncrypted||c.adminPaused)return null;tx.update(s.ref,{lease,leaseUntil:Date.now()+60000,attempts:Number(j.attempts||0)+1});return {...j,token:decryptSensitiveData(c.tokenEncrypted)};});
  if(!job)continue;count++;let failure:any;
  try{if(Date.now()-Date.parse(job.payload.createdAt.replace(' ','T')+'Z')>(job.payload.status==='refunded'?45:7)*86400000)throw Object.assign(err('Pedido fora da janela de 7 dias.',422),{code:'ORDER_TOO_OLD'});await utmifyRequest(job.token,job.payload,undefined,send);}catch(e:any){failure=e;}
  await store.runTransaction(async(tx:any)=>{const current=(await tx.get(s.ref)).data();if(current?.lease!==lease)return;const changed=current.revision!==job.revision;tx.update(s.ref,changed?{leaseUntil:0}:failure?{leaseUntil:0,state:(failure.retry||!failure.status)&&current.attempts<12?'pending':'failed',lastError:failure.code||'DELIVERY_FAILED',nextAttemptAt:Date.now()+1000*(failure.retryAfter||Math.min(3600,30*2**Math.min(current.attempts,7)))}:{leaseUntil:0,state:'sent',sentStatus:job.payload.status,sentAt:new Date().toISOString(),lastError:null});});
 }
 return {processed:count};
}
export const safeUtmJob=(v:any)=>({id:v.id,orderId:v.payload?.orderId,status:v.payload?.status,state:v.state,amountCents:v.amountCents,attempts:v.attempts,lastError:v.lastError,createdAt:v.createdAt,sentAt:v.sentAt,nextAttemptAt:v.nextAttemptAt});
export function registerUtmifyRoutes(app:any,deps:any){
 const {requireAuth,requireAdmin,dbService,checkAdminPermission}=deps;const store=deps.store||supabaseStore;
 const owner=async(req:any)=>{const aff=await dbService.getAffiliateByUserId(req.userId);if(!aff||aff.status!=='active')throw err('Ative sua conta de afiliado para usar integrações.',403);return req.userId as string;};
 const wrap=(fn:any)=>async(req:any,res:any)=>{res.set('Cache-Control','no-store');try{await fn(req,res);}catch(e:any){res.status([400,401,403,404,409,422,429].includes(e.status)?e.status:503).json({error:e.status&&e.status<500?e.message:'Integração temporariamente indisponível. Tente novamente.'});}};
 const ref=(id:string)=>store.collection('utmify_integrations').doc(id);
 const limited=async(id:string,action:string,ms:number)=>store.runTransaction(async tx=>{const s=(await tx.get(ref(id))).data();if(Date.now()-Number(s?.[action]||0)<ms)throw err('Aguarde alguns instantes antes de repetir.',429);tx.set(ref(id),{[action]:Date.now()},{merge:true});return s;});
 app.get('/api/affiliates/integrations/utmify',requireAuth,wrap(async(req:any,res:any)=>{const id=await owner(req),config=(await ref(id).get()).data()||{},rows=await store.recent('utmify_jobs',50,{ownerId:id});res.json({enabled:!!config.enabled,adminPaused:!!config.adminPaused,configured:!!config.tokenEncrypted,queryConfigured:!!config.queryEncrypted,dashboardId:config.dashboardId||'',updatedAt:config.updatedAt,lastTest:config.lastTest||null,jobs:rows.map(r=>safeUtmJob({...r.data,id:r.id}))});}));
 app.put('/api/affiliates/integrations/utmify',requireAuth,wrap(async(req:any,res:any)=>{const id=await owner(req),b=req.body||{};for(const k of ['token','queryToken'])if(b[k]!==undefined&&(typeof b[k]!=='string'||b[k].length>500||(/[\r\n]/.test(b[k]))))throw err('Credencial inválida.');if(b.dashboardId&&!/^[a-fA-F0-9]{24}$/.test(b.dashboardId))throw err('ID do dashboard inválido.');const token=b.token?.trim(),queryToken=b.queryToken?.trim(),secured=token?encryptSensitiveData(token):null,securedQuery=queryToken?encryptSensitiveData(queryToken):null;
 await store.runTransaction(async tx=>{const old=(await tx.get(ref(id))).data()||{};if(b.enabled&&!secured&&!old.tokenEncrypted)throw err('Informe a credencial de envio.');tx.set(ref(id),{...old,ownerId:id,enabled:!!b.enabled,activatedAt:old.activatedAt||new Date().toISOString(),...(secured?{tokenEncrypted:secured}:{}),...(securedQuery?{queryEncrypted:securedQuery}:{}),dashboardId:String(b.dashboardId||''),updatedAt:new Date().toISOString(),...(b.disconnect?{enabled:false,tokenEncrypted:null,queryEncrypted:null,dashboardId:''}:{})});});res.json({success:true});}));
 app.post('/api/affiliates/integrations/utmify/test',requireAuth,wrap(async(req:any,res:any)=>{const id=await owner(req),status=req.body?.status;if(!['waiting_payment','paid'].includes(status))throw err('Status de teste inválido.');const c=await limited(id,'testAt',15000);if(!c?.tokenEncrypted||c.adminPaused)throw err('Configure sua credencial e verifique se a integração está liberada.',409);const now=new Date().toISOString(),payload=buildUtmifyOrder({correlationID:'test_'+crypto.randomUUID(),value:1000,createdAt:now,paidAt:now},{name:'Teste de integração iNEX',email:'teste@example.com',registeredGame:'teste'},status==='paid',true);await utmifyRequest(decryptSensitiveData(c.tokenEncrypted),payload);await ref(id).set({lastTest:{status,at:now,success:true}},{merge:true});res.json({success:true,message:'Teste validado pela UTMify. Nenhuma venda ou saldo foi criado.'});}));
 app.post('/api/affiliates/integrations/utmify/sync',requireAuth,wrap(async(req:any,res:any)=>{const id=await owner(req);await limited(id,'syncAt',30000);res.json(await drainUtmify(id,store));}));
 app.post('/api/affiliates/integrations/utmify/jobs/:id/retry',requireAuth,wrap(async(req:any,res:any)=>{const id=await owner(req);if(!/^[a-f0-9]{64}$/.test(req.params.id))throw err('Registro inválido.');await limited(id,'retryAt',15000);const jref=store.collection('utmify_jobs').doc(req.params.id);await store.runTransaction(async tx=>{const j=(await tx.get(jref)).data();if(j?.ownerId!==id)throw err('Registro indisponível.',404);if(j.state!=='failed')throw err('Somente falhas podem ser retomadas.',409);const charge=(await tx.get(store.collection('charges').doc(j.chargeId))).data();const user=charge?.userId?(await tx.get(store.collection('users').doc(charge.userId))).data():null;if(!charge||!user||charge.utmifyOwnerId!==id||charge.rawResponse?.simulated)throw err('Origem do pedido indisponível.',409);const payload=buildUtmifyOrder(charge,user,!!charge.credited);tx.update(jref,{payload,state:'pending',attempts:0,nextAttemptAt:0,leaseUntil:0,revision:Number(j.revision||0)+1});});res.json(await drainUtmify(id,store));}));
 app.post('/api/affiliates/integrations/utmify/summary',requireAuth,wrap(async(req:any,res:any)=>{const id=await owner(req),c=await limited(id,'summaryAt',120000);if(!c?.queryEncrypted||!/^[a-fA-F0-9]{24}$/.test(c.dashboardId||''))throw err('Informe a chave de consulta e o ID do dashboard.',409);const days=req.body?.days===7?7:30,to=new Date(),from=new Date(to.getTime()-days*86400000);const data=await utmifyRequest(decryptSensitiveData(c.queryEncrypted),{from:from.toISOString(),to:to.toISOString(),platforms:['iNEX']},c.dashboardId);res.json({currency:data.currency,orders:data.orders,revenue:data.revenue,result:data.result,period:data.period});}));
 app.get('/api/admin/integrations/utmify',requireAdmin,wrap(async(req:any,res:any)=>{if(!checkAdminPermission(req,'canManageUsers'))throw err('Sem permissão para gerenciar integrações.',403);const rows=await store.recent('utmify_integrations',200);res.json({integrations:await Promise.all(rows.filter(r=>r.data.ownerId).map(async({id,data})=>{const u=await dbService.getUserById(id);return {id,name:u?.name||'Afiliado',enabled:!!data.enabled,adminPaused:!!data.adminPaused,configured:!!data.tokenEncrypted,updatedAt:data.updatedAt};}))});}));
 app.put('/api/admin/integrations/utmify/:id',requireAdmin,wrap(async(req:any,res:any)=>{if(!checkAdminPermission(req,'canManageUsers'))throw err('Sem permissão.',403);if(!req.params.id||req.params.id.length>200)throw err('Conta inválida.');const r=ref(req.params.id);await store.runTransaction(async tx=>{const old=(await tx.get(r)).data();if(!old?.ownerId)throw err('Integração não encontrada.',404);tx.update(r,{adminPaused:!!req.body.adminPaused,pausedBy:req.userId,updatedAt:new Date().toISOString()});});res.json({success:true});}));
}

export async function flushUtmify(chargeId:string){try{const c=(await supabaseStore.collection('charges').doc(chargeId).get()).data();if(c?.utmifyOwnerId)await drainUtmify(c.utmifyOwnerId,supabaseStore,globalThis.fetch,chargeId);}catch{console.warn('[UTMify] Envio preservado na fila para nova tentativa.');}}

export function scheduleUtmify(chargeId:string){if(process.env.NODE_TEST_CONTEXT)return;const task=flushUtmify(chargeId).catch(()=>{});if(process.env.VERCEL==='1')waitUntil(task);}
