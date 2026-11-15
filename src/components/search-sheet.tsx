import { useEffect, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import { BottomSheet, StatusBadge } from '@/components/ui'
import { listIssues, searchIssues } from '@/api/endpoints/issues'
import { errorMessage } from '@/api/client'
import type { SearchIssueResult } from '@/api/types'
import './search-sheet.scss'

function snippetOf(issue: SearchIssueResult): string {
  return (
    issue.matched_snippet ||
    issue.matched_description_snippet ||
    issue.matched_comment_snippet ||
    ''
  )
}

export function SearchSheet({
  visible,
  onClose,
  onOpenIssue,
}: {
  visible: boolean
  onClose: () => void
  onOpenIssue: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchIssueResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    const keyword = query.trim()
    if (!keyword) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchIssues(keyword, 20)
        .then(async (response) => {
          let issues = response.issues ?? []
          // `/api/issues/search` matches title/description/comment text, not
          // identifiers. Fall back to the issue list for queries like WAN-46.
          if (issues.length === 0 && /^[a-z]+-\d+$/i.test(keyword)) {
            const listed = await listIssues({ q: keyword, limit: 20 })
            issues = (listed.issues ?? []).map((issue) => ({
              ...issue,
              match_source: 'title' as const,
            }))
          }
          if (cancelled) return
          setResults(issues)
          setError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setError(errorMessage(err))
          setResults([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, visible])

  return (
    <BottomSheet
      visible={visible}
      title='搜索任务'
      subtitle='标题、编号、描述与评论'
      onClose={onClose}
    >
      <View className='search-sheet'>
        <Input
          className='search-sheet__input'
          value={query}
          focus={visible}
          placeholder='输入任务标题、编号或关键词'
          placeholderClass='input-placeholder'
          confirmType='search'
          onInput={(event) => setQuery(event.detail.value)}
        />

        {loading ? <Text className='search-sheet__hint'>搜索中…</Text> : null}
        {error ? <Text className='search-sheet__error'>{error}</Text> : null}
        {!loading && !error && query.trim() && results.length === 0 ? (
          <Text className='search-sheet__hint'>没有匹配的任务</Text>
        ) : null}

        {results.map((issue) => {
          const snippet = snippetOf(issue)
          return (
            <View
              key={issue.id}
              className='search-sheet__result'
              onClick={() => {
                onOpenIssue(issue.id)
                onClose()
              }}
            >
              <View className='search-sheet__result-top'>
                <Text className='search-sheet__id'>{issue.identifier}</Text>
                <StatusBadge status={issue.status} name={issue.status_name} compact />
              </View>
              <Text className='search-sheet__title'>{issue.title}</Text>
              {snippet ? <Text className='search-sheet__snippet'>{snippet}</Text> : null}
            </View>
          )
        })}
      </View>
    </BottomSheet>
  )
}
