/**
 * Rebuild exactly 10 curated Discover templates (8 multifile, 2 with maps).
 * Run: node scripts/gen-curated-10.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = path.join(root, 'public', 'templates')

const KEEP = new Set([
  'population-demographics',
  'regional-census-map',
  'census-household',
  'workforce-diversity',
  'marketing-funnel-advanced',
  'ecommerce-growth',
  'saas-metrics',
  'finance-executive',
  'logistics-delivery',
  'healthcare-clinic',
])

function writePack(id, { meta, rule, samples, sampleCsv }) {
  const dir = path.join(base, id)
  fs.rmSync(dir, { recursive: true, force: true })
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

// --- 1. population-demographics (multifile + world map) ---
const ageBands = ['0-17', '18-34', '35-54', '55-64', '65+']
const regions = ['North', 'South', 'East', 'West']
const ageRows = []
for (const band of ageBands) {
  for (const region of regions) {
    const male = 1800 + Math.round(Math.random() * 3500)
    const female = 1700 + Math.round(Math.random() * 3600)
    ageRows.push(`${band},${male},${female},${region},${male + female}`)
  }
}
const countries = [
  ['United States', 331000000],
  ['China', 1412000000],
  ['India', 1393000000],
  ['Germany', 83200000],
  ['France', 67750000],
  ['United Kingdom', 67330000],
  ['Brazil', 214300000],
  ['Japan', 125700000],
  ['Canada', 38200000],
  ['Mexico', 128900000],
  ['Australia', 25700000],
  ['Russia', 144100000],
]
writePack('population-demographics', {
  meta: {
    id: 'population-demographics',
    name: 'Population Demographics',
    category: 'demographics',
    description: 'Age–sex structure plus country population choropleth.',
    version: '2.0.0',
    author: 'DataCheetah',
    insights: [
      'Age–sex pyramid — population structure by band',
      'Age × region heatmap — where age groups concentrate',
      'World population map — country totals',
      'Population by region — geographic mix',
      'Region mix — share of people',
      'Country bar chart — largest populations',
    ],
  },
  rule: {
    tables: [
      {
        id: 'age_bands',
        file: 'age_bands',
        requiredColumns: [
          { role: 'age_band', aliases: ['age_band', 'age', 'band'], type: 'string', kind: 'dimension' },
          { role: 'male', aliases: ['male', 'males', 'men'], type: 'integer', kind: 'measure' },
          { role: 'female', aliases: ['female', 'females', 'women'], type: 'integer', kind: 'measure' },
          { role: 'region', aliases: ['region', 'area', 'zone'], type: 'string', kind: 'dimension' },
          { role: 'population', aliases: ['population', 'pop', 'total'], type: 'integer', kind: 'measure' },
        ],
      },
      {
        id: 'countries',
        file: 'countries',
        requiredColumns: [
          { role: 'country', aliases: ['country', 'nation', 'name'], type: 'string', kind: 'dimension' },
          { role: 'population', aliases: ['population', 'pop', 'total'], type: 'integer', kind: 'measure' },
        ],
      },
    ],
    charts: [
      { type: 'pyramid', title: 'Age–sex pyramid', x: 'age_band', y: 'male', y2: 'female', agg: 'sum', table: 'age_bands' },
      { type: 'heatmap', title: 'Age × region', x: 'age_band', y: 'region', measure: 'population', agg: 'sum', table: 'age_bands' },
      { type: 'map', title: 'World population', x: 'country', y: 'population', agg: 'sum', map: 'world', table: 'countries' },
      { type: 'bar', title: 'Population by region', x: 'region', y: 'population', agg: 'sum', table: 'age_bands' },
      { type: 'pie', title: 'Region mix', dimension: 'region', measure: 'population', agg: 'sum', table: 'age_bands' },
      { type: 'bar', title: 'Top countries', x: 'country', y: 'population', agg: 'sum', table: 'countries' },
    ],
  },
  samples: [
    {
      name: 'age_bands',
      csv: `age_band,male,female,region,population\n${ageRows.join('\n')}`,
    },
    {
      name: 'countries',
      csv: `country,population\n${countries.map(([c, p]) => `${c},${p}`).join('\n')}`,
    },
  ],
})

// --- 2. regional-census-map (multifile + usa-states map) ---
const states = [
  'California', 'Texas', 'Florida', 'New York', 'Pennsylvania', 'Illinois', 'Ohio',
  'Georgia', 'North Carolina', 'Michigan', 'New Jersey', 'Virginia', 'Washington',
  'Arizona', 'Massachusetts', 'Tennessee', 'Indiana', 'Missouri', 'Maryland', 'Wisconsin',
]
const stateRows = states.map((s, i) => {
  const pop = 2000000 + i * 1800000 + Math.round(Math.random() * 500000)
  const median = 48000 + Math.round(Math.random() * 40000)
  const density = 20 + Math.round(Math.random() * 800)
  return `${s},${pop},${median},${density}`
})
const demoRows = []
for (const s of states.slice(0, 12)) {
  for (const band of ['Under 18', '18-44', '45-64', '65+']) {
    demoRows.push(`${s},${band},${50000 + Math.round(Math.random() * 400000)}`)
  }
}
writePack('regional-census-map', {
  meta: {
    id: 'regional-census-map',
    name: 'Regional Census Map',
    category: 'demographics',
    description: 'US state choropleth with demographics and density.',
    version: '1.0.0',
    author: 'DataCheetah',
    insights: [
      'US states map — population by state',
      'Population treemap — relative state size',
      'Median income by state — bar comparison',
      'Age × state heatmap — demographic mix',
      'Density by state — how crowded each is',
      'Age band mix — share across sample states',
    ],
  },
  rule: {
    tables: [
      {
        id: 'states',
        file: 'states',
        requiredColumns: [
          { role: 'state', aliases: ['state', 'name', 'region'], type: 'string', kind: 'dimension' },
          { role: 'population', aliases: ['population', 'pop', 'total'], type: 'integer', kind: 'measure' },
          { role: 'median_income', aliases: ['median_income', 'income'], type: 'integer', kind: 'measure' },
          { role: 'density', aliases: ['density', 'pop_density'], type: 'number', kind: 'measure' },
        ],
      },
      {
        id: 'demographics',
        file: 'demographics',
        requiredColumns: [
          { role: 'state', aliases: ['state', 'name'], type: 'string', kind: 'dimension' },
          { role: 'age_band', aliases: ['age_band', 'age', 'band'], type: 'string', kind: 'dimension' },
          { role: 'count', aliases: ['count', 'population', 'people'], type: 'integer', kind: 'measure' },
        ],
      },
    ],
    charts: [
      { type: 'map', title: 'US population map', x: 'state', y: 'population', agg: 'sum', map: 'usa-states', table: 'states' },
      { type: 'treemap', title: 'Population treemap', x: 'state', y: 'population', agg: 'sum', table: 'states' },
      { type: 'bar', title: 'Median income by state', x: 'state', y: 'median_income', agg: 'avg', table: 'states' },
      { type: 'heatmap', title: 'Age × state', x: 'age_band', y: 'state', measure: 'count', agg: 'sum', table: 'demographics' },
      { type: 'bar', title: 'Density by state', x: 'state', y: 'density', agg: 'avg', table: 'states' },
      { type: 'pie', title: 'Age band mix', dimension: 'age_band', measure: 'count', agg: 'sum', table: 'demographics' },
    ],
  },
  samples: [
    {
      name: 'states',
      csv: `state,population,median_income,density\n${stateRows.join('\n')}`,
    },
    {
      name: 'demographics',
      csv: `state,age_band,count\n${demoRows.join('\n')}`,
    },
  ],
})

// --- 3. census-household ---
writePack('census-household', {
  meta: {
    id: 'census-household',
    name: 'Census Household',
    category: 'demographics',
    description: 'Households joined to regions — treemap, funnel, stacked bars.',
    version: '2.0.0',
    author: 'DataCheetah',
    insights: [
      'Households by type — family structure treemap',
      'Households by region — where people live',
      'Income funnel — households by income band',
      'Type × tenure stacked bar — ownership mix',
      'Avg size by type — household composition',
      'Region share — pie of households',
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
          { role: 'tenure', aliases: ['tenure', 'own_rent'], type: 'string', kind: 'dimension' },
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
      { type: 'stacked_bar', title: 'Type × tenure', x: 'hh_type', series: 'tenure', y: 'households', agg: 'sum', table: 'households' },
      { type: 'bar', title: 'Avg size by type', x: 'hh_type', y: 'avg_size', agg: 'avg', table: 'households' },
      { type: 'pie', title: 'Region share', dimension: 'region_name', measure: 'households', agg: 'sum', table: 'joined' },
    ],
  },
  samples: [
    {
      name: 'households',
      csv: `region_id,hh_type,tenure,households,income_band,avg_size
R1,Family,Own,4200,<50k,3.2
R1,Family,Rent,2800,50-100k,2.9
R1,Nonfamily,Own,1500,50-100k,1.4
R1,Nonfamily,Rent,2100,<50k,1.2
R2,Family,Own,5100,100k+,3.4
R2,Family,Rent,1900,50-100k,2.7
R2,Nonfamily,Own,1200,100k+,1.5
R2,Nonfamily,Rent,2400,<50k,1.1
R3,Family,Own,3800,50-100k,3.1
R3,Family,Rent,3200,<50k,2.8
R3,Nonfamily,Own,900,50-100k,1.3
R3,Nonfamily,Rent,1800,<50k,1.2
R4,Family,Own,2900,100k+,3.5
R4,Family,Rent,1600,50-100k,2.6
R4,Nonfamily,Own,1100,100k+,1.6
R4,Nonfamily,Rent,2000,50-100k,1.3`,
    },
    {
      name: 'regions',
      csv: `region_id,region_name
R1,Northeast
R2,Midwest
R3,South
R4,West`,
    },
  ],
})

// --- 4. workforce-diversity ---
const depts = ['Engineering', 'Sales', 'Ops', 'HR', 'Finance', 'Product']
const levels = ['IC', 'Manager', 'Director']
const genders = ['Women', 'Men', 'Non-binary']
const wfRows = []
for (const d of depts) {
  for (const g of genders) {
    for (const l of levels) {
      wfRows.push(`${d},${g},${l},${5 + Math.round(Math.random() * 40)}`)
    }
  }
}
const trendRows = []
const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06']
for (const m of months) {
  for (const g of genders) {
    trendRows.push(`${m},${g},${80 + Math.round(Math.random() * 60)}`)
  }
}
writePack('workforce-diversity', {
  meta: {
    id: 'workforce-diversity',
    name: 'Workforce Diversity',
    category: 'operations',
    description: 'Headcount by dept, gender, and level with trends.',
    version: '2.0.0',
    author: 'DataCheetah',
    insights: [
      'Dept × gender heatmap — representation',
      'Headcount treemap — org composition',
      'Level radar — balance by seniority',
      'Gender stacked area — trend over months',
      'Dept bar chart — team sizes',
      'Gender mix — overall share',
    ],
  },
  rule: {
    tables: [
      {
        id: 'headcount',
        file: 'headcount',
        requiredColumns: [
          { role: 'department', aliases: ['department', 'dept', 'team'], type: 'string', kind: 'dimension' },
          { role: 'gender', aliases: ['gender', 'sex'], type: 'string', kind: 'dimension' },
          { role: 'level', aliases: ['level', 'band', 'seniority'], type: 'string', kind: 'dimension' },
          { role: 'count', aliases: ['count', 'headcount', 'employees'], type: 'integer', kind: 'measure' },
        ],
      },
      {
        id: 'trend',
        file: 'trend',
        requiredColumns: [
          { role: 'month', aliases: ['month', 'date', 'period'], type: 'string', kind: 'dimension' },
          { role: 'gender', aliases: ['gender', 'sex'], type: 'string', kind: 'dimension' },
          { role: 'count', aliases: ['count', 'headcount'], type: 'integer', kind: 'measure' },
        ],
      },
    ],
    charts: [
      { type: 'heatmap', title: 'Dept × gender', x: 'department', y: 'gender', measure: 'count', agg: 'sum', table: 'headcount' },
      { type: 'treemap', title: 'Headcount by dept', x: 'department', y: 'count', agg: 'sum', table: 'headcount' },
      { type: 'radar', title: 'Count by level', x: 'level', y: 'count', agg: 'sum', table: 'headcount' },
      { type: 'stacked_area', title: 'Gender over time', x: 'month', series: 'gender', y: 'count', agg: 'sum', table: 'trend' },
      { type: 'bar', title: 'Headcount by dept', x: 'department', y: 'count', agg: 'sum', table: 'headcount' },
      { type: 'pie', title: 'Gender mix', dimension: 'gender', measure: 'count', agg: 'sum', table: 'headcount' },
    ],
  },
  samples: [
    { name: 'headcount', csv: `department,gender,level,count\n${wfRows.join('\n')}` },
    { name: 'trend', csv: `month,gender,count\n${trendRows.join('\n')}` },
  ],
})

// --- 5. marketing-funnel-advanced ---
const stages = ['Impression', 'Click', 'Signup', 'Activate', 'Purchase']
const channels = ['Paid Search', 'Social', 'Email', 'Organic', 'Referral']
const funnelRows = stages.map((s, i) => `${s},${Math.round(100000 / (i + 1) ** 1.4)},${(0.9 - i * 0.12).toFixed(2)},2025-0${(i % 6) + 1}-01`)
const flowRows = []
for (let i = 0; i < stages.length - 1; i++) {
  for (const ch of channels.slice(0, 3)) {
    flowRows.push(`${stages[i]},${stages[i + 1]},${ch},${8000 - i * 1500 + Math.round(Math.random() * 2000)}`)
  }
}
const dailyRows = []
for (let d = 1; d <= 24; d++) {
  dailyRows.push(`2025-03-${String(d).padStart(2, '0')},${2000 + d * 40 + Math.round(Math.random() * 300)}`)
}
writePack('marketing-funnel-advanced', {
  meta: {
    id: 'marketing-funnel-advanced',
    name: 'Marketing Funnel Advanced',
    category: 'marketing',
    description: 'Funnel, sankey flows, conversion rates, and volume trend.',
    version: '2.0.0',
    author: 'DataCheetah',
    insights: [
      'Conversion funnel — stage drop-off',
      'Stage sankey — path from impression to purchase',
      'Users over time — daily volume',
      'Stage rates radar — conversion health',
      'Users by stage — bar comparison',
      'Channel share in flows — pie of volume',
    ],
  },
  rule: {
    tables: [
      {
        id: 'funnel',
        file: 'funnel',
        requiredColumns: [
          { role: 'stage', aliases: ['stage', 'step', 'funnel_stage'], type: 'string', kind: 'dimension' },
          { role: 'users', aliases: ['users', 'count', 'volume'], type: 'integer', kind: 'measure' },
          { role: 'rate', aliases: ['rate', 'conversion_rate'], type: 'number', kind: 'measure' },
          { role: 'date', aliases: ['date', 'day'], type: 'date', kind: 'dimension' },
        ],
      },
      {
        id: 'flows',
        file: 'flows',
        requiredColumns: [
          { role: 'source', aliases: ['source', 'from_stage'], type: 'string', kind: 'dimension' },
          { role: 'target', aliases: ['target', 'to_stage'], type: 'string', kind: 'dimension' },
          { role: 'channel', aliases: ['channel', 'medium'], type: 'string', kind: 'dimension' },
          { role: 'value', aliases: ['value', 'users', 'count'], type: 'integer', kind: 'measure' },
        ],
      },
      {
        id: 'daily',
        file: 'daily',
        requiredColumns: [
          { role: 'date', aliases: ['date', 'day'], type: 'date', kind: 'dimension' },
          { role: 'users', aliases: ['users', 'count', 'volume'], type: 'integer', kind: 'measure' },
        ],
      },
    ],
    charts: [
      { type: 'funnel', title: 'Conversion funnel', x: 'stage', y: 'users', agg: 'sum', table: 'funnel' },
      { type: 'sankey', title: 'Stage flow', source: 'source', target: 'target', measure: 'value', agg: 'sum', table: 'flows' },
      { type: 'area', title: 'Users over time', x: 'date', y: 'users', agg: 'sum', table: 'daily' },
      { type: 'radar', title: 'Stage rates', x: 'stage', y: 'rate', agg: 'avg', table: 'funnel' },
      { type: 'bar', title: 'Users by stage', x: 'stage', y: 'users', agg: 'sum', table: 'funnel' },
      { type: 'pie', title: 'Channel in flows', dimension: 'channel', measure: 'value', agg: 'sum', table: 'flows' },
    ],
  },
  samples: [
    { name: 'funnel', csv: `stage,users,rate,date\n${funnelRows.join('\n')}` },
    { name: 'flows', csv: `source,target,channel,value\n${flowRows.join('\n')}` },
    { name: 'daily', csv: `date,users\n${dailyRows.join('\n')}` },
  ],
})

// --- 6. ecommerce-growth ---
const cats = ['Electronics/Phones', 'Electronics/Laptops', 'Home/Kitchen', 'Home/Furniture', 'Fashion/Men', 'Fashion/Women', 'Sports/Outdoor']
const catRows = cats.map((c) => `${c},${20000 + Math.round(Math.random() * 80000)}`)
const orderRows = []
for (let i = 1; i <= 40; i++) {
  const ch = channels[i % channels.length]
  orderRows.push(
    `2025-02-${String((i % 28) + 1).padStart(2, '0')},${ch},${40 + Math.round(Math.random() * 80)},${(2000 + Math.random() * 9000).toFixed(2)}`,
  )
}
const ecomFunnel = ['Visit', 'Add to cart', 'Checkout', 'Paid'].map((s, i) => `${s},${Math.round(50000 / (i + 1) ** 1.3)}`)
writePack('ecommerce-growth', {
  meta: {
    id: 'ecommerce-growth',
    name: 'E-commerce Growth',
    category: 'ecommerce',
    description: 'Category hierarchy, channel orders, and checkout funnel.',
    version: '2.0.0',
    author: 'DataCheetah',
    insights: [
      'Category sunburst — revenue hierarchy',
      'Orders vs revenue scatter — efficiency',
      'Revenue trend — sales over time',
      'Channel mix — order share',
      'Checkout funnel — conversion stages',
      'Revenue by channel — bar leaders',
    ],
  },
  rule: {
    tables: [
      {
        id: 'categories',
        file: 'categories',
        requiredColumns: [
          { role: 'path', aliases: ['path', 'category', 'name'], type: 'string', kind: 'dimension' },
          { role: 'revenue', aliases: ['revenue', 'sales', 'amount'], type: 'number', kind: 'measure' },
        ],
      },
      {
        id: 'orders',
        file: 'orders',
        requiredColumns: [
          { role: 'date', aliases: ['date', 'order_date'], type: 'date', kind: 'dimension' },
          { role: 'channel', aliases: ['channel', 'source'], type: 'string', kind: 'dimension' },
          { role: 'orders', aliases: ['orders', 'count'], type: 'integer', kind: 'measure' },
          { role: 'revenue', aliases: ['revenue', 'sales', 'amount'], type: 'number', kind: 'measure' },
        ],
      },
      {
        id: 'checkout',
        file: 'checkout',
        requiredColumns: [
          { role: 'stage', aliases: ['stage', 'step'], type: 'string', kind: 'dimension' },
          { role: 'users', aliases: ['users', 'count'], type: 'integer', kind: 'measure' },
        ],
      },
    ],
    charts: [
      { type: 'sunburst', title: 'Category hierarchy', x: 'path', y: 'revenue', agg: 'sum', table: 'categories' },
      { type: 'scatter', title: 'Orders vs revenue', x: 'orders', y: 'revenue', table: 'orders' },
      { type: 'line', title: 'Revenue trend', x: 'date', y: 'revenue', agg: 'sum', table: 'orders' },
      { type: 'pie', title: 'Channel mix', dimension: 'channel', measure: 'orders', agg: 'sum', table: 'orders' },
      { type: 'funnel', title: 'Checkout funnel', x: 'stage', y: 'users', agg: 'sum', table: 'checkout' },
      { type: 'bar', title: 'Revenue by channel', x: 'channel', y: 'revenue', agg: 'sum', table: 'orders' },
    ],
  },
  samples: [
    { name: 'categories', csv: `path,revenue\n${catRows.join('\n')}` },
    { name: 'orders', csv: `date,channel,orders,revenue\n${orderRows.join('\n')}` },
    { name: 'checkout', csv: `stage,users\n${ecomFunnel.join('\n')}` },
  ],
})

// --- 7. saas-metrics ---
const plans = ['Free', 'Pro', 'Business', 'Enterprise']
const saasMonths = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08']
const mrrRows = []
for (const m of saasMonths) {
  for (const p of plans) {
    mrrRows.push(`${m},${p},${5000 + Math.round(Math.random() * 40000)}`)
  }
}
const kpiRows = saasMonths.map((m, i) => `${m},${1200 + i * 80},${(0.04 + Math.random() * 0.03).toFixed(3)},${(0.92 + Math.random() * 0.05).toFixed(3)}`)
writePack('saas-metrics', {
  meta: {
    id: 'saas-metrics',
    name: 'SaaS Metrics',
    category: 'product',
    description: 'MRR by plan, stacked trends, and retention mix.',
    version: '2.0.0',
    author: 'DataCheetah',
    insights: [
      'MRR trend — monthly recurring revenue',
      'Plan stacked area — MRR composition',
      'Plan stacked bar — period mix',
      'Plan pie — share of MRR',
      'Customers over time — growth line',
      'Churn by month — bar watchlist',
    ],
  },
  rule: {
    tables: [
      {
        id: 'mrr',
        file: 'mrr',
        requiredColumns: [
          { role: 'month', aliases: ['month', 'date', 'period'], type: 'string', kind: 'dimension' },
          { role: 'plan', aliases: ['plan', 'tier', 'product'], type: 'string', kind: 'dimension' },
          { role: 'mrr', aliases: ['mrr', 'revenue', 'amount'], type: 'number', kind: 'measure' },
        ],
      },
      {
        id: 'kpis',
        file: 'kpis',
        requiredColumns: [
          { role: 'month', aliases: ['month', 'date', 'period'], type: 'string', kind: 'dimension' },
          { role: 'customers', aliases: ['customers', 'users', 'accounts'], type: 'integer', kind: 'measure' },
          { role: 'churn', aliases: ['churn', 'churn_rate'], type: 'number', kind: 'measure' },
          { role: 'retention', aliases: ['retention', 'retention_rate'], type: 'number', kind: 'measure' },
        ],
      },
    ],
    charts: [
      { type: 'line', title: 'MRR trend', x: 'month', y: 'mrr', agg: 'sum', table: 'mrr' },
      { type: 'stacked_area', title: 'MRR by plan', x: 'month', series: 'plan', y: 'mrr', agg: 'sum', table: 'mrr' },
      { type: 'stacked_bar', title: 'Plan mix by month', x: 'month', series: 'plan', y: 'mrr', agg: 'sum', table: 'mrr' },
      { type: 'pie', title: 'Plan share', dimension: 'plan', measure: 'mrr', agg: 'sum', table: 'mrr' },
      { type: 'line', title: 'Customers over time', x: 'month', y: 'customers', agg: 'sum', table: 'kpis' },
      { type: 'bar', title: 'Churn by month', x: 'month', y: 'churn', agg: 'avg', table: 'kpis' },
    ],
  },
  samples: [
    { name: 'mrr', csv: `month,plan,mrr\n${mrrRows.join('\n')}` },
    { name: 'kpis', csv: `month,customers,churn,retention\n${kpiRows.join('\n')}` },
  ],
})

// --- 8. finance-executive (single file OK) ---
const finRows = []
for (let m = 1; m <= 12; m++) {
  const month = `2025-${String(m).padStart(2, '0')}`
  for (const cat of ['Revenue', 'COGS', 'OpEx', 'Marketing']) {
    finRows.push(`${month},${cat},${(10000 + Math.random() * 90000).toFixed(2)}`)
  }
}
writePack('finance-executive', {
  meta: {
    id: 'finance-executive',
    name: 'Finance Executive',
    category: 'finance',
    description: 'P&L trend, category mix, and amount distribution.',
    version: '2.0.0',
    author: 'DataCheetah',
    insights: [
      'Amount over time — monthly P&L trend',
      'Spend by category — bar leaders',
      'Category mix — pie share',
      'Amount histogram — distribution shape',
      'Revenue vs other — category focus',
      'Monthly totals — executive pulse',
    ],
  },
  rule: {
    requiredColumns: [
      { role: 'month', aliases: ['month', 'date', 'period'], type: 'string', kind: 'dimension' },
      { role: 'category', aliases: ['category', 'line_item', 'account'], type: 'string', kind: 'dimension' },
      { role: 'amount', aliases: ['amount', 'value', 'spend'], type: 'number', kind: 'measure' },
    ],
    charts: [
      { type: 'line', title: 'Amount over time', x: 'month', y: 'amount', agg: 'sum' },
      { type: 'bar', title: 'Amount by category', x: 'category', y: 'amount', agg: 'sum' },
      { type: 'pie', title: 'Category mix', dimension: 'category', measure: 'amount', agg: 'sum' },
      { type: 'histogram', title: 'Amount distribution', x: 'amount' },
      { type: 'area', title: 'Running monthly total', x: 'month', y: 'amount', agg: 'sum' },
      { type: 'bar', title: 'Monthly totals', x: 'month', y: 'amount', agg: 'sum' },
    ],
  },
  sampleCsv: `month,category,amount\n${finRows.join('\n')}`,
})

// --- 9. logistics-delivery ---
const hubs = ['LAX', 'ORD', 'JFK', 'DFW', 'SEA', 'ATL']
const shipRows = []
for (let i = 0; i < 48; i++) {
  const hub = hubs[i % hubs.length]
  const delay = Math.round(Math.random() * 48)
  const distance = 50 + Math.round(Math.random() * 2500)
  const cost = (8 + distance * 0.02 + delay * 0.5).toFixed(2)
  shipRows.push(`2025-04-${String((i % 28) + 1).padStart(2, '0')},${hub},${delay},${distance},${cost}`)
}
const routeRows = []
for (const h of hubs) {
  for (const region of ['West', 'Central', 'East']) {
    routeRows.push(`${h},${region},${20 + Math.round(Math.random() * 80)},${(1 + Math.random() * 12).toFixed(1)}`)
  }
}
writePack('logistics-delivery', {
  meta: {
    id: 'logistics-delivery',
    name: 'Logistics Delivery',
    category: 'operations',
    description: 'Shipments, delays, hub performance, and route heat.',
    version: '2.0.0',
    author: 'DataCheetah',
    insights: [
      'Distance vs cost scatter — efficiency',
      'Shipments by hub — volume leaders',
      'Delay over time — service trend',
      'Hub × region heatmap — lane load',
      'Avg delay by hub — bar watchlist',
      'Cost distribution — ops histogram',
    ],
  },
  rule: {
    tables: [
      {
        id: 'shipments',
        file: 'shipments',
        requiredColumns: [
          { role: 'date', aliases: ['date', 'ship_date'], type: 'date', kind: 'dimension' },
          { role: 'hub', aliases: ['hub', 'warehouse', 'origin'], type: 'string', kind: 'dimension' },
          { role: 'delay_hrs', aliases: ['delay_hrs', 'delay', 'late_hours'], type: 'number', kind: 'measure' },
          { role: 'distance_mi', aliases: ['distance_mi', 'distance', 'miles'], type: 'number', kind: 'measure' },
          { role: 'cost', aliases: ['cost', 'spend', 'amount'], type: 'number', kind: 'measure' },
        ],
      },
      {
        id: 'routes',
        file: 'routes',
        requiredColumns: [
          { role: 'hub', aliases: ['hub', 'warehouse'], type: 'string', kind: 'dimension' },
          { role: 'region', aliases: ['region', 'dest_region'], type: 'string', kind: 'dimension' },
          { role: 'shipments', aliases: ['shipments', 'count', 'volume'], type: 'integer', kind: 'measure' },
          { role: 'avg_delay', aliases: ['avg_delay', 'delay'], type: 'number', kind: 'measure' },
        ],
      },
    ],
    charts: [
      { type: 'scatter', title: 'Distance vs cost', x: 'distance_mi', y: 'cost', table: 'shipments' },
      { type: 'bar', title: 'Shipments by hub', x: 'hub', y: 'shipments', agg: 'sum', table: 'routes' },
      { type: 'line', title: 'Delay over time', x: 'date', y: 'delay_hrs', agg: 'avg', table: 'shipments' },
      { type: 'heatmap', title: 'Hub × region', x: 'hub', y: 'region', measure: 'shipments', agg: 'sum', table: 'routes' },
      { type: 'bar', title: 'Avg delay by hub', x: 'hub', y: 'avg_delay', agg: 'avg', table: 'routes' },
      { type: 'histogram', title: 'Cost distribution', x: 'cost', table: 'shipments' },
    ],
  },
  samples: [
    { name: 'shipments', csv: `date,hub,delay_hrs,distance_mi,cost\n${shipRows.join('\n')}` },
    { name: 'routes', csv: `hub,region,shipments,avg_delay\n${routeRows.join('\n')}` },
  ],
})

// --- 10. healthcare-clinic (single file OK) ---
const clinics = ['North Clinic', 'Central Clinic', 'South Clinic']
const specialties = ['Primary', 'Cardiology', 'Ortho', 'Peds']
const hcRows = []
for (let d = 1; d <= 30; d++) {
  const date = `2025-05-${String(d).padStart(2, '0')}`
  for (const c of clinics) {
    for (const s of specialties.slice(0, 2 + (d % 3))) {
      hcRows.push(`${date},${c},${s},${5 + Math.round(Math.random() * 40)},${(15 + Math.random() * 50).toFixed(1)}`)
    }
  }
}
writePack('healthcare-clinic', {
  meta: {
    id: 'healthcare-clinic',
    name: 'Healthcare Clinic',
    category: 'healthcare',
    description: 'Visits by clinic and specialty with wait-time mix.',
    version: '2.0.0',
    author: 'DataCheetah',
    insights: [
      'Visits stacked by specialty — clinic load',
      'Visits over time — volume area',
      'Specialty mix — pie share',
      'Wait time histogram — patient experience',
      'Visits by clinic — bar comparison',
      'Avg wait by specialty — ops bar',
    ],
  },
  rule: {
    requiredColumns: [
      { role: 'date', aliases: ['date', 'visit_date'], type: 'date', kind: 'dimension' },
      { role: 'clinic', aliases: ['clinic', 'site', 'location'], type: 'string', kind: 'dimension' },
      { role: 'specialty', aliases: ['specialty', 'dept', 'service'], type: 'string', kind: 'dimension' },
      { role: 'visits', aliases: ['visits', 'count', 'patients'], type: 'integer', kind: 'measure' },
      { role: 'wait_min', aliases: ['wait_min', 'wait', 'wait_time'], type: 'number', kind: 'measure' },
    ],
    charts: [
      { type: 'stacked_bar', title: 'Clinic × specialty', x: 'clinic', series: 'specialty', y: 'visits', agg: 'sum' },
      { type: 'area', title: 'Visits over time', x: 'date', y: 'visits', agg: 'sum' },
      { type: 'pie', title: 'Specialty mix', dimension: 'specialty', measure: 'visits', agg: 'sum' },
      { type: 'histogram', title: 'Wait time distribution', x: 'wait_min' },
      { type: 'bar', title: 'Visits by clinic', x: 'clinic', y: 'visits', agg: 'sum' },
      { type: 'bar', title: 'Avg wait by specialty', x: 'specialty', y: 'wait_min', agg: 'avg' },
    ],
  },
  sampleCsv: `date,clinic,specialty,visits,wait_min\n${hcRows.join('\n')}`,
})

// Delete unused template dirs (keep schema json files at templates root)
for (const name of fs.readdirSync(base)) {
  const full = path.join(base, name)
  if (!fs.statSync(full).isDirectory()) continue
  if (!KEEP.has(name)) {
    fs.rmSync(full, { recursive: true, force: true })
    console.log('deleted', name)
  }
}

console.log('Kept:', [...KEEP].sort().join(', '))

// SPA-safe sample bundles (samples-bundle.json)
const { spawnSync } = await import('node:child_process')
spawnSync(process.execPath, [path.join(root, 'scripts', 'gen-sample-bundles.mjs')], {
  stdio: 'inherit',
})

console.log('Done.')
