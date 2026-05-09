# Agents — wytyczne dla AI / LLM

Ten dokument opisuje konwencje projektu, aby agenci AI (Copilot, OpenCode, Cursor itp.) mogli efektywnie pracować z kodem.

## Projekt

**EV Charger Map** — PWA/SPA wyświetlająca stacje ładowania EV na mapie Europy. Dane z rejestrów rządowych (PL, DE, FR, NL, BE) przechowywane w IndexedDB (Dexie), klastrowane po stronie klienta (Supercluster + Web Worker).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Leaflet + react-leaflet
- Supercluster (Web Worker)
- Dexie (IndexedDB)
- i18next (PL / EN / DE / FR)

## Struktura katalogów

```
src/
  App.tsx                 # Root — stan ładowania, routing stacji
  db/
    dexie.ts              # Dexie setup, loadData(), queryStations()
    sources.ts            # COUNTRY_SOURCES — rejestr źródeł danych
    findStation.ts        # findStation(id) — przeszukuje tabele sekwencyjnie
  hooks/                  # Custom hooks: useStations, useCluster, useGeolocation, useTheme
  components/
    Map/MapView.tsx       # Leaflet mapa, SingleStationMarker
    Filters/FiltersPanel.tsx
    StationPanel/StationPanel.tsx  # Panel szczegółów stacji (+ link nawigacji Google Maps)
    Support/SupportModal.tsx
  workers/
    cluster.worker.ts     # Web Worker dla Supercluster
  i18n/index.ts           # Tłumaczenia (PL / EN / DE / FR)
  types/index.ts          # ChargerStation, EIPADictionary itp.
scripts/                  # Skrypty fetch/process dla każdego źródła danych
public/                   # Pliki *.db.json (generowane przez scripts/)
```

## Konwencje

### Dodawanie nowego kraju (źródła danych)

Zmiany w 5 plikach:
1. `scripts/fetch-<kraj>.mjs` + `scripts/process-<kraj>.mjs`
2. `src/db/dexie.ts` — nowa tabela Dexie
3. `src/db/sources.ts` — wpis w `COUNTRY_SOURCES`
4. `src/i18n/index.ts` — klucze `source_<kraj>` i `loading_import_<kraj>` (4 języki)
5. `.github/workflows/update-<kraj>.yml`

### Tłumaczenia (i18n)

- Każdy nowy tekst UI wymaga klucza we **wszystkich 4 językach**: PL, EN, DE, FR
- Plik: `src/i18n/index.ts`
- Fallback: PL

### Komponenty

- Komponenty funkcyjne React (FC)
- Tailwind CSS — klasy utility, ciemny motyw przez `dark:` prefix
- Brak bibliotek komponentów — własne `Label`, `Badge` itp.

### Typy

- Główne typy w `src/types/index.ts`
- `ChargerStation` zawiera `lat`, `lng` — współrzędne używane m.in. do nawigacji Google Maps

### Testy

- Framework: Vitest (`vitest.config.ts`)
- Uruchamianie: `npm test`

### Linting

- ESLint (`eslint.config.js`)
- Uruchamianie: `npm run lint`
