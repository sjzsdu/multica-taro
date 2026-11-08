export interface MarkdownHeading {
  id: string
  level: number
  label: string
}

export interface MarkdownTableBlock {
  type: 'table'
  headers: string[]
  rows: string[][]
}

export interface MarkdownBlock {
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'space' | 'divider' | 'table'
  text: string
  level?: number
  id?: string
  headers?: string[]
  rows?: string[][]
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/
const LIST_RE = /^\s*[-*+]\s+(.*)$/
const ORDERED_LIST_RE = /^\s*\d+\.\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/
const DIVIDER_RE = /^\s*([-*_])\1{2,}\s*$/

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|')
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-')
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/**
 * Minimal Markdown splitter for the issue description.
 *
 * The detail page is a mobile reading surface, not an editor: headings are
 * extracted for the table of contents, tables become horizontally scrollable
 * grids, and other blocks keep their plain text (inline emphasis is handled at
 * render time).
 */
export function parseMarkdown(markdown: string): {
  blocks: MarkdownBlock[]
  headings: MarkdownHeading[]
} {
  const blocks: MarkdownBlock[] = []
  const headings: MarkdownHeading[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let inCode = false
  let codeLines: string[] = []

  const flushCode = () => {
    if (codeLines.length > 0) {
      blocks.push({ type: 'code', text: codeLines.join('\n') })
      codeLines = []
    }
  }

  let index = 0
  while (index < lines.length) {
    const rawLine = lines[index]
    const line = rawLine.replace(/\s+$/, '')

    if (line.trim().startsWith('```')) {
      if (inCode) {
        inCode = false
        flushCode()
      } else {
        inCode = true
        codeLines = []
      }
      index += 1
      continue
    }

    if (inCode) {
      codeLines.push(rawLine)
      index += 1
      continue
    }

    // Table: a header row followed by a separator row and data rows.
    if (isTableRow(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = splitTableRow(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      blocks.push({ type: 'table', text: '', headers, rows })
      continue
    }

    if (!line.trim()) {
      blocks.push({ type: 'space', text: '' })
      index += 1
      continue
    }

    if (DIVIDER_RE.test(line)) {
      blocks.push({ type: 'divider', text: '' })
      index += 1
      continue
    }

    const heading = HEADING_RE.exec(line.trim())
    if (heading) {
      const level = heading[1].length
      const label = heading[2].trim()
      const id = `section-${headings.length}`
      headings.push({ id, level, label })
      blocks.push({ type: 'heading', text: label, level, id })
      index += 1
      continue
    }

    const list = LIST_RE.exec(line)
    if (list) {
      blocks.push({ type: 'list', text: list[1].trim() })
      index += 1
      continue
    }

    const ordered = ORDERED_LIST_RE.exec(line)
    if (ordered) {
      blocks.push({ type: 'list', text: line.trim() })
      index += 1
      continue
    }

    const quote = QUOTE_RE.exec(line)
    if (quote) {
      blocks.push({ type: 'quote', text: quote[1].trim() })
      index += 1
      continue
    }

    blocks.push({ type: 'paragraph', text: line.trim() })
    index += 1
  }

  if (inCode) flushCode()

  return { blocks, headings }
}
