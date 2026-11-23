import {test} from 'node:test';import assert from 'node:assert/strict';
import {gameWithdrawalBlocked,validCommissionRelease} from '../server/influencerWithdrawalPolicy.ts';
import {reserveInfluencerCommission} from '../server/influencerCommissionReserve.ts';
function fixture(){const data=new Map<string,any>([['users/u',{id:'u',isInfluencer:true,balance:1000,hasAffiliateDemoBalance:true}],['affiliates/a',{id:'a',userId:'u',affiliateBalance:40}]]);const store:any={collection:(c:string)=>({doc:(id:string)=>({key:c+'/'+id})}),transaction:async(fn:any)=>{const copy=new Map([...data].map(([k,v])=>[k,structuredClone(v)]));const result=await fn({get:async(r:any)=>({data:()=>copy.get(r.key)}),set:(r:any,v:any)=>copy.set(r.key,v)});data.clear();copy.forEach((v,k)=>data.set(k,v));return result;}};return {data,store};}
const record={id:'req1',influencerUserId:'u',amount:30,pixKey:'destino',pixKeyType:'random',status:'pending'};
test('influenciador não saca carteira dos jogos mesmo sem a flag demo; jogador regular continua elegível',()=>{
 assert.equal(gameWithdrawalBlocked({isInfluencer:true}),true);assert.equal(gameWithdrawalBlocked({hasAffiliateDemoBalance:true}),true);assert.equal(gameWithdrawalBlocked({withdrawBlocked:true}),true);assert.equal(gameWithdrawalBlocked({}),false);
 assert.equal(validCommissionRelease(30,31),false);assert.equal(validCommissionRelease(30,Infinity),false);assert.equal(validCommissionRelease(30,-1),false);assert.equal(validCommissionRelease(30,20),true);
});
test('pedido reserva apenas comissão; demonstração fica intacta e repetição não debita duas vezes',async()=>{
 const {data,store}=fixture();const a=await reserveInfluencerCommission('a',record,store);assert.equal(a.balance,10);assert.equal(data.get('users/u').balance,1000);assert.equal(data.get('influencerCommissionRequests/req1').walletSource,'referral_commissions');
 assert.equal((await reserveInfluencerCommission('a',record,store)).replayed,true);assert.equal(data.get('affiliates/a').affiliateBalance,10);
 await assert.rejects(()=>reserveInfluencerCommission('a',{...record,pixKey:'outro'},store),/Identificador/);
});
test('saldo de jogo alto não substitui comissão insuficiente e conta bloqueada não solicita',async()=>{
 const {data,store}=fixture();await assert.rejects(()=>reserveInfluencerCommission('a',{...record,amount:50},store),/insuficiente/);assert.equal(data.get('affiliates/a').affiliateBalance,40);assert.equal(data.has('influencerCommissionRequests/req1'),false);
 data.set('users/u',{...data.get('users/u'),withdrawBlocked:true});await assert.rejects(()=>reserveInfluencerCommission('a',record,store),/não pode/);
});
