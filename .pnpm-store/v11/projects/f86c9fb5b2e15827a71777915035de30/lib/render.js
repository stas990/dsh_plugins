/**
 * Fixed visual system for every diagram this bundle produces: one palette, one
 * type scale, one node geometry, layered layout, orthogonal edges. Nothing in
 * here reads theme or user input for styling, so repeated renders of the same
 * spec are byte-identical and different sessions look like one product.
 */

const FONT = "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif"

export const NODE_W = 236
export const NODE_H = 68
const GAP_X = 88
const GAP_Y = 36
const PAD = 40
const TITLE_BASELINE = 40
const CONTENT_TOP_TITLE = 68
const GROUP_PAD = 12
const GROUP_LABEL_H = 16
const RADIUS = 12

const NOTE_FONT_SIZE = 11.5
const NOTE_LINE_H = 16
const NOTE_PAD_TOP = 8
const NOTE_PAD_BOTTOM = 10
const NOTE_TEXT_X = 16
const NOTE_LIST_X = 30
const NOTE_BULLET_X = 18
const NOTE_TEXT_CHARS = 30
const NOTE_LIST_CHARS = 28
const NOTE_COLOR = '#475569'
const DIVIDER_COLOR = '#EDF1F6'

const COLORS = {
  bg: '#FFFFFF',
  ink: '#0F172A',
  body: '#334155',
  muted: '#64748B',
  border: '#E2E8F0',
  surface: '#F8FAFC',
  edge: '#94A3B8',
}

const ACCENT_STYLES = {
  blue: { stroke: '#2563EB', tint: '#EFF6FF' },
  teal: { stroke: '#0D9488', tint: '#F0FDFA' },
  amber: { stroke: '#D97706', tint: '#FFFBEB' },
  rose: { stroke: '#E11D48', tint: '#FFF1F2' },
  violet: { stroke: '#7C3AED', tint: '#F5F3FF' },
  slate: { stroke: '#475569', tint: '#F1F5F9' },
}

const n = (value) => Math.round(value * 10) / 10

/** Escape text for XML text nodes and attribute values. */
export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/** Rough advance width; good enough for wrapped labels and pill sizes. */
function textWidth(text, size) {
  let units = 0
  for (const char of text) {
    if ('MW@#%&'.includes(char)) units += 0.85
    else if ("ilj.,:;'|!·".includes(char)) units += 0.32
    else if (char === ' ') units += 0.34
    else units += 0.58
  }
  return units * size
}

/** Greedy wrap to at most two lines; the last line is ellipsized. */
function wrapLabel(text, maxChars) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (current.length > 0) lines.push(current)
    current = word
    if (lines.length === 2) break
  }
  if (lines.length < 2 && current.length > 0) lines.push(current)
  if (lines.length === 2 && lines[1].length > maxChars) {
    lines[1] = `${lines[1].slice(0, maxChars - 1)}…`
  }
  if (lines.length === 0) lines.push(text)
  return lines
}

/** Greedy wrap with no line cap; a word longer than the line is hard-split. */
function wrapText(text, maxChars) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    if (word.length > maxChars) {
      if (current.length > 0) {
        lines.push(current)
        current = ''
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars))
      }
      continue
    }
    if (current.length === 0) current = word
    else if (`${current} ${word}`.length <= maxChars) current = `${current} ${word}`
    else {
      lines.push(current)
      current = word
    }
  }
  if (current.length > 0) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

/**
 * Wrapped note content for one node: an optional remark paragraph followed by
 * an optional short list. Measuring and drawing share this result.
 */
function noteLayout(node) {
  const paragraph = typeof node.noteParagraph === 'string' ? node.noteParagraph : ''
  const items = Array.isArray(node.noteItems) ? node.noteItems : []
  if (paragraph.length === 0 && items.length === 0) return null

  const paragraphLines = paragraph.length > 0 ? wrapText(paragraph, NOTE_TEXT_CHARS) : []
  const itemLines = items.map((item) => wrapText(item, NOTE_LIST_CHARS))
  const lineCount = paragraphLines.length + itemLines.reduce((sum, lines) => sum + lines.length, 0)
  return {
    paragraphLines,
    itemLines,
    lineCount,
    gap: paragraphLines.length > 0 && itemLines.length > 0 ? 4 : 0,
  }
}

