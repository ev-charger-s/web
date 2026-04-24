import { useEffect, useRef, useState, useCallback } from 'react'
import Supercluster from 'supercluster'
import type { DexieStation } from '../db/dexie'

export type ClusterItem =
  | Supercluster.ClusterFeature<Supercluster.AnyProps>
  | Supercluster.PointFeature<{ id: number; max_power_kw: number; connector_interface_ids: number[] }>

export interface UseClusterResult {
  clusters: ClusterItem[]
  ready: boolean
  getClusters: (bbox: [number, number, number, number], zoom: number) => void
  getClusterExpansionZoom: (clusterId: number) => number
}

export function useCluster(stations: DexieStation[], dataLoaded: boolean): UseClusterResult {
  const workerRef = useRef<Worker | null>(null)
  const [clusters, setClusters] = useState<ClusterItem[]>([])
  const [ready, setReady] = useState(false)
  const reqIdRef = useRef(0)
  // Keep last bbox/zoom to re-query after worker ready
  const lastQueryRef = useRef<{ bbox: [number, number, number, number]; zoom: number } | null>(null)
  // Main-thread SC instance for synchronous getClusterExpansionZoom
  const scRef = useRef<Supercluster | null>(null)

  useEffect(() => {
    if (!dataLoaded || stations.length === 0) return

    const worker = new Worker(new URL('../workers/cluster.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'ready') {
        setReady(true)
        // Re-query with last known bbox/zoom
        if (lastQueryRef.current) {
          const { bbox, zoom } = lastQueryRef.current
          const id = ++reqIdRef.current
          worker.postMessage({ type: 'getClusters', bbox, zoom, reqId: id })
        }
      } else if (msg.type === 'clusters') {
        setClusters(msg.clusters)
      }
    }

    // Build main-thread SC for expansion zoom queries
    const sc = new Supercluster({ radius: 60, maxZoom: 16, minPoints: 2 })
    sc.load(
      stations.map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        properties: { id: s.id, max_power_kw: s.max_power_kw, connector_interface_ids: s.connector_interface_ids ?? [] },
      }))
    )
    scRef.current = sc

    const points = stations.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      max_power_kw: s.max_power_kw,
      connector_interface_ids: s.connector_interface_ids ?? [],
    }))
    worker.postMessage({ type: 'load', points })

    return () => {
      worker.terminate()
      workerRef.current = null
      scRef.current = null
      setReady(false)
    }
  }, [dataLoaded, stations])

  const getClusters = useCallback((bbox: [number, number, number, number], zoom: number) => {
    lastQueryRef.current = { bbox, zoom }
    if (!workerRef.current || !ready) return
    const id = ++reqIdRef.current
    workerRef.current.postMessage({ type: 'getClusters', bbox, zoom, reqId: id })
  }, [ready])

  const getClusterExpansionZoom = useCallback((clusterId: number): number => {
    if (!scRef.current) return 12
    try {
      return scRef.current.getClusterExpansionZoom(clusterId)
    } catch {
      return 12
    }
  }, [])

  return { clusters, ready, getClusters, getClusterExpansionZoom }
}
