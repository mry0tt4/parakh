/* Thin wrapper over Phosphor Icons — keeps the app's `<Icon name="..." />`
 * call sites unchanged while swapping the underlying icon set. */
import {
  ArrowLeft, ArrowsClockwise, CaretLeft, CaretRight, Check, Clock,
  Copy, CreditCard, CurrencyInr, Eye, FileText, Gauge, Lightning,
  MagnifyingGlass, Plus, Printer, ShieldCheck, SignOut, SquaresFour,
  Stack, Warning, X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'

const ICONS: Record<string, PhosphorIcon> = {
  grid: SquaresFour,
  file: FileText,
  plus: Plus,
  shield: ShieldCheck,
  logout: SignOut,
  search: MagnifyingGlass,
  'chevron-right': CaretRight,
  'chevron-left': CaretLeft,
  alert: Warning,
  check: Check,
  x: X,
  copy: Copy,
  'arrow-left': ArrowLeft,
  clock: Clock,
  bolt: Lightning,
  gauge: Gauge,
  refresh: ArrowsClockwise,
  eye: Eye,
  layers: Stack,
  rupee: CurrencyInr,
  card: CreditCard,
  printer: Printer,
}

export type IconName = keyof typeof ICONS

interface IconProps {
  name: string
  size?: number
  className?: string
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
}

export function Icon({ name, size = 16, className, weight = 'regular' }: IconProps) {
  const Cmp = ICONS[name]
  if (!Cmp) return null
  return <Cmp size={size} weight={weight} className={className} />
}
