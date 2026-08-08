export interface FaqItem {
  q: string
  a: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Does my data leave my computer?',
    a: 'Dataset files are read in your browser and queried with DuckDB WASM. There is no DataCheetah server that receives your files. If you use OpenRouter for Ask, only the schema samples and questions you send go to OpenRouter.',
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
    a: 'Yes. The app is open source under the Apache License 2.0. Optional OpenRouter usage bills under your OpenRouter account; local WebLLM runs on your device when WebGPU works.',
  },
  {
    q: 'How do API keys work?',
    a: 'For OpenRouter, paste your API key and model id (for example openai/gpt-4o) in Settings. They are stored on this device in browser preferences only — not uploaded to a DataCheetah server. There is no passphrase vault.',
  },
  {
    q: 'Why does local Ask / Generate Data LLM seed fail on my PC?',
    a: 'Local models need WebGPU. Driver resets (common on Windows) can block GPU device creation. Switch to OpenRouter in Settings, or turn off LLM seeding and generate with sample inference + faker.js.',
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
