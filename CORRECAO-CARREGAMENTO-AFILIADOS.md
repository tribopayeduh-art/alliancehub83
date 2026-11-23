# Correção do carregamento do programa de afiliados

A tela anterior mantinha o estado de carregamento quando a API retornava erro, dados incompletos ou não havia token. Também existiam hooks de paginação depois de um retorno condicional: a quantidade de hooks mudava quando os dados chegavam.

A ordem dos hooks foi corrigida. A consulta agora tem limite de 25 segundos, cancela ao sair da tela e distingue falha de sessão, permissão, rede, dados incompletos e erro retornado pelo servidor. Tentar novamente executa uma nova consulta mesmo sem callback externo. A sincronização manual só informa sucesso depois de receber dados válidos.

O tratamento não cria link, saldo ou métricas fictícias. Se o Supabase ou o backend continuarem indisponíveis, a mensagem será apresentada para diagnóstico; esta mudança não implica que toda causa externa esteja corrigida.

## Aplicar localmente

1. Pare o servidor com Ctrl+C.
2. Extraia este pacote por cima da pasta da aplicação. Preserve seu .env.local, que não acompanha o ZIP.
3. Execute npm run dev e abra http://localhost:3000.
4. Se houver falha, copie a nova mensagem exibida. Não envie chaves privadas.

Validação: TypeScript, build, dois testes da consulta (sucesso, erro HTTP, sessão ausente, resposta incompleta, timeout e nova tentativa) e os sete testes de regressão existentes. Não foi feito um cadastro nem movimentação financeira real durante a correção.
