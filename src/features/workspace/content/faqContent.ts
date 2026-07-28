export interface FaqItem {
  q: string
  a: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Does my data leave my computer?',
    a: 'Dataset files are read in your browser and queried with DuckDB WASM. There is no DataCheetah server that receives your files. If you use a remote Ask provider (OpenAI, Claude, and so on), only the schema samples and questions you send go to that provider.',
  },
  {
    q: 'Why a large download when I first open a file?',
    a: 'That is the DuckDB SQL engine (WASM). It downloads once per browser, then starts from cache. JSON and text tools work without it.',
  },
  {
    q: 'What happens if I refresh the page?',
    a: 'Datasets in the active local workspace are restored from IndexedDB automatically. Use Clear local to remove the cache, or switch workspaces to see another set of files.',
  },
  {
    q: 'What are local workspaces?',
    a: 'Named on-device profiles (not a cloud login). Each workspace keeps its own cached datasets so you can separate projects and switch between them.',
  },
  {
    q: 'Which file types are supported?',
    a: 'CSV, TSV, Parquet, JSON, JSONL, and Excel (.xlsx / .xls). Excel is converted in the browser with SheetJS, then loaded into DuckDB.',
  },
  {
    q: 'Is DataCheetah free?',
    a: 'Yes. The app is open source under the Apache License 2.0. Optional remote Ask providers bill you under their own accounts; local WebLLM runs on your device when WebGPU works.',
  },
  {
    q: 'How do API keys work?',
    a: 'In Settings you create an encrypted vault with a passphrase (PBKDF2 + AES-GCM). Ciphertext stays in IndexedDB. Keys exist in memory only while the vault is unlocked for the session.',
  },
  {
    q: 'Why does local Ask / Generate Data LLM seed fail on my PC?',
    a: 'Local models need WebGPU. Driver resets (common on Windows) can block GPU device creation. Use a remote provider in Settings, or turn off LLM seeding and generate with sample inference + faker.js.',
  },
  {
    q: 'How is this different from installing DuckDB?',
    a: 'DataCheetah is a full browser workspace: editor, grid, charts, stats, Ask, tools, and local workspaces. DuckDB itself is the SQL engine underneath.',
  },
]

export const HOW_USEFUL = [
  {
    title: 'Explore spreadsheets and extracts',
    body: 'Open CSV or Excel, run SQL, and skim results without installing a desktop database.',
  },
  {
    title: 'Keep sensitive files local',
    body: 'Query on-device. No account required. Optional remote Ask only if you choose it.',
  },
  {
    title: 'Prototype SQL quickly',
    body: 'Format, lint, save queries, and export results to CSV or Excel.',
  },
  {
    title: 'Charts, stats, and Ask',
    body: 'Profile columns, chart results, or ask questions that become SQL against your tables.',
  },
]
