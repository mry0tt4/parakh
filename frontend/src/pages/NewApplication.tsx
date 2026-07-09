import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from '../components/ui/primitives'
import { api, ApiError } from '../lib/api'
import { inrFull, unSnake } from '../lib/format'
import { useApi } from '../lib/hooks'
import type { Product } from '../lib/types'

const FALLBACK_SECTORS = [
  'Retail Trade',
  'Wholesale Trade',
  'Manufacturing',
  'Food Processing',
  'Textiles & Apparel',
  'Auto Components',
  'Pharmaceuticals',
  'Logistics & Transport',
  'Construction Materials',
  'IT Services',
  'Hospitality',
  'Agriculture & Allied',
]

const ENTITY_TYPES = ['proprietorship', 'partnership', 'llp', 'private_limited']

const PRODUCTS: Product[] = ['working_capital', 'term_loan', 'invoice_finance']

export function NewApplicationPage() {
  const navigate = useNavigate()
  const enums = useApi(() => api.enums(), [])

  const [businessName, setBusinessName] = useState('')
  const [gstin, setGstin] = useState('')
  const [pan, setPan] = useState('')
  const [sector, setSector] = useState('')
  const [entityType, setEntityType] = useState('proprietorship')
  const [city, setCity] = useState('')
  const [stateName, setStateName] = useState('')
  const [incDate, setIncDate] = useState('')
  const [isNtc, setIsNtc] = useState(false)
  const [isNtb, setIsNtb] = useState(false)
  const [product, setProduct] = useState<Product>('working_capital')
  const [amount, setAmount] = useState('')
  const [tenure, setTenure] = useState('24')
  const [purpose, setPurpose] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sectors = enums.data?.sectors?.length ? enums.data.sectors : FALLBACK_SECTORS
  const products = enums.data?.products?.length ? enums.data.products : PRODUCTS
  const amountNum = Number(amount)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await api.createApplication({
        applicant: {
          business_name: businessName.trim(),
          gstin: gstin.trim().toUpperCase(),
          pan: pan.trim().toUpperCase(),
          sector,
          entity_type: entityType,
          city: city.trim(),
          state: stateName.trim(),
          incorporation_date: incDate,
          is_ntc: isNtc,
          is_ntb: isNtb,
        },
        product,
        amount_requested: amountNum,
        tenure_months: Number(tenure),
        purpose: purpose.trim(),
      })
      navigate(`/applications/${created.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the application.')
      setBusy(false)
    }
  }

  return (
    <div className="max-w-190">
      <PageHeader
        title="New Application"
        subtitle="Capture the applicant and the requested facility — consents come next."
      />

      <form onSubmit={submit} className="space-y-3">
        <Card title="Applicant" className="rise rise-1">
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5 px-4 py-4">
            <div className="sm:col-span-2">
              <Field label="Business name" required>
                <TextInput
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Saraswati Kirana & General Stores"
                  required
                />
              </Field>
            </div>
            <Field label="GSTIN" required hint="15-character GST identification number">
              <TextInput
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="27ABCDE1234F1Z5"
                minLength={15}
                maxLength={15}
                className="num uppercase"
                required
              />
            </Field>
            <Field label="PAN" required>
              <TextInput
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                minLength={10}
                maxLength={10}
                className="num uppercase"
                required
              />
            </Field>
            <Field label="Sector" required>
              <Select value={sector} onChange={(e) => setSector(e.target.value)} required>
                <option value="" disabled>
                  Select sector…
                </option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Entity type" required>
              <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} required>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {unSnake(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="City" required>
              <TextInput value={city} onChange={(e) => setCity(e.target.value)} placeholder="Pune" required />
            </Field>
            <Field label="State" required>
              <TextInput
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                placeholder="Maharashtra"
                required
              />
            </Field>
            <Field label="Incorporation date" required>
              <TextInput type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} required />
            </Field>
            <div className="flex items-end gap-5 pb-1.5">
              <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNtc}
                  onChange={(e) => setIsNtc(e.target.checked)}
                  className="size-4 accent-pine-700"
                />
                New to Credit
              </label>
              <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNtb}
                  onChange={(e) => setIsNtb(e.target.checked)}
                  className="size-4 accent-pine-700"
                />
                New to Bank
              </label>
            </div>
          </div>
        </Card>

        <Card title="Facility requested" className="rise rise-2">
          <div className="grid sm:grid-cols-3 gap-x-4 gap-y-3.5 px-4 py-4">
            <Field label="Product" required>
              <Select value={product} onChange={(e) => setProduct(e.target.value as Product)} required>
                {products.map((p) => (
                  <option key={p} value={p}>
                    {unSnake(p)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Amount requested (₹)"
              required
              hint={amountNum > 0 ? `= ${inrFull(amountNum)}` : 'Enter amount in rupees'}
            >
              <TextInput
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1500000"
                className="num"
                required
              />
            </Field>
            <Field label="Tenure (months)" required>
              <TextInput
                type="number"
                min={1}
                max={120}
                value={tenure}
                onChange={(e) => setTenure(e.target.value)}
                className="num"
                required
              />
            </Field>
            <div className="sm:col-span-3">
              <Field label="Purpose" required>
                <TextArea
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Inventory purchase for festive season"
                  required
                />
              </Field>
            </div>
          </div>
        </Card>

        {error && (
          <div className="flex items-start gap-2 text-[12.5px] text-crit bg-crit-bg border border-crit/25 rounded px-3 py-2.5">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={() => navigate('/applications')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Create application
          </Button>
        </div>
      </form>
    </div>
  )
}
