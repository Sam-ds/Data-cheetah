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
    a: 'For OpenRouter, paste your API key and model id (for example openai/gpt-4o) in Settings. The key is encrypted at rest with Web Crypto (AES-GCM) in this origin’s IndexedDB — never localStorage, never a DataCheetah server. Cached datasets are encrypted the same way. Other sites cannot read them. Malware that already controls this device or browser profile can still access anything this app can. Use Clear Key / Clear local if the device is shared.',
  },
  {
    q: 'Why does local Ask / Generate Data LLM seed fail on my PC?',
    a: 'Local models need WebGPU. Driver resets (common on Windows) can block GPU device creation. Switch to OpenRouter in Settings, or turn off LLM seeding and generate with sample inference + faker.js.',
  },
  {
    q: 'How do I design my own Discover template?',
    a: 'That guide is for the developer community. Open For developers in the footer or Discover → Dev packs. Regular packs declare roles and charts in rule.json. Three.js packs add visualization.js. Zip the pack and use Install template; custom JS asks for risk acceptance.',
  },
]
