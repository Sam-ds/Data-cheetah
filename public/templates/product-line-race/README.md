# Product Line Race

Three.js racing **line** chart. Each tip shows the **product name** and value. Playback interpolates between years so steeper growers climb faster on Y (X still follows the shared year playhead).

## Data path

```text
sample.csv / your CSV
  → Discover column mapping (year, product, revenue)
  → ephemeral DuckDB query
  → payload.rows in visualization.js
  → Three.js racing lines + on-chart labels
```

## Files

`meta.json`, `rule.json`, `sample.csv`, `visualization.js`

Settings: `time=year`, `dimension=product`, `measure=revenue`, `chartStyle=line`.
