/** Catalog draft. Billing and access enforcement must use confirmed server-side entitlements. */
export const affiliatePlans = [
  {
    id: 'starter',
    name: 'Starter',
    priceCents: 9790,
    commissionPercent: 70,
    benefits: ['Escolha até 3 jogos para divulgar', 'Painel de cliques e cadastros', 'Kit básico de divulgação', 'Suporte padrão'],
  },
  {
    id: 'alliance',
    name: 'Alliance',
    priceCents: 12700,
    commissionPercent: 75,
    benefits: ['Mais de 3 jogos no catálogo atual', 'Relatórios por campanha com exportação', 'Integração UTMify', 'Kit de divulgação ampliado'],
  },
  {
    id: 'escale',
    name: 'Escale',
    priceCents: 19700,
    commissionPercent: 85,
    benefits: ['Todos os jogos atuais e futuros', 'Relatórios avançados por jogo e canal', 'Suporte humano prioritário'],
  },
] as const;

export type AffiliatePlanId = typeof affiliatePlans[number]['id'];
export const planGames = [
  {id:'subwaypay',name:'Subway Pay'}, {id:'blockwin',name:'Block Win'},
  {id:'gen-dino',name:'GEN DINO'}, {id:'raspa-fortuna',name:'Raspa Fortuna'},
  {id:'bubbleblast',name:'Bubble Blast'},
] as const;
export const findAffiliatePlan = (id: unknown) => affiliatePlans.find(p=>p.id===id);
export function planDifference(target:AffiliatePlanId, current?:AffiliatePlanId) {
  return (findAffiliatePlan(target)?.priceCents ?? 0) - (findAffiliatePlan(current)?.priceCents ?? 0);
}
export function affiliateGameKey(value:unknown) {
  const key=String(value??'').toLowerCase().replace(/_/g,'-').replace(/^g-/,'');
  return ({'block-puzzle':'blockwin','block':'blockwin','block-win':'blockwin','bubble-blast':'bubbleblast','bubbles-win':'bubbleblast','subway-pay':'subwaypay','raspafortuna':'raspa-fortuna','gendino':'gen-dino'} as Record<string,string>)[key] ?? key;
}

// Legacy Hub accounts retain access without a checkout. Keep custom negotiated rates.
export function legacyAllianceRate(user:{affiliatePlanRequired?:boolean;role?:string;isAffiliate?:boolean;isInfluencer?:boolean;registeredGame?:string}, current?:number) {
  const hub=user.role==='affiliate'||user.isAffiliate===true||user.registeredGame==='alliance_hub';
  return !user.affiliatePlanRequired&&hub&&!user.isInfluencer&&(current==null||current===70)
    ? findAffiliatePlan('alliance')!.commissionPercent
    : current;
}
