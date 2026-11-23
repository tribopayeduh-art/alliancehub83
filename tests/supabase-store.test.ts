import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {SupabaseStore} from '../server/supabaseStore';
import {transferAtomic} from '../server/pisLedger';
const pg=new PGlite();
const store=new SupabaseStore(async(name,args)=>{
 const entries=Object.entries(args);const placeholders=entries.map((_,i)=>'$'+(i+1)).join(',');
 const result=await pg.query<{result:any}>(`select public.${name}(${placeholders}) as result`,entries.map(([,value])=>typeof value==='object'?JSON.stringify(value):value));return result.rows[0].result;
});
before(async()=>{await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');const dir=new URL('../supabase/migrations/',import.meta.url);const name=fs.readdirSync(dir).find(n=>n.endsWith('_inex_authoritative_store.sql'))!;await pg.exec(fs.readFileSync(new URL(name,dir),'utf8'));await pg.exec(fs.readFileSync(new URL('../supabase/patches/inex_read_performance.sql',import.meta.url),'utf8'));});
after(()=>pg.close());
test('Postgres schema blocks anonymous and authenticated access to wallets and RPC writes',async()=>{
 for(const role of ['anon','authenticated']){
  await pg.exec(`set role ${role}`);
  await assert.rejects(pg.query('select * from public.inex_documents'),/permission denied/);
  await assert.rejects(pg.query("select public.inex_commit('[]','[]')"),/permission denied/);
  await pg.exec('reset role');
 }
 await pg.exec('set role service_role');await store.health();await pg.exec('reset role');
});
test('CRUD, native and functional snapshots preserve merge/update/delete semantics',async()=>{
 const ref=store.collection('test').doc('crud');assert.equal((await ref.get()).exists,false);
 await ref.set({profile:{name:'Ana',city:'Teresina'},amount:10});
 await ref.set({profile:{name:'Eduardo'}},{merge:true});assert.deepEqual((await ref.get()).data().profile,{name:'Eduardo',city:'Teresina'});
 await ref.update({profile:{name:'Bia'}});assert.deepEqual((await ref.get()).data().profile,{name:'Bia'});
 await ref.delete();assert.equal((await ref.get()).exists,false);await assert.rejects(ref.update({amount:30}),/not found/i);
});
test('filters and pagination return every record, including more than 500 documents',async()=>{
 const writes=Array.from({length:510},(_,i)=>({collection_id:'pages',document_id:String(i).padStart(4,'0'),mode:'set',data:{n:i,members:['u1'],userId:'u1'}}));
 await pg.query('select public.inex_commit($1,$2)',['[]',JSON.stringify(writes)]);
 const rows=await store.collection('pages').where('userId','==','u1').get();assert.equal(rows.size,510);
 assert.equal((await store.collection('pages').where('members','array-contains','u1').limit(2).get()).size,2);
 assert.equal((await store.collection('pages').where('userId','==','other').get()).empty,true);
});
test('optimistic transactions retry a concurrent wallet update without losing money',async()=>{
 const ref=store.collection('test').doc('wallet');await ref.set({balance:100});let injected=false;
 await store.runTransaction(async tx=>{const snap=await tx.get(ref);if(!injected){injected=true;await ref.update({balance:120});}tx.update(ref,{balance:snap.data().balance-30});});
 assert.equal((await ref.get()).data().balance,90);
});
test('invalid multi-document operation rolls back every write',async()=>{
 const a=store.collection('test').doc('rollback');await a.set({balance:100});
 await assert.rejects(store.runTransaction(async tx=>{await tx.get(a);tx.update(a,{balance:50});tx.update(store.collection('test').doc('missing'),{balance:50});}));
 assert.equal((await a.get()).data().balance,100);
});
test('PIS IO transfers use the same Postgres wallets and idempotent receipt',async()=>{
 await store.collection('users').doc('su').set({id:'su',name:'Ana'});await store.collection('users').doc('ru').set({id:'ru',name:'Bia'});
 await store.collection('affiliates').doc('sa').set({userId:'su',affiliateBalance:100});await store.collection('affiliates').doc('ra').set({userId:'ru',affiliateBalance:10});
 await store.collection('pis_codes').doc('654321').set({userId:'ru',affiliateId:'ra'});
 const input={sender:{userId:'su',affiliateId:'sa',code:'123456'},code:'654321',cents:2500,id:'transfer-test'};
 await transferAtomic(store,input);assert.equal((await transferAtomic(store,input)).replayed,true);
 assert.equal((await store.collection('affiliates').doc('sa').get()).data().affiliateBalance,75);assert.equal((await store.collection('affiliates').doc('ra').get()).data().affiliateBalance,35);
});

test('recent queries order before limiting and enforce server-only access',async()=>{
 const rows=Array.from({length:610},(_,i)=>({collection_id:'recent_test',document_id:String(610-i),mode:'set',data:{createdAt:new Date(1700000000000+i*1000).toISOString(),userId:i%2?'a':'b',sequence:i}}));
 await pg.query('select public.inex_commit($1,$2)',['[]',JSON.stringify(rows)]);
 const recent=await store.recent('recent_test',200,{userId:'a'});
 assert.equal(recent.length,200);assert.equal(recent[0].data.sequence,609);assert.equal(recent.at(-1)?.data.sequence,211);
 for(const role of ['anon','authenticated']){await pg.exec('set role '+role);await assert.rejects(pg.query("select public.inex_recent_documents('recent_test','{}',200)"),/permission denied/);await pg.exec('reset role');}
});
test('concurrent identical scans share only the in-flight request and subsequent reads remain fresh',async()=>{
 let calls=0,release:()=>void=()=>{};
 const waiting=new Promise<void>(r=>release=r);
 const shared=new SupabaseStore(async()=>{calls++;await waiting;return []});
 const a=shared.collection('shared').get(),b=shared.collection('shared').get();release();await Promise.all([a,b]);assert.equal(calls,1);
 await shared.collection('shared').get();assert.equal(calls,2);
});

test('game clicks keep affiliate and game totals isolated and retain historical totals', async()=>{
 const {recordGameClick,readGameClicks,referralGame}=await import('../server/affiliateGameClicks');
 assert.equal(referralGame(['blockwin']),'');
 assert.equal(referralGame('BLOCKWIN'),'blockwin');
 const old=new Date('2026-10-20T23:59:59Z'), now=new Date('2026-11-23T00:00:01Z');
 await recordGameClick(store,'affiliate-a','blockwin',old);
 await Promise.all([1,2,3].map(()=>recordGameClick(store,'affiliate-a','blockwin',now)));
 await recordGameClick(store,'affiliate-a','bubbleblast',now);
 await recordGameClick(store,'affiliate-b','blockwin',now);
 const current=await readGameClicks(store,'affiliate-a','blockwin',now);
 assert.equal(current.total,4);
 assert.equal(current.days.length,30);
 assert.deepEqual(current.days.filter(day=>day.count),[{date:'2026-11-23',count:3}]);
 assert.equal((await readGameClicks(store,'affiliate-a','bubbleblast',now)).total,1);
 assert.equal((await readGameClicks(store,'affiliate-b','blockwin',now)).total,1);
 assert.equal((await readGameClicks(store,'affiliate-b','bubbleblast',now)).total,0);
});

test('PIS IO receipt marks are personal, protected and do not alter the amount',async()=>{
 const {markPisReceipt}=await import('../server/pisLedger');
 const receipt=store.collection('pis_transfers').doc('receipt-test');
 await receipt.set({members:['sender','recipient'],status:'completed',cents:4999});
 await assert.rejects(markPisReceipt(store,receipt.id,'stranger',true),{status:404});
 await Promise.all([markPisReceipt(store,receipt.id,'sender',true),markPisReceipt(store,receipt.id,'recipient',true)]);
 await markPisReceipt(store,receipt.id,'sender',false);
 assert.deepEqual((await receipt.get()).data(),{members:['sender','recipient'],status:'completed',cents:4999,receiptMarks:{sender:false,recipient:true}});
});
