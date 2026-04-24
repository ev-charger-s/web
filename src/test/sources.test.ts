import { describe, it, expect } from 'vitest'
import { bboxIntersects, COUNTRY_SOURCES } from '../db/sources'

describe('bboxIntersects', () => {
  it('returns true for identical bboxes', () => {
    const bbox: [number, number, number, number] = [10, 50, 20, 55]
    expect(bboxIntersects(bbox, bbox)).toBe(true)
  })

  it('returns true when bboxes overlap', () => {
    const a: [number, number, number, number] = [0, 0, 10, 10]
    const b: [number, number, number, number] = [5, 5, 15, 15]
    expect(bboxIntersects(a, b)).toBe(true)
  })

  it('returns true when one bbox contains the other', () => {
    const outer: [number, number, number, number] = [0, 0, 20, 20]
    const inner: [number, number, number, number] = [5, 5, 10, 10]
    expect(bboxIntersects(outer, inner)).toBe(true)
    expect(bboxIntersects(inner, outer)).toBe(true)
  })

  it('returns false when bboxes are horizontally separated', () => {
    const a: [number, number, number, number] = [0, 0, 5, 10]
    const b: [number, number, number, number] = [10, 0, 15, 10]
    expect(bboxIntersects(a, b)).toBe(false)
  })

  it('returns false when bboxes are vertically separated', () => {
    const a: [number, number, number, number] = [0, 0, 10, 5]
    const b: [number, number, number, number] = [0, 10, 10, 15]
    expect(bboxIntersects(a, b)).toBe(false)
  })

  it('returns true when bboxes share only an edge', () => {
    const a: [number, number, number, number] = [0, 0, 10, 10]
    const b: [number, number, number, number] = [10, 0, 20, 10]
    expect(bboxIntersects(a, b)).toBe(true)
  })

  it('PL and DE bboxes overlap (they share border region)', () => {
    const pl = COUNTRY_SOURCES.find((s) => s.key === 'pl')!.bbox
    const de = COUNTRY_SOURCES.find((s) => s.key === 'de')!.bbox
    expect(bboxIntersects(pl, de)).toBe(true)
  })

  it('PL and FR bboxes do not overlap', () => {
    const pl = COUNTRY_SOURCES.find((s) => s.key === 'pl')!.bbox
    const fr = COUNTRY_SOURCES.find((s) => s.key === 'fr')!.bbox
    expect(bboxIntersects(pl, fr)).toBe(false)
  })

  it('NL and BE bboxes overlap (they share border)', () => {
    const nl = COUNTRY_SOURCES.find((s) => s.key === 'nl')!.bbox
    const be = COUNTRY_SOURCES.find((s) => s.key === 'be')!.bbox
    expect(bboxIntersects(nl, be)).toBe(true)
  })
})

describe('COUNTRY_SOURCES', () => {
  it('has 5 entries', () => {
    expect(COUNTRY_SOURCES).toHaveLength(5)
  })

  it('all entries have required fields', () => {
    for (const source of COUNTRY_SOURCES) {
      expect(source.key).toBeTruthy()
      expect(source.flag).toBeTruthy()
      expect(source.i18nKey).toBeTruthy()
      expect(source.i18nLoadingKey).toBeTruthy()
      expect(source.bbox).toHaveLength(4)
    }
  })

  it('all bboxes have minLng < maxLng and minLat < maxLat', () => {
    for (const { key, bbox } of COUNTRY_SOURCES) {
      const [minLng, minLat, maxLng, maxLat] = bbox
      expect(minLng, `${key} minLng < maxLng`).toBeLessThan(maxLng)
      expect(minLat, `${key} minLat < maxLat`).toBeLessThan(maxLat)
    }
  })
})
