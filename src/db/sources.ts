import type { CountryFilter } from './dexie'

export interface CountrySource {
  /** Country filter key */
  key: Exclude<CountryFilter, 'all'>
  /** Flag emoji */
  flag: string
  /** i18n key for the source label, e.g. "source_pl" */
  i18nKey: string
  /** i18n key shown in the loading progress bar, e.g. "loading_import_pl" */
  i18nLoadingKey: string
  /**
   * Approximate bounding box [minLng, minLat, maxLng, maxLat].
   * Used for viewport-triggered lazy loading — a country is loaded only when
   * the map viewport intersects this bbox.
   */
  bbox: [number, number, number, number]
}

export const COUNTRY_SOURCES: CountrySource[] = [
  { key: 'pl', flag: '🇵🇱', i18nKey: 'source_pl', i18nLoadingKey: 'loading_import_pl', bbox: [14.12, 49.00, 24.15, 54.83] },
  { key: 'de', flag: '🇩🇪', i18nKey: 'source_de', i18nLoadingKey: 'loading_import_de', bbox: [5.87, 47.27, 15.04, 55.06] },
  { key: 'fr', flag: '🇫🇷', i18nKey: 'source_fr', i18nLoadingKey: 'loading_import_fr', bbox: [-5.14, 41.33, 9.56, 51.09] },
  { key: 'nl', flag: '🇳🇱', i18nKey: 'source_nl', i18nLoadingKey: 'loading_import_nl', bbox: [3.36, 50.75, 7.23, 53.55] },
  { key: 'be', flag: '🇧🇪', i18nKey: 'source_be', i18nLoadingKey: 'loading_import_be', bbox: [2.54, 49.50, 6.40, 51.50] },
]

/** Returns true if two bboxes [minLng, minLat, maxLng, maxLat] overlap. */
export function bboxIntersects(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}
