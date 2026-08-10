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

## Roles

| Role | Used for |
|------|----------|
| `year` | Corridor, helix, year ledger |
| `region` | Skyline, lattice, orbit moons |
| `category` | Constellation, lattice, mix bars |
| `channel` | River particle colors |
| `revenue` | Heights / sizes |
| `orders` | Particle density |
| `customers` | HUD KPIs |
| `margin` | Mix panel |

## Files

`meta.json`, `rule.json`, `sample.csv`, `visualization.js`
