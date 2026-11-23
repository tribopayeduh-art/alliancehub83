import {createHash} from 'node:crypto';
import type {SupabaseStore} from './supabaseStore';

type Counts = {total:number; days:Record<string,number>};
const dates = (now:Date) => Array.from({length:30},(_,i) =>
  new Date(now.getTime() - (29-i)*86400000).toISOString().slice(0,10));
const document = (store:SupabaseStore, affiliateId:string, game:string) => store.collection('affiliate_game_clicks')
  .doc(createHash('sha256').update(JSON.stringify([affiliateId,game])).digest('hex'));

export const referralGame = (value:unknown) => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value) ? value.toLowerCase() : '';

export async function recordGameClick(store:SupabaseStore, affiliateId:string, game:string, now=new Date()) {
  const ref = document(store,affiliateId,game);
  const days = dates(now), today = days[days.length-1];
  await store.runTransaction(async tx => {
    const previous: Counts | undefined = (await tx.get(ref)).data();
    const counts: Record<string,number> = {};
    for (const day of days) if (previous?.days[day]) counts[day] = previous.days[day];
    counts[today] = (counts[today] || 0) + 1;
    tx.set(ref,{days:counts,total:(previous?.total || 0)+1});
  });
}

export async function readGameClicks(store:SupabaseStore, affiliateId:string, game:string, now=new Date()) {
  const data: Counts | undefined = (await document(store,affiliateId,game).get()).data();
  return {total:data?.total || 0,days:dates(now).map(date=>({date,count:data?.days[date] || 0}))};
}
