import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApplicationsTable } from '../components/ApplicationsTable'
import { Icon } from '../components/ui/Icon'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SkeletonRows,
} from '../components/ui/primitives'
import { api } from '../lib/api'
import { useApi, useDebounced } from '../lib/hooks'
import { STATUS_META, STATUS_ORDER } from '../lib/theme'
import type { ApplicationStatus } from '../lib/types'

const PAGE_SIZE = 20

export function ApplicationsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ApplicationStatus | ''>('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search, 300)

  const list = useApi(
    () => api.listApplications({ search: debouncedSearch, status, page, page_size: PAGE_SIZE }),
    [debouncedSearch, status, page],
  )

  const setFilter = (next: ApplicationStatus | '') => {
    setStatus(next)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle="All credit applications across the pipeline"
        actions={
          <Link to="/applications/new">
            <Button variant="primary">
              <Icon name="plus" size={14} /> New application
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search name, ref or GSTIN…"
            className="h-8.5 w-72 pl-8 pr-3 rounded border border-line-2 bg-card text-[13px] text-ink placeholder:text-ink-4 outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <FilterChip active={status === ''} label="All" onClick={() => setFilter('')} />
          {STATUS_ORDER.map((s) => (
            <FilterChip key={s} active={status === s} label={STATUS_META[s].label} onClick={() => setFilter(s)} />
          ))}
        </div>
      </div>

      <Card className="rise rise-1">
        {list.loading ? (
          <SkeletonRows rows={10} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState
            title="No applications found"
            body={
              debouncedSearch || status
                ? 'No applications match the current filters. Try clearing them.'
                : 'Create the first application to begin underwriting.'
            }
            action={
              debouncedSearch || status ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setFilter('')
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Link to="/applications/new">
                  <Button variant="primary" size="sm">
                    <Icon name="plus" size={13} /> New application
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <>
            <ApplicationsTable items={list.data.items} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-2.5 rounded-full border text-[12px] font-medium cursor-pointer transition-colors ${
        active
          ? 'bg-pine-700 border-pine-700 text-white'
          : 'bg-card border-line-2 text-ink-2 hover:border-ink-3'
      }`}
    >
      {label}
    </button>
  )
}
