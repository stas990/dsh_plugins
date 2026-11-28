/**
 * Diagram spec validation and normalization. The spec is the only thing the
 * model authors; anything outside this schema is rejected with a message that
 * names the offending path, so a bad diagram fails loudly instead of rendering
 * something subtly different from what was asked.
 */
import { resolveIcon } from './icons.js'

export const ACCENTS = ['blue', 'teal', 'amber', 'rose', 'violet', 'slate']
export const DIRECTIONS = ['LR', 'TB']

const TOP_KEYS = ['title', 'direction', 'nodes', 'edges', 'groups']
const NODE_KEYS = ['id', 'label', 'kind', 'icon', 'accent', 'note', 'notes']
const EDGE_KEYS = ['from', 'to', 'label', 'dashed']
const GROUP_KEYS = ['label', 'nodes', 'accent']

const MAX_NODES = 80
const MAX_EDGES = 160
const MAX_LABEL = 80
const MAX_KIND = 24
const MAX_NOTE_TEXT = 320
const MAX_NOTE_ITEMS = 6
const MAX_EDGE_LABEL = 40
const MAX_GROUP_LABEL = 40
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/

function fail(path, message) {
  throw new Error(`invalid diagram: ${path} ${message}`)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assertKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(path, `has unknown key "${key}"; allowed: ${allowed.join(', ')}`)
  }
}

function asText(value, path, max, warnings) {
  if (typeof value !== 'string') fail(path, 'must be a string')
  let text = value.trim()
  if (text.length === 0) fail(path, 'must not be empty')
  if (text.length > max) {
    text = `${text.slice(0, max - 1)}…`
    warnings.push(`${path} was truncated to ${max} characters`)
  }
  return text
}

/**
 * A node may carry one remark, a short list, or both. Both fields are merged
 * into one block — the remark first, then the list — and only the merged text
 * is measured against the limit, so a caller can combine them freely.
 */
function normalizeNotes(node, path, warnings) {
  const hasNote = node.note !== undefined
  const hasNotes = node.notes !== undefined
  if (!hasNote && !hasNotes) return { paragraph: '', items: [] }

  let paragraph = ''
  if (hasNote) {
    if (typeof node.note !== 'string') fail(`${path}.note`, 'must be a string')
    paragraph = node.note.trim()
    if (paragraph.length === 0) fail(`${path}.note`, 'must not be empty')
  }

  let items = []
  if (hasNotes) {
    if (!Array.isArray(node.notes) || node.notes.length === 0) {
      fail(`${path}.notes`, 'must be a non-empty array of strings')
    }
    if (node.notes.length > MAX_NOTE_ITEMS) {
      fail(`${path}.notes`, `must contain at most ${MAX_NOTE_ITEMS} items`)
    }
    items = node.notes.map((item, index) => {
      if (typeof item !== 'string') fail(`${path}.notes[${index}]`, 'must be a string')
      const text = item.trim()
      if (text.length === 0) fail(`${path}.notes[${index}]`, 'must not be empty')
      return text
    })
  }

  // Merge first: the remark takes the budget before the list, then the merged
  // text is cut once at the limit with a single warning.
  let budget = MAX_NOTE_TEXT
  let truncated = false
  const take = (text) => {
    if (budget <= 0) {
      truncated = true
      return ''
    }
    if (text.length <= budget) {
      budget -= text.length
      return text
    }
    truncated = true
    const kept = text.slice(0, Math.max(1, budget - 1)).trimEnd()
    budget = 0
    return `${kept}…`
  }

  const mergedParagraph = take(paragraph)
  const mergedItems = []
  for (const item of items) {
    const kept = take(item)
    if (kept.length === 0) break
    mergedItems.push(kept)
  }
  if (truncated) warnings.push(`${path} note text was truncated to ${MAX_NOTE_TEXT} characters`)

  return { paragraph: mergedParagraph, items: mergedItems }
}

/**
 * @param raw - model-supplied spec, already an object (or a JSON string).
 * @param maxNodes - optional cap override.
 * @returns a normalized spec the renderer can consume without further checks.
 */
