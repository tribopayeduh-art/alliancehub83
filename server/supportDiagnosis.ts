import {accountGuide, type SupportTopic} from '../shared/supportGuide.ts';

const plain = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function inferSupportTopic(question:string):SupportTopic{
 const q=plain(question);
 if(/\b(pis[ -]?io|transferencia entre afiliados)\b/.test(q))return 'pis';
 if(/\b(saque[s]?|sacar|retirada[s]?)\b/.test(q))return 'saque';
 if(/\b(deposit[oa]\w*|cobranca|qr code|pix pago)\b/.test(q))return 'deposito';
 if(/\b(afiliad\w*|indicac\w*|comiss\w*|utmify)\b/.test(q))return 'indicacoes';
 if(/\b(configur\w*|perfil|senha|chave|tutorial|menu|preferencia\w*)\b/.test(q))return 'configuracoes';
 return 'outro';
}
type Movement = {id:string;type:string;status:string;createdAt:string};
export function diagnoseSupport(question:string,topic:SupportTopic,transactions:Movement[],account:{withdrawBlocked?:boolean;financialReviewHold?:boolean}):{answer:string;suggestion:string;escalate:boolean;transactionId?:string}{
 const q=plain(question);
 const explicitId=question.match(/(?:^|\s)(?:id|protocolo)\s*[:#]?\s*([a-z0-9_-]{5,100})/i)?.[1]?.toLowerCase();
 const kind=topic==='saque'?'withdrawal':topic==='deposito'?'deposit':null;
 if(kind){
  const own=transactions.filter(t=>t.type===kind);
  const t=explicitId ? own.find(r=>r.id.toLowerCase()===explicitId) : own[0];
  const operation=kind==='withdrawal'?'saque':'depósito';
  if(!t){
   return {answer:explicitId?'Não encontrei esse ID entre as movimentações da sua conta. Confira o identificador no extrato.':`Não encontrei um ${operation} no seu extrato. Se você já fez a solicitação, posso encaminhar para conferência.`,suggestion:`Conferir o extrato da conta e confirmar o identificador do ${operation} antes de orientar.`,escalate:true};
  }
  const status=String(t.status||'').toLowerCase();
  const context={transactionId:t.id};
  const prefix=(explicitId?'A movimentação informada':'A movimentação mais recente desse tipo')+` (${t.id})`;
  if(['paid','approved','completed','confirmed','success'].includes(status))return {...context,answer:`${prefix} consta como confirmada no iNEX. Se o valor não apareceu, solicite uma conferência com o ID; não repita a operação enquanto ela estiver sendo verificada.`,suggestion:'Conferir o registro no extrato e reconciliar com o provedor se o valor não foi localizado.',escalate:/nao|falt|diverg|sumiu|cade/.test(q)};
  if(['failed','rejected','cancelled','canceled','expired','refunded'].includes(status))return {...context,answer:`${prefix} não está ativa como pagamento confirmado. O código registrado é ${status}. Vou encaminhar para confirmar o motivo e o destino do saldo, sem pedir outro pagamento.`,suggestion:'Verificar o motivo no provedor e confirmar se houve estorno antes de orientar uma nova tentativa.',escalate:true};
  const hold=kind==='withdrawal'&&(account.withdrawBlocked||account.financialReviewHold);
  return {...context,answer:`${prefix} ainda não tem confirmação final no iNEX.${hold?' A conta também está com uma restrição de saque ou em revisão financeira.':''} O financeiro pode conferir o status e o motivo antes de orientar o próximo passo.`,suggestion:hold?'Revisar a razão da restrição da conta e informar ao usuário o próximo passo permitido.':'Conferir a solicitação e o retorno do provedor; informar se ainda aguarda processamento ou se precisa de correção.',escalate:true};
 }
 if(topic==='pis')return {answer:'Abra Financeiro → PIS IO. Confira os seis dígitos e o nome do destinatário antes de enviar. Se já enviou, abra a movimentação no histórico para consultar o comprovante. Evite repetir o envio até confirmar o status.',suggestion:'Conferir o histórico de transferências internas pelo identificador do comprovante, sem repetir o envio.',escalate:/sumiu|erro|nao|dupli|falha/.test(q)};
 if(topic==='indicacoes')return {answer:'Em Mais → Afiliados você encontra a rede e as comissões. Em Jogos, abra o banner e copie o link de indicação para medir os cliques. Links antigos podem continuar levando ao cadastro sem registrar cliques.',suggestion:'Conferir o vínculo de indicação, o jogo de origem e o período utilizado no painel.',escalate:false};
 if(topic==='configuracoes'){
  if(/chave|pix/.test(q))return {answer:'Em Mais → Minhas Chaves PIX, confira as chaves cadastradas e use as opções da tela para adicionar ou remover. No saque, revise a chave selecionada antes de confirmar.',suggestion:'Conferir se a dificuldade é cadastrar ou selecionar a chave, sem pedir a chave completa pelo chat.',escalate:false};
  if(/perfil|senha/.test(q))return {answer:'Em Mais → Perfil, confira seus dados. Se a dificuldade for recuperar o acesso, use o fluxo de recuperação na tela de login. A equipe não precisa receber sua senha.',suggestion:'Orientar o usuário pelo fluxo de perfil ou recuperação de acesso.',escalate:false};
  const step=accountGuide.find(item=>q.includes(item.key)||q.includes(item.label.toLowerCase()));
  return {answer:step?.text||'Abra Mais para acessar perfil, chaves PIX, afiliados e preferências. Se quiser ver onde fica cada botão, inicie o tutorial aqui no suporte.',suggestion:'Identificar a configuração que a pessoa quer alterar e orientar pelo menu correto.',escalate:false};
 }
 return {answer:'Me diga qual operação você estava tentando fazer e o que apareceu na tela. Para pagamentos, selecione Saques ou Depósitos e informe o ID do extrato, se tiver. Nunca envie senha, código de autenticação ou chave completa no chat.',suggestion:'Ler o relato e pedir apenas o contexto necessário para reproduzir o problema.',escalate:false};
}
