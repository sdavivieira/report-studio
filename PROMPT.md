Você é um engenheiro de software sênior responsável por projetar e implementar o Report Studio.

O Report Studio é uma aplicação web local para transformar planilhas Excel em relatórios PDF visualmente configuráveis.

O usuário importa uma planilha, revisa os dados, aplica limpezas opcionais, configura o relatório, posiciona os elementos visualmente e exporta o resultado como PDF.

Implemente funcionalidades reais. Não crie apenas uma demonstração visual.

# 1. Objetivo do MVP

O usuário deve conseguir:

1. Importar um arquivo `.xlsx` ou `.xls`.
2. Selecionar uma aba da planilha.
3. Visualizar os cabeçalhos e os dados encontrados.
4. Receber avisos sobre problemas na planilha.
5. Aplicar limpezas opcionais sem alterar o arquivo original.
6. Configurar título, subtítulo, data, cores e orientação da página.
7. Escolher quais colunas aparecerão no relatório.
8. Renomear colunas somente no relatório.
9. Definir largura e alinhamento das colunas.
10. Adicionar uma imagem ou logotipo opcional.
11. Visualizar uma prévia semelhante ao PDF final.
12. Arrastar elementos dentro da página.
13. Ajustar manualmente posição X e Y.
14. Exportar um PDF paginado.
15. Salvar o modelo visual em um arquivo local.
16. Abrir um modelo salvo e aplicá-lo a outra planilha compatível.

# 2. Tipo de produto

Este projeto é um MVP local, não um SaaS.

Não implementar nesta etapa:

- login;
- cadastro;
- planos;
- pagamento;
- banco de dados;
- armazenamento em nuvem;
- histórico remoto;
- colaboração;
- compartilhamento público;
- backend;
- API;
- telemetria;
- analytics.

O projeto deve ficar preparado para evoluir no futuro, mas não deve conter abstrações prematuras de SaaS.

# 3. Privacidade

Todo o processamento deve acontecer no navegador.

Regras obrigatórias:

- Não enviar planilhas pela rede.
- Não enviar imagens pela rede.
- Não enviar modelos pela rede.
- Não enviar dados do relatório pela rede.
- Não armazenar dados em servidor.
- Não usar banco de dados.
- Não usar cache externo.
- Não usar serviços cloud.
- Não carregar bibliotecas por CDN.
- Não usar `localStorage` para armazenar planilhas ou imagens.
- Não persistir arquivos automaticamente.
- O usuário controla explicitamente os arquivos salvos.
- O PDF deve ser gerado inteiramente no navegador.
- O aplicativo deve continuar funcional depois que os pacotes estiverem instalados, sem depender de APIs externas.

# 4. Stack

Use versões estáveis recentes e compatíveis entre si. Fixe as versões no lockfile.

Utilize:

- Vue 3;
- Composition API;
- `<script setup lang="ts">`;
- TypeScript com `strict: true`;
- Vite;
- PrimeVue;
- tema Aura do PrimeVue;
- PrimeIcons;
- Pinia somente para estado compartilhado real;
- SheetJS para leitura de Excel;
- pdf-lib para geração do PDF;
- Zod para validação dos modelos;
- Vitest;
- Vue Test Utils;
- Playwright;
- ESLint;
- Prettier;
- pnpm.

Não adicionar backend Node.js ao MVP.

Node.js deve ser utilizado somente como ambiente de desenvolvimento, gerenciamento de pacotes, build e execução dos testes.

# 5. PrimeVue

PrimeVue deve ser a biblioteca principal de interface.

Utilize seus componentes sempre que forem apropriados:

- `FileUpload` para planilhas, imagens e modelos;
- `DataTable` e `Column` para visualização dos dados;
- `InputText` para título e campos simples;
- `Textarea` para textos maiores;
- `Select` para orientação, alinhamento e seleção de aba;
- `MultiSelect` para seleção de colunas;
- `ColorPicker` para cores;
- `InputNumber` para dimensões, posições e tamanhos;
- `ToggleSwitch` ou `Checkbox` para opções booleanas;
- `Slider` para ajustes visuais;
- `Stepper` para organizar o fluxo;
- `Tabs` quando necessário;
- `Dialog` para ações modais;
- `ConfirmDialog` para ações que descartam alterações;
- `Toast` para retornos de ações;
- `Message` para avisos da planilha;
- `Button` para ações;
- `ProgressSpinner` ou `ProgressBar` para processamentos;
- `Drawer` para propriedades do elemento selecionado;
- `Toolbar` para ações do editor;
- `Tooltip` para ações menos óbvias;
- `Tag` para estados e tipos de problema.