/** Card height: the fixed header plus the wrapped note block, if any. */
function nodeHeight(node) {
  const notes = noteLayout(node)
  if (notes === null) return NODE_H
  return NODE_H + NOTE_PAD_TOP + notes.lineCount * NOTE_LINE_H + notes.gap + NOTE_PAD_BOTTOM
}

/** Longest-path ranks on the DAG left after removing DFS back edges. */
function assignRanks(nodes, edges) {
  const ids = nodes.map((node) => node.id)
  const adjacency = new Map(ids.map((id) => [id, []]))
  for (const edge of edges) adjacency.get(edge.from).push(edge.to)

  const state = new Map()
  const backEdges = new Set()
  const walk = (id) => {
    state.set(id, 1)
    for (const next of adjacency.get(id)) {
      if (state.get(next) === 1) backEdges.add(`${id}->${next}`)
      else if (!state.has(next)) walk(next)
    }
    state.set(id, 2)
  }
  for (const id of ids) if (!state.has(id)) walk(id)

  const rank = new Map(ids.map((id) => [id, 0]))
  const acyclic = edges.filter((edge) => !backEdges.has(`${edge.from}->${edge.to}`))
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false
    for (const edge of acyclic) {
      const candidate = rank.get(edge.from) + 1
      if (rank.get(edge.to) < candidate) {
        rank.set(edge.to, candidate)
        changed = true
      }
    }
    if (!changed) break
  }
  return rank
}

/** Group nodes by rank, then reduce crossings with two barycenter passes. */
function orderRanks(nodes, edges, rank) {
  const maxRank = Math.max(0, ...nodes.map((node) => rank.get(node.id)))
  const columns = Array.from({ length: maxRank + 1 }, () => [])
  nodes.forEach((node, index) => columns[rank.get(node.id)].push({ id: node.id, index }))
  for (let pass = 0; pass < 2; pass++) {
    for (let column = 1; column < columns.length; column++) {
      const previous = new Map(columns[column - 1].map((entry, index) => [entry.id, index]))
      const meanOf = (id) => {
        const positions = edges
          .filter((edge) => edge.to === id && previous.has(edge.from))
          .map((edge) => previous.get(edge.from))
        if (positions.length === 0) return columns[column].find((entry) => entry.id === id).index
        return positions.reduce((sum, value) => sum + value, 0) / positions.length
      }
      columns[column] = columns[column]
        .slice()
        .sort((a, b) => meanOf(a.id) - meanOf(b.id) || a.index - b.index)
    }
  }
  return columns
}

