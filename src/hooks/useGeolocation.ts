import { useState, useCallback } from 'react'

type GeoError = 'not_supported' | 'denied' | 'unavailable' | 'timeout' | null

interface GeolocationState {
  lat: number | null
  lng: number | null
  error: GeoError
  loading: boolean
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    error: null,
    loading: false,
  })

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'not_supported' }))
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          error: null,
          loading: false,
        })
      },
      (err) => {
        let error: GeoError = 'unavailable'
        if (err.code === err.PERMISSION_DENIED) error = 'denied'
        else if (err.code === err.TIMEOUT) error = 'timeout'
        else if (err.code === err.POSITION_UNAVAILABLE) error = 'unavailable'
        setState((s) => ({ ...s, loading: false, error }))
      },
      { timeout: 10000, enableHighAccuracy: true },
    )
  }, [])

  return { ...state, locate }
}