Não recriar manualmente componentes que o PrimeVue já fornece.

Não misturar PrimeVue com outra biblioteca completa de componentes.

Evitar Tailwind inicialmente. Utilize CSS próprio, CSS Modules ou estilos escopados.

Centralize cores, espaçamentos, tipografia e demais tokens visuais.

# 6. Experiência do usuário

Organize o fluxo principal em um `Stepper`:

1. Importar.
2. Revisar.
3. Configurar.
4. Ajustar layout.
5. Exportar.

O usuário deve sempre saber:

- em qual etapa está;
- qual arquivo foi importado;
- qual aba está selecionada;
- quantas linhas foram encontradas;
- quantas colunas foram encontradas;
- quais problemas foram identificados;
- quais limpezas foram aplicadas;
- se existem alterações não salvas no modelo;
- se o relatório ultrapassa uma página;
- se algum elemento está fora da área da página.

Não obrigue o usuário a corrigir todos os problemas.

Diferencie:

- erros que impedem a geração;
- avisos que podem ser ignorados;
- sugestões de limpeza.

# 7. Arquitetura

Aplique Clean Architecture de forma pragmática.

Não transforme o projeto em uma arquitetura excessivamente abstrata.

Regras:

- O domínio não pode depender de Vue, PrimeVue, Pinia, SheetJS ou pdf-lib.
- Os casos de uso dependem somente do domínio e de contratos.
- Adaptadores implementam integrações externas.
- Componentes Vue não devem processar Excel diretamente.
- Componentes Vue não devem gerar PDF diretamente.
- Componentes Vue não devem conter regras de limpeza.
- Pinia não deve ser usado como depósito global para todo o estado.
- Não criar interfaces para classes que possuem apenas uma implementação, salvo quando houver uma fronteira externa concreta.
- Não criar classes genéricas chamadas `Service`, `Manager`, `Helper`, `Utils`, `Repository` ou `Controller` sem uma responsabilidade clara.
- Preferir funções puras para validação, limpeza, layout e paginação.
- Representar estados inválidos explicitamente.
- Evitar duplicação entre o preview e o PDF.
- O preview e o PDF devem consumir o mesmo `ReportTemplate`.
- O preview e o PDF devem utilizar o mesmo cálculo de layout.

Estrutura sugerida:

src/
├── app/
│   ├── App.vue
│   ├── main.ts
│   ├── primevue.ts
│   └── routes.ts
│
├── domain/
│   ├── workbook/
│   │   ├── Workbook.ts
│   │   ├── Worksheet.ts
│   │   ├── WorkbookIssue.ts
│   │   └── CleaningOptions.ts
│   ├── report/
│   │   ├── ReportTemplate.ts
│   │   ├── ReportElement.ts
│   │   ├── ColumnSettings.ts
│   │   └── PageSettings.ts
│   └── layout/
│       ├── Position.ts
│       ├── Size.ts
│       └── LayoutResult.ts
│
├── application/
│   ├── import-workbook/
│   ├── analyze-workbook/
│   ├── clean-workbook/
│   ├── configure-report/
│   ├── calculate-layout/
│   ├── generate-pdf/
│   ├── save-template/
│   └── load-template/
│
├── adapters/
│   ├── excel/
│   │   └── SheetJsWorkbookReader.ts
│   ├── pdf/
│   │   └── PdfLibReportWriter.ts
│   ├── files/
│   │   ├── BrowserFileReader.ts
│   │   └── BrowserFileDownloader.ts
│   └── images/
│       └── BrowserImageReader.ts
│
├── features/
│   ├── import/
│   ├── review/
│   ├── configuration/
│   ├── editor/
│   └── export/
│
├── components/
│   ├── report-editor/
│   ├── workbook-preview/
│   └── common/
│
├── stores/
│   ├── workbookStore.ts
│   └── reportStore.ts
│
├── styles/
│   ├── tokens.css
│   ├── global.css
│   └── primevue-overrides.css
│
└── tests/
    ├── fixtures/
    └── builders/

