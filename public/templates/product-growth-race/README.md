# Product Growth Race

Three.js pack that animates multi-product sales over years so one product can overtake another.

## Files

```text
product-growth-race/
├── meta.json
├── rule.json          # year / product / revenue mapping
├── sample.csv         # crossing trajectories (Nova Buds overtakes Aurora Watch)
├── visualization.js   # race animation
└── README.md
```

## Mapping

`rule.json` maps:

| Role | Used for |
|------|----------|
| `year` | Time axis / scrubber |
| `product` | Competing lanes |
| `revenue` | Bar height |
| `orders` | Available in payload |

Settings:

```json
{
  "time": "year",
  "dimension": "product",
  "measure": "revenue"
}
```

## Mount contract

```js
window.DataCheetahVisualization = {
  mount({ THREE, payload, root, reportHeight }) {
    // Read payload.settings.time / dimension / measure
    // Animate years; reorder lanes by rank when one product overtakes another
    return () => { /* dispose WebGL */ }
  },
}
```

Install via Discover → **Install template**. Packs with `visualization.js` require risk acceptance.
