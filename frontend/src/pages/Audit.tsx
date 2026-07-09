import { useState } from 'react'
import { Icon } from '../components/ui/Icon'
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SkeletonRows,
  Td,
  Th,
} from '../components/ui/primitives'
import { api } from '../lib/api'
import { fmtDateTime, unSnake } from '../lib/format'
import { useApi, useDebounced } from '../lib/hooks'

const PAGE_SIZE = 50

export function AuditPage() {
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [page, setPage] = useState(1)
  const debouncedAction = useDebounced(action, 300)
  const debouncedActor = useDebounced(actor, 300)

  const log = useApi(
    () => api.audit({ page, page_size: PAGE_SIZE, action: debouncedAction, actor: debouncedActor }),
    [page, debouncedAction, debouncedActor],
  )

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Every actor action, immutably recorded — newest first"
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <FilterInput
          placeholder="Filter by action (e.g. assessment.run)…"
          value={action}
          onChange={(v) => {
            setAction(v)
            setPage(1)
          }}
        />
        <FilterInput
          placeholder="Filter by actor email…"
          value={actor}
          onChange={(v) => {
            setActor(v)
            setPage(1)
          }}
        />
      </div>

      <Card className="rise rise-1">
        {log.loading ? (
          <SkeletonRows rows={12} />
        ) : log.error ? (
          <ErrorState error={log.error} onRetry={log.reload} />
        ) : !log.data || log.data.items.length === 0 ? (
          <EmptyState title="No audit events" body="No events match the current filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <Th>Timestamp</Th>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Entity</Th>
                    <Th>IP</Th>
                    <Th>Detail</Th>
                  </tr>
                </thead>
                <tbody>
                  {log.data.items.map((ev) => (
                    <tr key={ev.id} className="hover:bg-well transition-colors">
                      <Td className="num text-[11.5px] text-ink-2 whitespace-nowrap">{fmtDateTime(ev.ts)}</Td>
                      <Td>
                        <span className="font-medium text-ink">{ev.actor_email}</span>
                        <span className="block text-[10.5px] text-ink-3 uppercase tracking-wider">
                          {unSnake(ev.actor_role)}
                        </span>
                      </Td>
                      <Td>
                        <span className="num inline-flex items-center h-5.5 px-2 rounded-sm bg-well border border-line text-[11px] font-medium text-ink">
                          {ev.action}
                        </span>
                      </Td>
                      <Td className="num text-[11.5px] text-ink-2 whitespace-nowrap">
                        {ev.entity_type} / {ev.entity_id}
                      </Td>
                      <Td className="num text-[11.5px] text-ink-3 whitespace-nowrap">{ev.ip ?? '—'}</Td>
                      <Td className="num text-[11px] text-ink-3 max-w-70">
                        <span className="line-clamp-2 break-all">
                          {ev.detail ? JSON.stringify(ev.detail) : '—'}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={log.data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}

function FilterInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8.5 w-76 pl-8 pr-3 rounded border border-line-2 bg-card text-[13px] text-ink placeholder:text-ink-4 outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/15"
      />
    </div>
  )
}
