const dateFormat = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
export const affiliateOfferDay = (at=new Date()) => dateFormat.format(at);
export const affiliateOfferId = (userId:string,day:string) => userId+'_'+day;

export function advanceAffiliateOffer(previous:{count:number;differenceCents:number}|undefined,depositCents:number){
 const count=previous?.count??0;
 if(count>=6) return null;
 return {
  count: count+1,
  differenceCents:(previous?.differenceCents??0)+Math.floor(depositCents*85/100)-Math.floor(depositCents*70/100),
 };
}
