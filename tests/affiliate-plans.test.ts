import assert from 'node:assert/strict';
import test from 'node:test';
import { affiliatePlans, affiliateGameKey, planDifference } from '../shared/affiliatePlans.ts';
import { confirmAffiliatePlan, validatePlanSelection } from '../server/affiliatePlanCheckout.ts';

test('the server caps Starter at three distinct games and computes upgrades in cents',()=>{
 assert.deepEqual(affiliatePlans.map(p=>p.commissionPercent),[70,75,85]);
 assert.equal(planDifference('alliance','starter'),2910);
 assert.equal(planDifference('escale','alliance'),7000);
 assert.equal(planDifference('escale','starter'),9910);
 assert.equal(affiliateGameKey('g_block_puzzle'),'blockwin');
 assert.deepEqual(validatePlanSelection('starter',['blockwin','blockwin','subwaypay']),['blockwin','subwaypay']);
 assert.throws(()=>validatePlanSelection('starter',['blockwin','subwaypay','gen-dino','bubbleblast']));
 assert.throws(()=>validatePlanSelection('starter',['other-game']));
});

test('Pixup amount and identifier must match; confirmation updates entitlement once and never credits deposit balance',async()=>{
 const reference='inex-plan-'+'a'.repeat(32);
 const order={reference,userId:'new-affiliate',planId:'escale',previous:'starter',games:[],cents:9910,status:'pending',gatewayId:'pix_123'};
 const source=new Map<string,any>([
  ['affiliate_plan_orders/'+reference,order],
  ['affiliate_plan_accounts/new-affiliate',{planId:'starter',orderRef:reference,games:['blockwin']}],
  ['affiliates/aff-1',{revSharePercent:70,balance:12,status:'active'}],
 ]);
 const snapshot=(key:string)=>({data:()=>source.get(key)});
 const store:any={
  collection(name:string){return {doc:(key:string)=>name+'/'+key,where:()=>({get:async()=>({docs:[{ref:'affiliates/aff-1'}]})})};},
  runTransaction:(fn:any)=>fn({get:async(key:string)=>snapshot(key),set:(key:string,v:any)=>source.set(key,v),update:(key:string,v:any)=>source.set(key,{...source.get(key),...v})})
 };
 const event={event:'cashin.confirmed',transaction_id:'pix_123',data:{external_id:reference,transaction_id:'pix_123',type:'cashin',currency:'BRL',status:'confirmed',amount:'99.10'}};
 await assert.rejects(confirmAffiliatePlan({...event,data:{...event.data,amount:'97.90'}},store));
 assert.equal(source.get('affiliate_plan_accounts/new-affiliate').planId,'starter');
 assert.equal(await confirmAffiliatePlan(event,store),true);
 assert.equal(await confirmAffiliatePlan(event,store),true);
 assert.equal(source.get('affiliate_plan_accounts/new-affiliate').planId,'escale');
 assert.equal(source.get('affiliates/aff-1').revSharePercent,85);
 assert.equal(source.get('affiliates/aff-1').balance,12);
 assert.equal(source.has('charges/'+reference),false);
});

test('legacy Hub defaults to Alliance without changing negotiated or purchased rates',async()=>{
 const {legacyAllianceRate}=await import('../shared/affiliatePlans.ts');
 assert.equal(legacyAllianceRate({role:'affiliate'},70),75);
 assert.equal(legacyAllianceRate({role:'affiliate'},82),82);
 assert.equal(legacyAllianceRate({role:'affiliate',affiliatePlanRequired:true},70),70);
 assert.equal(legacyAllianceRate({role:'affiliate',isInfluencer:true},70),70);
 assert.equal(legacyAllianceRate({role:'user'},70),70);
});

test('admin changes the assigned plan without touching balances or creating a charge',async()=>{
 const {assignAffiliatePlan}=await import('../server/affiliatePlanCheckout.ts');
 const data=new Map<string,any>([['users/u',{id:'u',role:'affiliate'}],['affiliates/a',{userId:'u',status:'active',affiliateBalance:123,revSharePercent:75}]]);
 const store:any={
  collection:(name:string)=>({doc:(id:string)=>name+'/'+id,where:()=>({get:async()=>({docs:[{ref:'affiliates/a'}]})})}),
  runTransaction:(fn:any)=>fn({get:async(key:string)=>({data:()=>data.get(key)}),set:(key:string,v:any)=>data.set(key,v),update:(key:string,v:any)=>data.set(key,{...data.get(key),...v})}),
 };
 const input={userId:'u',actorId:'admin',planId:'escale',games:[],expected:'alliance'};
 assert.deepEqual(await assignAffiliatePlan(input,store),{planId:'escale',games:[]});
 assert.equal(data.get('users/u').affiliatePlanRequired,true);
 assert.equal(data.get('affiliates/a').revSharePercent,85);
 assert.equal(data.get('affiliates/a').affiliateBalance,123);
 assert.equal([...data.keys()].filter(k=>k.startsWith('affiliate_plan_audit/')).length,1);
 assert.equal([...data.keys()].some(k=>k.startsWith('affiliate_plan_orders/')),false);
 await assert.rejects(assignAffiliatePlan(input,store),{status:409});
 data.set('affiliate_plan_accounts/u',{planId:'escale',orderRef:'pending'});
 data.set('affiliate_plan_orders/pending',{status:'pending'});
 await assert.rejects(assignAffiliatePlan({...input,expected:'escale',planId:'alliance'},store),{status:409});
});
