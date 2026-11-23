Painel de afiliados baseado no mockup aprovado.
Desktop: navegação lateral, KPIs, convite, gráfico e rede em tabela.
Celular: navegação horizontal, KPIs 2x2 e rede em cartões.
Seções funcionais: visão geral, rede, comissões, relatórios, materiais, configurações e operação avançada. As ferramentas anteriores continuam em operação avançada.
Dados da conta consultados por API. Gráfico de comissões diárias usa somente registros disponíveis, não inventa depósitos por dia. Resumo da rede usa indicações retornadas. CSV da rede respeita busca e filtros. Histórico de comissões exporta os registros retornados. Taxas, crédito e saques não foram alterados.
Preserve .env.local. Sem credenciais privadas no ZIP. Extraia na pasta de teste e execute npm ci. Depois: set "NODE_ENV=development" && set "DEFAULT_APP_PORT=3001" && npm run dev
Abra http://localhost:3001. Validados TypeScript, compilação e 5 testes (hooks, carregamento, timeout, prioridade HTML e CSV). Validação visual em aparelhos reais e pagamentos reais não executados. GitHub e Vercel não atualizados.
