import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = path.join(root, 'public', 'templates')

function writePack(id, { meta, rule, samples, sampleCsv }) {
  const dir = path.join(base, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
  fs.writeFileSync(path.join(dir, 'rule.json'), JSON.stringify(rule, null, 2) + '\n')
  if (sampleCsv) {
    fs.writeFileSync(path.join(dir, 'sample.csv'), sampleCsv.trim() + '\n')
  }
  if (samples?.length) {
    const sdir = path.join(dir, 'samples')
    fs.mkdirSync(sdir, { recursive: true })
    const index = []
    for (const s of samples) {
      const name = s.name.endsWith('.csv') ? s.name : `${s.name}.csv`
      fs.writeFileSync(path.join(sdir, name), s.csv.trim() + '\n')
      index.push(name)
    }
    fs.writeFileSync(path.join(sdir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
  }
}

writePack('population-demographics', {
  meta: {
    id: 'population-demographics',
    name: 'Population Demographics',
    category: 'demographics',
    description: 'Age–sex pyramid, region heatmap, and population mix.',
    version: '1.0.0',
    author: 'DataCheetah',
    insights: [
      'Age–sex pyramid — population structure by band',
      'Age × region heatmap — where age groups concentrate',
      'Population by region — geographic mix',
      'Sex mix — share of male vs female',
    ],
  },
  rule: {
    requiredColumns: [
      { role: 'age_band', aliases: ['age_band', 'age', 'band'], type: 'string', kind: 'dimension' },
      { role: 'male', aliases: ['male', 'males', 'men'], type: 'integer', kind: 'measure' },
      { role: 'female', aliases: ['female', 'females', 'women'], type: 'integer', kind: 'measure' },
      { role: 'region', aliases: ['region', 'area', 'zone'], type: 'string', kind: 'dimension' },
      { role: 'population', aliases: ['population', 'pop', 'total'], type: 'integer', kind: 'measure' },
    ],
    charts: [
      { type: 'pyramid', title: 'Age–sex pyramid', x: 'age_band', y: 'male', y2: 'female', agg: 'sum' },
      { type: 'heatmap', title: 'Age × region', x: 'age_band', y: 'region', measure: 'population', agg: 'sum' },
      { type: 'bar', title: 'Population by region', x: 'region', y: 'population', agg: 'sum' },
      { type: 'pie', title: 'Region mix', dimension: 'region', measure: 'population', agg: 'sum' },
    ],
  },
  sampleCsv: `age_band,male,female,region,population
0-17,4200,4000,North,8200
0-17,3800,3700,South,7500
18-34,5100,5200,North,10300
18-34,4900,5000,South,9900
35-54,4800,4700,North,9500
35-54,4500,4600,South,9100
55-64,2200,2400,North,4600
55-64,2100,2300,South,4400
65+,1800,2200,North,4000
65+,1700,2100,South,3800`,
})

writePack('census-household', {
  meta: {
    id: 'census-household',
    name: 'Census Household',
    category: 'demographics',
    description: 'Households joined to regions — treemap, funnel, and counts.',
    version: '1.0.0',
    author: 'DataCheetah',
    insights: [
      'Households by type — family structure treemap',
      'Households by region — where people live',
      'Income funnel — households by income band',
      'Avg size by type — household composition',
    ],
  },
  rule: {
    tables: [
      {
        id: 'households',
        file: 'households',
        requiredColumns: [
          { role: 'region_id', aliases: ['region_id', 'region'], type: 'string', kind: 'dimension' },
          { role: 'hh_type', aliases: ['hh_type', 'type', 'household_type'], type: 'string', kind: 'dimension' },
          { role: 'households', aliases: ['households', 'count', 'hh'], type: 'integer', kind: 'measure' },
          { role: 'income_band', aliases: ['income_band', 'income'], type: 'string', kind: 'dimension' },
          { role: 'avg_size', aliases: ['avg_size', 'size'], type: 'number', kind: 'measure' },
        ],
      },
      {
        id: 'regions',
        file: 'regions',
        requiredColumns: [
          { role: 'region_id', aliases: ['region_id', 'id'], type: 'string', kind: 'dimension' },
          { role: 'region_name', aliases: ['region_name', 'name'], type: 'string', kind: 'dimension' },
        ],
      },
    ],
    joins: [{ left: 'households', right: 'regions', on: ['region_id', 'region_id'] }],
    charts: [
      { type: 'treemap', title: 'Households by type', x: 'hh_type', y: 'households', agg: 'sum', table: 'households' },
      { type: 'bar', title: 'Households by region', x: 'region_name', y: 'households', agg: 'sum', table: 'joined' },
      { type: 'funnel', title: 'Income funnel', x: 'income_band', y: 'households', agg: 'sum', table: 'households' },
      { type: 'bar', title: 'Avg size by type', x: 'hh_type', y: 'avg_size', agg: 'avg', table: 'households' },
    ],
  },
  samples: [
    {
      name: 'households',
      csv: `region_id,hh_type,households,income_band,avg_size
R1,Family,4200,Low,3.2
R1,Single,2100,Mid,1.1
R1,Shared,800,Low,2.4
R2,Family,3900,Mid,3.0
R2,Single,2500,High,1.0
R2,Shared,900,Mid,2.2
R3,Family,5100,High,2.8
R3,Single,1800,Mid,1.2
R3,Shared,700,Low,2.5
R1,Family,1500,High,2.9
R2,Family,1200,Low,3.4
R3,Single,1100,Low,1.1`,
    },
    {
      name: 'regions',
      csv: `region_id,region_name
R1,Coastal
R2,Inland
R3,Metro`,
    },
  ],
})

writePack('marketing-funnel-advanced', {
  meta: {
    id: 'marketing-funnel-advanced',
    name: 'Marketing Funnel Advanced',
    category: 'marketing',
    description: 'Conversion funnel, area trend, and radar of stage rates.',
    version: '1.0.0',
    author: 'DataCheetah',
    insights: [
      'Conversion funnel — drop-off by stage',
      'Users over time — engagement area chart',
      'Stage radar — relative stage strength',
      'Users by stage — bar comparison',
    ],
  },
  rule: {
    requiredColumns: [
      { role: 'stage', aliases: ['stage', 'step', 'funnel_stage'], type: 'string', kind: 'dimension' },
      { role: 'users', aliases: ['users', 'count', 'volume'], type: 'integer', kind: 'measure' },
      { role: 'date', aliases: ['date', 'day'], type: 'date', kind: 'dimension' },
      { role: 'rate', aliases: ['rate', 'conversion_rate'], type: 'number', kind: 'measure' },
    ],
    charts: [
      { type: 'funnel', title: 'Conversion funnel', x: 'stage', y: 'users', agg: 'sum' },
      { type: 'area', title: 'Users over time', x: 'date', y: 'users', agg: 'sum' },
      { type: 'radar', title: 'Stage rates', x: 'stage', y: 'rate', agg: 'avg' },
      { type: 'bar', title: 'Users by stage', x: 'stage', y: 'users', agg: 'sum' },
    ],
  },
  sampleCsv: `date,stage,users,rate
2026-01-05,Awareness,10000,1.0
2026-01-05,Interest,6200,0.62
2026-01-05,Consideration,3100,0.31
2026-01-05,Purchase,900,0.09
2026-02-02,Awareness,12000,1.0
2026-02-02,Interest,7400,0.62
2026-02-02,Consideration,3800,0.32
2026-02-02,Purchase,1100,0.09
2026-03-02,Awareness,14000,1.0
2026-03-02,Interest,8800,0.63
2026-03-02,Consideration,4500,0.32
2026-03-02,Purchase,1400,0.1
2026-04-06,Awareness,15000,1.0
2026-04-06,Interest,9600,0.64
2026-04-06,Consideration,5000,0.33
2026-04-06,Purchase,1600,0.11`,
})

writePack('workforce-diversity', {
  meta: {
    id: 'workforce-diversity',
    name: 'Workforce Diversity',
    category: 'demographics',
    description: 'Dept × level heatmap, role treemap, skills radar, and hiring area.',
    version: '1.0.0',
    author: 'DataCheetah',
    insights: [
      'Dept × level heatmap — org density',
      'Headcount treemap — roles at a glance',
      'Skills radar — capability mix',
      'Hires over time — hiring area trend',
    ],
  },
  rule: {
    requiredColumns: [
      { role: 'department', aliases: ['department', 'dept'], type: 'string', kind: 'dimension' },
      { role: 'level', aliases: ['level', 'grade', 'band'], type: 'string', kind: 'dimension' },
      { role: 'headcount', aliases: ['headcount', 'count', 'employees'], type: 'integer', kind: 'measure' },
      { role: 'role', aliases: ['role', 'job', 'title'], type: 'string', kind: 'dimension' },
      { role: 'skill', aliases: ['skill', 'capability'], type: 'string', kind: 'dimension' },
      { role: 'score', aliases: ['score', 'rating'], type: 'number', kind: 'measure' },
      { role: 'date', aliases: ['date', 'month'], type: 'date', kind: 'dimension' },
      { role: 'hires', aliases: ['hires', 'hired'], type: 'integer', kind: 'measure' },
    ],
    charts: [
      { type: 'heatmap', title: 'Dept × level', x: 'department', y: 'level', measure: 'headcount', agg: 'sum' },
      { type: 'treemap', title: 'Headcount by role', x: 'role', y: 'headcount', agg: 'sum' },
      { type: 'radar', title: 'Skills radar', x: 'skill', y: 'score', agg: 'avg' },
      { type: 'area', title: 'Hires over time', x: 'date', y: 'hires', agg: 'sum' },
    ],
  },
  sampleCsv: `date,department,level,headcount,role,skill,score,hires
2026-01-01,Engineering,IC,40,Engineer,Backend,78,5
2026-01-01,Engineering,Manager,8,Eng Manager,Leadership,72,1
2026-01-01,Sales,IC,22,AE,Communication,80,3
2026-01-01,Sales,Manager,4,Sales Manager,Leadership,75,0
2026-01-01,Support,IC,18,Support Spec,Customer,82,2
2026-02-01,Engineering,IC,42,Engineer,Frontend,76,4
2026-02-01,Engineering,Manager,8,Eng Manager,Leadership,73,1
2026-02-01,Sales,IC,24,AE,Negotiation,79,2
2026-02-01,Support,IC,19,Support Spec,Customer,81,1
2026-03-01,Engineering,IC,45,Engineer,Backend,80,6
2026-03-01,Sales,IC,25,AE,Communication,81,2
2026-03-01,Support,Manager,3,Support Lead,Leadership,74,1
2026-03-01,Product,IC,12,PM,Strategy,77,2
2026-04-01,Product,IC,14,PM,Strategy,78,2
2026-04-01,Engineering,IC,48,Engineer,Data,79,3
2026-04-01,Sales,Manager,5,Sales Manager,Leadership,76,1`,
})

// Refresh advertising-funnel to include area if needed — skip, we have marketing-funnel-advanced

console.log('Wrote advanced demographic packs')