Não crie arquivos vazios apenas para reproduzir essa estrutura. Crie somente o que tiver responsabilidade real.

# 8. Modelo de domínio

Defina pelo menos os seguintes conceitos:

- `Workbook`;
- `Worksheet`;
- `WorkbookColumn`;
- `WorkbookRow`;
- `CellValue`;
- `WorkbookIssue`;
- `IssueSeverity`;
- `CleaningOptions`;
- `ReportTemplate`;
- `ReportElement`;
- `ReportElementType`;
- `ElementPosition`;
- `ElementSize`;
- `ElementStyle`;
- `PageSettings`;
- `PageOrientation`;
- `ColumnSettings`;
- `ReportLayout`;
- `ReportPage`.

As posições devem ser armazenadas:

- em pontos de PDF; ou
- em coordenadas normalizadas.

Não armazenar posições diretamente em pixels da tela.

A conversão entre coordenadas da interface e coordenadas do PDF deve ficar centralizada.

# 9. Importação de Excel

A importação deve:

- aceitar `.xlsx`;
- aceitar `.xls`;
- validar extensão;
- validar MIME type quando disponível;
- validar tamanho máximo configurável;
- mostrar mensagem para arquivos inválidos;
- permitir selecionar a aba;
- preservar acentuação;
- reconhecer números;
- reconhecer textos;
- reconhecer booleanos;
- reconhecer datas;
- tratar células vazias;
- manter fórmulas como valores calculados quando disponíveis;
- impedir que conteúdo de célula seja interpretado como HTML;
- manter uma cópia dos dados originais;
- criar uma cópia de trabalho para limpeza;
- não modificar o arquivo original;
- limitar a quantidade de linhas renderizadas no `DataTable`;
- não descartar linhas que não estiverem visíveis na prévia;
- processar arquivos grandes sem travar a interface sempre que possível.

A primeira linha pode ser sugerida como cabeçalho, mas o usuário deve poder escolher outra linha.

# 10. Diagnóstico da planilha

Identifique pelo menos:

- planilha vazia;
- aba vazia;
- cabeçalhos vazios;
- cabeçalhos duplicados;
- linhas completamente vazias;
- colunas completamente vazias;
- linhas com quantidade inesperada de células;
- tipos misturados na mesma coluna;
- números armazenados como texto;
- espaços desnecessários;
- separadores decimais inconsistentes;
- datas inconsistentes;
- células com erros;
- quantidade muito grande de linhas;
- quantidade muito grande de colunas.

Cada problema deve possuir:

- código;
- severidade;
- mensagem;
- linha quando aplicável;
- coluna quando aplicável;
- sugestão de correção;
- indicação se pode ser corrigido automaticamente.

# 11. Limpeza de dados

As limpezas devem ser opcionais.

Implemente:

- remoção de espaços no início e no final;
- normalização de espaços repetidos;
- remoção de linhas vazias;
- remoção de colunas vazias;
- preenchimento de valores vazios;
- normalização de separador decimal;
- conversão opcional de números armazenados como texto;
- normalização opcional de datas;
- renomeação de cabeçalhos duplicados;
- remoção de caracteres invisíveis.

Regras:

- Mostrar o que será alterado antes de aplicar.
- Permitir desfazer a última limpeza.
- Manter os dados originais intactos.
- Não realizar correções silenciosas.
- Não converter valores de maneira destrutiva sem confirmação.
- Exibir quantas células serão afetadas.

# 12. Configuração do relatório

O usuário deve poder configurar:

- título;
- subtítulo;
- exibição da data;
- exibição da hora;
- texto do rodapé;
- numeração de páginas;
- orientação retrato;
- orientação paisagem;
- margens;
- cor de fundo;
- cor do título;
- cor do subtítulo;
- cor do cabeçalho da tabela;
- cor do texto do cabeçalho;
- cor das células;
- cor do texto das células;
- cor das bordas;
- tamanho das fontes;
- alinhamento dos textos;
- altura das linhas;
- espaçamento interno das células;
- colunas visíveis;
- ordem das colunas;
- nome exibido para cada coluna;
- largura de cada coluna;
- alinhamento de cada coluna;
- formato de números;
- formato de datas.

