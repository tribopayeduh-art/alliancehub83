import{test}from'node:test';import assert from'node:assert/strict';import{loadAffiliateInfo}from'../src/lib/loadAffiliateInfo.ts';
const reply=(data:any,status=200)=>async()=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('carrega dados válidos e não esconde falhas de sessão/banco',async()=>{
 assert.equal((await loadAffiliateInfo('token',{fetcher:reply({referralCode:'REF1',indications:[]}) as any})).referralCode,'REF1');
 await assert.rejects(()=>loadAffiliateInfo('',{fetcher:reply({}) as any}),/sessão não foi encontrada/);
 await assert.rejects(()=>loadAffiliateInfo('token',{fetcher:reply({error:'Não autorizado'},401) as any}),/sessão expirou/);
 await assert.rejects(()=>loadAffiliateInfo('token',{fetcher:reply({error:'Banco indisponível'},503) as any}),/Banco indisponível/);
 await assert.rejects(()=>loadAffiliateInfo('token',{fetcher:reply({error:'missing'}) as any}),/dados incompletos/);
});
test('consulta parada termina com mensagem de timeout e pode ser tentada novamente',async()=>{
 const hanging:any=(_:any,{signal}:any)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('Aborted'),{name:'AbortError'})),{once:true}));
 await assert.rejects(()=>loadAffiliateInfo('token',{timeoutMs:5,fetcher:hanging}),/demorou mais/);
 assert.equal((await loadAffiliateInfo('token',{fetcher:reply({referralCode:'RETRY',indications:[]}) as any})).referralCode,'RETRY');
});
