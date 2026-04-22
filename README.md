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

### Generowanie danych lokalnie

```bash
# EIPA (Polska) — wymaga tokenu w zmiennej środowiskowej
EIPA_TOKEN=<token> node scripts/fetch-eipa.mjs
node scripts/process-data.mjs

# BNetzA (Niemcy)
node scripts/fetch-bnetza.mjs
node scripts/process-bnetza.mjs

# IRVE (Francja)
node scripts/fetch-irve.mjs
node scripts/process-irve.mjs

# NDW (Holandia)
node scripts/fetch-ndw.mjs
node scripts/process-ndw.mjs
```

---

## Źródła danych

### Zintegrowane

| Kraj | Rejestr | Plik | Aktualizacja | Uwagi |
|---|---|---|---|---|
| 🇵🇱 Polska | [EIPA — Ewidencja Infrastruktury Paliw Alternatywnych](https://eipa.udt.gov.pl) | `public/chargers.db.json` | Co godzinę (GH Action) | API OCPI; token wymagany; ~5 700 stacji |
| 🇩🇪 Niemcy | [BNetzA Ladesäulenregister](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/) | `public/bnetza.db.json` | 1× dziennie (GH Action) | CSV bulk; darmowy, bez rejestracji; ~71 000 lokalizacji |
| 🇫🇷 Francja | [Base nationale des IRVE](https://www.data.gouv.fr/fr/datasets/fichier-consolide-des-bornes-de-recharge-pour-vehicules-electriques/) | `public/irve.db.json` | 1× dziennie (GH Action) | CSV bulk; darmowy, CC BY, bez klucza; ~62 700 lokalizacji (216k PDC) |
| 🇳🇱 Holandia | [NDW — Nationaal Dataportaal Wegverkeer](https://opendata.ndw.nu) | `public/ndw.db.json` | 1× dziennie (GH Action) | OCPI 2.x JSON GZ; darmowy, bez rejestracji; ~89 400 lokalizacji (225k złącz) |

### Kandydaci do integracji

#### Rejestry rządowe (darmowe, bulk download)

| Kraj | Nazwa | URL | Format | Dostęp | Szacowana liczba stacji |
|---|---|---|---|---|---|
| 🇬🇧 Wielka Brytania | ~~National Chargepoint Registry (NCR/DfT)~~ **ZLIKWIDOWANY** | ~~chargepoints.dft.gov.uk~~ | — | ❌ Offline od 28.11.2024 | ~119 000 (brak zamiennika) |
| 🇧🇪 Belgia | transport.be / BEEV | [transport.belgium.be](https://transport.belgium.be) | OCPI | Do zbadania | ~30 000 |
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

## Architektura danych

```
public/
  chargers.db.json     # EIPA — generowany przez scripts/process-data.mjs
  bnetza.db.json       # BNetzA — generowany przez scripts/process-bnetza.mjs
  irve.db.json         # IRVE — generowany przez scripts/process-irve.mjs
  ndw.db.json          # NDW — generowany przez scripts/process-ndw.mjs
data/
  station.json / pool.json / point.json / operator.json / dictionary.json  # EIPA raw
  bnetza/              # BNetzA CSV (gitignored) + latest.txt
  irve/                # IRVE CSV (gitignored) + latest.txt
  ndw/                 # NDW JSON GZ (gitignored)
scripts/
  fetch-bnetza.mjs     # Pobieranie CSV BNetzA
  process-bnetza.mjs   # Parsowanie CSV → bnetza.db.json
  fetch-irve.mjs       # Pobieranie CSV IRVE z data.gouv.fr API
  process-irve.mjs     # Parsowanie CSV → irve.db.json
  fetch-ndw.mjs        # Pobieranie OCPI JSON GZ z opendata.ndw.nu
  process-ndw.mjs      # Parsowanie OCPI → ndw.db.json
  process-data.mjs     # Łączenie EIPA raw → chargers.db.json
.github/workflows/
  update-data.yml      # EIPA — co godzinę
  update-bnetza.yml    # BNetzA — 1× dziennie (03:30 UTC)
  update-irve.yml      # IRVE — 1× dziennie (03:45 UTC)
  update-ndw.yml       # NDW — 1× dziennie (04:00 UTC)
```

## GitHub Actions

| Workflow | Cron | Źródło | Commit |
|---|---|---|---|
| `update-data.yml` | Co godzinę | EIPA API | `public/chargers.db.json` |
| `update-bnetza.yml` | 03:30 UTC | BNetzA CSV | `public/bnetza.db.json` |
| `update-irve.yml` | 03:45 UTC | IRVE CSV (data.gouv.fr) | `public/irve.db.json` |
| `update-ndw.yml` | 04:00 UTC | NDW OCPI JSON GZ (opendata.ndw.nu) | `public/ndw.db.json` |