As larguras das colunas devem ser definidas pelo usuário e validadas em relação à largura disponível da página.

# 13. Imagens

Permita adicionar uma imagem ou logotipo opcional.

Requisitos:

- aceitar PNG e JPEG;
- validar tamanho;
- validar tipo;
- mostrar preview;
- permitir remover;
- permitir redimensionar;
- permitir arrastar;
- manter proporção opcionalmente;
- incorporar a imagem no PDF;
- não enviar a imagem para servidor;
- não armazenar a imagem automaticamente;
- apresentar erro claro para imagens inválidas.

# 14. Editor visual

O editor deve apresentar uma página semelhante ao PDF final.

Elementos editáveis:

- título;
- subtítulo;
- data;
- tabela;
- imagem;
- rodapé;
- numeração de página.

O editor deve permitir:

- selecionar um elemento;
- arrastar;
- redimensionar quando aplicável;
- ajustar X;
- ajustar Y;
- ajustar largura;
- ajustar altura quando aplicável;
- alterar cor;
- alterar tamanho da fonte;
- alterar alinhamento;
- restaurar posição padrão;
- excluir elementos opcionais;
- visualizar limites da página;
- visualizar margens;
- impedir ou alertar sobre elementos fora da página;
- usar mouse;
- usar toque;
- usar teclado para ajuste fino;
- mostrar qual elemento está selecionado.

Use um `Drawer` do PrimeVue para editar as propriedades do elemento selecionado.

Utilize uma `Toolbar` para:

- desfazer;
- refazer;
- restaurar layout;
- alternar zoom;
- centralizar visualização;
- mostrar ou ocultar margens.

Implemente histórico limitado de desfazer e refazer para alterações de layout.

# 15. Coordenadas e escala

Centralize o cálculo de layout.

O editor não deve gravar posições em pixels da tela.

Defina funções explícitas para:

- pontos de PDF para pixels;
- pixels para pontos de PDF;
- coordenadas normalizadas para pontos;
- pontos para coordenadas normalizadas;
- escala de zoom;
- limites da página;
- limites das margens;
- detecção de overflow;
- cálculo da largura da tabela;
- cálculo de paginação.

O preview e o PDF devem utilizar os mesmos dados de layout.

# 16. Preview

O preview deve:

- representar retrato e paisagem;
- preservar proporção da página;
- mostrar título;
- mostrar subtítulo;
- mostrar data;
- mostrar imagem;
- mostrar cabeçalho da tabela;
- mostrar uma quantidade limitada de linhas;
- mostrar rodapé;
- mostrar número da página;
- indicar continuação da tabela;
- atualizar após alterações;
- evitar recalcular toda a planilha sem necessidade.

Não é necessário renderizar todas as páginas simultaneamente.

O usuário deve conseguir navegar entre páginas da prévia quando houver paginação.

# 17. Geração do PDF

Use `pdf-lib`.

O PDF deve:

- ser gerado no navegador;
- suportar A4;
- suportar retrato;
- suportar paisagem;
- preservar acentos;
- suportar quantidade variável de colunas;
- respeitar larguras definidas;
- respeitar alinhamento;
- respeitar cores;
- incorporar a imagem;
- quebrar textos longos;
- paginar automaticamente;
- repetir o cabeçalho da tabela;
- impedir que uma linha seja cortada entre páginas;
- renderizar rodapé em todas as páginas;
- renderizar número da página;
- gerar um arquivo PDF válido;
- iniciar download somente após ação explícita.

Se a fonte padrão não atender à acentuação, utilize uma fonte incorporada compatível e documente a licença.

Não use geração de PDF baseada em screenshot da página.

# 18. Modelos reutilizáveis

O modelo deve ser salvo como JSON versionado.

Extensão sugerida:

`nome-do-modelo.report-template.json`

O arquivo deve conter:

- versão do formato;
- orientação;
- margens;
- elementos;
- posições;
- tamanhos;
- estilos;
- configurações da tabela;
- colunas escolhidas;
- mapeamento de colunas;
- nomes exibidos;
- formatos;
- configurações do rodapé.

