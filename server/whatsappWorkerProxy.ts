import {fetchWithTimeout} from './network.ts';
export function whatsappWorkerProxy(req:any,res:any,next:any){
 const base=process.env.WHATSAPP_WORKER_URL;
 if(!base)return next();
 let url:URL;try{url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.hostname===req.hostname)throw new Error();}catch{return res.status(503).json({error:'Configure uma URL HTTPS de worker persistente diferente deste servidor.'});}
 if(!process.env.WHATSAPP_WORKER_TOKEN)return res.status(503).json({error:'Configure a autenticação do worker WhatsApp.'});
 url.pathname='/api/campaigns/whatsapp'+req.path;url.search='';
 void(async()=>{try{const response=await fetchWithTimeout(url.toString(),{method:req.method,headers:{'Content-Type':'application/json','Authorization':String(req.headers.authorization||''),'X-Inex-Worker-Token':process.env.WHATSAPP_WORKER_TOKEN!},timeoutMs:20000,...(req.method!=='GET'?{body:JSON.stringify(req.body||{})}:{})});const data=await response.json();res.status(response.status).json(data);}catch{res.status(503).json({error:'Worker WhatsApp indisponível. Nenhuma entrega foi confirmada.'});}})();
}
