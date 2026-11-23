export const regionGames = [
 ['bubbleblast','Bubble Win'],['subwaypay','Subway Pay'],['gen-dino','Gen Dino'],['raspafortuna','Raspadinha da Sorte'],['blockwin','Block Win'],['zumbla','Zumbla Win'],['countmasters','Count Masters']
] as const;
export function validGameUrl(value:string, allowPath=false){
 if(!value)return true;
 if(value.length>2048||/[\\\s]/.test(value))return false;
 if(allowPath&&value.startsWith('/')&&!value.startsWith('//'))return true;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}
}
export function brazilianLink(game:string){return ({bubbleblast:'/bubbleblast/',subwaypay:'/subwaypay/index.html','gen-dino':'/gen-dino/index.html',raspafortuna:'/raspafortuna/index.html',zumbla:'/zumbla'} as Record<string,string>)[game]||'/?site='+game;}