/** Place every node; returns geometry the renderer can draw directly. */
function layoutNodes(spec) {
  const rank = assignRanks(spec.nodes, spec.edges)
  const columns = orderRanks(spec.nodes, spec.edges, rank)
  const contentTop = spec.title.length > 0 ? CONTENT_TOP_TITLE : PAD
  const positions = new Map()
  const byId = new Map(spec.nodes.map((node) => [node.id, node]))
  const heightOf = new Map(spec.nodes.map((node) => [node.id, nodeHeight(node)]))
  let maxRight = 0
  let maxBottom = 0

  if (spec.direction === 'LR') {
    const heights = columns.map((column) =>
      column.reduce((sum, entry, index) => sum + heightOf.get(entry.id) + (index > 0 ? GAP_Y : 0), 0),
    )
    const tallest = Math.max(0, ...heights)
    columns.forEach((column, index) => {
      const left = PAD + index * (NODE_W + GAP_X)
      let top = contentTop + (tallest - heights[index]) / 2
      for (const entry of column) {
        const node = byId.get(entry.id)
        const height = heightOf.get(entry.id)
        positions.set(entry.id, { x: left, y: top, w: NODE_W, h: height, notes: noteLayout(node) })
        top += height + GAP_Y
        maxRight = Math.max(maxRight, left + NODE_W)
        maxBottom = Math.max(maxBottom, top - GAP_Y)
      }
    })
  } else {
    const widths = columns.map((column) => column.length * NODE_W + Math.max(0, column.length - 1) * GAP_X)
    const widest = Math.max(0, ...widths)
    let top = contentTop
    columns.forEach((column, index) => {
      const left = PAD + (widest - widths[index]) / 2
      const rowHeight = Math.max(...column.map((entry) => heightOf.get(entry.id)))
      column.forEach((entry, position) => {
        const node = byId.get(entry.id)
        positions.set(entry.id, {
          x: left + position * (NODE_W + GAP_X),
          y: top,
          w: NODE_W,
          h: heightOf.get(entry.id),
          notes: noteLayout(node),
        })
        maxRight = Math.max(maxRight, left + position * (NODE_W + GAP_X) + NODE_W)
      })
      top += rowHeight + GAP_Y
      maxBottom = Math.max(maxBottom, top - GAP_Y)
    })
  }

  return { positions, rank, contentTop, maxRight, maxBottom }
}

/**
 * Frame each declared group around its member nodes. A frame is drawn only when
 * its bounding box contains nothing but members: a frame around a region that
 * also holds unrelated nodes would claim those nodes belong to the group.
 */
function layoutGroups(spec, positions) {
  const frames = []
  const warnings = []
  for (const group of spec.groups) {
    const members = group.nodes.map((id) => positions.get(id))
    const minX = Math.min(...members.map((member) => member.x))
    const minY = Math.min(...members.map((member) => member.y))
    const maxX = Math.max(...members.map((member) => member.x + member.w))
    const maxY = Math.max(...members.map((member) => member.y + member.h))
    const labelSpace = group.label.length > 0 ? GROUP_LABEL_H : 0
    const frame = {
      ...group,
      x: minX - GROUP_PAD,
      y: minY - GROUP_PAD - labelSpace,
      width: maxX - minX + GROUP_PAD * 2,
      height: maxY - minY + GROUP_PAD * 2 + labelSpace,
    }

    const memberIds = new Set(group.nodes)
    const intruders = spec.nodes.filter((node) => {
      if (memberIds.has(node.id)) return false
      const position = positions.get(node.id)
      return (
        position.x < frame.x + frame.width &&
        position.x + position.w > frame.x &&
        position.y < frame.y + frame.height &&
        position.y + position.h > frame.y
      )
    })

    if (intruders.length > 0) {
      const names = intruders.slice(0, 4).map((node) => `"${node.label}"`)
      const more = intruders.length > 4 ? ` and ${intruders.length - 4} more` : ''
      warnings.push(
        `group "${group.label || group.nodes.join(', ')}" was not framed: its area also contains ${names.join(', ')}${more}. ` +
          'Keep each group inside one contiguous layer, or split it.',
      )
      continue
    }
    frames.push(frame)
  }
  frames.sort((a, b) => b.width * b.height - a.width * a.height)
  return { frames, warnings }
}

