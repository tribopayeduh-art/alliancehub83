(()=>{
 const original=window.fetch.bind(window),routes=new Set(['/api/wallet/withdraw','/api/wallet/withdraw-affiliate','/api/finance/withdraw','/api/withdrawals','/api/game/raspa-fortuna/withdraw']);
 window.fetch=async(input,options={})=>{
  const raw=input instanceof Request?input.url:String(input),url=new URL(raw,location.origin),method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(url.origin!==location.origin||method!=='POST'||!routes.has(url.pathname))return original(input,options);
  const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));
  if(headers.has('Idempotency-Key'))return original(input,options);
  let body=typeof options.body==='string'?options.body:input instanceof Request?await input.clone().text():'';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url.pathname+':'+headers.get('Authorization')+':'+body)),keyName='inex-financial-'+Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  let key;try{key=sessionStorage.getItem(keyName);}catch{}if(!key){key=crypto.randomUUID();try{sessionStorage.setItem(keyName,key);}catch{}}
  headers.set('Idempotency-Key',key);
  const response=await original(input,{...options,headers});
  if(response.ok||response.status>=400&&response.status<500&&![408,409,429].includes(response.status)){try{sessionStorage.removeItem(keyName);}catch{}}
  return response;
 };
})();
