import {readApiJson} from './readApiJson';
export async function requestJson(url:string,options:RequestInit={},timeoutMs=15000){
 const controller=new AbortController();const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,timeoutMs);if(options.signal?.aborted)controller.abort();
 try{const response=await fetch(url,{...options,signal:controller.signal});const data=await readApiJson(response);if(!response.ok)throw Object.assign(new Error(data.error||'Não foi possível concluir a consulta.'),{status:response.status});return data;}
 catch(e:any){if(e.name==='AbortError')throw Object.assign(new Error('A consulta demorou mais que o esperado. Tente novamente.'),{status:408});throw e;}
 finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
export function uniqueTransactions<T extends {id:string}>(primary:T[],secondary:T[]){const seen=new Set<string>();return [...primary,...secondary].filter(row=>{if(!row.id||seen.has(row.id))return false;seen.add(row.id);return true;});}

export function deadlineFetch(input:RequestInfo|URL,init:RequestInit={}){return globalThis.fetch(input,{...init,signal:init.signal||AbortSignal.timeout(20000)});}
