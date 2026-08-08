<p align="center">
  <img src="public/logo.png" alt="DataCheetah" width="280" />
</p>

# DataCheetah

**Local-first SQL data workspace.** Your data never leaves your machine.

DataCheetah is a browser-only app for exploring structured datasets with SQL. DuckDB WASM runs all computation in a Web Worker. There is no backend, no file upload, no accounts, and no telemetry.

You can use the hosted GitHub Pages build, or run everything yourself on your machine — same app, same privacy model. Local is the recommended way to develop and the simplest way to keep data fully on-device.

---

## Run locally

**Requirements:** [Node.js](https://nodejs.org/) 20+ and npm.

```bash
git clone https://github.com/Sam-ds/Data-cheetah.git
cd Data-cheetah
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). From **Home**, open **Data exploration**, drop a file in the sidebar (or use **Open**), then press **Ctrl+Enter** to run SQL.

No API keys, env files, or server process are required. Optional Ask features (local WebLLM or OpenRouter) are configured later in **Settings** if you want them.

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

To try a production build without deploying:

```bash
npm run build
npm run preview
```

Then open the URL Vite prints (usually http://localhost:4173).

---

## What It Supports Today

### File formats
| Format | How it loads |
|--------|----------------|
| CSV / TSV | DuckDB `read_csv_auto()` |
| Parquet | DuckDB `read_parquet()` |
| JSON / JSONL | DuckDB `read_json_auto()` |
| Excel (`.xlsx` / `.xls`) | SheetJS converts to CSV in the browser, then DuckDB reads it |

### Workspace UI
- **Home** hub with cards for Data exploration and JSON & text tools
- Explore mode: resizable layout (file upload sidebar / SQL editor / results / charts / stats / Ask)
- Drag-and-drop or **Open** in the explore sidebar (same page as the editor)
- Monaco SQL editor (lazy-loaded)
- AG Grid results table with virtual scrolling
- Data Explorer: schema + 100-row preview
- Charts panel with auto-inferred chart type + manual override
- Statistics panel: per-column profiling
- Light / dark theme
- Keyboard shortcuts: **Ctrl+Enter** (run), **Ctrl+Shift+F** (format)

### SQL & analytics
- DuckDB SQL execution (only engine)
- sqlglot-ts format + lint (separate worker)
- Default query after import: `SELECT * FROM "table" LIMIT 100`
- Result export to CSV or Excel
- Saved queries (names + SQL text only)

### Local utility tools
Open from **Home** or the header **Tools** tab (in-app page; data stays in the browser):

| Tool | What it does |
|------|----------------|
| JSON Formatter | Pretty-print with 2-space indent |
| JSON Minifier | Collapse JSON to one line |
| JSON Compare | Normalize (sorted keys) then side-by-side line diff |
| Text Compare | Side-by-side line diff (add / remove / change) |
| Generate Data | LLM seeds a few rows from sample + context; faker.js fills the rest client-side (download or open in Explore) |

Each tool lives in its own folder under `src/features/tools/` with isolated UI + helpers (easy to edit/debug).

### Ask (local or OpenRouter)
Right panel tab **Insights** / Ask bar — choose a provider in **Settings**:

1. **Local (WebLLM)** — runs in the browser with [WebLLM](https://webllm.mlc.ai/) (WebGPU required)
2. **OpenRouter** — paste an [OpenRouter](https://openrouter.ai/keys) API key and type any model id (e.g. `openai/gpt-4o`)

The OpenRouter key and model id are stored on this device in browser preferences (not encrypted at rest). They are never sent to a DataCheetah server.

For local models:

1. Choose a model from the editable catalog (`src/features/ask/config/modelCatalog.ts`)
2. Select one or more loaded files
3. **Generate insights** from schema + sample rows, or use the Ask bar for a custom question
4. The model writes SQL → DuckDB runs it → grounded answer from the result
5. Use **Full screen** in the Insights panel when you want more room (Esc to exit)
6. Optional: after tables are loaded, add **one** `datacheetah.schema.json` for all tables (Files sidebar → Sample file → edit → Upload)

Pluggable layout under `src/features/ask/` (`llm/` provider interface, prompts, services, UI).

### Settings
Toolbar **Settings**: DuckDB memory limit (restart to apply), Local vs OpenRouter, OpenRouter API key + model id.

### Optional table schema descriptions
Insights / Ask work without them, but SQL quality improves when you document meaning in **one file for all tables**:

1. Load your data files (they cache in the local workspace)
2. In the Explore **Files** sidebar → **Sample file** → download `datacheetah.schema.json` pre-filled with every table/column name
3. Fill in `description`, `grain`, `notes`, column meanings, relationships
4. **Upload** the edited file (or Open `*.schema.json` from the toolbar / drop zone)

Example multi-table file: `examples/datacheetah.schema.json`.

### Privacy model
| Stored? | What |
|---------|------|
| In DuckDB memory | Active session tables (rebuilt from local cache on restore) |
| In IndexedDB | Theme, layout prefs, saved SQL, **optional dataset bytes** per local workspace, schema descriptions, optional OpenRouter key/model |
| Never | Raw datasets uploaded to a server — there is no server |
| OpenRouter Ask only | Schema samples + questions sent to OpenRouter |

### Local workspaces & dataset cache
- Opening a file caches it in IndexedDB under the **active local workspace** (default: Personal).
- Refresh restores that workspace’s datasets automatically.
- Re-opening the same file name / table **updates** the cached copy (no duplicate).
- Toolbar **workspace** menu: create, switch, rename, delete workspaces (on-device only — not a cloud login).
- **Clear local** removes cached datasets for the current workspace; theme and saved queries stay.

---

## How Components Interact

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  React UI    │───▶│ Custom Hooks │───▶│   Services    │  │
│  │  (panels,    │    │ useFileImport│    │ duckdbClient  │  │
│  │   toolbar,   │    │ useSqlEditor │    │ sqlglotClient │  │
│  │   Monaco,    │    │ useDuckDB    │    │ storageService│  │
│  │   AG Grid)   │    └──────────────┘    │ exportService │  │
│  └──────────────┘                        └───────┬───────┘  │
│         ▲                                        │          │
│         │ Zustand stores                         │          │
│         │ (files, sql, query,                    │          │
│         │  charts, preferences)                  │          │
│         │                                        ▼          │
│  ┌──────┴───────┐              ┌──────────────────────────┐ │
│  │  IndexedDB   │◀─────────────│ Dexie (storageService)   │ │
│  │  preferences │              │ metadata / prefs only    │ │
│  │  recentFiles │              └──────────────────────────┘ │
│  │  savedQueries│                                           │
│  └──────────────┘                                           │
│                                                              │
│         postMessage (RPC)                                    │
│              │                                               │
│              ├──────────────────┬────────────────────┐       │
│              ▼                  ▼                    │       │
│  ┌───────────────────┐  ┌───────────────────┐        │       │
│  │  duckdb.worker.ts │  │ sqlglot.worker.ts │        │       │
│  │  AsyncDuckDB WASM │  │ parse / format    │        │       │
│  │  register files   │  │ lint SQL          │        │       │
│  │  run queries      │  └───────────────────┘        │       │
│  │  profile columns  │                               │       │
│  └───────────────────┘                               │       │
│           ▲                                          │       │
│           │ File / ArrayBuffer (local only)          │       │
│           │                                          │       │
│  ┌────────┴────────┐                                 │       │
│  │ User drag-drop  │◀────────────────────────────────┘       │
│  │ File API        │                                         │
│  └─────────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
```

### Layer responsibilities

| Layer | Role |
|-------|------|
| **UI** | Renders workspace; no business logic. Calls hooks only. |
| **Hooks** | Wire UI to stores + services (`useFileImport`, `useSqlEditor`, `useDuckDB`). |
| **Services** | Orchestrate workers and IndexedDB (`duckdbClient`, `storageService`, `exportService`). |
| **DuckDB Worker** | Sole compute engine: load files, SQL, profiling, schema, preview. |
| **sqlglot Worker** | Parse / format / lint SQL. Never executes queries. |
| **IndexedDB** | Prefs, saved SQL, local workspaces, and optional dataset byte cache. |
| **Zustand** | In-session UI state (open files, query results, chart config). |

### Typical flows

**1. App boot**
1. `main.tsx` mounts React `App`
2. Active local workspace is ensured; cached datasets for that workspace are rehydrated into DuckDB when present
3. Theme loaded from IndexedDB via `storageService`
4. Empty workspace shown if this workspace has no cached files

**2. File import**
1. User drops a file → `useFileImport` → `fileImportService.importFile`
2. XLSX is converted with SheetJS to a CSV buffer in the main thread
3. `ArrayBuffer` is posted to the DuckDB worker (`REGISTER_FILE`)
4. Worker: `registerFileBuffer` → `CREATE VIEW` with `read_csv_auto` / `read_parquet` / `read_json_auto`
5. Worker returns schema + row count (plain JSON — Arrow rows are serialized first)
6. UI updates file sidebar, SQL editor, and starts background profiling
7. IndexedDB stores file bytes for the active workspace (so refresh restores) plus metadata / saved SQL / workspace list

**3. Run query**
1. User presses Run / Ctrl+Enter → `useSqlEditor.runQuery`
2. sqlglot worker lints SQL; errors surface in the editor
3. Valid SQL → DuckDB worker `EXECUTE_SQL`
4. Results → Zustand `queryStore` → AG Grid
5. Chart inference runs on column types → ECharts panel

**4. Profiling**
1. After import, `profilingService.profileTable` sends `PROFILE_TABLE` to DuckDB
2. All stats (null %, distinct, min/max/avg/median, top values, duplicates) are computed with DuckDB SQL — no custom JS aggregation

---

## How Initialization Works

### 1. UI bootstrap (`src/main.tsx` → `src/App.tsx`)

```text
createRoot → <App />
  ├── useDuckDB()           // kick off DuckDB WASM init
  ├── useKeyboardShortcuts()
  ├── loadPreferences()     // IndexedDB theme
  └── <WorkspaceLayout />   // empty state or full IDE layout
```

### 2. DuckDB init (`src/services/duckdbClient.ts` + `src/workers/duckdb.worker.ts`)

```text
Main thread                         DuckDB worker
───────────                         ─────────────
duckdbClient.init()
  postMessage({ type: 'INIT' })  →  selectBundle (mvp / eh)
                                    new Worker(DuckDB wasm worker)
                                    AsyncDuckDB.instantiate(...)
                                    connect()
  ← { type: 'READY' }               DuckDB ready for REGISTER_FILE / EXECUTE_SQL
```

- WASM bundles are loaded via Vite `?url` imports
- Init is lazy and shared (`initPromise`); StatusBar shows “DuckDB ready”
- All query work stays off the UI thread

### 3. sqlglot init

- Worker is created on first format/lint call
- Imports DuckDB dialect from `sqlglot-ts`
- Used only for intelligence (format / parse / lint)

### 4. IndexedDB init (`src/lib/db/dexie.ts`)

```text
Dexie database: "datacheetah"
  ├── preferences   // theme, layout, editor settings
  ├── recentFiles   // filename, format, row/column counts, timestamps
  ├── savedQueries  // id, name, sql text, tableName
  ├── datasetBlobs  // cached bytes per workspace (optional local profile)
  └── workspaces    // local named workspaces
```

Opened on first storage / restore call. Dataset blobs are written when a file is opened so refresh can restore the active workspace.

### 5. Important lifetime rule

| Component | Survives page refresh? |
|-----------|------------------------|
| DuckDB tables / file buffers | **Restored** from IndexedDB for the active workspace |
| Query results in AG Grid | **No** |
| Theme / saved queries / local workspaces | **Yes** (IndexedDB) |
| SQL editor text | **No** (not persisted — avoids stale table names) |

---

## Tech Stack

| Area | Library |
|------|---------|
| UI | React 19, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Layout | react-resizable-panels |
| State | Zustand |
| SQL engine | `@duckdb/duckdb-wasm` |
| SQL intelligence | `sqlglot-ts` |
| Editor | Monaco (`@monaco-editor/react`) |
| Grid | AG Grid Community |
| Charts | Apache ECharts |
| Excel | SheetJS (`xlsx`) |
| IndexedDB | Dexie |
| Offline | vite-plugin-pwa |

---

## Project Layout

```text
src/
├── features/          # workspace, files, sql, explorer, profiling, charts
├── components/        # shared UI (toolbar pieces, shadcn)
├── hooks/             # useDuckDB, useKeyboardShortcuts
├── services/          # duckdbClient, storageService, exportService
├── workers/           # duckdb.worker.ts, sqlglot.worker.ts
├── lib/db/            # Dexie schema
└── types/             # shared TypeScript types
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Privacy

- No backend query API
- No file uploads to a server
- No telemetry / analytics
- No cloud authentication (local workspaces only)
- Dataset bytes stay on-device (DuckDB session + optional IndexedDB cache; Clear local removes the cache)

---

## Acknowledgements

DataCheetah is built entirely on the shoulders of open-source projects. Thank you to the teams and communities behind:

| Project | What it does here |
|---------|------------------|
| [DuckDB](https://duckdb.org) | In-browser SQL engine via WASM — the core of everything |
| [React](https://react.dev) | UI framework |
| [Vite](https://vitejs.dev) | Build tooling and dev server |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | SQL editor with syntax highlighting and IntelliSense |
| [AG Grid](https://www.ag-grid.com) | High-performance results table with virtual scrolling |
| [Apache ECharts](https://echarts.apache.org) | Charts and visualisations |
| [sqlglot](https://github.com/tobymao/sqlglot) | SQL formatting and linting (via sqlglot-ts) |
| [Dexie.js](https://dexie.org) | IndexedDB for prefs, workspaces, and local dataset cache |
| [SheetJS (xlsx)](https://sheetjs.com) | Excel file parsing in the browser |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com) | Accessible UI component primitives |
| [Lucide](https://lucide.dev) | Icon set |
| [WebLLM / MLC](https://webllm.mlc.ai/) | Optional local Ask Q&A (WebGPU) |
| [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) | Resizable workspace panels |

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
