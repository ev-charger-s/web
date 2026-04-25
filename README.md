# EV Charger Map

Mapa ładowarek EV dla samochodów elektrycznych — PWA/SPA (React + Vite + Tailwind + Leaflet + Dexie/IndexedDB).

## Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** v4
- **Leaflet** + **react-leaflet** — mapa
- **supercluster** + **Web Worker** — klastrowanie po stronie klienta
- **Dexie** (IndexedDB) — lokalna baza danych stacji
- **i18next** — internacjonalizacja (PL / EN / DE / FR)

## Uruchamianie lokalnie

```bash
npm install
npm run dev
```

### Aktualizacja danych lokalnie

```bash
# Wszystkie źródła naraz
npm run update

# Wybrane źródła
npm run update:eipa    # 🇵🇱 Polska — wymaga danych w data/ (fetch osobno)
npm run update:bnetza  # 🇩🇪 Niemcy
npm run update:irve    # 🇫🇷 Francja
npm run update:ndw     # 🇳🇱 Holandia
npm run update:beev    # 🇧🇪 Belgia

# Kilka źródeł jednocześnie (bezpośrednio przez skrypt)
node scripts/update.mjs --bnetza --irve --ndw
node scripts/update.mjs --help   # pełna lista flag
```

---

## Źródła danych

### Zintegrowane

