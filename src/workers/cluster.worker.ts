import Supercluster from 'supercluster'

export interface ClusterPoint {
  id: number
  lat: number
  lng: number
  max_power_kw: number
  connector_interface_ids: number[]
}

type WorkerMessage =
  | { type: 'load'; points: ClusterPoint[] }
  | { type: 'getClusters'; bbox: [number, number, number, number]; zoom: number; reqId: number }

type WorkerResponse =
  | { type: 'ready'; count: number }
  | { type: 'clusters'; clusters: Supercluster.ClusterFeature<Supercluster.AnyProps>[] | Supercluster.PointFeature<Supercluster.AnyProps>[]; reqId: number }

const sc = new Supercluster<{ id: number; max_power_kw: number; connector_interface_ids: number[] }>({
  radius: 60,
  maxZoom: 16,
  minPoints: 2,
})

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data
  if (msg.type === 'load') {
    const features: Supercluster.PointFeature<{ id: number; max_power_kw: number; connector_interface_ids: number[] }>[] = msg.points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, max_power_kw: p.max_power_kw, connector_interface_ids: p.connector_interface_ids },
    }))
    sc.load(features)
    const resp: WorkerResponse = { type: 'ready', count: features.length }
    self.postMessage(resp)
  } else if (msg.type === 'getClusters') {
    const clusters = sc.getClusters(msg.bbox, msg.zoom)
    const resp: WorkerResponse = { type: 'clusters', clusters, reqId: msg.reqId }
    self.postMessage(resp)
  }
}