/** Right-angle path between two rectangles, entering through the target's side. */
function routeEdge(a, b, direction, rankA, rankB) {
  if (direction === 'LR') {
    const sy = a.y + NODE_H / 2
    const ty = b.y + NODE_H / 2
    if (b.x > a.x) {
      const sx = a.x + a.w
      const tx = b.x
      if (rankB > rankA + 1) {
        // Skipping a column: go around underneath so the line never crosses a node.
        const bottom = Math.max(a.y + a.h, b.y + b.h) + 26
        return [
          { x: a.x + a.w / 2, y: a.y + a.h },
          { x: a.x + a.w / 2, y: bottom },
          { x: b.x + b.w / 2, y: bottom },
          { x: b.x + b.w / 2, y: b.y + b.h },
        ]
      }
      if (Math.abs(sy - ty) < 0.5) return [{ x: sx, y: sy }, { x: tx, y: ty }]
      const middle = (sx + tx) / 2
      return [{ x: sx, y: sy }, { x: middle, y: sy }, { x: middle, y: ty }, { x: tx, y: ty }]
    }
    if (b.x === a.x) {
      const corridor = a.x - 26
      return [
        { x: a.x, y: sy },
        { x: corridor, y: sy },
        { x: corridor, y: ty },
        { x: b.x, y: ty },
      ]
    }
    const corridor = Math.max(a.x + a.w, b.x + b.w) + 26
    const bottom = Math.max(a.y + a.h, b.y + b.h) + 26
    return [
      { x: a.x + a.w, y: sy },
      { x: corridor, y: sy },
      { x: corridor, y: bottom },
      { x: b.x - 26, y: bottom },
      { x: b.x - 26, y: ty },
      { x: b.x, y: ty },
    ]
  }

  const sx = a.x + a.w / 2
  const sy = a.y + a.h
  if (b.y > a.y) {
    if (rankB > rankA + 1) {
      // Skipping a row: pass on the right so the line never crosses a node.
      const corridor = Math.max(a.x + a.w, b.x + b.w) + 26
      const exitY = a.y + NODE_H / 2
      const enterY = b.y + NODE_H / 2
      return [
        { x: a.x + a.w, y: exitY },
        { x: corridor, y: exitY },
        { x: corridor, y: enterY },
        { x: b.x + b.w, y: enterY },
      ]
    }
    const ty = b.y
    const tx = b.x + b.w / 2
    if (Math.abs(sx - tx) < 0.5) return [{ x: sx, y: sy }, { x: tx, y: ty }]
    const middle = (sy + ty) / 2
    return [{ x: sx, y: sy }, { x: sx, y: middle }, { x: tx, y: middle }, { x: tx, y: ty }]
  }
  if (b.y === a.y) {
    const exitY = a.y + NODE_H / 2
    const enterY = b.y + NODE_H / 2
    const corridor = Math.max(a.x + a.w, b.x + b.w) + 26
    return [
      { x: a.x + a.w, y: exitY },
      { x: corridor, y: exitY },
      { x: corridor, y: enterY },
      { x: b.x, y: enterY },
    ]
  }
  const corridor = Math.max(a.y + a.h, b.y + b.h) + 26
  const right = Math.max(a.x + a.w, b.x + b.w) + 26
  return [
    { x: sx, y: sy },
    { x: sx, y: corridor },
    { x: right, y: corridor },
    { x: right, y: b.y + NODE_H / 2 },
    { x: b.x + b.w, y: b.y + NODE_H / 2 },
  ]
}

/** Path with rounded corners; radius shrinks so short segments stay straight. */
function pathData(points, radius = 10) {
  if (points.length < 2) return ''
  let d = `M${n(points[0].x)},${n(points[0].y)}`
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1]
    const corner = points[index]
    const next = points[index + 1]
    const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y)
    const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y)
    const r = Math.min(radius, incoming / 2, outgoing / 2)
    if (r < 1) {
      d += ` L${n(corner.x)},${n(corner.y)}`
      continue
    }
    const startX = corner.x - ((corner.x - previous.x) / incoming) * r
    const startY = corner.y - ((corner.y - previous.y) / incoming) * r
    const endX = corner.x + ((next.x - corner.x) / outgoing) * r
    const endY = corner.y + ((next.y - corner.y) / outgoing) * r
    d += ` L${n(startX)},${n(startY)} Q${n(corner.x)},${n(corner.y)} ${n(endX)},${n(endY)}`
  }
  const last = points[points.length - 1]
  d += ` L${n(last.x)},${n(last.y)}`
  return d
}

