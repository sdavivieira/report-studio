module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'domain-is-independent',
      severity: 'error',
      from: { path: '^src/domain/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^src/domain/' },
    },
    {
      name: 'application-depends-on-domain',
      severity: 'error',
      from: { path: '^src/application/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^src/(domain|application)/' },
    },
    {
      name: 'views-do-not-parse-excel',
      severity: 'error',
      from: { path: '^src/(features|components|app)/' },
      to: {
        path: '(node_modules/(xlsx|pdf-lib)|src/adapters/excel/parseWorkbook)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.js', '.ts', '.vue', '.json'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
    },
  },
}
