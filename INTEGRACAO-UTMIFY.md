# iNEX · Integração UTMify

## Onde usar

- Afiliado: Programa de afiliados → Integrações → UTMify.
- Admin: Configurações → Integrações dos afiliados. Requer superadmin ou permissão de gerenciamento de usuários.
- Visual neutro, campos de 16px para evitar zoom automático no celular, botões de toque e tabelas com rolagem interna.

## Configurar envio

1. Na UTMify, abra Integrações → Webhooks → Credenciais de API → Adicionar Credencial → Criar Credencial.
2. Cole a credencial no painel do afiliado, marque Sincronizar meus depósitos e salve.
3. Use Testar PIX pendente e Testar PIX pago. Aguarde 15 segundos entre testes. Estes pedidos usam `isTest: true`: validam os dados sem registrar uma venda e sem criar cobrança ou saldo na iNEX.
4. A partir da ativação, os próximos depósitos elegíveis aparecem no histórico. O cadastro do pagador precisa estar correto para a API aceitá-lo.

A integração usa POST https://api.utmify.com.br/api-credentials/orders com x-api-token. O token é criptografado com AES-256-GCM no servidor e nunca é retornado ao navegador ou ao administrador.

## Origem e valores

- Cobrança real gerada: `waiting_payment`.
- Depósito creditado após confirmação do gateway: `paid`.
- Mesmo `orderId`, mesmo `createdAt` UTC; `approvedDate` vem do crédito confirmado, não do clique no painel.
- A origem fica vinculada à cobrança. O influenciador direto recebe as cobranças de seus próprios indicados; sem influenciador, o destinatário é o afiliado responsável. Não se envia a mesma cobrança também para o Hub.
- Apenas a conexão do titular pode listar ou retomar seus envios. O admin pode pausar/liberar, sem ler as credenciais.
- A integração informa o volume bruto do depósito em centavos como valor do pedido. Não informa sua comissão financeira como se fosse o valor depositado. O campo de comissão exigido pela UTMify acompanha o valor bruto (modalidade permitida pela documentação quando não se informa a comissão). Não se deduz taxa bancária desconhecida.
- Envia cadastro real do pagador (nome/e-mail/telefone/documento quando disponível), jogo, datas e UTMs. Dados ausentes não são inventados. A API pode rejeitar cadastros incompletos; o motivo técnico fica no histórico.
- UTMs/src/sck são capturados no acesso com parâmetros pela própria origem/domínio, guardados em cookie HTTP-only e associados ao cadastro/cobrança. Para campanhas em outro domínio de jogo, mantenha os parâmetros na URL desse domínio: cookies não atravessam domínios diferentes.
- Simulações, apostas, saques e ajustes administrativos não são exportados como vendas. Não há importação automática de depósitos antigos.

## Fila e recuperação

O registro de envio é escrito na mesma transação que a criação/atualização da cobrança ou o crédito do depósito. Uma falha da API externa não desfaz o crédito confirmado. Há chave determinística por cobrança/destinatário, trava de processamento, revisão do status, retentativas limitadas e backoff.

- Timeout, 429 e 5xx: nova tentativa com espera; Retry-After é respeitado.
- Erros de credencial/cadastro: requerem correção e o botão Tentar novamente.
- O painel nunca aceita um payload ou um status de pagamento informado pelo afiliado. A retomada reconstrói o pedido dos registros internos.
- A atualização para pago não regride para pendente em polls atrasados.
- O envio inicial acontece no fluxo da cobrança/confirmação. No servidor local, a fila também é processada a cada 30 segundos. Processar fila, no painel, tenta até três pedidos elegíveis por acionamento.
- Na Vercel, configure `CRON_SECRET` nas variáveis de ambiente e mantenha o redeploy. O `vercel.json` inclui recuperação diária às 06:00 UTC (03:00 de Brasília), com até 20 pedidos por execução. Sem essa variável a rota retorna 401, evitando acionamentos públicos.
- Para recuperar falhas com menor atraso em produção, configure uma chamada agendada por minuto a `GET /api/cron/utmify` com `Authorization: Bearer SEU_CRON_SECRET` em um agendador externo, ou altere o cron conforme o plano da Vercel. O padrão diário permite uso no Hobby. A confirmação normal não depende de abrir o painel.
- Pedidos com mais de 7 dias não são reenviados (limite da documentação UTMify). Falhas prolongadas precisam de acompanhamento.
- Desativar/pausar impede novos envios; pedidos já conhecidos continuam recebendo atualização interna de status, para retomar pelo resultado mais recente. Uma chamada externa que já estava em andamento não pode ser desfeita pelo painel.
- Desconectar remove as credenciais e mantém histórico para consulta. Credenciais não são incluídas no ZIP.

Mantenha `SYSTEM_ENCRYPTION_KEY` estável, como já usado na plataforma. Não troque a chave depois de salvar os tokens, pois isso impede sua decifragem. Não publique `.env.local` no GitHub.

## Consulta opcional de resultados

A API de consulta usa outra chave:

1. UTMify → Avançado → API Oficial → Novo Token.
2. Plano elegível (Monster, Scale ou Enterprise) e allowlist do beta são exigidos pela UTMify.
3. Salve essa chave e o ID do dashboard de 24 caracteres na seção opcional.
4. Consulte 7 ou 30 dias. O servidor usa Bearer no domínio query-api.utmify.com.br e filtra a plataforma iNEX. Valores em centavos são apresentados em moeda; pode haver aproximadamente 2 minutos de cache. A consulta é limitada no painel a uma a cada 2 minutos.

A consulta externa não altera os saldos nem substitui o banco da iNEX como fonte financeira.

## Validado nesta versão

- TypeScript e build de frontend/backend.
- 132 testes automatizados, incluindo fila, concorrência, autenticação/autorização HTTP, criptografia, backoff, isolamento de contas, mocks da UTMify e depósito com persistência Postgres local.
- Não foram enviados dados ou pagamentos reais à UTMify, Pixup ou Dotfy durante o desenvolvimento.
- Validação com a conta real é feita pelos botões de teste após configurar sua credencial. A verificação visual em aparelhos físicos continua pendente.
- Esta entrega é um ZIP completo de código-fonte; não faz push nem redeploy automaticamente.

## Testar no Windows

Preserve seu `.env.local` anterior na pasta de destino. Depois de baixar o ZIP em Downloads, execute no CMD:

```cmd
cd /d "%USERPROFILE%\Downloads" && powershell -NoProfile -Command "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath 'inex-utmify-integrado.zip' -DestinationPath 'inex-afiliados-local' -Force" && cd inex-afiliados-local && npm ci && npm run local
```

Abra http://localhost:3001. Ao publicar, suba os arquivos extraídos e faça novo build/redeploy.

Documentação consultada: https://docs.utmify.com.br/envio-de-vendas e https://docs.utmify.com.br/consulta-de-dados.