/** Solid arrowhead aligned with the final segment. */
function arrowHead(points, color) {
  const to = points[points.length - 1]
  const from = points[points.length - 2]
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const baseX = to.x - ux * 10
  const baseY = to.y - uy * 10
  const px = -uy
  const py = ux
  return `<path d="M${n(to.x)},${n(to.y)} L${n(baseX + px * 4.5)},${n(baseY + py * 4.5)} L${n(baseX - px * 4.5)},${n(baseY - py * 4.5)} Z" fill="${color}"/>`
}

/** Midpoint of the longest segment, used for the edge label. */
function labelPoint(points) {
  let best = { x: points[0].x, y: points[0].y, length: -1 }
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]
    const b = points[index]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length > best.length) best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, length }
  }
  return best
}

function renderIcon(icon, x, y, color) {
  const parts = [`<g transform="translate(${n(x)} ${n(y)}) scale(0.8333)" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`]
  for (const [tag, attributes] of icon.elements) {
    const rendered = Object.entries(attributes ?? {})
      .map(([key, value]) => `${key}="${escapeXml(value)}"`)
      .join(' ')
    parts.push(`<${tag}${rendered ? ` ${rendered}` : ''}/>`)
  }
  parts.push('</g>')
  return parts.join('')
}

function renderNode(node, position) {
  const style = ACCENT_STYLES[node.accent] ?? ACCENT_STYLES.slate
  const headerCenter = position.y + NODE_H / 2
  const parts = []
  parts.push(`<g>`)
  parts.push(`<rect x="${n(position.x)}" y="${n(position.y)}" width="${position.w}" height="${position.h}" rx="${RADIUS}" fill="#FFFFFF" stroke="${COLORS.border}" stroke-width="1.25"/>`)
  if (node.icon) {
    parts.push(`<rect x="${n(position.x + 14)}" y="${n(headerCenter - 20)}" width="40" height="40" rx="10" fill="${style.tint}"/>`)
    parts.push(renderIcon(node.icon, position.x + 24, headerCenter - 10, style.stroke))
  }
  const lines = wrapLabel(node.label, node.icon ? 20 : 26)
  const textX = position.x + (node.icon ? 66 : 16)
  if (node.kind.length > 0) {
    parts.push(`<text x="${n(textX)}" y="${n(headerCenter - 2)}" font-family="${FONT}" font-size="14" font-weight="600" fill="${COLORS.ink}">${escapeXml(lines[0])}</text>`)
    parts.push(`<text x="${n(textX)}" y="${n(headerCenter + 17)}" font-family="${FONT}" font-size="11.5" fill="${COLORS.muted}">${escapeXml(node.kind)}</text>`)
  } else if (lines.length === 1) {
    parts.push(`<text x="${n(textX)}" y="${n(headerCenter + 5)}" font-family="${FONT}" font-size="14" font-weight="600" fill="${COLORS.ink}">${escapeXml(lines[0])}</text>`)
  } else {
    parts.push(`<text x="${n(textX)}" y="${n(headerCenter - 6)}" font-family="${FONT}" font-size="14" font-weight="600" fill="${COLORS.ink}">${escapeXml(lines[0])}</text>`)
    parts.push(`<text x="${n(textX)}" y="${n(headerCenter + 14)}" font-family="${FONT}" font-size="14" font-weight="600" fill="${COLORS.ink}">${escapeXml(lines[1])}</text>`)
  }

  if (position.notes !== null && position.notes !== undefined) {
    parts.push(`<path d="M${n(position.x + 14)},${n(position.y + NODE_H)} H${n(position.x + position.w - 14)}" stroke="${DIVIDER_COLOR}" stroke-width="1"/>`)
    let baseline = position.y + NODE_H + NOTE_PAD_TOP + 12
    for (const line of position.notes.paragraphLines) {
      parts.push(`<text x="${n(position.x + NOTE_TEXT_X)}" y="${n(baseline)}" font-family="${FONT}" font-size="${NOTE_FONT_SIZE}" fill="${NOTE_COLOR}">${escapeXml(line)}</text>`)
      baseline += NOTE_LINE_H
    }
    baseline += position.notes.gap
    for (const lines of position.notes.itemLines) {
      lines.forEach((line, lineIndex) => {
        if (lineIndex === 0) {
          parts.push(`<circle cx="${n(position.x + NOTE_BULLET_X)}" cy="${n(baseline - 4)}" r="1.8" fill="${COLORS.muted}"/>`)
        }
        parts.push(`<text x="${n(position.x + NOTE_LIST_X)}" y="${n(baseline)}" font-family="${FONT}" font-size="${NOTE_FONT_SIZE}" fill="${NOTE_COLOR}">${escapeXml(line)}</text>`)
        baseline += NOTE_LINE_H
      })
    }
  }
  parts.push('</g>')
  return parts.join('')
}

