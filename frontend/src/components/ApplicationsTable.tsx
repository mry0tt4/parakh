import { useNavigate } from 'react-router-dom'
import { fmtDate, inr, pct, unSnake } from '../lib/format'
import type { ApplicationListItem } from '../lib/types'
import { ScoreChip, StatusBadge } from './ui/badges'
import { Td, Th } from './ui/primitives'

export function ApplicationsTable({ items }: { items: ApplicationListItem[] }) {
  const navigate = useNavigate()
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <Th>Ref</Th>
            <Th>Business</Th>
            <Th>Sector</Th>
            <Th>Product</Th>
            <Th className="text-right">Amount</Th>
            <Th>Status</Th>
            <Th>Score</Th>
            <Th className="text-right">PD 12m</Th>
            <Th className="text-right">Created</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((app) => (
            <tr
              key={app.id}
              onClick={() => navigate(`/applications/${app.id}`)}
              className="cursor-pointer hover:bg-well transition-colors"
            >
              <Td className="num text-[12px] text-ink-2 whitespace-nowrap">{app.ref}</Td>
              <Td>
                <span className="font-semibold text-ink">{app.applicant.business_name}</span>
                <span className="block text-[11px] text-ink-3">
                  {app.applicant.city}, {app.applicant.state}
                </span>
              </Td>
              <Td className="text-ink-2 whitespace-nowrap">{app.applicant.sector}</Td>
              <Td className="text-ink-2 whitespace-nowrap">{unSnake(app.product)}</Td>
              <Td className="num text-right font-semibold text-ink whitespace-nowrap">
                {inr(app.amount_requested)}
              </Td>
              <Td>
                <StatusBadge status={app.status} />
              </Td>
              <Td>
                <ScoreChip score={app.health_score} grade={app.grade} />
              </Td>
              <Td className="num text-right text-ink-2">
                {app.pd_12m !== null ? pct(app.pd_12m) : '—'}
              </Td>
              <Td className="num text-right text-[12px] text-ink-3 whitespace-nowrap">
                {fmtDate(app.created_at)}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
