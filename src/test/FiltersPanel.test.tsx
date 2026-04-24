import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FiltersPanel from '../components/Filters/FiltersPanel'
import type { FilterParams } from '../db/dexie'
import type { EIPADictionary } from '../types'

// Mock i18next — return the key as translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key}:${opts.count}`
      return key
    },
  }),
}))

const mockDictionary: EIPADictionary = {
  charging_mode: [
    { id: 1, name: 'AC' },
    { id: 2, name: 'DC' },
  ],
  connector_interface: [
    { id: 1, name: 'IEC-62196-T2-F-NOCABLE', description: 'Type 2 (socket)' },
    { id: 2, name: 'IEC-62196-T2-COMBO', description: 'CCS2' },
    { id: 3, name: 'CHADEMO', description: 'CHAdeMO' },
    { id: 99, name: 'SCHUKO', description: 'Schuko' }, // should be filtered out
  ],
  station_authentication_method: [],
  station_payment_method: [],
  company_type: [],
  country: [],
  weekday: [],
}

const defaultFilters: FilterParams = {}

function renderPanel(filters = defaultFilters, onUpdate = vi.fn(), onClear = vi.fn()) {
  return render(
    <FiltersPanel
      filters={filters}
      dictionary={mockDictionary}
      onUpdate={onUpdate}
      onClear={onClear}
      stationCount={42}
      country="all"
      onCountryChange={vi.fn()}
    />
  )
}

describe('FiltersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders station count', () => {
    renderPanel()
    expect(screen.getByText('stations_count:42')).toBeInTheDocument()
  })

  it('renders charging mode buttons from dictionary', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'AC' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DC' })).toBeInTheDocument()
  })

  it('renders only known connector types (excludes SCHUKO)', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Type 2 (socket)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CCS2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CHAdeMO' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Schuko' })).not.toBeInTheDocument()
  })

  it('calls onUpdate when charging mode toggled on', () => {
    const onUpdate = vi.fn()
    renderPanel(defaultFilters, onUpdate)
    fireEvent.click(screen.getByRole('button', { name: 'AC' }))
    expect(onUpdate).toHaveBeenCalledWith({ charging_modes: [1] })
  })

  it('calls onUpdate when charging mode toggled off', () => {
    const onUpdate = vi.fn()
    renderPanel({ charging_modes: [1] }, onUpdate)
    fireEvent.click(screen.getByRole('button', { name: 'AC' }))
    expect(onUpdate).toHaveBeenCalledWith({ charging_modes: undefined })
  })

  it('calls onUpdate with combined charging modes when two selected', () => {
    const onUpdate = vi.fn()
    renderPanel({ charging_modes: [1] }, onUpdate)
    fireEvent.click(screen.getByRole('button', { name: 'DC' }))
    expect(onUpdate).toHaveBeenCalledWith({ charging_modes: [1, 2] })
  })

  it('calls onClear when clear button clicked', () => {
    const onClear = vi.fn()
    renderPanel(defaultFilters, vi.fn(), onClear)
    fireEvent.click(screen.getByRole('button', { name: 'filters_clear' }))
    expect(onClear).toHaveBeenCalled()
  })

  it('renders search input', () => {
    renderPanel()
    expect(screen.getByPlaceholderText('search_placeholder')).toBeInTheDocument()
  })

  it('calls onUpdate with query when search input changes', () => {
    const onUpdate = vi.fn()
    renderPanel(defaultFilters, onUpdate)
    fireEvent.change(screen.getByPlaceholderText('search_placeholder'), {
      target: { value: 'Warszawa' },
    })
    expect(onUpdate).toHaveBeenCalledWith({ query: 'Warszawa' })
  })

  it('calls onUpdate with undefined query when search cleared', () => {
    const onUpdate = vi.fn()
    renderPanel({ query: 'Warszawa' }, onUpdate)
    fireEvent.change(screen.getByPlaceholderText('search_placeholder'), {
      target: { value: '' },
    })
    expect(onUpdate).toHaveBeenCalledWith({ query: undefined })
  })

  it('renders country filter buttons', () => {
    renderPanel()
    // "all" + 5 countries = 6 buttons in the country section
    expect(screen.getByRole('button', { name: 'source_all' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'source_pl' })).toBeInTheDocument()
  })

  it('calls onCountryChange when country button clicked', () => {
    const onCountryChange = vi.fn()
    render(
      <FiltersPanel
        filters={defaultFilters}
        dictionary={mockDictionary}
        onUpdate={vi.fn()}
        onClear={vi.fn()}
        stationCount={0}
        country="all"
        onCountryChange={onCountryChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'source_pl' }))
    expect(onCountryChange).toHaveBeenCalledWith('pl')
  })

  it('renders without dictionary (null)', () => {
    render(
      <FiltersPanel
        filters={defaultFilters}
        dictionary={null}
        onUpdate={vi.fn()}
        onClear={vi.fn()}
        stationCount={0}
        country="all"
        onCountryChange={vi.fn()}
      />
    )
    // No charging mode or connector buttons when dictionary is null
    expect(screen.queryByRole('button', { name: 'AC' })).not.toBeInTheDocument()
  })
})
