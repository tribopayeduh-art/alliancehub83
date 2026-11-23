import {test} from 'node:test';import assert from 'node:assert/strict';
import {reviewInfluencer,settleInfluencerLedger} from '../server/influencerReview.ts';
import {periodValue} from '../src/lib/periodMetrics.ts';
import {requestJson,uniqueTransactions} from '../src/lib/requestJson.ts';
import {approveDotfyWithdrawal} from '../server/dotfy/withdrawalApproval.ts';
function fixture(){
 const data=new Map<string,any>([['affiliates/hub',{id:'hub',userId:'owner',affiliateBalance:100}],['affiliates/admin-wallet',{id:'admin-wallet',userId:'admin',affiliateBalance:900}],['affiliates/inf',{id:'inf',userId:'influencer',affiliateBalance:10}],['influencerCommissionRequests/r',{id:'r',status:'pending',amount:30,affiliateId:'hub',affiliateUserId:'owner',influencerUserId:'influencer',pixKey:'key',pixKeyType:'random'}]]);
 let chain=Promise.resolve();const ref=(c:string,id:string)=>({key:c+'/'+id});const store:any={collection:(c:string)=>({doc:(id:string)=>ref(c,id)}),transaction:(fn:any)=>{const run=chain.then(async()=>{let writes=false;const copy=new Map([...data].map(([k,v])=>[k,structuredClone(v)]));const tx={get:async(r:any)=>{assert.equal(writes,false,'read before write');return{data:()=>copy.get(r.key)};},set:(r:any,v:any)=>{writes=true;copy.set(r.key,v);},update:(r:any,v:any)=>{writes=true;copy.set(r.key,{...copy.get(r.key),...v});}};const result=await fn(tx);data.clear();copy.forEach((v,k)=>data.set(k,v));return result;});chain=run.catch(()=>{});return run;}};
 return {data,store,ref};
}
const input={requestId:'r',action:'approve',amount:20,actorId:'admin',actorName:'Admin',admin:true,sponsorAffiliateId:'hub',influencerAffiliateId:'inf'};
test('aprovação usa carteira do Hub, fica pendente bancário e duas aprovações não duplicam débito',async()=>{
 const {data,store}=fixture();const results=await Promise.all([reviewInfluencer(input,store),reviewInfluencer(input,store)]);assert.equal(results.filter(r=>r.replayed).length,1);assert.equal(data.get('affiliates/hub').affiliateBalance,80);assert.equal(data.get('affiliates/admin-wallet').affiliateBalance,900);assert.equal(data.get('affiliates/inf').affiliateBalance,20);assert.equal(results[0].payout.status,'pending');assert.equal(data.get('influencerCommissionRequests/r').paymentStatus,'pending');
 await assert.rejects(()=>reviewInfluencer({...input,action:'reject'},store),/já processado/);
});
test('recusa é atômica, repeti-la não estorna duas vezes e outro afiliado não aprova',async()=>{
 const {data,store}=fixture();await assert.rejects(()=>reviewInfluencer({...input,admin:false,actorId:'intruder'},store),/permissão/);await reviewInfluencer({...input,action:'reject'},store);await reviewInfluencer({...input,action:'reject'},store);assert.equal(data.get('affiliates/inf').affiliateBalance,40);assert.equal(data.get('affiliates/hub').affiliateBalance,100);
});
test('falha bancária devolve reserva às duas carteiras uma única vez',async()=>{
 const {data,store,ref}=fixture();const r=await reviewInfluencer(input,store);await store.transaction((tx:any)=>settleInfluencerLedger(tx,r.payout,false,ref));await store.transaction((tx:any)=>settleInfluencerLedger(tx,r.payout,false,ref));assert.equal(data.get('affiliates/hub').affiliateBalance,100);assert.equal(data.get('affiliates/inf').affiliateBalance,40);assert.equal(data.get('influencerCommissionRequests/r').paymentStatus,'failed');
});
test('confirmação bancária registra pago, sem novo débito e sem alteração de saldo dos jogos',async()=>{
 const {data,store,ref}=fixture();const r=await reviewInfluencer(input,store);await store.transaction((tx:any)=>settleInfluencerLedger(tx,r.payout,true,ref));assert.equal(data.get('influencerCommissionRequests/r').paymentStatus,'paid');assert.equal(data.get('affiliates/hub').affiliateBalance,80);assert.equal(data.get('transactions/hub_'+r.payout.id).status,'approved');
});
test('períodos usam data da movimentação e extrato mantém somente um registro de cada id',()=>{
 const now=new Date(2026,10,21,12);const events:any[]=[{kind:'deposit',amount:50,createdAt:new Date(2026,10,20,10).toISOString()},{kind:'deposit',amount:90,createdAt:new Date(2026,9,10).toISOString()},{kind:'signup',createdAt:new Date(2026,9,1).toISOString()}];assert.equal(periodValue(events,'deposit','7d',now),50);assert.equal(periodValue(events,'signup','7d',now),0);assert.equal(uniqueTransactions([{id:'x'}],[{id:'x'},{id:'y'}]).length,2);
});
test('sessão distingue indisponibilidade de credencial inválida e termina em timeout',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=(async()=>new Response(JSON.stringify({error:'Indisponível'}),{status:503,headers:{'Content-Type':'application/json'}})) as any;await assert.rejects(()=>requestJson('/test'),(e:any)=>e.status===503);globalThis.fetch=((_:any,o:any)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Object.assign(new Error('abort'),{name:'AbortError'}))))) as any;await assert.rejects(()=>requestJson('/test',{},5),(e:any)=>e.status===408);}finally{globalThis.fetch=original;}
});
test('gateway recebe comissões de influenciador demo sem marcar pagamento como concluído antecipadamente',async()=>{
 const records:any[]=[];const tx={id:'t',userId:'u',type:'withdrawal',status:'pending',amount:20,netAmount:20,walletKind:'affiliate',pixKey:'key',pixType:'random'};
 const result=await approveDotfyWithdrawal('t',{getTransactionById:async()=>tx,getUserById:async()=>({id:'u',name:'Inf',hasAffiliateDemoBalance:true,isInfluencer:true}),getApiKey:async()=>'test',resolveKey:async()=>({pixKeyId:'k'}),claimWithdrawal:async()=>'attempt',recordResult:async(...r:any[])=>{records.push(r);},send:async()=>new Response(JSON.stringify({id:'bank-id'}),{status:200,headers:{'Content-Type':'application/json'}})},{});assert.ok(result);assert.equal(records[0][2].kind,'accepted');assert.equal(tx.status,'pending');
});
