# Report Studio

Aplicação web local para transformar planilhas Excel, CSV e TSV em relatórios PDF configuráveis. A especificação completa está em [PROMPT.md](PROMPT.md).

## Estado atual

**O fluxo local do MVP está implementado da importação ao PDF e ao modelo reutilizável.**

- Importação real de `.xlsx`, `.xls`, `.csv` e `.tsv`, processada em Web Worker.
- Validação de extensão, MIME, tamanho, assinatura e limites de processamento.
- Seleção de aba e linha de cabeçalho; prévia paginada de até 200 linhas, mantendo todas as linhas importadas em memória.
- Preservação de acentos, números, booleanos, datas, valores calculados de fórmulas e erros. Fórmulas e macros não são executadas.
- Diagnóstico de cabeçalhos vazios/duplicados, linhas/colunas vazias, células além do cabeçalho, tipos misturados, números como texto, espaços, separadores decimais e representações de datas inconsistentes.
- Dados originais separados da cópia de trabalho. Troca e descarte exigem confirmação; uma importação inválida preserva a planilha anterior.
- Limpeza opcional com prévia em Worker, contagem de células afetadas, amostra antes/depois e desfazer da última aplicação. Inclui espaços, caracteres invisíveis, linhas/colunas vazias, preenchimento, cabeçalhos duplicados e conversões explícitas de números/datas por coluna.
- As linhas e colunas do diagnóstico continuam usando a numeração original após remoções. Trocar aba ou cabeçalho avisa sobre o descarte das limpezas.
- Interface responsiva com PrimeVue, Aura, campos rotulados, foco visível e navegação por teclado.
- Configuração editorial de textos, página, cores, tipografia, formatos e colunas, com prévia paginada calculada pelo mesmo motor usado no PDF.
- Editor visual com coordenadas normalizadas, arraste por mouse ou toque, ajuste fino pelo teclado, redimensionamento, duplicação, ordem de camadas, alinhamento, propriedades em Drawer, margens, zoom e histórico limitado de desfazer/refazer.
- Importação assistida de PDF já pronto e preenchido: o documento original permanece como fundo vetorial, os textos e números compatíveis com a planilha viram campos editáveis e podem ser remapeados por coluna e linha sem criar JSON manualmente. Cabeçalhos alinhados também podem reconstruir uma tabela real sobre o modelo, com confiança indicada, colunas remapeáveis, larguras independentes e quebra automática dentro das células. Também é possível criar um campo manual quando nenhum texto é reconhecido.
- Prévia de qualquer registro da planilha no próprio editor, páginas adicionais duplicáveis e removíveis, textos livres, totalizadores, fórmulas, gráficos e tabelas adicionais.
- Imagens PNG/JPEG validadas e mantidas em memória, com preview, texto alternativo, proporção opcional e incorporação vetorial no PDF.
- Modelos JSON versão 1 validados com Zod, remapeamento explícito de colunas ausentes e incorporação opcional da imagem. A configuração também pode ser salva em uma biblioteca local do navegador e recebe rascunho automático.
- Verificação anterior à exportação para colunas ausentes, linhas inválidas, elementos fora da página, textos vazios e sobreposições fortes.
- PDF vetorial gerado em Web Worker, com Noto Sans incorporada, paginação, cabeçalhos repetidos, textos longos, rodapé e numeração. A exportação em lote reúne até 100 relatórios individuais, um por registro, no mesmo arquivo.

## Executar

Requisitos: Node.js 22.12+ (validado com 24.12) e pnpm 11.19.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra o endereço local informado pelo Vite. Não abra `index.html` diretamente.

```sh
pnpm build
pnpm preview
```

O build estático fica em `dist/`. O servidor de desenvolvimento/prévia serve somente os arquivos da aplicação; não existe backend de processamento.

## Verificação

Na primeira execução, instale o navegador de testes:

```sh
node node_modules/@playwright/test/cli.js install chromium
```

