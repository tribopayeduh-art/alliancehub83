import {readApiJson} from './readApiJson';
import type {AffiliateInfo} from '../types';
export async function loadAffiliateInfo(token:string,options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<AffiliateInfo>{
 if(!token)throw Object.assign(new Error('Sua sessão não foi encontrada. Entre novamente para abrir o programa de afiliados.'),{status:401});
 const controller=new AbortController();let expired=false;
 const abort=()=>controller.abort();
 if(options.signal?.aborted)controller.abort();else options.signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{expired=true;controller.abort();},options.timeoutMs??25000);
 try{
  const response=await (options.fetcher||fetch)('/api/affiliates/info',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
  const data=await readApiJson(response);
  if(!response.ok){const message=response.status===401?'Sua sessão expirou. Entre novamente para continuar.':response.status===403?'Sua conta não tem acesso a esta área.':typeof data?.error==='string'&&!/<(?:html|!doctype)/i.test(data.error)?data.error.slice(0,200):'Não foi possível carregar os dados de afiliado. Tente novamente.';throw Object.assign(new Error(message),{status:response.status});}
  if(!data||typeof data.referralCode!=='string'||!data.referralCode.trim()||!Array.isArray(data.indications??[]))throw new Error('O servidor retornou dados incompletos do programa de afiliados. Tente novamente.');
  return data;
 }catch(error:any){if(expired)throw Object.assign(new Error('A consulta demorou mais que o esperado. Confira sua conexão e tente novamente.'),{code:'AFFILIATE_TIMEOUT'});if(error.name==='TypeError')throw new Error('Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.');throw error;}
 finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
