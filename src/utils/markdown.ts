export interface MarkdownHeading {
  id: string
  level: number
  label: string
}

export interface MarkdownBlock {
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'space'
  text: string
  level?: number
  id?: string
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/
const LIST_RE = /^\s*[-*+]\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/

/**
 * Minimal Markdown splitter for the issue description.
 *
 * The detail page is a mobile reading surface, not an editor: headings are
 * extracted for the table of contents, and the body is split into blocks so
 * each heading can carry an anchor id for ScrollView.scrollIntoView. Inline
 * emphasis/links stay as plain text.
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

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '')

    if (line.trim().startsWith('```')) {
      if (inCode) {
        inCode = false
        flushCode()
      } else {
        inCode = true
        codeLines = []
      }
      continue
    }

    if (inCode) {
      codeLines.push(rawLine)
      continue
    }

    if (!line.trim()) {
      blocks.push({ type: 'space', text: '' })
      continue
    }

    const heading = HEADING_RE.exec(line.trim())
    if (heading) {
      const level = heading[1].length
      const label = heading[2].trim()
      const id = `section-${headings.length}`
      headings.push({ id, level, label })
      blocks.push({ type: 'heading', text: label, level, id })
      continue
    }

    const list = LIST_RE.exec(line)
    if (list) {
      blocks.push({ type: 'list', text: list[1].trim() })
      continue
    }

    const quote = QUOTE_RE.exec(line)
    if (quote) {
      blocks.push({ type: 'quote', text: quote[1].trim() })
      continue
    }

    blocks.push({ type: 'paragraph', text: line.trim() })
  }

  if (inCode) flushCode()

  return { blocks, headings }
}
