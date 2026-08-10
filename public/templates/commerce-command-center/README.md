# Commerce Command Center

Showcase Three.js pack: a cinematic commerce ops floor driven by rich mapped data.

## Data path

```text
sample.csv / your CSV
  → Discover column mapping (8 roles)
  → ephemeral DuckDB query
  → payload.rows in visualization.js
  → Three.js command center
```

## Roles

| Role | Used for |
|------|----------|
| `year` | Timeline play / scrub |
| `region` | Platform pads on the ring |
| `category` | Towers on each pad |
| `channel` | Particle flow color / share |
| `revenue` | Platform and tower height |
| `orders` | Particle density |
| `customers` | HUD KPI |
| `margin` | HUD + tower glow |

## Files

`meta.json`, `rule.json`, `sample.csv`, `visualization.js`