Se o download não estiver disponível e o Microsoft Edge estiver instalado, no PowerShell use `$env:PLAYWRIGHT_CHANNEL = 'msedge'` antes dos comandos de teste. A configuração também aceita outro canal suportado pelo Playwright. Nesta máquina, os testes de navegador usam Edge.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm verify
```

`verify` executa lint, formatação, regras de dependência/imports e ciclos, TypeScript, testes unitários/de componentes, build e testes E2E. Os E2E usam o build de produção na porta 4175; execute `pnpm build` antes de rodá-los isoladamente. As fixtures são pequenas e artificiais, geradas com SheetJS. Relatórios de teste são ignorados pelo Git. Use `pnpm format` para formatar os arquivos.

## Stack e estrutura

O código deve ser lido e mantido por pessoas. Prefira nomes que expressem intenção, declarações explícitas, funções com uma responsabilidade e fluxo fácil de acompanhar. Revise clareza e formato a cada alteração; comentários devem explicar decisões, sem repetir o código. A formatação é padronizada pelo Prettier e conferida no lint.

Vue 3, TypeScript strict, Vite, PrimeVue/Aura, PrimeIcons, Pinia, SheetJS, PDF.js, pdf-lib e Zod. PDF.js lê o conteúdo e monta a prévia do modelo; pdf-lib preserva suas páginas na exportação. A fonte Noto Sans é incorporada ao PDF com `@pdf-lib/fontkit`; os arquivos TTF oficiais são distribuídos sob a SIL Open Font License 1.1, preservada em `src/assets/fonts/OFL.txt`. Vitest, Vue Test Utils, Playwright, ESLint, Prettier e dependency-cruiser validam o projeto. As versões resolvidas estão fixadas em `pnpm-lock.yaml`.

- `src/domain/workbook`: tipos, seleção de cabeçalho e diagnóstico puro.
- `src/application/import-workbook`: validação e contrato de leitura.
- `src/application/clean-workbook`: planejamento de alterações e validação das opções de limpeza.
- `src/application/export-pdf`: validação e caso de uso da exportação.
- `src/adapters/excel`: SheetJS e Worker com limite de tempo.
- `src/adapters/cleaning`: execução da prévia de limpeza em Worker.
- `src/adapters/pdf`: renderização vetorial com pdf-lib e fonte incorporada.
- `src/adapters/images`: leitura e validação local de PNG/JPEG.
- `src/adapters/templates`: validação Zod e serialização segura do modelo JSON.
- `src/stores`: estado compartilhado entre importação e revisão.
- `src/features`: interface de cada etapa.
- `src/app` e `src/styles`: composição, tema e tokens visuais.
- `tests`: fixtures artificiais e fluxos no navegador.

## Privacidade

Planilhas são lidas e PDFs são gerados somente no navegador. Nenhum dado da planilha é enviado, persistido ou registrado no console. Não há login, banco, API, analytics, telemetria ou dependências carregadas de CDN em execução. A biblioteca e o rascunho automático usam `localStorage` somente para configuração, posições e relações de colunas; as linhas importadas e os arquivos PDF não são armazenados. Fechar ou recarregar a página remove os dados da planilha mantidos em memória.

O pacote oficial do SheetJS é baixado durante a instalação a partir da distribuição indicada pela [documentação do fornecedor](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), e incluído no build local. A aplicação instalada não depende desse endereço. O tema segue a [integração PrimeVue/Vite](https://primevue.org/vite/).

## Limites conhecidos

- Limites configuráveis em `DEFAULT_IMPORT_LIMITS`: 20 MB, 50 abas, 50.000 linhas por aba (incluindo cabeçalho), 256 colunas, 1 milhão de posições de células por arquivo e 30 segundos de parsing. Arquivos que excedem limites são rejeitados, sem importação parcial.
- Os limites reduzem o uso de recursos, mas arquivos compactados excepcionalmente grandes podem consumir memória durante a descompactação. O Worker evita bloquear a leitura na interface e é encerrado por timeout.
- Datas numéricas do Excel são interpretadas como datas de calendário, sem deslocamento de fuso, respeitando o sistema 1904. Datas textuais são preservadas e apenas sinalizadas por heurísticas; não há conversão automática.
- O diagnóstico não interpreta células vazias internas como linhas malformadas. Sinaliza valores além da última coluna com cabeçalho. Não valida toda combinação de datas textuais ou separadores de milhar.
- Arquivos criptografados, macros, estilos do Excel, gráficos e imagens da planilha não são importados. Fórmulas dependem do resultado já salvo no arquivo.
- Planilhas do Google podem ser usadas após exportação para XLSX ou CSV. A aplicação local não acessa diretamente uma conta Google.
- A primeira linha é sugerida como cabeçalho, sem alteração silenciosa. Linhas anteriores ao cabeçalho escolhido permanecem nos dados originais.
- Mais de 10 mil linhas gera um aviso, sem bloquear a importação. Há testes de importação e limpeza com 25 mil linhas e exportação PDF com mais de 10 mil linhas; a prévia visual continua limitada a 200 linhas e a amostra de alterações a 50 células.
- Conversão numérica não adivinha separadores de milhar e preserva zeros à esquerda e valores com mais de 15 dígitos significativos. Datas textuais só são convertidas mediante escolha de formato e colunas, com validação de calendário. O preenchimento usa texto de até 100 caracteres.
- A ordem da limpeza é: tratar texto, remover estrutura vazia, converter valores e preencher vazios. Há um nível de desfazer; uma nova aplicação substitui o snapshot anterior. Nenhuma limpeza é salva automaticamente.
- A configuração de textos, página, cores e colunas valida largura. A prévia, o editor e o PDF usam o mesmo cálculo de página e paginação; o PDF repete cabeçalho, preserva linhas inteiras, incorpora Noto Sans e só é baixado após ação explícita.
- Imagens aceitam PNG/JPEG de até 5 MB e 8.000 px por lado. Modelos aceitam JSON de até 2 MB. A imagem só é escrita no modelo quando a opção de incorporação é marcada.
- PDFs usados como modelo aceitam até 20 MB e 20 páginas. A relação automática depende de texto selecionável e de valores presentes na planilha; PDFs digitalizados como imagem exigirão OCR em uma evolução posterior. Campos não reconhecidos podem ser associados manualmente no editor.
- A reconstrução de tabelas é assistida: exige ao menos dois cabeçalhos reconhecíveis na mesma linha. O usuário deve conferir a confiança, as colunas e os limites sugeridos; tabelas com células mescladas, cabeçalhos rotacionados ou desenho irregular podem precisar de correção manual.
- A biblioteca local mantém até 12 modelos sem incorporar imagens. Para transportar um modelo entre navegadores, use o arquivo JSON e marque a incorporação da imagem quando necessário.
- A exportação por registro aceita até 100 registros por lote para manter o uso de memória previsível. Lotes maiores podem ser gerados em intervalos sucessivos.
- A geração de PDF tem limite de dois minutos por tarefa. O custo final depende da quantidade de páginas, do tamanho da imagem e da memória disponível no dispositivo.

## Evoluções possíveis

Depois do MVP, as melhorias naturais são otimização adicional do carregamento inicial, mais opções de estilo por elemento, migrações para futuras versões do formato de modelo e testes de desempenho em diferentes dispositivos.
