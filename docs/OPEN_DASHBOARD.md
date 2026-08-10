# Open Dashboard pack standard

**Discover:** Your data and ready-made templates — instant visualization.

**Developer community:** [TEMPLATE_DESIGN.md](./TEMPLATE_DESIGN.md) — how to build and share chart templates or Three.js visualization packs (in-app: **For developers**). The community can publish ZIPs to DataCheetah or a marketplace that follows this Open Dashboard standard; users can install those packs and run them on their own data.

DataCheetah Discover uses portable dashboard packs. Everything runs locally (DuckDB WASM, ECharts, and sandboxed Three.js renderers). No DataCheetah server receives your files.

## Bundled templates

Fifteen curated packs ship under `/templates`: the original 10 chart packs plus five interactive Three.js experiences. Eight chart packs are multifile. Two packs include **choropleth maps**: world countries (`population-demographics`) and US states (`regional-census-map`).

| Id | Multifile | Notes |
|----|-----------|-------|
| `population-demographics` | yes | Pyramid, heatmap, **world map** |
| `regional-census-map` | yes | **US states map**, treemap, heatmap |
| `census-household` | yes | Join + stacked bar |
| `workforce-diversity` | yes | Heatmap, radar, stacked area |
| `marketing-funnel-advanced` | yes | Funnel + sankey |
| `ecommerce-growth` | yes | Sunburst, scatter, funnel |
| `saas-metrics` | yes | Stacked area / bar |
| `finance-executive` | no | Line, pie, histogram |
| `logistics-delivery` | yes | Scatter, heatmap |
| `healthcare-clinic` | no | Stacked bar, area, histogram |
| `interactive-sales-studio` | no | **Sandboxed Three.js**, interactive 3D bars |
| `product-growth-race` | no | **Sandboxed Three.js**, year bar race / overtake |
| `product-line-race` | no | **Sandboxed Three.js**, racing line chart / overtake |
| `commerce-command-center` | no | **Sandboxed Three.js**, multi-KPI command floor |
| `market-scroll-voyage` | no | **Sandboxed Three.js**, tall scrollable multi-chapter voyage |

Chart types across the engine and set (15+): `bar`, `line`, `area`, `pie`, `scatter`, `histogram`, `heatmap`, `funnel`, `treemap`, `radar`, `pyramid`, `stacked_bar`, `stacked_area`, `sankey`, `sunburst`, `map`.

Map GeoJSON lives under `/geo/world.json` and `/geo/usa-states.json`. Sample region/country names must match GeoJSON feature `properties.name` (e.g. `United States`, `California`).

## Pack layout

```json
{
  "id": "finance-executive",
  "name": "Finance Executive",
  "category": "finance",
  "description": "P&L trend and category mix",
  "version": "2.0.0",
  "publisher": "DataCheetah",
  "insights": ["Amount over time — monthly P&L trend"]
}
```

A pack is a folder or `.datacheetah-dashboard.zip` containing:

| File | Required | Purpose |
|------|----------|---------|
| `meta.json` | yes | id, name, category, description, **version**, **publisher** (or `author`), optional `insights[]` |

`insights[]` populates the **What you can visualize** panel (and the first line on Free template cards). Prefer `Title — detail`. It is static copy from the pack, not derived from queries.
| `rule.json` | yes | column roles / tables / joins + chart definitions |
| `sample.csv` | recommended | single-file demo data |
| `samples-bundle.json` | recommended | SPA-safe map of sample CSV strings (multifile packs) |
| `samples/*.csv` + `samples/index.json` | optional | multi-file demo data |

Clicking a free template loads sample data and lists what you can visualize. Use **Bring your own data** to swap in your file(s).

### Multifile + joins (sketch)

```json
{
  "tables": [
    { "id": "households", "file": "households", "requiredColumns": [/* ... */] },
    { "id": "regions", "file": "regions", "requiredColumns": [/* ... */] }
  ],
  "joins": [{ "left": "households", "right": "regions", "on": ["region_id", "region_id"] }],
  "charts": [
    { "type": "bar", "title": "By region", "x": "region_name", "y": "households", "agg": "sum", "table": "joined" }
  ]
}
```

### Map chart (sketch)

```json
{ "type": "map", "title": "US population", "x": "state", "y": "population", "agg": "sum", "map": "usa-states", "table": "states" }
```

`map` is `world` or `usa-states`.

### Verified dynamic visualization

Dynamic packs use the same required-column mapping and ephemeral DuckDB loading as chart packs. The mapped query result is sent to a sandboxed iframe through a validated `postMessage` contract.

```json
{
  "renderer": "dynamic",
  "requiredColumns": [
    { "role": "region", "aliases": ["region", "market"], "type": "string", "kind": "dimension" },
    { "role": "revenue", "aliases": ["revenue", "sales"], "type": "number", "kind": "measure" }
  ],
  "charts": [],
  "dynamic": {
    "visualizationId": "pack",
    "entry": "visualization.js",
    "title": "Sales performance studio",
    "columns": ["region", "revenue"],
    "maxRows": 1000,
    "settings": { "dimension": "region", "measure": "revenue" }
  }
}
```

Dynamic packs can use an app-bundled renderer ID or set `visualizationId` to
`pack` and include a root-level `visualization.js`. Pack code exposes
`window.DataCheetahVisualization.mount({ THREE, payload, root, reportHeight })`;
the Three.js runtime is provided by DataCheetah. Custom code runs in an
opaque-origin, script-only iframe whose CSP blocks network access. Only the
single `visualization.js` entry is accepted (256 KB maximum); TypeScript,
`.vue`, HTML, and additional executable entries are rejected.

See `public/templates/interactive-sales-studio` for a complete installable
Three.js pack with sample data and protocol documentation.

## Install / export

- **Install template** in Discover → validates the ZIP; chart packs install
  directly, while packs with `visualization.js` require an unverified-code
  risk confirmation before they are stored in this browser
- **Export pack** → downloads the same zip for teammates or GitHub
- Installed Three.js packs require an explicit executable-code confirmation and run
  inside the restricted iframe sandbox.

## rule.json (sketch)

```json
{
  "requiredColumns": [
    { "role": "date", "aliases": ["date", "txn_date"], "type": "date", "kind": "dimension" },
    { "role": "amount", "aliases": ["amount", "spend"], "type": "number", "kind": "measure" }
  ],
  "charts": [
    { "type": "line", "title": "Spend over time", "x": "date", "y": "amount", "agg": "sum" },
    { "type": "stacked_bar", "title": "Mix", "x": "category", "series": "segment", "y": "amount", "agg": "sum" },
    { "type": "sankey", "title": "Flow", "source": "from", "target": "to", "measure": "value", "agg": "sum" },
    { "type": "map", "title": "World", "x": "country", "y": "population", "agg": "sum", "map": "world" }
  ]
}
```