export function normalizeSpec(raw, maxNodes = MAX_NODES) {
  const warnings = []
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      fail('spec', 'is not valid JSON')
    }
  }
  if (!isRecord(raw)) fail('spec', 'must be an object')
  assertKeys(raw, TOP_KEYS, 'spec')

  const direction = raw.direction ?? 'LR'
  if (!DIRECTIONS.includes(direction)) fail('spec.direction', `must be one of ${DIRECTIONS.join(', ')}`)

  const title = raw.title === undefined ? '' : asText(raw.title, 'spec.title', 120, warnings)

  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) fail('spec.nodes', 'must be a non-empty array')
  if (raw.nodes.length > maxNodes) fail('spec.nodes', `must contain at most ${maxNodes} nodes`)

  const seen = new Set()
  const nodes = raw.nodes.map((node, index) => {
    const path = `spec.nodes[${index}]`
    if (!isRecord(node)) fail(path, 'must be an object')
    assertKeys(node, NODE_KEYS, path)
    if (typeof node.id !== 'string' || !ID_PATTERN.test(node.id)) {
      fail(`${path}.id`, 'must match [A-Za-z0-9_-]{1,40} and be unique')
    }
    if (seen.has(node.id)) fail(`${path}.id`, `duplicates node id "${node.id}"`)
    seen.add(node.id)

    const accent = node.accent ?? 'slate'
    if (!ACCENTS.includes(accent)) fail(`${path}.accent`, `must be one of ${ACCENTS.join(', ')}`)

    const icon = node.icon === undefined ? undefined : resolveIcon(node.icon)
    const notes = normalizeNotes(node, path, warnings)

    return {
      id: node.id,
      label: asText(node.label, `${path}.label`, MAX_LABEL, warnings),
      kind: node.kind === undefined ? '' : asText(node.kind, `${path}.kind`, MAX_KIND, warnings),
      accent,
      iconName: icon === undefined ? '' : `${icon.pack}/${icon.id}`,
      icon,
      noteParagraph: notes.paragraph,
      noteItems: notes.items,
    }
  })

  const rawEdges = raw.edges ?? []
  if (!Array.isArray(rawEdges)) fail('spec.edges', 'must be an array')
  if (rawEdges.length > MAX_EDGES) fail('spec.edges', `must contain at most ${MAX_EDGES} edges`)
  const edges = rawEdges.map((edge, index) => {
    const path = `spec.edges[${index}]`
    if (!isRecord(edge)) fail(path, 'must be an object')
    assertKeys(edge, EDGE_KEYS, path)
    if (typeof edge.from !== 'string' || !seen.has(edge.from)) fail(`${path}.from`, 'must name an existing node id')
    if (typeof edge.to !== 'string' || !seen.has(edge.to)) fail(`${path}.to`, 'must name an existing node id')
    if (edge.from === edge.to) fail(path, 'must not connect a node to itself')
    return {
      from: edge.from,
      to: edge.to,
      label: edge.label === undefined ? '' : asText(edge.label, `${path}.label`, MAX_EDGE_LABEL, warnings),
      dashed: edge.dashed === true,
    }
  })

  const rawGroups = raw.groups ?? []
  if (!Array.isArray(rawGroups)) fail('spec.groups', 'must be an array')
  const groups = rawGroups.map((group, index) => {
    const path = `spec.groups[${index}]`
    if (!isRecord(group)) fail(path, 'must be an object')
    assertKeys(group, GROUP_KEYS, path)
    if (!Array.isArray(group.nodes) || group.nodes.length === 0) fail(`${path}.nodes`, 'must be a non-empty array of node ids')
    for (const member of group.nodes) {
      if (typeof member !== 'string' || !seen.has(member)) fail(`${path}.nodes`, `names unknown node "${String(member)}"`)
    }
    const accent = group.accent ?? 'slate'
    if (!ACCENTS.includes(accent)) fail(`${path}.accent`, `must be one of ${ACCENTS.join(', ')}`)
    return {
      label: group.label === undefined ? '' : asText(group.label, `${path}.label`, MAX_GROUP_LABEL, warnings),
      accent,
      nodes: [...new Set(group.nodes)],
    }
  })

  return { title, direction, nodes, edges, groups, warnings }
}
