import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Icon } from '../../components/ui/Icon'
import { Button, Card, EmptyState, ErrorState, SkeletonRows, Td, Th } from '../../components/ui/primitives'
import { api } from '../../lib/api'
import { fmtDateTime } from '../../lib/format'
import { useApi } from '../../lib/hooks'

export function MemoTab({ appId }: { appId: string }) {
  const memo = useApi(() => api.getMemo(appId), [appId])
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!memo.data) return
    try {
      await navigator.clipboard.writeText(memo.data.memo_markdown)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  if (memo.loading) return <SkeletonRows rows={14} className="bg-card border border-line rounded-md" />
  if (memo.error) {
    return (
      <Card>
        <ErrorState error={memo.error} onRetry={memo.reload} />
      </Card>
    )
  }
  if (!memo.data) {
    return (
      <Card>
        <EmptyState title="No memo available" body="The credit memo is drafted automatically by the assessment run." />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card
        aside={
          <Button size="sm" onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} size={13} />
            {copied ? 'Copied' : 'Copy memo'}
          </Button>
        }
        title={
          <span className="overline-label">
            Auto-drafted credit memo · engine v{memo.data.engine_version} ·{' '}
            {fmtDateTime(memo.data.generated_at)}
          </span>
        }
        className="rise rise-1"
      >
        <div className="px-6 py-5">
          <div className="memo-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo.data.memo_markdown}</ReactMarkdown>
          </div>
        </div>
      </Card>

      {memo.data.citations.length > 0 && (
        <Card title="Sources & citations" className="rise rise-2">
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <Th className="w-16">Tag</Th>
                  <Th>Source</Th>
                  <Th>Description</Th>
                </tr>
              </thead>
              <tbody>
                {memo.data.citations.map((c) => (
                  <tr key={c.tag} className="hover:bg-well transition-colors">
                    <Td>
                      <span className="num inline-flex items-center h-5.5 px-2 rounded-sm bg-pine-50 border border-pine-100 text-[11px] font-semibold text-pine-800">
                        {c.tag}
                      </span>
                    </Td>
                    <Td className="num text-[12px] text-ink font-medium">{c.source}</Td>
                    <Td className="text-ink-2">{c.description}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
