import type { ReactNode } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { MarkdownBlock } from '@/utils/markdown'

/** One-line preview used by the table of contents. */
export function commentPreview(content?: string): string {
  const text = (content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`>|_~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return '（无文字内容）'
  return text.length > 28 ? `${text.slice(0, 28)}…` : text
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, index) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} className='detail__md-strong'>
          {part.slice(2, -2)}
        </Text>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text key={index} className='detail__md-inline-code'>
          {part.slice(1, -1)}
        </Text>
      )
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link) {
      return (
        <Text
          key={index}
          className='detail__md-link'
          onClick={() => {
            void Taro.setClipboardData({ data: link[2] })
            Taro.showToast({ title: '链接已复制', icon: 'none' })
          }}
        >
          {link[1]}
        </Text>
      )
    }
    return <Text key={index}>{part}</Text>
  })
}

export function MarkdownBody({
  blocks,
  withAnchors = true,
  compact = false,
}: {
  blocks: MarkdownBlock[]
  withAnchors?: boolean
  compact?: boolean
}) {
  return (
    <View
      className={`detail__markdown ${compact ? 'detail__markdown--compact' : ''}`}
    >
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <View
                key={index}
                id={withAnchors ? block.id : undefined}
                className='detail__md-heading'
              >
                <Text className={`detail__md-h detail__md-h${block.level || 3}`}>
                  {renderInline(block.text)}
                </Text>
              </View>
            )
          case 'code':
            return (
              <View key={index} className='detail__md-code'>
                <Text className='detail__md-code-text'>{block.text}</Text>
              </View>
            )
          case 'table': {
            const headers = block.headers ?? []
            const rows = block.rows ?? []
            return (
              <ScrollView key={index} scrollX className='detail__md-table-wrap'>
                <View className='detail__md-table'>
                  <View className='detail__md-tr detail__md-tr--head'>
                    {headers.map((cell, cellIndex) => (
                      <Text key={cellIndex} className='detail__md-th'>
                        {renderInline(cell)}
                      </Text>
                    ))}
                  </View>
                  {rows.map((row, rowIndex) => (
                    <View key={rowIndex} className='detail__md-tr'>
                      {headers.map((_, cellIndex) => (
                        <Text key={cellIndex} className='detail__md-td'>
                          {renderInline(row[cellIndex] ?? '')}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )
          }
          case 'list': {
            const ordered = /^\d+\.\s/.test(block.text)
            return (
              <Text key={index} className='detail__md-li'>
                {ordered ? '' : '• '}
                {renderInline(block.text)}
              </Text>
            )
          }
          case 'quote':
            return (
              <Text key={index} className='detail__md-quote'>
                {renderInline(block.text)}
              </Text>
            )
          case 'divider':
            return <View key={index} className='detail__md-divider' />
          case 'space':
            return <View key={index} className='detail__md-space' />
          default:
            return (
              <Text key={index} className='detail__md-p'>
                {renderInline(block.text)}
              </Text>
            )
        }
      })}
    </View>
  )
}