O modelo não deve conter:

- linhas da planilha;
- dados pessoais;
- conteúdo integral das células;
- arquivo Excel;
- imagem em base64, salvo se o usuário optar explicitamente por incorporar a imagem.

Valide o modelo com Zod.

Ao abrir um modelo:

- validar versão;
- validar campos;
- verificar colunas esperadas;
- mostrar colunas ausentes;
- permitir remapear colunas;
- rejeitar arquivos inválidos;
- nunca confiar diretamente no JSON importado.

# 19. Estado

Use Pinia apenas para estado compartilhado entre etapas.

Separe:

- dados originais;
- dados de trabalho;
- diagnóstico;
- opções de limpeza;
- configuração do relatório;
- layout;
- histórico de layout;
- estado da interface.

Não armazene objetos grandes desnecessariamente em múltiplos lugares.

Evite watchers amplos e profundos sobre toda a planilha.

Use propriedades computadas e atualizações explícitas.

# 20. Aparência

Crie uma interface profissional, limpa e fácil de entender.

Direção visual:

- aparência de ferramenta editorial;
- página branca central;
- fundo externo neutro;
- painel lateral organizado;
- tipografia clara;
- hierarquia visual forte;
- cores sóbrias;
- destaque para a ação de gerar PDF;
- bom uso de espaço;
- interface responsiva;
- sem excesso de cartões;
- sem aparência de painel administrativo genérico.

Use o tema Aura como base, mas personalize tokens para criar identidade própria.

Centralize os tokens em:

`src/styles/tokens.css`

Inclua:

- cores;
- tipografia;
- raios;
- sombras;
- espaçamentos;
- larguras;
- estados de foco.

# 21. Acessibilidade

Implemente:

- labels associadas aos campos;
- navegação por teclado;
- foco visível;
- contraste adequado;
- nomes acessíveis nos botões;
- mensagens que não dependam apenas de cor;
- suporte a leitores de tela;
- `aria-live` para estados importantes;
- alternativa textual para imagens;
- diálogos com foco correto;
- editor utilizável por teclado;
- respeito a `prefers-reduced-motion`.

# 22. Segurança

Considere os arquivos importados como dados não confiáveis.

Regras:

- nunca renderizar conteúdo de célula com `v-html`;
- não executar fórmulas;
- não executar macros;
- não interpretar texto como código;
- validar JSON de modelo;
- validar tamanho dos arquivos;
- validar tipo dos arquivos;
- limitar recursos usados por arquivos grandes;
- escapar nomes usados em downloads;
- revogar URLs criadas com `URL.createObjectURL`;
- tratar exceções de parsing;
- não registrar conteúdo sensível no console;
- não incluir dados reais nas fixtures de teste.

# 23. Tratamento de erros

Crie erros de domínio ou resultados tipados para falhas esperadas.

Evite `try/catch` espalhado por componentes.

Apresente mensagens compreensíveis para:

- arquivo inválido;
- extensão não suportada;
- arquivo muito grande;
- planilha vazia;
- aba vazia;
- erro ao interpretar Excel;
- modelo inválido;
- versão incompatível;
- imagem inválida;
- erro ao gerar PDF;
- configuração de tabela impossível;
- elemento fora da página.

Não mostre stack trace ao usuário.

# 24. Testes

Implemente testes unitários para:

- análise de cabeçalhos;
- detecção de duplicidade;
- detecção de linhas vazias;
- limpeza de espaços;
- normalização decimal;
- normalização de datas;
- seleção de colunas;
- cálculo de larguras;
- conversão de coordenadas;
- limites da página;
- paginação;
- serialização do modelo;
- validação do modelo;
- migração de versão quando existir;
- quebra de textos;
- geração do layout.

Implemente testes de componentes para:

- importação;
- seleção de aba;
- exibição de problemas;
- aplicação de limpeza;
- formulário de configuração;
- troca de orientação;
- seleção de cores;
- seleção de colunas;
- editor de propriedades;
- salvamento de modelo.

Implemente testes E2E para:

1. Importar uma planilha válida.
2. Selecionar uma aba.
3. Aplicar uma limpeza.
4. Configurar título e cores.
5. Alterar para paisagem.
6. Ajustar a posição de um elemento.
7. Gerar o PDF.
8. Salvar um modelo.
9. Abrir um modelo.
10. Usar o modelo com outra planilha compatível.

