# Market Scroll Voyage

A **very tall scrollable** Three.js pack: eight cinematic chapters plus interstitial data briefs on one page. Scroll inside the visualization frame (or use Full screen) — sticky HUD and chapter nav stay with you.

## Chapters

1. **Orbit** — living revenue core with region moons  
2. **Skyline** — regional towers (drag to orbit)  
3. **Region brief** — flat KPI cards  
4. **Constellation** — category stars  
5. **River** — channel particle flows  
6. **Category mix** — share bars  
7. **Corridor** — year gates  
8. **Lattice** — region × category grid  
9. **Helix** — growth spiral  
10. **Year ledger** — year cards  
11. **Finale** — combined spark field  

## Data path

```text
sample.csv / your CSV
  → Discover column mapping (8 roles)
  → ephemeral DuckDB query
  → payload.rows in visualization.js
  → scrollable multi-scene voyage
```

Every chapter has **floating tags on the 3D canvas** (name + value stuck to towers, moons, stars, gates, etc.) plus a **How to read** legend under the stage.

## Roles → visuals

| Role | Used for |
|------|----------|
| `year` | Corridor gates, helix turns, year ledger |
| `region` | Skyline towers, lattice columns, orbit moons (size ∝ revenue) |
| `category` | Constellation stars, lattice rows, mix bars |
| `channel` | River lane colors + order-share speed |
| `revenue` | Core / tower / star / gate / cell / helix sizes |
| `orders` | River density, HUD + finale |
| `customers` | HUD KPIs |
| `margin` | Mix panel average |

## Files

`meta.json`, `rule.json`, `sample.csv`, `visualization.js`
