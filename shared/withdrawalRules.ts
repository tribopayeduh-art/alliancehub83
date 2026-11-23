export const MIN_COMMISSION_WITHDRAW=20;
export const MAX_COMMISSION_WITHDRAW=100000;
export function validCommissionRequest(amount:number){return Number.isFinite(amount)&&amount>=MIN_COMMISSION_WITHDRAW&&amount<=MAX_COMMISSION_WITHDRAW&&Math.abs(amount*100-Math.round(amount*100))<1e-6;}
