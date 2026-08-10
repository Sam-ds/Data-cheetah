import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const base = path.join(__dirname, '..', 'public', 'templates')

const packs = [
  {
    id: 'marketing-campaigns',
    name: 'Marketing Campaigns',
    category: 'marketing',
    description: 'Campaign spend, clicks, and ROI by channel.',
    insights: [
      'Spend over time — how campaign budget is used',
      'Spend by channel — where money goes',
      'Channel mix — share of spend as a pie',
      'Clicks vs spend — efficiency scatter',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'campaign_date'], type: 'date', kind: 'dimension' },
      { role: 'spend', aliases: ['spend', 'cost', 'amount'], type: 'number', kind: 'measure' },
      { role: 'clicks', aliases: ['clicks', 'click_count'], type: 'integer', kind: 'measure' },
      { role: 'channel', aliases: ['channel', 'medium', 'source'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'Spend over time', x: 'date', y: 'spend', agg: 'sum' },
      { type: 'bar', title: 'Spend by channel', x: 'channel', y: 'spend', agg: 'sum' },
      { type: 'pie', title: 'Channel mix', dimension: 'channel', measure: 'spend', agg: 'sum' },
      { type: 'scatter', title: 'Clicks vs spend', x: 'clicks', y: 'spend' },
    ],
    csv: `date,spend,clicks,channel
2026-01-05,1200,3400,Paid Search
2026-01-12,980,2900,Social
2026-01-19,1500,4100,Paid Search
2026-02-02,720,1800,Email
2026-02-09,1100,3200,Social
2026-02-16,890,2100,Display
2026-03-02,1600,4500,Paid Search
2026-03-09,640,1500,Email
2026-03-16,1300,3600,Social
2026-04-06,1750,4800,Paid Search
2026-04-13,800,1900,Display
2026-04-20,950,2700,Email`,
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    category: 'operations',
    description: 'Tickets over time by priority and wait time distribution.',
    insights: [
      'Tickets over time — volume trend',
      'Tickets by priority — workload mix',
      'Priority mix — share of open work',
      'Wait time distribution — how long customers wait',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'opened_at', 'created_at'], type: 'date', kind: 'dimension' },
      { role: 'tickets', aliases: ['tickets', 'ticket_count', 'count'], type: 'integer', kind: 'measure' },
      { role: 'priority', aliases: ['priority', 'severity', 'level'], type: 'string', kind: 'dimension' },
      { role: 'wait_minutes', aliases: ['wait_minutes', 'wait_time', 'sla_minutes'], type: 'number', kind: 'measure' },
    ],
    charts: [
      { type: 'line', title: 'Tickets over time', x: 'date', y: 'tickets', agg: 'sum' },
      { type: 'bar', title: 'Tickets by priority', x: 'priority', y: 'tickets', agg: 'sum' },
      { type: 'pie', title: 'Priority mix', dimension: 'priority', measure: 'tickets', agg: 'sum' },
      { type: 'histogram', title: 'Wait time distribution', x: 'wait_minutes' },
    ],
    csv: `date,tickets,priority,wait_minutes
2026-01-06,42,P2,18
2026-01-13,55,P1,9
2026-01-20,38,P3,35
2026-02-03,61,P2,22
2026-02-10,47,P1,7
2026-02-17,33,P3,41
2026-03-03,70,P2,19
2026-03-10,52,P1,11
2026-03-17,29,P3,48
2026-04-07,66,P2,16
2026-04-14,48,P1,8
2026-04-21,57,P3,29
2026-05-05,44,P2,21
2026-05-12,39,P1,10`,
  },
  {
    id: 'hr-headcount',
    name: 'HR Headcount',
    category: 'operations',
    description: 'Headcount and attrition by department over time.',
    insights: [
      'Headcount over time — team growth',
      'Headcount by department — where people sit',
      'Department mix — org shape as a pie',
      'Attrition over time — exits trend',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'month', 'period'], type: 'date', kind: 'dimension' },
      { role: 'headcount', aliases: ['headcount', 'employees', 'fte'], type: 'integer', kind: 'measure' },
      { role: 'attrition', aliases: ['attrition', 'exits', 'terminations'], type: 'integer', kind: 'measure' },
      { role: 'department', aliases: ['department', 'dept', 'team'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'Headcount over time', x: 'date', y: 'headcount', agg: 'sum' },
      { type: 'bar', title: 'Headcount by department', x: 'department', y: 'headcount', agg: 'sum' },
      { type: 'pie', title: 'Department mix', dimension: 'department', measure: 'headcount', agg: 'sum' },
      { type: 'line', title: 'Attrition over time', x: 'date', y: 'attrition', agg: 'sum' },
    ],
    csv: `date,headcount,attrition,department
2026-01-01,42,1,Engineering
2026-01-01,18,0,Sales
2026-01-01,12,1,Support
2026-02-01,45,2,Engineering
2026-02-01,19,1,Sales
2026-02-01,12,0,Support
2026-03-01,48,1,Engineering
2026-03-01,21,0,Sales
2026-03-01,13,1,Support
2026-04-01,50,2,Engineering
2026-04-01,22,1,Sales
2026-04-01,14,0,Support
2026-05-01,52,1,Engineering
2026-05-01,24,0,Sales
2026-05-01,14,1,Support`,
  },
  {
    id: 'inventory-stock',
    name: 'Inventory Stock',
    category: 'operations',
    description: 'On-hand units vs reorder levels by warehouse.',
    insights: [
      'Units by warehouse — where stock sits',
      'Units vs reorder — stock health scatter',
      'On-hand distribution — how stock levels spread',
      'SKU mix by units — top inventory share',
    ],
    columns: [
      { role: 'warehouse', aliases: ['warehouse', 'location', 'site'], type: 'string', kind: 'dimension' },
      { role: 'units', aliases: ['units', 'on_hand', 'qty'], type: 'integer', kind: 'measure' },
      { role: 'reorder', aliases: ['reorder', 'reorder_point', 'min_qty'], type: 'integer', kind: 'measure' },
      { role: 'sku', aliases: ['sku', 'item', 'product'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'bar', title: 'Units by warehouse', x: 'warehouse', y: 'units', agg: 'sum' },
      { type: 'scatter', title: 'Units vs reorder', x: 'units', y: 'reorder' },
      { type: 'histogram', title: 'On-hand distribution', x: 'units' },
      { type: 'pie', title: 'SKU mix by units', dimension: 'sku', measure: 'units', agg: 'sum' },
    ],
    csv: `warehouse,units,reorder,sku
East,120,40,Widget A
East,35,50,Widget B
West,90,40,Widget A
West,60,45,Widget C
Central,150,55,Widget A
Central,22,40,Widget B
North,80,35,Widget C
North,110,50,Widget A
South,45,40,Widget B
South,70,30,Widget C
East,55,40,Widget C
West,28,35,Widget B`,
  },
  {
    id: 'saas-metrics',
    name: 'SaaS Metrics',
    category: 'product',
    description: 'MRR, churn, and plan mix for a subscription product.',
    insights: [
      'MRR over time — recurring revenue trend',
      'Churn over time — lost accounts trend',
      'Plan mix — revenue by plan',
      'MRR by plan — which tiers pay',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'month', 'period'], type: 'date', kind: 'dimension' },
      { role: 'mrr', aliases: ['mrr', 'revenue', 'arr'], type: 'number', kind: 'measure' },
      { role: 'churn', aliases: ['churn', 'churned', 'cancellations'], type: 'integer', kind: 'measure' },
      { role: 'plan', aliases: ['plan', 'tier', 'package'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'MRR over time', x: 'date', y: 'mrr', agg: 'sum' },
      { type: 'line', title: 'Churn over time', x: 'date', y: 'churn', agg: 'sum' },
      { type: 'pie', title: 'Plan mix', dimension: 'plan', measure: 'mrr', agg: 'sum' },
      { type: 'bar', title: 'MRR by plan', x: 'plan', y: 'mrr', agg: 'sum' },
    ],
    csv: `date,mrr,churn,plan
2026-01-01,12000,4,Pro
2026-01-01,4500,2,Starter
2026-01-01,8000,1,Enterprise
2026-02-01,12800,3,Pro
2026-02-01,4700,1,Starter
2026-02-01,8200,2,Enterprise
2026-03-01,13500,5,Pro
2026-03-01,5000,2,Starter
2026-03-01,8600,1,Enterprise
2026-04-01,14200,3,Pro
2026-04-01,5200,1,Starter
2026-04-01,9100,1,Enterprise`,
  },
  {
    id: 'website-analytics',
    name: 'Website Analytics',
    category: 'marketing',
    description: 'Sessions, bounce rate, and device mix for a site.',
    insights: [
      'Sessions over time — traffic trend',
      'Sessions by device — desktop vs mobile',
      'Device mix — share of traffic',
      'Bounce rate distribution — session quality',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'day'], type: 'date', kind: 'dimension' },
      { role: 'sessions', aliases: ['sessions', 'visits', 'users'], type: 'integer', kind: 'measure' },
      { role: 'bounce_rate', aliases: ['bounce_rate', 'bounce', 'bounce_pct'], type: 'number', kind: 'measure' },
      { role: 'device', aliases: ['device', 'device_type', 'platform'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'Sessions over time', x: 'date', y: 'sessions', agg: 'sum' },
      { type: 'bar', title: 'Sessions by device', x: 'device', y: 'sessions', agg: 'sum' },
      { type: 'pie', title: 'Device mix', dimension: 'device', measure: 'sessions', agg: 'sum' },
      { type: 'histogram', title: 'Bounce rate distribution', x: 'bounce_rate' },
    ],
    csv: `date,sessions,bounce_rate,device
2026-01-05,4200,0.42,Desktop
2026-01-05,3800,0.51,Mobile
2026-01-12,4500,0.40,Desktop
2026-01-12,4100,0.49,Mobile
2026-01-19,3900,0.44,Desktop
2026-01-19,4700,0.53,Mobile
2026-02-02,5100,0.38,Desktop
2026-02-02,5200,0.47,Mobile
2026-02-09,4800,0.41,Desktop
2026-02-09,5600,0.50,Mobile
2026-02-16,1200,0.36,Tablet
2026-03-02,5400,0.39,Desktop
2026-03-02,5900,0.48,Mobile
2026-03-09,1300,0.35,Tablet`,
  },
  {
    id: 'logistics-delivery',
    name: 'Logistics Delivery',
    category: 'operations',
    description: 'On-time rate, shipments, and lane performance.',
    insights: [
      'Shipments over time — volume trend',
      'Shipments by lane — busy corridors',
      'On-time vs shipments — reliability scatter',
      'Lane mix — share of volume',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'ship_date'], type: 'date', kind: 'dimension' },
      { role: 'shipments', aliases: ['shipments', 'orders', 'packages'], type: 'integer', kind: 'measure' },
      { role: 'on_time_rate', aliases: ['on_time_rate', 'otif', 'on_time'], type: 'number', kind: 'measure' },
      { role: 'lane', aliases: ['lane', 'route', 'corridor'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'Shipments over time', x: 'date', y: 'shipments', agg: 'sum' },
      { type: 'bar', title: 'Shipments by lane', x: 'lane', y: 'shipments', agg: 'sum' },
      { type: 'scatter', title: 'On-time vs shipments', x: 'shipments', y: 'on_time_rate' },
      { type: 'pie', title: 'Lane mix', dimension: 'lane', measure: 'shipments', agg: 'sum' },
    ],
    csv: `date,shipments,on_time_rate,lane
2026-01-07,120,0.92,East-West
2026-01-14,140,0.88,North-South
2026-01-21,110,0.94,East-West
2026-02-04,155,0.86,Coastal
2026-02-11,130,0.91,North-South
2026-02-18,145,0.89,East-West
2026-03-04,160,0.85,Coastal
2026-03-11,125,0.93,North-South
2026-03-18,150,0.90,East-West
2026-04-08,170,0.87,Coastal
2026-04-15,135,0.92,North-South
2026-04-22,148,0.91,East-West`,
  },
  {
    id: 'healthcare-clinic',
    name: 'Healthcare Clinic',
    category: 'healthcare',
    description: 'Visits by specialty with wait-time distribution.',
    insights: [
      'Visits by specialty — demand mix',
      'Specialty mix — share of visits',
      'Wait minutes distribution — patient wait',
      'Visits over time — clinic volume',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'visit_date'], type: 'date', kind: 'dimension' },
      { role: 'visits', aliases: ['visits', 'appointments', 'count'], type: 'integer', kind: 'measure' },
      { role: 'specialty', aliases: ['specialty', 'department', 'clinic'], type: 'string', kind: 'dimension' },
      { role: 'wait_minutes', aliases: ['wait_minutes', 'wait_time'], type: 'number', kind: 'measure' },
    ],
    charts: [
      { type: 'bar', title: 'Visits by specialty', x: 'specialty', y: 'visits', agg: 'sum' },
      { type: 'pie', title: 'Specialty mix', dimension: 'specialty', measure: 'visits', agg: 'sum' },
      { type: 'histogram', title: 'Wait minutes distribution', x: 'wait_minutes' },
      { type: 'line', title: 'Visits over time', x: 'date', y: 'visits', agg: 'sum' },
    ],
    csv: `date,visits,specialty,wait_minutes
2026-01-08,28,Primary Care,22
2026-01-08,14,Cardiology,35
2026-01-15,30,Primary Care,18
2026-01-15,12,Dermatology,27
2026-01-22,25,Primary Care,24
2026-01-22,16,Cardiology,40
2026-02-05,32,Primary Care,20
2026-02-05,11,Dermatology,29
2026-02-12,27,Primary Care,21
2026-02-12,15,Cardiology,33
2026-02-19,18,Orthopedics,45
2026-03-05,34,Primary Care,19
2026-03-05,13,Dermatology,26
2026-03-12,17,Orthopedics,42`,
  },
  {
    id: 'education-enrollment',
    name: 'Education Enrollment',
    category: 'education',
    description: 'Enrollments by program over terms.',
    insights: [
      'Enrollments over time — term trend',
      'Enrollments by program — popular courses',
      'Program mix — share of students',
      'Credits by program — load mix',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'term_start', 'term'], type: 'date', kind: 'dimension' },
      { role: 'enrollments', aliases: ['enrollments', 'students', 'seats'], type: 'integer', kind: 'measure' },
      { role: 'program', aliases: ['program', 'major', 'course'], type: 'string', kind: 'dimension' },
      { role: 'credits', aliases: ['credits', 'credit_hours'], type: 'number', kind: 'measure' },
    ],
    charts: [
      { type: 'line', title: 'Enrollments over time', x: 'date', y: 'enrollments', agg: 'sum' },
      { type: 'bar', title: 'Enrollments by program', x: 'program', y: 'enrollments', agg: 'sum' },
      { type: 'pie', title: 'Program mix', dimension: 'program', measure: 'enrollments', agg: 'sum' },
      { type: 'bar', title: 'Credits by program', x: 'program', y: 'credits', agg: 'sum' },
    ],
    csv: `date,enrollments,program,credits
2026-01-10,120,Computer Science,360
2026-01-10,85,Business,255
2026-01-10,60,Design,180
2026-02-10,125,Computer Science,375
2026-02-10,88,Business,264
2026-02-10,62,Design,186
2026-03-10,130,Computer Science,390
2026-03-10,90,Business,270
2026-03-10,65,Design,195
2026-04-10,134,Computer Science,402
2026-04-10,92,Business,276
2026-04-10,68,Design,204`,
  },
  {
    id: 'retail-store',
    name: 'Retail Store',
    category: 'sales',
    description: 'Basket size vs visits with category mix.',
    insights: [
      'Visits vs basket size — traffic and spend scatter',
      'Revenue by category — department sales',
      'Basket size distribution — ticket spread',
      'Category mix — share of revenue',
    ],
    columns: [
      { role: 'visits', aliases: ['visits', 'traffic', 'footfall'], type: 'integer', kind: 'measure' },
      { role: 'basket_size', aliases: ['basket_size', 'avg_ticket', 'aov'], type: 'number', kind: 'measure' },
      { role: 'revenue', aliases: ['revenue', 'sales', 'amount'], type: 'number', kind: 'measure' },
      { role: 'category', aliases: ['category', 'dept', 'department'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'scatter', title: 'Visits vs basket size', x: 'visits', y: 'basket_size' },
      { type: 'bar', title: 'Revenue by category', x: 'category', y: 'revenue', agg: 'sum' },
      { type: 'histogram', title: 'Basket size distribution', x: 'basket_size' },
      { type: 'pie', title: 'Category mix', dimension: 'category', measure: 'revenue', agg: 'sum' },
    ],
    csv: `visits,basket_size,revenue,category
420,32.5,13650,Grocery
380,45.0,17100,Electronics
510,28.0,14280,Grocery
290,55.0,15950,Apparel
460,30.5,14030,Grocery
340,48.0,16320,Electronics
400,27.0,10800,Home
310,52.0,16120,Apparel
480,29.5,14160,Grocery
360,50.0,18000,Electronics
270,41.0,11070,Home
330,47.0,15510,Apparel`,
  },
  {
    id: 'advertising-funnel',
    name: 'Advertising Funnel',
    category: 'marketing',
    description: 'Impressions, clicks, and conversions by campaign.',
    insights: [
      'Impressions over time — reach trend',
      'Clicks by campaign — engagement leaders',
      'Conversions by campaign — outcome mix',
      'Campaign mix — share of conversions',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'day'], type: 'date', kind: 'dimension' },
      { role: 'impressions', aliases: ['impressions', 'impr', 'views'], type: 'integer', kind: 'measure' },
      { role: 'clicks', aliases: ['clicks', 'click_count'], type: 'integer', kind: 'measure' },
      { role: 'conversions', aliases: ['conversions', 'conv', 'leads'], type: 'integer', kind: 'measure' },
      { role: 'campaign', aliases: ['campaign', 'ad_set', 'name'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'Impressions over time', x: 'date', y: 'impressions', agg: 'sum' },
      { type: 'bar', title: 'Clicks by campaign', x: 'campaign', y: 'clicks', agg: 'sum' },
      { type: 'bar', title: 'Conversions by campaign', x: 'campaign', y: 'conversions', agg: 'sum' },
      { type: 'pie', title: 'Campaign mix', dimension: 'campaign', measure: 'conversions', agg: 'sum' },
    ],
    csv: `date,impressions,clicks,conversions,campaign
2026-01-05,50000,1200,85,Brand
2026-01-12,62000,1500,110,Brand
2026-01-19,41000,980,70,Prospecting
2026-02-02,70000,1800,140,Brand
2026-02-09,45000,1100,90,Prospecting
2026-02-16,38000,900,60,Retargeting
2026-03-02,72000,1900,155,Brand
2026-03-09,48000,1250,95,Prospecting
2026-03-16,40000,1000,75,Retargeting
2026-04-06,75000,2000,165,Brand
2026-04-13,50000,1300,100,Prospecting
2026-04-20,42000,1050,80,Retargeting`,
  },
  {
    id: 'product-usage',
    name: 'Product Usage',
    category: 'product',
    description: 'DAU and feature adoption over time.',
    insights: [
      'DAU over time — active users trend',
      'Events by feature — what people use',
      'Feature mix — share of engagement',
      'Events vs DAU — intensity scatter',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'day'], type: 'date', kind: 'dimension' },
      { role: 'dau', aliases: ['dau', 'active_users', 'users'], type: 'integer', kind: 'measure' },
      { role: 'events', aliases: ['events', 'event_count', 'actions'], type: 'integer', kind: 'measure' },
      { role: 'feature', aliases: ['feature', 'module', 'screen'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'DAU over time', x: 'date', y: 'dau', agg: 'sum' },
      { type: 'bar', title: 'Events by feature', x: 'feature', y: 'events', agg: 'sum' },
      { type: 'pie', title: 'Feature mix', dimension: 'feature', measure: 'events', agg: 'sum' },
      { type: 'scatter', title: 'Events vs DAU', x: 'events', y: 'dau' },
    ],
    csv: `date,dau,events,feature
2026-01-06,820,5400,Search
2026-01-06,820,3100,Export
2026-01-13,860,5600,Search
2026-01-13,860,2900,Charts
2026-01-20,900,5800,Search
2026-01-20,900,3200,Export
2026-02-03,940,6100,Search
2026-02-03,940,3400,Charts
2026-02-10,980,6400,Search
2026-02-10,980,3600,Export
2026-02-17,1010,6600,Search
2026-02-17,1010,3500,Charts`,
  },
  {
    id: 'finance-cashflow',
    name: 'Finance Cashflow',
    category: 'finance',
    description: 'Inflows and outflows over time with amount distribution.',
    insights: [
      'Cash movement over time — net cash trend',
      'Amount by type — inflow vs outflow',
      'Type mix — share of cash movement',
      'Amount distribution — transaction sizes',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'txn_date'], type: 'date', kind: 'dimension' },
      { role: 'amount', aliases: ['amount', 'value', 'cash'], type: 'number', kind: 'measure' },
      { role: 'flow_type', aliases: ['flow_type', 'type', 'direction'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'Cash movement over time', x: 'date', y: 'amount', agg: 'sum' },
      { type: 'bar', title: 'Amount by type', x: 'flow_type', y: 'amount', agg: 'sum' },
      { type: 'pie', title: 'Type mix', dimension: 'flow_type', measure: 'amount', agg: 'sum' },
      { type: 'histogram', title: 'Amount distribution', x: 'amount' },
    ],
    csv: `date,amount,flow_type
2026-01-05,25000,Inflow
2026-01-08,12000,Outflow
2026-01-15,18000,Inflow
2026-01-22,9000,Outflow
2026-02-03,22000,Inflow
2026-02-10,14000,Outflow
2026-02-18,16000,Inflow
2026-02-25,11000,Outflow
2026-03-04,27000,Inflow
2026-03-12,13000,Outflow
2026-03-20,19000,Inflow
2026-03-28,10000,Outflow
2026-04-05,24000,Inflow
2026-04-15,15000,Outflow`,
  },
  {
    id: 'real-estate-listings',
    name: 'Real Estate Listings',
    category: 'operations',
    description: 'Price vs square footage by neighborhood.',
    insights: [
      'Price vs sqft — value scatter',
      'Listings by area — inventory mix',
      'Price distribution — listing price spread',
      'Area mix by price — premium neighborhoods',
    ],
    columns: [
      { role: 'price', aliases: ['price', 'list_price', 'asking'], type: 'number', kind: 'measure' },
      { role: 'sqft', aliases: ['sqft', 'square_feet', 'area_sqft'], type: 'number', kind: 'measure' },
      { role: 'area', aliases: ['area', 'neighborhood', 'district'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'scatter', title: 'Price vs sqft', x: 'sqft', y: 'price' },
      { type: 'bar', title: 'Listings by area', x: 'area', y: 'price', agg: 'count' },
      { type: 'histogram', title: 'Price distribution', x: 'price' },
      { type: 'pie', title: 'Area mix by price', dimension: 'area', measure: 'price', agg: 'sum' },
    ],
    csv: `price,sqft,area
420000,1100,Riverside
380000,950,Hillside
510000,1400,Riverside
295000,800,Downtown
620000,1800,Lakeside
450000,1250,Hillside
340000,900,Downtown
580000,1600,Lakeside
410000,1050,Riverside
360000,980,Hillside
275000,750,Downtown
640000,1900,Lakeside`,
  },
  {
    id: 'energy-usage',
    name: 'Energy Usage',
    category: 'operations',
    description: 'kWh by site over time with site mix.',
    insights: [
      'kWh over time — usage trend',
      'kWh by site — which locations consume most',
      'Site mix — share of energy use',
      'kWh distribution — daily usage spread',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'day'], type: 'date', kind: 'dimension' },
      { role: 'kwh', aliases: ['kwh', 'energy', 'usage'], type: 'number', kind: 'measure' },
      { role: 'site', aliases: ['site', 'location', 'building'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'kWh over time', x: 'date', y: 'kwh', agg: 'sum' },
      { type: 'bar', title: 'kWh by site', x: 'site', y: 'kwh', agg: 'sum' },
      { type: 'pie', title: 'Site mix', dimension: 'site', measure: 'kwh', agg: 'sum' },
      { type: 'histogram', title: 'kWh distribution', x: 'kwh' },
    ],
    csv: `date,kwh,site
2026-01-05,4200,Plant A
2026-01-05,3100,Plant B
2026-01-12,4500,Plant A
2026-01-12,2900,HQ
2026-01-19,4100,Plant B
2026-01-19,2800,HQ
2026-02-02,4700,Plant A
2026-02-02,3300,Plant B
2026-02-09,3000,HQ
2026-02-09,4600,Plant A
2026-02-16,3200,Plant B
2026-02-16,2700,HQ
2026-03-02,4900,Plant A
2026-03-02,3400,Plant B`,
  },
  {
    id: 'nonprofit-donations',
    name: 'Nonprofit Donations',
    category: 'finance',
    description: 'Gifts by campaign over time.',
    insights: [
      'Donations over time — giving trend',
      'Amount by campaign — fundraising leaders',
      'Campaign mix — share of gifts',
      'Gift size distribution — donation amounts',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'gift_date'], type: 'date', kind: 'dimension' },
      { role: 'amount', aliases: ['amount', 'gift', 'donation'], type: 'number', kind: 'measure' },
      { role: 'campaign', aliases: ['campaign', 'appeal', 'fund'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'Donations over time', x: 'date', y: 'amount', agg: 'sum' },
      { type: 'bar', title: 'Amount by campaign', x: 'campaign', y: 'amount', agg: 'sum' },
      { type: 'pie', title: 'Campaign mix', dimension: 'campaign', measure: 'amount', agg: 'sum' },
      { type: 'histogram', title: 'Gift size distribution', x: 'amount' },
    ],
    csv: `date,amount,campaign
2026-01-04,250,Annual Fund
2026-01-11,1000,Gala
2026-01-18,75,Annual Fund
2026-01-25,500,Scholarship
2026-02-01,1200,Gala
2026-02-08,150,Annual Fund
2026-02-15,800,Scholarship
2026-02-22,90,Annual Fund
2026-03-01,1500,Gala
2026-03-08,200,Annual Fund
2026-03-15,600,Scholarship
2026-03-22,110,Annual Fund
2026-04-05,1800,Gala
2026-04-12,300,Scholarship`,
  },
  {
    id: 'restaurant-ops',
    name: 'Restaurant Ops',
    category: 'sales',
    description: 'Covers and average check by daypart.',
    insights: [
      'Covers over time — guest volume',
      'Covers by daypart — lunch vs dinner',
      'Daypart mix — share of covers',
      'Avg check by daypart — ticket size',
    ],
    columns: [
      { role: 'date', aliases: ['date', 'business_date'], type: 'date', kind: 'dimension' },
      { role: 'covers', aliases: ['covers', 'guests', 'covers_count'], type: 'integer', kind: 'measure' },
      { role: 'avg_check', aliases: ['avg_check', 'average_check', 'ticket'], type: 'number', kind: 'measure' },
      { role: 'daypart', aliases: ['daypart', 'meal_period', 'shift'], type: 'string', kind: 'dimension' },
    ],
    charts: [
      { type: 'line', title: 'Covers over time', x: 'date', y: 'covers', agg: 'sum' },
      { type: 'bar', title: 'Covers by daypart', x: 'daypart', y: 'covers', agg: 'sum' },
      { type: 'pie', title: 'Daypart mix', dimension: 'daypart', measure: 'covers', agg: 'sum' },
      { type: 'bar', title: 'Avg check by daypart', x: 'daypart', y: 'avg_check', agg: 'avg' },
    ],
    csv: `date,covers,avg_check,daypart
2026-01-06,85,18.5,Lunch
2026-01-06,120,42.0,Dinner
2026-01-13,90,19.0,Lunch
2026-01-13,130,44.5,Dinner
2026-01-20,78,17.5,Lunch
2026-01-20,125,41.0,Dinner
2026-02-03,95,20.0,Lunch
2026-02-03,140,46.0,Dinner
2026-02-10,88,18.0,Lunch
2026-02-10,135,43.5,Dinner
2026-02-17,40,12.0,Brunch
2026-03-03,92,19.5,Lunch
2026-03-03,145,45.0,Dinner
2026-03-10,42,13.0,Brunch`,
  },
]

for (const p of packs) {
  const dir = path.join(base, p.id)
  fs.mkdirSync(dir, { recursive: true })
  const meta = {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    version: '1.0.0',
    author: 'DataCheetah',
    insights: p.insights,
  }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
  fs.writeFileSync(
    path.join(dir, 'rule.json'),
    JSON.stringify({ requiredColumns: p.columns, charts: p.charts }, null, 2) + '\n',
  )
  fs.writeFileSync(path.join(dir, 'sample.csv'), p.csv.trim() + '\n')
}

console.log(`Wrote ${packs.length} packs`)
