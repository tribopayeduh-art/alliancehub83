import { drawScratchPrize } from './scratchRtp.ts';
import crypto from 'node:crypto';
import type {GameBetDB,UserDB} from './db.ts';
const failure=(message:string,status=400)=>Object.assign(new Error(message),{status});
function player(user:UserDB|null):asserts user is UserDB{
 if(!user)throw failure('Faça login para jogar com seu saldo.',401);
 if(user.isBlocked||(user as any).financialReviewHold||Number((user as any).financialDebt)>0||user.role==='affiliate'||(user as UserDB & {isAffiliate?:boolean}).isAffiliate||user.registeredGame==='alliance_hub')throw failure('Conta indisponível para apostas.',403);
}
function betId(game:string,userId:string,key?:string){
 if(key){if(!/^[a-zA-Z0-9-]{16,80}$/.test(key))throw failure('Identificador da operação inválido.');return game+'_'+crypto.createHash('sha256').update(userId+':'+key).digest('hex');}
 return game+'_'+crypto.randomUUID();
}
export async function startBubble(db:any,user:UserDB|null,body:any,key?:string){
 player(user);
 const cents=Number(body.betCents??body.stake??1000),config=await db.getGameConfig('g_bubble_blast');
 if(!Number.isSafeInteger(cents)||cents<=0)throw failure('Entrada inválida.');
 const amount=cents/100;
 if(config.status==='inactive'||config.maintenance)throw failure('O jogo está em manutenção.');
 if(amount<(config.minBet??5)||amount>(config.maxBet??500))throw failure('Entrada fora dos limites do jogo.');
 const id=betId('bubble',user.id,key);
 const bet:GameBetDB={id,gameId:'g_bubble_blast',userId:user.id,betAmount:amount,payoutAmount:0,profitAmount:-amount,multiplier:1,status:'active',difficulty:config.difficulty||'medium',createdAt:new Date().toISOString()};
 const balance=await db.startGameBetAtomic(bet,'BubbleWin');
 return {ok:true,betId:id,balanceCents:Math.round(balance*100),rtpPercent:config.rtpPercent??95,difficulty:config.difficulty||'medium'};
}
export async function settleBubble(db:any,user:UserDB|null,body:any){
 player(user);
 if(typeof body.betId!=='string'||!body.betId)throw failure('Informe a rodada iniciada.');
 const bet=await db.getGameBetById(body.betId);
 if(!bet||bet.userId!==user.id||bet.gameId!=='g_bubble_blast')throw failure('Rodada não encontrada.',404);
 const balance=await db.settleGameBetAtomic(bet.id,user.id,0,'cashed_out','BubbleWin','g_bubble_blast');
 const settled=await db.getGameBetById(bet.id),payout=Number(settled.payoutAmount||0);
 return {ok:true,won:payout>0,payoutAmount:payout,balanceCents:Math.round(balance*100),financialModel:'server-authoritative'};
}
export async function settleSubway(db:any,user:UserDB|null,body:any){
 player(user);
 const bet=typeof body.betId==='string'?await db.getGameBetById(body.betId):null;
 if(!bet||bet.userId!==user.id||bet.gameId!=='g_subway_pay')throw failure('Rodada não encontrada.',404);
 if(body.outcome==='offer'){
  const payout=bet.status==='active'?await db.getSubwayAuthorizedPrize(bet.id,user.id):0;
  return {success:true,payout};
 }
 if(body.outcome==='cashout'){
  const payout=bet.status==='active'?await db.getSubwayAuthorizedPrize(bet.id,user.id):Number(bet.payoutAmount||0);
  if(!(payout>0))throw failure('Esta rodada não tem prêmio disponível para saque.',409);
 }
 const balance=await db.settleGameBetAtomic(bet.id,user.id,0,'cashed_out','SubwayPay','g_subway_pay');
 const settled=await db.getGameBetById(bet.id),payout=Number(settled.payoutAmount||0);
 return {success:true,outcome:payout>0?'cashout':'loss',payout,multiplier:payout/bet.betAmount,balance,financialModel:'server-authoritative'};
}

