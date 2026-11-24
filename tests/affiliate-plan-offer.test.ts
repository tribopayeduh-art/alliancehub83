import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceAffiliateOffer,affiliateOfferDay} from '../server/affiliatePlanOffer.ts';

test('the sixth conversion freezes the estimate for the first six conversions',()=>{
 let offer;
 for(let i=1;i<=6;i++){
  offer=advanceAffiliateOffer(offer,10000)!;
  assert.equal(offer.count,i);
  assert.equal(offer.differenceCents,i*1500);
 }
 assert.equal(advanceAffiliateOffer(offer,20000),null);
});
test('offer day resets at local midnight, not UTC midnight',()=>{
 assert.equal(affiliateOfferDay(new Date('2026-11-24T02:59:59Z')),'2026-11-23');
 assert.equal(affiliateOfferDay(new Date('2026-11-24T03:00:00Z')),'2026-11-24');
});
