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
