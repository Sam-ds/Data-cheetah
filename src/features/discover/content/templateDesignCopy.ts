/** In-app copy for the developer community pack-authoring guide. */

export interface TemplateDesignSection {
  id: string
  title: string
  body: string
  /** Plain bullets (no numbers). Prefer short lines. */
  items?: string[]
  /** Ordered steps — rendered as <ol>, not bullets. */
  steps?: string[]
  code?: string
  /** Optional built-in diagram key rendered by the page. */
  diagram?: 'pack-types' | 'zip-files'
}

export const TEMPLATE_DESIGN_INTRO =
  'For the developer community: build reusable Discover packs — chart templates or sandboxed Three.js scenes — that anyone can install and run on their own data. Data stays on the user’s device.'

export const TEMPLATE_DESIGN_SECTIONS: TemplateDesignSection[] = [
  {
    id: 'what',
    title: 'What is a pack?',
    body:
      'A DataCheetah Discover pack (Open Dashboard pack) is a portable visualization you ship as a folder or .datacheetah-dashboard.zip. It defines how data should be shown — not which file it came from. Users install the pack in Discover, map their columns to your roles, and run it locally on their device.',
    items: [
      'meta.json — name, publisher, version, and “What you can visualize” insights',
      'rule.json — roles (e.g. revenue, year) plus either charts or a Three.js dynamic entry',
      'sample.csv — demo data so Use sample data works out of the box',
      'visualization.js — optional; only for sandboxed Three.js packs',
      'Users install the ZIP in Discover; their files never leave their device',
    ],
  },
  {
    id: 'reusable',
    title: 'What makes a pack reusable',
    body: 'A reusable pack ships the visualization contract once. Each user brings different files; Discover remaps their headers onto your roles.',
    items: [
      'Bind charts and Three.js to logical roles (revenue, year, product) — never to one customer’s CSV headers',
      'Add aliases for common header names so auto-mapping works for more people',
      'Ship sample.csv so Use sample data proves the pack before Bring your own data',
      'Keep dynamic.settings (and chart x/y roles) stable — that is your public API across versions',
      'Set publisher + version in meta.json; bump version when roles or settings change',
      'Distribute a .datacheetah-dashboard.zip (or GitHub folder). Publish to DataCheetah or a marketplace that follows the Open Dashboard standard — users can install those packs and run them on their own data',
    ],
  },
  {
    id: 'kinds',
    title: 'Two pack types',
    body: 'Both share the same reusable role-mapping contract. Pick one renderer.',
    diagram: 'pack-types',
  },
  {
    id: 'files',
    title: 'Files in the ZIP',
    body: 'Put these at the archive root (not inside a nested folder). visualization.js is only for Three.js packs.',
    diagram: 'zip-files',
  },
  {
    id: 'steps',
    title: 'How to build a reusable pack',
    body: 'Author in your repo, verify with sample + a differently named file, then share.',
    steps: [
      'Define roles and rich aliases in rule.json',
      'Wire charts or visualization.js only to those roles / settings',
      'Add sample.csv that matches the roles',
      'Write meta.insights, publisher, and version',
      'Install the ZIP → Use sample data → Bring your own data with different headers',
      'Export or publish the ZIP for the community to reuse',
    ],
  },
  {
    id: 'data',
    title: 'Data connection',
    body: 'Roles are what make reuse work. Anyone maps their own data once; your pack stays unchanged.',
    code: `Your pack role: revenue
User A file: "Amount ($)"  → map → revenue
User B file: "sales_total" → map → revenue
Same charts / Three.js scene for both`,
  },
  {
    id: 'charts',
    title: 'Chart template sketch',
    body: 'No JavaScript. Roles plus chart defs — reusable across any file that can map those roles.',
    code: `{
  "requiredColumns": [
    { "role": "date", "aliases": ["date", "order_date", "day"], "type": "date" },
    { "role": "amount", "aliases": ["amount", "spend", "revenue"], "type": "number" }
  ],
  "charts": [
    { "type": "line", "title": "Spend", "x": "date", "y": "amount", "agg": "sum" }
  ]
}`,
  },
  {
    id: 'threejs',
    title: 'Three.js pack sketch',
    body: 'Read payload.settings and payload.rows by role keys only. That keeps the scene reusable when headers change.',
    code: `{
  "renderer": "dynamic",
  "charts": [],
  "dynamic": {
    "visualizationId": "pack",
    "entry": "visualization.js",
    "columns": ["year", "product", "revenue"],
    "settings": { "time": "year", "dimension": "product", "measure": "revenue" }
  }
}`,
  },
  {
    id: 'insights',
    title: 'What you can visualize',
    body: 'Filled from meta.insights — copy you write for people installing the pack. Prefer “Title — detail”. Skip to hide the panel.',
    code: `{
  "insights": [
    "Year playthrough — sales rise over time",
    "Overtake moments — products swap rank"
  ]
}`,
  },
  {
    id: 'start',
    title: 'Start from a sample',
    body: 'Fork finance-executive or ecommerce-growth for reusable charts; interactive-sales-studio, product-growth-race, product-line-race, or commerce-command-center for reusable Three.js. See the [Open Dashboard pack standard](app:open-dashboard) section below.',
  },
  {
    id: 'open-dashboard',
    title: 'Open Dashboard pack standard',
    body: 'Defined by DataCheetah. A pack is a reusable visualization (charts or sandboxed Three.js) that you ship once. Other people install it, map their own columns to your roles, and run it on their data — on their device.',
    items: [
      'Portable format — folder or .datacheetah-dashboard.zip that any compatible app can load',
      'Roles, not file headers — authors bind to roles like revenue or year; users map their columns to those roles',
      'On-device by design — DuckDB and the renderer run in the browser; data does not upload to a DataCheetah server',
      'Two pack kinds — declarative chart packs, or sandboxed Three.js packs with visualization.js',
      'Share anywhere — publish the ZIP on DataCheetah, your site, or a marketplace that follows this standard; users install it in DataCheetah and run it on their own data',
    ],
  },
]
