# Designing Discover templates

**For the developer community.** This guide explains how to build and share installable Discover packs — regular ECharts templates and sandboxed Three.js visualization packs.

In the app: footer → **For developers** (or Discover → **Dev packs**). Pack format reference: [OPEN_DASHBOARD.md](./OPEN_DASHBOARD.md).

## Reusable packs

A pack is reusable when **many people can install it once and run it on their own files** without you changing code.

| Practice | Why |
|----------|-----|
| Bind UI to **roles**, not CSV headers | Each user maps `Amount ($)` / `sales_total` → `revenue` |
| Rich **aliases** on each role | Improves auto-mapping across datasets |
| Ship **sample.csv** | Proves the pack before Bring your own data |
| Stable **settings** / chart role refs | Your public API across pack versions |
| **publisher** + **version** in meta | Consumers know who shipped it and when it changed |
| Distribute a **ZIP** (or GitHub folder) | Install template → reuse the same charts or Three.js scene |

Do not hard-code one customer’s column names in `rule.charts` or `visualization.js`. Read `payload.rows` and `payload.settings` by role only.

## Design pattern

Every template follows the same pipeline:

```text
CSV / files
   → column mapping (aliases → logical roles)
   → DuckDB query (ephemeral, not Explore persistence)
   → renderer
        ├─ charts  → ECharts options from rule.charts
        └─ dynamic → sandboxed visualization.js (Three.js)
```

**Logical roles** are the contract. Charts and Three.js code never depend on your raw CSV header names. They depend on roles such as `date`, `revenue`, or `product`. Aliases and the Discover mapping UI resolve real headers onto those roles.

```text
CSV header "Amount ($)"  ──aliases/mapping──►  role "revenue"
rule.charts[].y = "revenue"
dynamic.settings.measure = "revenue"
payload.rows[].revenue = 18420
```

## Pack anatomy

```text
Chart template                 Visualization pack
─────────────────              ──────────────────────
meta.json                      meta.json
rule.json  (charts)            rule.json  (dynamic)
sample.csv                     sample.csv
                               visualization.js
         └── same role-mapping contract ──┘
```

| File | Purpose |
|------|---------|
| `meta.json` | Name, category, publisher, version, insights |
| `rule.json` | Roles, tables/joins, charts **or** dynamic Three.js config |
| `sample.csv` / `samples/` | Demo data for “Use sample data” |
| `visualization.js` | Only for Three.js packs (`visualizationId: "pack"`) |

Zip those files at the archive root:

```text
my-pack.datacheetah-dashboard.zip
├── meta.json
├── rule.json
├── sample.csv
└── visualization.js   (Three.js only)
```

Use Discover → **Install template**.

### What you can visualize (`meta.insights`)

The dashboard section **What you can visualize** is populated from `meta.json` → `insights` (a string array). It is copy only — it does not query data or invent chart titles.

```json
{
  "insights": [
    "Year playthrough — sales rise from mapped data over time",
    "Overtake moments — products swap rank as leaders change"
  ]
}
```

Recommended format: `Short title — one-line detail`. Discover splits on ` — ` (space-emdash-space) so the card shows a bold title and muted detail. If there is no separator, the whole string is shown as the title.

Also used as the preview blurb on Free template cards (first insight). Omit `insights` and the section is hidden.

---

## Regular (chart) templates

Use when you want declarative dashboards: bars, lines, maps, sankeys, etc. No custom JavaScript.

### 1. Define roles

```json
{
  "requiredColumns": [
    { "role": "date", "aliases": ["date", "order_date"], "type": "date", "kind": "dimension" },
    { "role": "amount", "aliases": ["amount", "spend"], "type": "number", "kind": "measure" },
    { "role": "category", "aliases": ["category", "segment"], "type": "string", "kind": "dimension" }
  ]
}
```

For multiple files, use `tables[]` + optional `joins[]` and set each chart’s `table` to a table id or `"joined"`.

### 2. Bind charts to roles

```json
{
  "charts": [
    { "type": "line", "title": "Spend over time", "x": "date", "y": "amount", "agg": "sum" },
    { "type": "pie", "title": "Mix", "dimension": "category", "measure": "amount", "agg": "sum" }
  ]
}
```

Supported types include `bar`, `line`, `area`, `pie`, `scatter`, `histogram`, `heatmap`, `funnel`, `treemap`, `radar`, `pyramid`, `stacked_bar`, `stacked_area`, `sankey`, `sunburst`, `map`.

### 3. How data reaches the chart

1. User uploads a file (or uses sample CSV).
2. Discover maps headers → roles.
3. `dashboardRunner` builds SQL using the mapped columns, aggregating with `agg`.
4. Result rows become an ECharts option via the chart inference service.

The chart definition never sees `"Amount ($)"` — only the role `amount`.

### Checklist

