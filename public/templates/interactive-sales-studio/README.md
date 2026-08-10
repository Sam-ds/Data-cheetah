# Dynamic visualization sample pack

This folder is a complete sample showing how files and logical data roles map
to a user-authored Three.js visualization.

## Pack files

```text
interactive-sales-studio/
├── meta.json    # Name, publisher, version, category, and description
├── rule.json    # Column contract and renderer configuration
├── sample.csv   # Sample input data
├── visualization.js # Three.js scene executed in the sandbox
└── README.md    # This protocol guide
```

`visualization.js` is loaded only when `rule.json` uses
`"visualizationId": "pack"`. It runs in an opaque-origin iframe with scripts
enabled but without network, same-origin, form, popup, or top-navigation
permissions.

## 1. Define the input columns

`rule.json` first maps a pack or uploaded file to a table ID. The dynamic
renderer then selects that table:

```json
{
  "tables": [
    {
      "id": "sales",
      "file": "sample.csv",
      "requiredColumns": []
    }
  ],
  "dynamic": {
    "table": "sales"
  }
}
```

For custom data, the Discover mapping screen asks for the file assigned to
`sales`. Each `tables[].requiredColumns` entry then creates a logical role:

```json
{
  "role": "revenue",
  "aliases": ["revenue", "sales", "amount"],
  "type": "number",
  "kind": "measure"
}
```

When a CSV is loaded, DataCheetah maps its actual header to this role. For
example, any of these headers can supply `revenue`:

```text
revenue -> revenue
sales   -> revenue
amount  -> revenue
```

Users can correct an automatic match in the column-mapping screen.

## 2. Select the renderer and exposed roles

The `dynamic` object in `rule.json` connects the mapped data to the Three.js
renderer:

```json
{
  "visualizationId": "pack",
  "entry": "visualization.js",
  "title": "Sales performance studio",
  "columns": ["date", "region", "channel", "revenue", "orders"],
  "maxRows": 1000,
  "settings": {
    "dimension": "region",
    "measure": "revenue",
    "secondaryMeasure": "orders"
  }
}
```

- `visualizationId: "pack"` selects the pack's `visualization.js`.
- `entry` documents the executable filename; only `visualization.js` is accepted.
- `columns` lists the logical roles sent to that implementation.
- `maxRows` limits the rows crossing the iframe boundary.
- `settings` provides renderer-specific configuration.

The role names in `columns` must exist in `requiredColumns`.

## 3. Payload delivered to Three.js

DataCheetah queries the mapped columns, renames them to their logical roles,
and sends this message to the sandboxed iframe:

```json
{
  "source": "datacheetah-dynamic-v1",
  "type": "render",
  "payload": {
    "visualizationId": "pack",
    "title": "Sales performance studio",
    "columns": ["date", "region", "channel", "revenue", "orders"],
    "rows": [
      {
        "date": "2026-01-01",
        "region": "North",
        "channel": "Direct",
        "revenue": 18420,
        "orders": 132
      }
    ],
    "settings": {
      "dimension": "region",
      "measure": "revenue",
      "secondaryMeasure": "orders"
    },
    "theme": "light"
  }
}
```

The entry file exposes one global mount function and reads values using
logical roles:

```js
window.DataCheetahVisualization = {
  mount({ THREE, payload, root, reportHeight }) {
    const measure = payload.settings.measure
    const total = payload.rows.reduce(
      (sum, row) => sum + Number(row[measure] ?? 0),
      0,
    )
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    root.appendChild(renderer.domElement)
    // Build meshes from payload.rows, then start the render loop.
    reportHeight()
    return () => {
      renderer.dispose()
      renderer.domElement.remove()
    }
  },
}
```

The sandbox supplies the Three.js module as `THREE`. Pack code must not use
`import`, npm packages, remote scripts, or network requests.

## 4. Install your own Three.js pack

1. Copy this folder and update `meta.json`, `rule.json`, and `sample.csv`.
2. Implement `visualization.js` using the mount contract above.
3. Zip the files at the ZIP root (not inside another folder).
4. Choose **Install template** in Discover.
5. If the pack includes `visualization.js`, review the unverified-code warning and explicitly accept the risk.
6. Test both sample data and your own mapped data.

Only one executable file named `visualization.js` is accepted, with a 256 KB
limit. Other `.js`, `.ts`, `.vue`, and `.html` entries are rejected.
