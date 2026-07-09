import { GRADE_COLORS } from '../lib/theme'
import type { Grade } from '../lib/types'
import { GradeChip } from './ui/badges'

/**
 * 300–900 health score gauge: a 210° SVG arc with grade-colored progress,
 * band ticks at the grade boundaries, and the score as the hero figure.
 */
export function ScoreArc({ score, grade }: { score: number; grade: Grade }) {
  const MIN = 300
  const MAX = 900
  const START = -195 // degrees
  const SWEEP = 210
  const R = 84
  const CX = 110
  const CY = 108

  const frac = Math.min(1, Math.max(0, (score - MIN) / (MAX - MIN)))
  const color = GRADE_COLORS[grade]

  const polar = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
  }

  const arcPath = (fromDeg: number, toDeg: number, r: number) => {
    const s = polar(fromDeg, r)
    const e = polar(toDeg, r)
    const large = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
  }

  const progressEnd = START + SWEEP * frac

  /* grade boundary ticks */
  const boundaries = [550, 650, 700, 750, 800]

  return (
    <div className="relative w-55 select-none" aria-label={`Health score ${score}, grade ${grade}`}>
      <svg viewBox="0 0 220 150" className="w-full">
        {/* track */}
        <path d={arcPath(START, START + SWEEP, R)} stroke="#e9e6dc" strokeWidth="13" fill="none" strokeLinecap="round" />
        {/* progress */}
        {frac > 0.005 && (
          <path
            d={arcPath(START, progressEnd, R)}
            stroke={color}
            strokeWidth="13"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* boundary ticks */}
        {boundaries.map((b) => {
          const deg = START + SWEEP * ((b - MIN) / (MAX - MIN))
          const p1 = polar(deg, R - 10.5)
          const p2 = polar(deg, R - 15)
          return (
            <line
              key={b}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#b3aea0"
              strokeWidth="1.4"
            />
          )
        })}
        {/* needle dot */}
        {(() => {
          const p = polar(progressEnd, R)
          return <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke={color} strokeWidth="3" />
        })()}
        {/* min / max labels */}
        {(() => {
          const lo = polar(START, R + 1)
          const hi = polar(START + SWEEP, R + 1)
          return (
            <>
              <text x={lo.x} y={lo.y + 16} textAnchor="middle" className="num" fontSize="10" fill="#8a8578">
                300
              </text>
              <text x={hi.x} y={hi.y + 16} textAnchor="middle" className="num" fontSize="10" fill="#8a8578">
                900
              </text>
            </>
          )
        })()}
      </svg>
      <div className="absolute inset-x-0 top-13.5 flex flex-col items-center">
        <span className="num text-[44px] leading-none font-semibold text-ink">{score}</span>
        <span className="mt-2">
          <GradeChip grade={grade} size="lg" />
        </span>
      </div>
    </div>
  )
}
