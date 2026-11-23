import crypto from 'node:crypto';
export const AUTHORITATIVE_GAMES=new Set(['g_bubble_blast','g_subway_pay','g_gen_dino','g_block_puzzle','g_zumbla']);
export function financialDraw(stakeCents:number,rtp:number,maxMultiplier:number,draw=crypto.randomInt){
 if(!Number.isSafeInteger(stakeCents)||stakeCents<=0||!Number.isFinite(rtp)||rtp<.1||rtp>100)throw new Error('Modelo financeiro inválido.');
 const multiplier=Math.max(1,Math.min(50,Number(maxMultiplier)||2));
 const prizeCents=Math.round(stakeCents*multiplier);
 const probability=Math.min(1,stakeCents*(rtp/100)/prizeCents);
 return {prizeCents:draw(0,1000000000)<Math.round(probability*1000000000)?prizeCents:0,rtp,maxMultiplier:multiplier};
}
export function createRoundAuthority(bet:any,config:any){
 const seed=crypto.randomBytes(32).toString('hex'),rtp=Number(config?.rtpPercent??95);
 const result=financialDraw(Math.round(bet.betAmount*100),rtp,Math.min(bet.gameId==='g_subway_pay'?5:bet.gameId==='g_bubble_blast'?8:50,Number(config?.maxMultiplier||2)));
 return {...result,userId:bet.userId,gameId:bet.gameId,betId:bet.id,seed,commitment:crypto.createHash('sha256').update(JSON.stringify([bet.id,seed,result.prizeCents,rtp])).digest('hex'),createdAt:bet.createdAt,model:'fixed-prize-v1'};
}
