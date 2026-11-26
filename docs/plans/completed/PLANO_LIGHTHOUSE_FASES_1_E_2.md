# Plano de otimização Lighthouse — fases 1 e 2

Fluxo Completo. Escopo restrito à home pública, aos cabeçalhos indicados e às dependências de inicialização.

- [x] Capturar build de referência da workspace e comparar imports estáticos e navegação anônima.
- [x] Corrigir a diretiva de robots, a permissão obsoleta e a descrição do fallback do Pages. Conferir a resposta real dos assets e preservar a descoberta ARD.
- [x] Separar provedores visuais e de sessão por rota. Preservar o cliente de cache durante navegações com dados e executar a limpeza entre contas de forma síncrona.
- [x] Isolar registro do botão voltar, limpeza nativa e paleta de busca. Checar o grafo emitido após mudar os agrupamentos.
- [x] Adiar demonstrações e diálogo legal com âncoras, textos editoriais, teclado e geometria estável. Trocar a medição repetida da seção ativa por observação da faixa de ativação.
- [x] Reavaliar o precache conforme o grafo real. Manter o CSS global e medir antes de considerar sua divisão.
- [x] Rodar build, testes direcionados, verify:full e verificações de navegador. Atualizar arquitetura, roadmap e versão minor, e registrar a evidência e a validação de preview pendente.

A fase 3 fica fora desta entrega. A splash HTML, o hash do tema e a CSP de scripts são preservados.

## Evidências locais

O build de referência foi gerado da própria workspace antes da implementação. Na versão 3.32.0, o grafo estático de entrada caiu de 1.176 para 446 KiB minificados (370 para 159 KiB gzip). A união alcançável pela landing caiu de 1.410 para 604 KiB minificados (428 para 202 KiB gzip). Cmdk, monitor bancário, App Lock, Supabase, TanStack Query e motores financeiros ficaram fora do grafo anônimo.

A landing mantém as demonstrações iniciais montadas. Abas e cenários secundários carregam por seleção e o simulador carrega por proximidade, com a altura reservada medida entre 320 e 1280 px. Títulos e âncoras são montados junto à página. O CSS global foi mantido. As fontes críticas locais são entregues cedo, com fallback estável quando chegam tarde.

Lighthouse 13.6.0 em 4G lento local por DevTools, com os cabeçalhos do artefato, mediu SEO 92 → 100, Práticas Recomendadas 96 → 100, Acessibilidade 100 → 100 e Desempenho 40 → 58. LCP foi de 10,01 s para 6,52 s e Speed Index de 8,84 s para 5,78 s. FCP aumentou de 1,60 s para 2,21 s neste ensaio. CLS foi de 0,0027 para 0. A categoria agêntica ficou em 98 nas duas medições, com os mesmos avisos ARD de tipos de mídia. Os catálogos, o sitemap e os arquivos llms são idênticos à base.

O build, verify:full e 125 testes direcionados passaram. Chromium verificou abertura da landing e da tela offline, troca de versão do service worker e endpoints estáticos com o worker ativo. A homologação com contas e checkout reais, o prompt nativo de instalação e a pontuação no Cloudflare Pages permanecem para o preview.
