import fs from 'node:fs'
import path from 'node:path'
import { normalizeSpec } from '../dsh-diagram/lib/spec.js'
import { buildDiagram } from '../dsh-diagram/lib/render.js'
import { svgToPng } from '../dsh-diagram/lib/png.js'

const raw = {
  title: 'Shop architecture',
  direction: 'LR',
  nodes: [
    { id: 'web', label: 'Web app', icon: 'monitor', accent: 'blue' },
    { id: 'mobile', label: 'Mobile app', icon: 'smartphone', accent: 'blue' },
    { id: 'admin', label: 'Admin console', icon: 'settings', accent: 'slate' },
    { id: 'cdn', label: 'CDN', icon: 'globe', accent: 'violet' },
    { id: 'lb', label: 'Load balancer', icon: 'network', accent: 'violet' },
    { id: 'api', label: 'API gateway', kind: 'service', icon: 'server', accent: 'teal' },
    { id: 'auth', label: 'Auth', icon: 'key', accent: 'amber' },
    { id: 'orders', label: 'Orders', icon: 'workflow', accent: 'teal' },
    { id: 'billing', label: 'Billing', icon: 'credit-card', accent: 'amber' },
    { id: 'search', label: 'Search', icon: 'search', accent: 'teal' },
    { id: 'notify', label: 'Notifications', icon: 'bell', accent: 'rose' },
    { id: 'pg', label: 'PostgreSQL', icon: 'database', accent: 'teal' },
    { id: 'redis', label: 'Redis', icon: 'zap', accent: 'rose' },
    { id: 'kafka', label: 'Kafka', icon: 'inbox', accent: 'amber' },
    { id: 's3', label: 'Object storage', icon: 'hard-drive', accent: 'slate' },
  ],
  edges: [
    { from: 'web', to: 'cdn' },
    { from: 'mobile', to: 'cdn' },
    { from: 'admin', to: 'lb' },
    { from: 'cdn', to: 'lb', label: 'dynamic' },
    { from: 'lb', to: 'api' },
    { from: 'api', to: 'auth', label: 'verify' },
    { from: 'api', to: 'orders' },
    { from: 'api', to: 'search' },
    { from: 'orders', to: 'billing', label: 'charge' },
    { from: 'orders', to: 'pg', label: 'write' },
    { from: 'orders', to: 'kafka', label: 'events' },
    { from: 'search', to: 'redis', label: 'cache' },
    { from: 'notify', to: 'kafka', dashed: true },
    { from: 'billing', to: 's3', label: 'invoices' },
    { from: 'kafka', to: 'notify' },
  ],
  groups: [
    { label: 'Clients', nodes: ['web', 'mobile', 'admin'] },
    { label: 'Edge', nodes: ['cdn', 'lb'] },
    { label: 'Services', nodes: ['api', 'auth', 'orders', 'billing', 'search', 'notify'] },
    { label: 'Data', nodes: ['pg', 'redis', 'kafka', 's3'] },
  ],
}

const spec = normalizeSpec(raw)
const diagram = buildDiagram(spec)
fs.mkdirSync('diagrams', { recursive: true })
fs.writeFileSync(path.resolve('diagrams/shop-architecture.svg'), diagram.svg)
const png = svgToPng(diagram.svg, 2)
fs.writeFileSync(path.resolve('diagrams/shop-architecture.png'), png.bytes)
console.log('frame:', diagram.width, 'x', diagram.height)
console.log('warnings:', diagram.warnings)
