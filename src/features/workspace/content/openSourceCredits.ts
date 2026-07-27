/** Projects DataCheetah is built on. Shown on Home and the License page. */
export interface OpenSourceCredit {
  name: string
  url: string
  role: string
  /** SPDX-style license id for the package we ship against */
  license: string
}

export const OPEN_SOURCE_CREDITS: OpenSourceCredit[] = [
  {
    name: 'DuckDB',
    url: 'https://duckdb.org',
    role: 'In-browser SQL engine via WASM',
    license: 'MIT',
  },
  {
    name: 'React',
    url: 'https://react.dev',
    role: 'UI framework',
    license: 'MIT',
  },
  {
    name: 'Vite',
    url: 'https://vitejs.dev',
    role: 'Build tooling and dev server',
    license: 'MIT',
  },
  {
    name: 'Monaco Editor',
    url: 'https://microsoft.github.io/monaco-editor/',
    role: 'SQL editor',
    license: 'MIT',
  },
  {
    name: 'AG Grid',
    url: 'https://www.ag-grid.com',
    role: 'Results table (Community)',
    license: 'MIT',
  },
  {
    name: 'Apache ECharts',
    url: 'https://echarts.apache.org',
    role: 'Charts',
    license: 'Apache-2.0',
  },
  {
    name: 'sqlglot / sqlglot-ts',
    url: 'https://github.com/tobymao/sqlglot',
    role: 'SQL format and lint',
    license: 'MIT',
  },
  {
    name: 'Dexie.js',
    url: 'https://dexie.org',
    role: 'IndexedDB storage',
    license: 'Apache-2.0',
  },
  {
    name: 'SheetJS (xlsx)',
    url: 'https://sheetjs.com',
    role: 'Excel parsing',
    license: 'Apache-2.0',
  },
  {
    name: 'Papa Parse',
    url: 'https://www.papaparse.com',
    role: 'CSV helpers',
    license: 'MIT',
  },
  {
    name: 'WebLLM / MLC',
    url: 'https://webllm.mlc.ai/',
    role: 'Optional local Ask models',
    license: 'Apache-2.0',
  },
  {
    name: 'Faker.js',
    url: 'https://fakerjs.dev',
    role: 'Generate Data bulk rows',
    license: 'MIT',
  },
  {
    name: 'Zustand',
    url: 'https://zustand-demo.pmnd.rs',
    role: 'Client state',
    license: 'MIT',
  },
  {
    name: 'Tailwind CSS',
    url: 'https://tailwindcss.com',
    role: 'Styling',
    license: 'MIT',
  },
  {
    name: 'Radix UI / shadcn',
    url: 'https://www.radix-ui.com',
    role: 'Accessible UI primitives',
    license: 'MIT',
  },
  {
    name: 'Lucide',
    url: 'https://lucide.dev',
    role: 'Icons',
    license: 'ISC',
  },
  {
    name: 'react-resizable-panels',
    url: 'https://github.com/bvaughn/react-resizable-panels',
    role: 'Resizable workspace panels',
    license: 'MIT',
  },
  {
    name: 'Sonner',
    url: 'https://sonner.emilkowal.ski',
    role: 'Toasts',
    license: 'MIT',
  },
  {
    name: 'TypeScript',
    url: 'https://www.typescriptlang.org',
    role: 'Typed JavaScript',
    license: 'Apache-2.0',
  },
  {
    name: 'vite-plugin-pwa',
    url: 'https://vite-pwa-org.netlify.app',
    role: 'Progressive web app shell',
    license: 'MIT',
  },
]
