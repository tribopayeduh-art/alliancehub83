# Atualização da auditoria iNEX

## Rodar no Windows
Extraia este ZIP em uma pasta nova. Instale Node.js 22. Para usar credenciais locais existentes, copie seu .env.local para a pasta extraída, fora de qualquer publicação. Use um projeto Supabase de teste para não movimentar o banco de produção. Na pasta extraída, execute `npm ci`, `npm run setup:local` e `npm run local`. Abra http://localhost:3001. Rode `npm run build` antes de `npm test`.

## Mudanças no comportamento
- Bubble, Subway, Dino, Block e Zumbla passam a liquidar no servidor. O modelo financeiro usa sorteio próprio, com prêmio fixo quando há vitória e probabilidade ajustada pelo RTP. As ações e os pontos do jogo visual não determinam o prêmio financeiro. Isso muda a mecânica em relação à versão anterior. A raspadinha usa o prêmio registrado no servidor e Count Masters mantém seu motor próprio. Não é certificação independente de RTP.
- Rodadas antigas ainda abertas sem registro da nova autorização vão para análise no Admin → Jogos. A devolução da entrada exige justificativa e não é repetida automaticamente.
- Solicitações de saque de jogadores reservam o valor, persistem taxa, líquido, destino e pedido em uma transação. Saques de comissão permanecem em carteira separada.
- Pixup e Dotfy compartilham a distribuição contábil dos novos depósitos elegíveis. Distribuições inconsistentes entram em revisão no Admin → Comissões. Esta rotina não executa as antigas regras de desvio de comissão. Históricos e saldos anteriores não são reprocessados.
- Estornos da Pixup e eventos MED são registrados para revisão no Admin → Saques. A decisão contábil exige conciliação e justificativa. MED por si só não cria segundo débito. Não concilie sem conferir o comprovante do gateway.
- A UTMify tem fila persistente, independente da resposta bancária. No Admin → Sistema e conexões estão os indicadores de configuração; eles não comprovam conectividade real.

## Homologação e publicação
Use outro ambiente antes de publicar. Confirme o projeto conectado ao repositório correto e use o runtime Node.js 22. Configure variáveis e chaves no ambiente, conforme .env.example, mantendo os segredos de sessão e criptografia originais se já houver dados. Para Pixup, configure OAuth e o callback HTTPS; valide a origem do webhook na hospedagem efetiva. Configure CRON_SECRET para recuperação da fila. Para Baileys na Vercel, configure worker HTTPS persistente conforme .env.example. Não publique .env.local.

Valide depósitos, saques, estornos, comissões e UTMify com as credenciais do ambiente de homologação. Revise também navegação em iPhone e Android, dados legados, eventos sem vínculo e conciliação bancária. O pacote não representa deploy, teste de integração com credenciais em produção ou certificação do aplicativo.