- Every `x` / `y` / `dimension` / `measure` / `source` / `target` references a defined role
- Sample headers match at least one alias per role
- Multifile packs include `samples-bundle.json` (or reliable `samples/`) for SPA loading
- Map charts use GeoJSON names that match `/geo` feature `properties.name`

---

## Three.js templates

Use when you need custom interactive 3D (races, landscapes, timelines). You ship one sandboxed `visualization.js`.

### 1. Same role mapping, different renderer

```json
{
  "renderer": "dynamic",
  "tables": [
    {
      "id": "sales",
      "file": "sample.csv",
      "requiredColumns": [
        { "role": "year", "aliases": ["year", "fiscal_year"], "type": "integer", "kind": "dimension" },
        { "role": "product", "aliases": ["product", "sku"], "type": "string", "kind": "dimension" },
        { "role": "revenue", "aliases": ["revenue", "sales"], "type": "number", "kind": "measure" }
      ]
    }
  ],
  "charts": [],
  "dynamic": {
    "visualizationId": "pack",
    "entry": "visualization.js",
    "title": "Product growth race",
    "table": "sales",
    "columns": ["year", "product", "revenue"],
    "maxRows": 1000,
    "settings": {
      "time": "year",
      "dimension": "product",
      "measure": "revenue"
    }
  }
}
```

### 2. How data reaches Three.js

1. Roles are mapped exactly like chart packs.
2. Runner selects `dynamic.columns` as `SELECT mapped AS role … LIMIT maxRows`.
3. Host posts a render message into a script-only iframe:

```json
{
  "source": "datacheetah-dynamic-v1",
  "type": "render",
  "payload": {
    "visualizationId": "pack",
    "title": "Product growth race",
    "columns": ["year", "product", "revenue"],
    "rows": [{ "year": 2024, "product": "Nova Buds", "revenue": 54600 }],
    "settings": { "time": "year", "dimension": "product", "measure": "revenue" },
    "theme": "light"
  }
}
```

4. Your entry must expose:

```js
window.DataCheetahVisualization = {
  mount({ THREE, payload, root, reportHeight }) {
    const measure = payload.settings.measure
    // Build scene from payload.rows using role keys
    reportHeight()
    return () => { /* dispose renderer, geometries, listeners */ }
  },
}
```

DataCheetah injects the Three.js module as `THREE`. Do not `import` packages or fetch the network — the sandbox blocks it.

### 3. Settings as the glue

Treat `dynamic.settings` as the stable API between `rule.json` and your scene:

| Setting | Typical use |
|---------|-------------|
| `dimension` | Category / product / region lanes |
| `measure` | Bar height, size, glow |
| `time` | Year scrubber / animation axis |
| `secondaryMeasure` | Second KPI |

Read settings first; fall back to `payload.columns[n]` only for defaults.

### Security & install

- Third-party ZIPs with `visualization.js` require an explicit risk confirmation
- Code runs sandboxed: can read only the mapped payload rows
- Only root `visualization.js` is allowed (256 KB); no extra `.js` / `.ts` / `.html`
- Bundled DataCheetah packs are first-party and skip the install warning when opened from Free templates

### Reference packs

- `public/templates/interactive-sales-studio` — static 3D bars + hover
- `public/templates/product-growth-race` — multi-product year race / overtake animation
- `public/templates/product-line-race` — racing lines with named tips
- `public/templates/commerce-command-center` — multi-dimension command floor (regions, categories, channels, KPIs)
- `public/templates/market-scroll-voyage` — very tall scrollable multi-chapter Three.js voyage

---

## Choosing a pattern

| Need | Use |
|------|-----|
| Standard BI charts, maps, funnels | Regular `charts` pack |
| Custom 3D / animation / interaction | Three.js `dynamic` pack |
| Multiple CSVs with joins | `tables` + `joins` (both patterns) |
| Share with teammates | Export ZIP → Install template |

## Quick authoring loop

1. Write `meta.json` + `rule.json` + sample CSV.
2. For Three.js, add `visualization.js` using roles from `settings`.
3. Zip at the root → Discover → **Install template**.
4. Open sample, then **Bring your own data** and remapping headers.
5. Export again when the contract is stable.

## Idea behind this

Discover packs separate **how you see data** from **whose file you open**.

One author ships a reusable visualization contract (roles + charts or a sandboxed Three.js scene). **Anyone can install that pack and run it on their own data.** Everything runs locally — DuckDB WASM and the renderer stay in the browser; DataCheetah does not receive the files.

Roles are the shared language between pack authors and end users. Chart packs stay declarative. Three.js packs stay sandboxed so the community can share custom scenes with clear risk boundaries.

The community can publish pack ZIPs to **DataCheetah** or a **marketplace** that follows the [DataCheetah Open Dashboard standard](./OPEN_DASHBOARD.md). Users can then install those packs and run them on their own data — using the same `meta.json` / `rule.json` / sample / optional `visualization.js` contract as Free templates.