const scratchPrices:Record<string,number>={carros:20,fan160:10,twister:15,tech:10,iphone:5,dinheiro:5,pix:5,'byd-song':20,'byd-dolphin':15,'bmw-audi':25,'bmw-motos':20,combo:25};
export async function startScratch(db:any,user:UserDB|null,body:any,key?:string){
 player(user);const price=scratchPrices[String(body.gameId)];if(!price)throw failure('Raspadinha não encontrada.');
 const config=await db.getGameConfig('g_raspa_fortuna');if(config.status==='inactive'||config.maintenance)throw failure('O jogo está em manutenção.');
 const id=betId('scratch',user.id,key),existing=await db.getGameBetById(id);
 if(existing&&(existing.userId!==user.id||existing.cardId!==body.gameId))throw failure('Rodada incompatível.');
 const rtpPercent=existing?.rtpPercent ?? config.rtpPercent ?? 88;
 const prize=existing?existing.scratchPrize:drawScratchPrize(price,rtpPercent);
 const balance=await db.startGameBetAtomic({id,userId:user.id,gameId:'g_raspa_fortuna',cardId:body.gameId,scratchPrize:prize,rtpPercent,difficulty:config.difficulty||'medium',betAmount:price,payoutAmount:0,multiplier:1,status:'active',createdAt:new Date().toISOString()} as GameBetDB,'RaspaFortuna');
 const stored=await db.getGameBetById(id);
 return {success:true,betId:id,balance,prize:stored.scratchPrize};
}
export async function revealScratch(db:any,user:UserDB|null,body:any){
 player(user);const bet=typeof body.betId==='string'?await db.getGameBetById(body.betId):null;
 if(!bet||bet.userId!==user.id||bet.gameId!=='g_raspa_fortuna'||!Number.isFinite(bet.scratchPrize))throw failure('Rodada não encontrada ou criada por uma versão anterior.',404);
 const prize=bet.scratchPrize;
 const balance=await db.settleGameBetAtomic(bet.id,user.id,prize,prize>0?'cashed_out':'lost','RaspaFortuna','g_raspa_fortuna');
 return {success:true,balance,prize};
}

const standardGames:Record<string,string>={g_gen_dino:'g_gen_dino','gen-dino':'g_gen_dino',g_block_puzzle:'g_block_puzzle','block-puzzle':'g_block_puzzle',g_zumbla:'g_zumbla',zumbla:'g_zumbla'};
export async function startStandardGame(db:any,user:UserDB|null,game:string,body:any,key?:string){
 player(user);const gameId=standardGames[game];if(!gameId)throw failure('Jogo não encontrado.',404);
 const config=await db.getGameConfig(gameId),amount=Number(body.betAmount);
 if(config.status==='inactive'||config.maintenance)throw failure('O jogo está em manutenção.');
 if(!Number.isFinite(amount)||!Number.isSafeInteger(Math.round(amount*100))||Math.abs(amount*100-Math.round(amount*100))>1e-7||amount<=0||amount<(config.minBet??1)||amount>(config.maxBet??500))throw failure('Entrada fora dos limites do jogo.');
 const id=betId(gameId,user.id,key);
 const balance=await db.startGameBetAtomic({id,userId:user.id,gameId,betAmount:amount,payoutAmount:0,multiplier:1,status:'active',difficulty:config.difficulty||'medium',createdAt:new Date().toISOString()} as GameBetDB,gameId);
 return {success:true,betId:id,balance};
}
export async function settleStandardGame(db:any,user:UserDB|null,game:string,body:any){
 player(user);const gameId=standardGames[game];if(!gameId)throw failure('Jogo não encontrado.',404);
 const bet=typeof body.betId==='string'?await db.getGameBetById(body.betId):null;
 if(!bet||bet.userId!==user.id||bet.gameId!==gameId)throw failure('Rodada não encontrada.',404);
 const balance=await db.settleGameBetAtomic(bet.id,user.id,0,'cashed_out',gameId,gameId);
 const settled=await db.getGameBetById(bet.id),payout=Number(settled.payoutAmount||0);
 return {success:true,balance,payout,payoutAmount:payout,won:payout>0,status:settled.status,coins:Math.floor(payout),financialModel:'server-authoritative'};
}
