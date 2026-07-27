<p align="center">
  <img src="public/logo.png" alt="DataCheetah" width="280" />
</p>

# DataCheetah

**Local-first SQL data workspace.** Your data never leaves your machine.

DataCheetah is a browser-only app for exploring structured datasets with SQL. DuckDB WASM runs all computation in a Web Worker. There is no backend, no file upload, no accounts, and no telemetry.

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), drop a file, then press **Ctrl+Enter** to run SQL.

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

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
- Resizable desktop-style layout (sidebar / SQL editor / results / charts / stats)
- Drag-and-drop or **Open** file picker
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
Open from toolbar **Tools** (full-screen overlay; data stays in the browser):

| Tool | What it does |
|------|----------------|
| JSON Formatter | Pretty-print with 2-space indent |
| JSON Minifier | Collapse JSON to one line |
| JSON Compare | Normalize (sorted keys) then side-by-side line diff |
| Text Compare | Side-by-side line diff (add / remove / change) |

Each tool lives in its own folder under `src/features/tools/` with isolated UI + helpers (easy to edit/debug).

### Privacy model
| Stored? | What |
|---------|------|
| In DuckDB memory | Dataset bytes (gone on refresh) |
| In IndexedDB | Theme, layout prefs, recent file **metadata**, saved query **text** |
| Never | Raw datasets uploaded to a server — there is no server |

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
| **IndexedDB** | Persist prefs and metadata only — **never dataset bytes**. |
| **Zustand** | In-session UI state (open files, query results, chart config). |

### Typical flows

**1. App boot**
1. `main.tsx` mounts React `App`
2. `useDuckDB()` calls `duckdbClient.init()` → worker `INIT` → DuckDB WASM loads in background
3. Theme loaded from IndexedDB via `storageService`
4. Empty workspace shown until a file is opened

**2. File import**
1. User drops a file → `useFileImport` → `fileImportService.importFile`
2. XLSX is converted with SheetJS to a CSV buffer in the main thread
3. `ArrayBuffer` is posted to the DuckDB worker (`REGISTER_FILE`)
4. Worker: `registerFileBuffer` → `CREATE VIEW` with `read_csv_auto` / `read_parquet` / `read_json_auto`
5. Worker returns schema + row count (plain JSON — Arrow rows are serialized first)
6. UI updates file sidebar, SQL editor, and starts background profiling
7. IndexedDB stores **file metadata only** (name, size, row count — not the file)

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
  └── savedQueries  // id, name, sql text, tableName
```

Opened on first `storageService` call. No dataset blobs are written.

### 5. Important lifetime rule

| Component | Survives page refresh? |
|-----------|------------------------|
| DuckDB tables / file buffers | **No** — re-open the file |
| Query results in AG Grid | **No** |
| Theme / saved queries / recent metadata | **Yes** (IndexedDB) |
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
- No file uploads
- No telemetry / analytics
- No authentication
- Dataset bytes never leave the browser tab’s memory

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
| [Dexie.js](https://dexie.org) | IndexedDB wrapper for saved queries and file metadata |
| [SheetJS (xlsx)](https://sheetjs.com) | Excel file parsing in the browser |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com) | Accessible UI component primitives |
| [Lucide](https://lucide.dev) | Icon set |
| [Zustand](https://github.com/pmndrs/zustand) | Lightweight state management |
| [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) | Resizable workspace panels |

---

## License

MIT
