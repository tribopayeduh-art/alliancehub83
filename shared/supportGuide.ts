export const accountGuide = [
 {key:'home',label:'Início',text:'Veja o resumo da conta. Para conferir movimentações e saldos em detalhe, abra Financeiro.'},
 {key:'finance',label:'Financeiro',text:'Consulte o extrato e toque em uma movimentação para ver data, status e identificador. Solicitações pendentes podem aparecer antes da confirmação do provedor.'},
 {key:'games',label:'Jogos',text:'Explore o catálogo. Na visão de afiliado, toque no banner para ver o desempenho das indicações ou em Jogar para abrir o jogo.'},
 {key:'more',label:'Mais',text:'Aqui ficam seu perfil, as ferramentas da conta e a Central de suporte.'},
 {key:'pix-keys',label:'Minhas Chaves PIX',text:'Cadastre e confira suas chaves aqui. Esse botão existe quando sua conta tem acesso às chaves PIX.'},
 {key:'affiliates',label:'Afiliados',text:'Abra o programa para conferir indicações, vínculos e comissões.'},
 {key:'support',label:'Central de suporte',text:'Volte aqui para abrir o chat, acompanhar uma resposta ou retomar este tutorial quando quiser.'},
];
export const adminGuide = [
 {key:'metrics',label:'Visão geral',text:'Acompanhe os indicadores da operação.'},
 {key:'live',label:'Jogadores ao vivo',text:'Consulte sessões e filtre por jogo ou jogador.'},
 {key:'users',label:'Usuários',text:'Localize uma conta para revisar o perfil e as opções permitidas para sua função.'},
 {key:'affiliates',label:'Gestão de afiliados',text:'Consulte carteiras, rede e preferências de saque dos afiliados.'},
 {key:'games',label:'Jogos',text:'Edite as configurações dos jogos e os links por país.'},
 {key:'commissions',label:'Comissões',text:'Acompanhe o cálculo e a atribuição das comissões.'},
 {key:'dotfy',label:'Gateway',text:'Revise provedores e roteamento financeiro. Antes de trocar o provedor, verifique as transações em andamento.'},
 {key:'deposits',label:'Depósitos',text:'Confira cada cobrança, seu status e a confirmação do provedor.'},
 {key:'withdrawals',label:'Saques',text:'Abra a solicitação pelo ID, confira os dados e use o fluxo financeiro existente para qualquer decisão sobre pagamento.'},
 {key:'reports',label:'Relatórios',text:'Escolha o período, abra transações e exporte os dados conforme sua permissão.'},
 {key:'support',label:'Suporte',text:'Abra tickets, leia o diagnóstico e aprove ou recuse o encaminhamento sugerido.'},
];
export const supportTopics = ['saque','deposito','pis','indicacoes','configuracoes','outro'] as const;
export type SupportTopic = typeof supportTopics[number];
export type SupportTicket = {
 id:string; userId:string; topic:SupportTopic; question:string; diagnosis:string; suggestion:string;
 transactionId?:string; status:'open'|'approved'|'rejected'; createdAt:string; decidedAt?:string; decidedBy?:string; reply?:string;
};
