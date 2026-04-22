// Raw EIPA types

export interface EIPAStation {
  id: number
  pool_id: number
  type: string
  latitude: number
  longitude: number
  authentication_methods: number[]
  payment_methods: number[]
  images: string[]
  ts: string
  location: {
    province: string
    district: string
    community: string
    city: string
  }
}

export interface EIPAPool {
  id: number
  operator_id: number
  name: string
  city: string
  postal_code: string
  street: string
  street_number: string
  country: string
  lat?: number
  lon?: number
}

export interface EIPAPoint {
  id: number
  station_id: number
  name?: string
  status?: string
  charging_modes: number[]
  connectors: EIPAConnector[]
  last_status_update?: string
  price?: string | null
  price_details?: string | null
}

export interface EIPAConnector {
  id: number
  interface_id: number
  power_kw?: number
  max_power_kw?: number
  current_type?: string
}

export interface EIPAOperator {
  id: number
  name: string
  type: number
  country: string
}

export interface EIPADictionary {
  charging_mode: Array<{ id: number; name: string }>
  connector_interface: Array<{ id: number; name: string; description: string }>
  station_authentication_method: Array<{ id: number; description: string }>
  station_payment_method: Array<{ id: number; description: string }>
  company_type: Array<{ id: number; name: string }>
  country: Array<{ id: string; name: string }>
  weekday: Array<{ id: number; name: string }>
  // Extra connector types added for BNetzA (negative IDs)
  connector_interface_extra?: Array<{ id: number; name: string; description: string }>
}

// Processed / app types

export type CountrySource = 'pl' | 'de' | 'fr' | 'nl'

export interface ChargerStation {
  id: number
  pool_id: number
  source: CountrySource
  lat: number
  lng: number
  city: string
  province: string
  postal_code: string
  street: string
  street_number: string
  operator_id: number
  operator_name: string
  authentication_methods: number[]
  payment_methods: number[]
  points: ChargerPoint[]
  // denormalised for quick filtering
  charging_modes: number[]
  connector_interface_ids: number[]
  connector_names: string[]
  max_power_kw: number
}

export interface ChargerPoint {
  id: number
  name?: string
  status?: string
  charging_modes: number[]
  connectors: ChargerConnector[]
  price?: string | null
  price_details?: string | null
}

export interface ChargerConnector {
  id: number
  interface_id: number
  power_kw?: number
  max_power_kw?: number
}

export interface ProcessedData {
  stations: ChargerStation[]
  dictionary: EIPADictionary
  generated_at: string
}
