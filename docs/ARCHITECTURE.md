# DataCheetah Architecture

Local-first SQL data workspace. Static assets only — the browser is the compute engine.

## High-Level Flow

```
User File → fileImportService → duckdbClient → DuckDB Worker
SQL Editor → sqlIntelligenceService → sqlglot Worker (lint/format)
           → duckdbClient → DuckDB Worker (execute)
Results → queryStore → AG Grid + Chart Inference → ECharts
Preferences → storageService → IndexedDB (Dexie)
```

## Folder Structure

```
src/
├── features/          # Feature-based modules
│   ├── workspace/     # Home hub, modes (home/explore/tools), layout, toolbar
│   ├── files/         # Import, sidebar upload
│   ├── sql/           # Editor, results
│   ├── explorer/      # Schema, preview
│   ├── profiling/     # Column statistics
│   ├── charts/        # Auto charts
│   ├── settings/      # Settings page, encrypted secrets vault
│   ├── tools/         # JSON / text utility pages
│   └── ask/           # Local WebLLM + remote Ask providers
├── components/        # Shared UI (shadcn)
├── hooks/             # Global hooks
├── services/          # Worker facades, export, storage
├── workers/           # DuckDB + sqlglot Web Workers
├── lib/               # Dexie, utilities
└── types/             # Shared TypeScript types
```

## Workers

### DuckDB Worker (`duckdb.worker.ts`)
- Initializes DuckDB WASM bundle
- Registers files via `registerFileBuffer`
- Creates views with `read_csv_auto`, `read_parquet`, `read_json_auto`
- Executes SQL, profiling queries, schema inspection

### sqlglot Worker (`sqlglot.worker.ts`)
- Formats SQL via `transpileOne` (DuckDB dialect)
- Lints SQL via `parseOne`
- Never executes queries

## IndexedDB Schema

| Store | Contents |
|-------|----------|
| `preferences` | Theme, layout, editor settings |
| `recentFiles` | File metadata (legacy / companion) |
| `savedQueries` | Named SQL queries |
| `datasetBlobs` | Cached dataset bytes + schema (scoped by `workspaceId`) |
| `workspaces` | Local named workspaces (on-device profiles) |

OpenRouter API keys are stored in `preferences` (plaintext on this device only).

## Chart Inference Rules

| Condition | Chart |
|-----------|-------|
| Date + numeric | Line |
| Category + numeric (< 8 distinct) | Pie |
| Category + numeric | Bar |
| Two numeric columns | Scatter |
| Single numeric | Histogram |

## Performance

- Lazy load: Monaco, ECharts, DuckDB WASM
- Web Workers for DuckDB and sqlglot (UI thread never blocked)
- AG Grid virtual scrolling for large result sets
- PWA service worker caches static assets + WASM