| Kraj | Rejestr | Plik | Aktualizacja | Uwagi |
|---|---|---|---|---|
| 🇵🇱 Polska | [EIPA — Ewidencja Infrastruktury Paliw Alternatywnych](https://eipa.udt.gov.pl) | `public/eipa.db.json` | Co godzinę (GH Action) | API OCPI; token wymagany; ~5 700 stacji |
| 🇩🇪 Niemcy | [BNetzA Ladesäulenregister](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/) | `public/bnetza.db.json` | 1× dziennie (GH Action) | CSV bulk; darmowy, bez rejestracji; ~71 000 lokalizacji |
| 🇫🇷 Francja | [Base nationale des IRVE](https://www.data.gouv.fr/fr/datasets/fichier-consolide-des-bornes-de-recharge-pour-vehicules-electriques/) | `public/irve.db.json` | 1× dziennie (GH Action) | CSV bulk; darmowy, CC BY, bez klucza; ~62 700 lokalizacji (216k PDC) |
| 🇳🇱 Holandia | [NDW — Nationaal Dataportaal Wegverkeer](https://opendata.ndw.nu) | `public/ndw.db.json` | 1× dziennie (GH Action) | OCPI 2.x JSON GZ; darmowy, bez rejestracji; ~89 400 lokalizacji (225k złącz) |
| 🇧🇪 Belgia | [road.io via transportdata.be NAP ITS](https://www.transportdata.be/en/dataset/road-public-charging-network) | `public/beev.db.json` | 1× dziennie (GH Action) | OCPI 2.2.1 JSON; darmowy, bez rejestracji; ~2 829 stacji |

### Kandydaci do integracji

#### Rejestry rządowe (darmowe, bulk download)

| Kraj | Nazwa | URL | Format | Dostęp | Szacowana liczba stacji |
|---|---|---|---|---|---|
| 🇬🇧 Wielka Brytania | ~~National Chargepoint Registry (NCR/DfT)~~ **ZLIKWIDOWANY** | ~~chargepoints.dft.gov.uk~~ | — | ❌ Offline od 28.11.2024 | ~119 000 (brak zamiennika) |
| 🇳🇴 Norwegia | Entur | [entur.no](https://entur.no) | OCPI REST | Darmowy | ~25 000 |
| 🇦🇹 Austria | emob.at | [emob.at](https://www.emob.at) | OCPI REST | Do zbadania | ~20 000 |

> **UK — stan na 2026:** NCR zlikwidowany 28.11.2024. Zastąpiony zdecentralizowanym modelem OCPI 2.2.1 (Public Charge Point Regulations 2023) — każdy operator udostępnia własne API, brak centralnego bulk download. Główni operatorzy (Shell Recharge ~20k, Pod Point ~18k, Connected Kerb ~10k, BP Pulse ~10k) mają API wyłącznie dla partnerów komercyjnych. Jedyna darmowa alternatywa: **OpenChargeMap** (~60k UK stacji, darmowy klucz API).

#### Agregatory europejskie / globalne

| Nazwa | Zasięg | URL | Dostęp | Uwagi |
|---|---|---|---|---|
| [OpenChargeMap](https://openchargemap.org) | Cały świat | [api.openchargemap.io/v3](https://api.openchargemap.io/v3/) | Darmowy (klucz API) | CC BY 4.0; społecznościowa + importy z rejestrów; bbox query |
| [EAFO](https://alternative-fuels-observatory.ec.europa.eu) | EU27+ | — | Darmowy | Dane zagregowane (statystyki, nie EVSE); DG MOVE |
| [Eco-Movement](https://www.eco-movement.com) | 80+ krajów | [developers.eco-movement.com](https://developers.eco-movement.com) | **Płatny** | Najwyższa jakość; używany przez Apple Maps, OEM-y |
| [GIREVE ConnectPlace](https://connect-place.gireve.com) | Europa (695k+ punktów) | — | **Komercyjny** (CPO/MSP) | Największy hub OCPI w Europie |
| [e-clearing.net](https://e-clearing.net) | Europa (DACH+) | — | **Komercyjny** | Hub OCPI/OCHP; popularny w Niemczech |
| [PlugShare](https://www.plugshare.com) | Cały świat | [developer.plugshare.com](https://developer.plugshare.com) | **Komercyjny API** | Popularny wśród kierowców EV |

#### Kontekst regulacyjny

**AFIR (EU 2023/1804)**, obowiązuje od kwietnia 2024 — wymaga od wszystkich operatorów w UE publikowania danych przez **OCPI 2.2.1+** do krajowych NAP (National Access Point). Docelowo każde państwo UE powinno mieć rejestr analogiczny do EIPA.

---

## Architektura

### Dane

```
public/
  eipa.db.json     # EIPA — generowany przez scripts/process-eipa.mjs
  bnetza.db.json       # BNetzA — generowany przez scripts/process-bnetza.mjs
  irve.db.json         # IRVE — generowany przez scripts/process-irve.mjs
  ndw.db.json          # NDW — generowany przez scripts/process-ndw.mjs
  beev.db.json         # BEEV — generowany przez scripts/process-beev.mjs
data/
  station.json / pool.json / point.json / operator.json / dictionary.json  # EIPA raw
  bnetza/              # BNetzA CSV (gitignored) + latest.txt
  irve/                # IRVE CSV (gitignored) + latest.txt
  ndw/                 # NDW JSON GZ (gitignored)
  beev/                # BEEV OCPI JSON (gitignored)
```

### Skrypty

```
scripts/
  fetch-bnetza.mjs     # Pobieranie CSV BNetzA
  process-bnetza.mjs   # Parsowanie CSV → bnetza.db.json
  fetch-irve.mjs       # Pobieranie CSV IRVE z data.gouv.fr API
  process-irve.mjs     # Parsowanie CSV → irve.db.json
  fetch-ndw.mjs        # Pobieranie OCPI JSON GZ z opendata.ndw.nu
  process-ndw.mjs      # Parsowanie OCPI → ndw.db.json
  fetch-beev.mjs       # Pobieranie OCPI JSON z road.io (transportdata.be)
  process-beev.mjs     # Parsowanie OCPI 2.2.1 → beev.db.json
  process-eipa.mjs     # Łączenie EIPA raw → eipa.db.json
  update.mjs           # Unified CLI: --all / --eipa / --bnetza / --irve / --ndw / --beev
  lib/
    download.mjs       # Wspólne: downloadFile(), downloadAndDecompress(), httpsGet()
    ocpi-connectors.mjs# Wspólne: STANDARD_MAP, mapConnector(), powerKw(), hashId()
    json-output.mjs    # Wspólne: writeDbJson() z null-stripping replacer
```

### Frontend (`src/`)

```
src/
  App.tsx              # Root — useReducer dla stanu ładowania, COUNTRY_SOURCES-driven UI
  db/
    dexie.ts           # Dexie setup, loadData(), loadCountrySource() (generyczna), queryStations()
    sources.ts         # COUNTRY_SOURCES registry — jedyne miejsce do edycji przy dodawaniu kraju
    findStation.ts     # findStation(id) — przeszukuje wszystkie tabele sekwencyjnie
  hooks/
    useStations.ts     # Zapytania do Dexie z debounce i cleanup
    useCluster.ts      # Supercluster worker + main-thread SC dla expansion zoom
    useGeolocation.ts  # Geolokalizacja
    useTheme.ts        # Dark/light mode
  components/
    Map/MapView.tsx    # Leaflet map, SingleStationMarker (używa findStation)
    Filters/FiltersPanel.tsx
    StationPanel/StationPanel.tsx  # Rozpoznaje connector_interface_extra
    Support/SupportModal.tsx
  workers/
    cluster.worker.ts  # Web Worker dla Supercluster
  i18n/index.ts        # PL / EN / DE / FR
  types/index.ts       # Typy ChargerStation, EIPADictionary itp.
```

### Dodawanie nowego kraju

Wymagane zmiany (5 plików):

1. `scripts/fetch-<kraj>.mjs` + `scripts/process-<kraj>.mjs` — pobieranie i parsowanie
2. `src/db/dexie.ts` — nowa tabela Dexie + wywołanie `loadCountrySource()`
3. `src/db/sources.ts` — nowy wpis w `COUNTRY_SOURCES`
4. `src/i18n/index.ts` — klucze `source_<kraj>` i `loading_import_<kraj>` (PL/EN/DE/FR)
5. `.github/workflows/update-<kraj>.yml` — GH Action (cron)

## GitHub Actions

| Workflow | Cron | Źródło | Commit |
|---|---|---|---|
| `update-eipa.yml` | Co godzinę | EIPA API | `public/eipa.db.json` |
| `update-bnetza.yml` | 03:30 UTC | BNetzA CSV | `public/bnetza.db.json` |
| `update-irve.yml` | 03:45 UTC | IRVE CSV (data.gouv.fr) | `public/irve.db.json` |
| `update-ndw.yml` | 04:00 UTC | NDW OCPI JSON GZ (opendata.ndw.nu) | `public/ndw.db.json` |
| `update-beev.yml` | 04:15 UTC | BEEV OCPI JSON (road.io via transportdata.be) | `public/beev.db.json` |