Crie fixtures pequenas e artificiais.

Não use dados pessoais reais.

# 25. Qualidade

Configure:

- TypeScript strict;
- ESLint;
- Prettier;
- Vitest;
- Vue Test Utils;
- Playwright;
- validação de imports;
- detecção de imports circulares;
- build reproduzível;
- cobertura das regras principais.

Scripts esperados:

pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm verify

`pnpm verify` deve executar:

1. lint;
2. typecheck;
3. testes unitários;
4. testes de componentes;
5. build;
6. testes E2E essenciais.

# 26. Agente independente de testes

Após cada build bem-sucedido, crie ou acione um agente independente chamado:

`implementation_test_agent`

O agente deve atuar como verificador e não como implementador.

Responsabilidades:

1. Ler a especificação.
2. Ler as alterações da etapa.
3. Não assumir que a implementação está correta.
4. Executar os comandos de verificação.
5. Verificar os critérios de aceite da etapa.
6. Testar o fluxo principal.
7. Procurar regressões.
8. Verificar erros no console.
9. Verificar comportamento com dados inválidos.
10. Registrar evidências objetivas.

O agente deve executar:

- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm test`;
- `pnpm build`;
- `pnpm test:e2e`;
- teste manual do fluxo principal quando houver preview disponível.

O agente deve verificar especialmente:

- importação de Excel;
- preservação de acentos;
- diagnóstico da planilha;
- limpeza opcional;
- retrato;
- paisagem;
- cores;
- largura das colunas;
- arraste;
- ajuste X e Y;
- imagens;
- paginação;
- geração do PDF;
- salvamento do modelo;
- abertura do modelo;
- funcionamento sem backend;
- ausência de envio de dados.

O agente deve produzir um relatório contendo:

- comandos executados;
- resultado de cada comando;
- funcionalidades verificadas;
- problemas encontrados;
- severidade;
- passos para reprodução;
- evidências;
- recomendação objetiva.

O agente não deve alterar o código sem autorização explícita.

O agente principal deve:

1. analisar o relatório;
2. corrigir os problemas;
3. executar novamente `pnpm verify`;
4. acionar novamente o agente quando a correção for relevante.

Não considerar a etapa concluída apenas porque o build passou.

Nenhum arquivo, configuração, memória, relatório ou log do agente deve entrar no commit.

Adicione ao `.gitignore`:

.agents/
.agent/
.codex/
test-results/
playwright-report/
coverage/
*.log

Não ignore arquivos legítimos de configuração do projeto por engano.

# 27. Skill de Clean Code

Antes da implementação, procure uma skill chamada:

`clean-code-review`

Se ela não existir, use a skill de criação de skills disponível no ambiente para criar uma skill pessoal com esse nome.

A skill deve ser criada fora do repositório.

Não adicionar a skill ao projeto.

Não adicionar arquivos da skill ao commit.

A skill deve revisar:

- clareza dos nomes;
- responsabilidades;
- tamanho das funções;
- complexidade;
- duplicação;
- coesão;
- acoplamento;
- direção das dependências;
- separação entre domínio e infraestrutura;
- regras dentro de componentes Vue;
- uso excessivo de Pinia;
- watchers desnecessários;
- efeitos colaterais;
- tratamento de erros;
- tipos inseguros;
- uso de `any`;
- estados inválidos;
- código morto;
- comentários desnecessários;
- abstrações prematuras;
- acessibilidade;
- segurança;
- performance;
- testes;
- consistência entre preview e PDF.

Cada achado deve conter:

- arquivo;
- trecho ou linha;
- severidade;
- explicação;
- impacto;
- correção recomendada.

A skill não deve produzir críticas genéricas.

A skill não deve exigir padrões sem benefício concreto.

Execute a skill:

- depois de cada vertical slice;
- antes de qualquer commit;
- depois de refatorações relevantes;
- quando houver duplicação entre preview e PDF.

# 28. Processo de implementação

Trabalhe por vertical slices.

Ordem recomendada:

1. Estrutura do projeto e quality gates.
2. Tema e shell da aplicação.
3. Importação de Excel.
4. Seleção de aba.
5. Diagnóstico da planilha.
6. Limpeza opcional.
7. Configuração do relatório.
8. Preview da página.
9. Editor visual.
10. Arraste e posicionamento.
11. Configuração das colunas.
12. Paginação.
13. Geração do PDF.
14. Salvamento do modelo.
15. Abertura do modelo.
16. Imagem ou logotipo.
17. Acessibilidade.
18. Refinamento visual.
19. Testes completos.
20. Documentação.

Para cada vertical slice:

1. Definir o critério de aceite.
2. Implementar a menor solução completa.
3. Criar testes.
4. Executar lint.
5. Executar typecheck.
6. Executar testes.
7. Executar build.
8. Acionar o agente independente de testes.
9. Corrigir os problemas encontrados.
10. Executar a skill de Clean Code.
11. Corrigir os achados relevantes.
12. Executar `pnpm verify`.
13. Somente então avançar.

# 29. Restrições de implementação

- Não fazer commits automaticamente.
- Não fazer push.
- Não abrir pull request.
- Não criar backend.
- Não criar banco.
- Não adicionar autenticação.
- Não adicionar pagamentos.
- Não adicionar analytics.
- Não adicionar telemetria.
- Não usar bibliotecas por CDN.
- Não armazenar dados do usuário automaticamente.
- Não incluir arquivos de agentes no projeto.
- Não incluir skills no projeto.
- Não usar `any`, salvo integração externa isolada e justificada.
- Não usar `v-html` com conteúdo da planilha.
- Não esconder limitações com mocks.
- Não apresentar botões que não funcionam.
- Não simular geração de PDF.
- Não simular drag and drop.
- Não avançar deixando testes quebrados.
- Não apagar alterações existentes sem verificar o workspace.
- Não modificar arquivos sem relação com o projeto.
- Não criar abstrações apenas para seguir um diagrama.

# 30. README

Crie um README objetivo contendo:

- objetivo;
- recursos do MVP;
- stack;
- privacidade;
- requisitos;
- instalação;
- execução;
- build;
- testes;
- estrutura;
- limitações conhecidas;
- próximos passos.

Não transforme o README em documentação excessivamente longa.

# 31. Critérios de aceite do MVP

O MVP somente estará pronto quando:

- importar `.xlsx`;
- importar `.xls`;
- permitir selecionar a aba;
- preservar acentuação;
- identificar problemas da planilha;
- permitir limpeza opcional;
- manter dados originais;
- aceitar quantidade variável de colunas;
- permitir selecionar colunas;
- permitir reordenar colunas;
- permitir renomear colunas;
- permitir definir larguras;
- permitir definir alinhamentos;
- permitir retrato;
- permitir paisagem;
- permitir configurar cores;
- permitir configurar textos;
- permitir adicionar imagem;
- permitir arrastar elementos;
- permitir redimensionar elementos aplicáveis;
- permitir ajuste X e Y;
- mostrar preview coerente;
- detectar elementos fora da página;
- gerar PDF válido;
- paginar tabelas;
- repetir cabeçalho;
- preservar acentos no PDF;
- mostrar rodapé;
- mostrar número da página;
- salvar modelo;
- abrir modelo;
- validar modelo;
- funcionar sem backend;
- funcionar sem banco;
- não enviar dados;
- passar em `pnpm verify`;
- passar pelo agente independente de testes;
- passar pela skill de Clean Code.

# 32. Início do trabalho

Comece fazendo o seguinte:

1. Inspecione o workspace.
2. Verifique se já existem arquivos e alterações.
3. Preserve qualquer trabalho existente que não pertença a esta implementação.
4. Apresente um plano curto.
5. Crie a estrutura mínima do projeto.
6. Configure TypeScript strict, ESLint, Prettier, Vitest e Playwright.
7. Configure PrimeVue com o tema Aura.
8. Crie os tokens visuais.
9. Implemente o primeiro vertical slice funcional.
10. Execute os testes e o build.
11. Acione o agente independente de testes.
12. Execute a skill de Clean Code.
13. Informe claramente o que foi concluído e o que ainda falta.

Não pare apenas no planejamento.

Não entregue somente arquivos de configuração.

Implemente e valide uma funcionalidade vertical real.