/**
 * Build the SVG document for a normalized spec.
 * @param spec - output of normalizeSpec.
 * @returns SVG text plus canvas dimensions and node/edge counts.
 */
export function buildDiagram(spec) {
  const { positions, rank, maxRight, maxBottom } = layoutNodes(spec)
  const { frames, warnings } = layoutGroups(spec, positions)
  const byId = new Map(spec.nodes.map((node) => [node.id, node]))

  let width = maxRight + PAD
  let height = maxBottom + PAD
  for (const frame of frames) {
    width = Math.max(width, frame.x + frame.width + PAD)
    height = Math.max(height, frame.y + frame.height + PAD)
  }
  width = Math.ceil(width)
  height = Math.ceil(height)

  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(spec.title || 'Diagram')}">`)
  parts.push(`<rect width="${width}" height="${height}" fill="${COLORS.bg}"/>`)

  if (spec.title.length > 0) {
    parts.push(`<text x="${PAD}" y="${TITLE_BASELINE}" font-family="${FONT}" font-size="18" font-weight="600" fill="${COLORS.ink}">${escapeXml(spec.title)}</text>`)
  }

  for (const frame of frames) {
    parts.push(`<rect x="${n(frame.x)}" y="${n(frame.y)}" width="${n(frame.width)}" height="${n(frame.height)}" rx="14" fill="${COLORS.surface}" stroke="${COLORS.border}" stroke-width="1.25"/>`)
    if (frame.label.length > 0) {
      parts.push(`<text x="${n(frame.x + 12)}" y="${n(frame.y + 13)}" font-family="${FONT}" font-size="11" font-weight="600" letter-spacing="0.04em" fill="${COLORS.muted}">${escapeXml(frame.label.toUpperCase())}</text>`)
    }
  }

  for (const edge of spec.edges) {
    const points = routeEdge(
      positions.get(edge.from),
      positions.get(edge.to),
      spec.direction,
      rank.get(edge.from),
      rank.get(edge.to),
    )
    parts.push(`<path d="${pathData(points)}" fill="none" stroke="${COLORS.edge}" stroke-width="1.5" stroke-linejoin="round"${edge.dashed ? ' stroke-dasharray="6 4"' : ''}/>`)
    parts.push(arrowHead(points, COLORS.edge))
    if (edge.label.length > 0) {
      const point = labelPoint(points)
      const pillWidth = textWidth(edge.label, 11) + 16
      const pillHeight = 20
      parts.push(`<rect x="${n(point.x - pillWidth / 2)}" y="${n(point.y - pillHeight / 2)}" width="${n(pillWidth)}" height="${pillHeight}" rx="6" fill="#FFFFFF" stroke="${COLORS.border}" stroke-width="1"/>`)
      parts.push(`<text x="${n(point.x)}" y="${n(point.y + 4)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${COLORS.body}">${escapeXml(edge.label)}</text>`)
    }
  }

  for (const node of spec.nodes) parts.push(renderNode(node, positions.get(node.id)))

  parts.push('</svg>')
  return {
    svg: parts.join('\n'),
    width,
    height,
    nodes: byId.size,
    edges: spec.edges.length,
    warnings,
  }
}
