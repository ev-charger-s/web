/**
 * Country registry — single source of truth for all integrated data sources.
 *
 * Adding a new country requires:
 *  1. Adding an entry here
 *  2. Adding a Dexie table in dexie.ts
 *  3. Adding translations in i18n/index.ts
 *  4. Adding scripts/fetch-<key>.mjs + scripts/process-<key>.mjs
 *  5. Adding .github/workflows/update-<key>.yml
 */

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
}

export const COUNTRY_SOURCES: CountrySource[] = [
  { key: 'pl', flag: '🇵🇱', i18nKey: 'source_pl', i18nLoadingKey: 'loading_import_pl' },
  { key: 'de', flag: '🇩🇪', i18nKey: 'source_de', i18nLoadingKey: 'loading_import_de' },
  { key: 'fr', flag: '🇫🇷', i18nKey: 'source_fr', i18nLoadingKey: 'loading_import_fr' },
  { key: 'nl', flag: '🇳🇱', i18nKey: 'source_nl', i18nLoadingKey: 'loading_import_nl' },
  { key: 'be', flag: '🇧🇪', i18nKey: 'source_be', i18nLoadingKey: 'loading_import_be' },
]
