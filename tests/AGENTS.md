# AGENTS — Testes

- Ler `.agents/skills/testes-qualidade/SKILL.md` e `docs/09-plano-testes.md`.
- Unitários: regras de pedido, arredondamento/cálculo em centavos, mudanças de estado e cenários de cartão.
- Integração: Fastify `inject()` com SQLite em memória/arquivo temporário, migrado e populado a cada suíte.
- E2E: Playwright no navegador real com frontend e backend testáveis, preferencialmente ambiente isolado.
- Cobrir cartão aprovado, insuficiência de limite, recusa genérica, erro de formulário, recálculo servidor e acompanhamento de pedido.
- Não mockar a lógica sob teste; é permitido mockar somente fronteiras externas (não deve haver gateway externo).
- Ter dados determinísticos e limpeza automática; sem flakiness, sem snapshots massivos de UI, sem dependência de internet.
- Cinco colegas avaliadores são **testes humanos separados**, nunca substituídos por Playwright e nunca inventados.
