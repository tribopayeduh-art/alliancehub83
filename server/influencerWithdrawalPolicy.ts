export function gameWithdrawalBlocked(user:{isInfluencer?:boolean;hasAffiliateDemoBalance?:boolean;withdrawBlocked?:boolean;isBlocked?:boolean}|null|undefined){
 return !user||Boolean(user.isInfluencer||user.hasAffiliateDemoBalance||user.withdrawBlocked||user.isBlocked);
}
export function canReviewGameWithdrawals(user:{role?:string}|null|undefined){return user?.role==='admin'||user?.role==='superadmin';}
export function validCommissionRelease(requested:number,release:number){return Number.isFinite(requested)&&requested>0&&Number.isFinite(release)&&release>0&&release<=requested;}
