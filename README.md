# SignalMap

SignalMap is a real-time global situation dashboard: a large tactical map on the left and live intel panels on the right. Every enabled map layer attempts a live public feed (or a scheduled snapshot of that feed). Offline or on fetch failure the app falls back to snapshots in `public/data/live/`, then to in-memory fixtures. It is original software inspired by the *feel* of public situation dashboards — not a copy of World Monitor, and it does not use that product’s source, trademarks, or APIs.

**Live site:** [https://howardwasp.github.io/Helloworld/](https://howardwasp.github.io/Helloworld/)

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

Production build (assets are prefixed with `/Helloworld/` for GitHub Pages):

```bash
npm run build
npm run preview
```

Preview the production build at `http://localhost:4173/Helloworld/`.

## Deploy (GitHub Pages)

Pushes to `main` run [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml): Node 22, `npm ci`, `npm run build`, then the official `upload-pages-artifact` + `deploy-pages` actions.

Public URL: **https://howardwasp.github.io/Helloworld/**

**Required once (repo admin):** GitHub Actions cannot create the Pages site by itself on this repo. Enable it with one Settings click:

1. Open [Settings → Pages](https://github.com/howardwasp/Helloworld/settings/pages).
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

Then re-run **Deploy SignalMap to GitHub Pages** (Actions → Run workflow) or push another commit to `main`. After that, every push to `main` publishes automatically.

## Default view

On first load SignalMap opens an **Americas** frame at zoom **~2.5**, time range **7D**, with these layers on:

- Conflict Zones
- Intel Hotspots
- Sanctions
- Internet Disruptions
- Natural Events
- Severe Weather Alerts

Zoom, center, pitch, time range, region, and layers are written to the query string so a view can be shared:

```
?region=americas&timeRange=7d&layers=conflicts,hotspots,sanctions,weather,outages,natural&lng=-75.000&lat=12.000&zoom=2.50
```

## What you can do

- Toggle enabled layer chips (green border = visible). Extra chips (protests, bases, cables, …) are present but disabled for v1.
- Filter by 1H / 6H / 24H / 48H / 7D / ALL.
- Switch region presets: Americas, Europe, Asia, Global.
- Click a marker or shaded overlay for a detail card (title, severity, time, source, description).
- Search the visible event set from the top bar.
- Play a cycling live-briefing feed; filter cards by source tab.
- Jump from a news card or hotspot row onto the map.

## Architecture

```
src/
  api/client.ts          Assembles IntelBundle (live + snapshot + fixtures).
  api/http.ts            Fetch + timeout + in-memory cache.
  api/usgs.ts            USGS FDSN earthquake GeoJSON.
  api/weather.ts         NWS alerts, Open-Meteo stations, NHC storms.
  api/conflicts.ts       GDELT 2.0 exports + DOC headlines.
  api/hotspots.ts        Density clusters derived from GDELT points.
  api/sanctions.ts       OFAC SDN country aggregates (Actions snapshot).
  api/outages.ts         IODA (+ optional Cloudflare Radar).
  data/catalog.ts        Regions, chips, colors, source tabs.
  data/fixtures/         Fallback events, polygons, and desk copy.
  map/                   MapLibre style, graticule, GeoJSON helpers, map view.
  state/useDashboard.ts  URL sync + filtering + selection.
  components/            Chrome, panels, detail card.
  types/intel.ts         Shared contracts.
public/data/             Natural Earth 110m countries + live API snapshots.
```

The map prefers **MapLibre GL JS** with a local style (pale-blue ocean, 10° graticule, beige Natural Earth land). No commercial tile key is required. If WebGL is unavailable or only a software fallback exists, SignalMap automatically uses a Canvas2D equirectangular renderer with the same GeoJSON, markers, and interactions so the dashboard still looks alive.

## Live vs fallback layers

`src/api/client.ts` is the only module the UI talks to. It returns an `IntelBundle` plus per-layer source metadata (`live` / `cached` / `fallback` / `sample`). Time chips map to API windows (1H/6H/24H/48H/7D/ALL → provider `starttime` plus client-side `occurredAt` filtering). Successful snapshot loads show **Live (cached)**, not Sample.

| Layer | Status | Source | Notes |
| --- | --- | --- | --- |
| Natural events | **Live** | [USGS FDSN event API](https://earthquake.usgs.gov/fdsnws/event/1/) GeoJSON | CORS-safe. Magnitude floor rises for longer windows (M2.5 → M4.5). |
| Severe weather | **Live** | [NWS alerts](https://api.weather.gov/alerts/active) + [Open-Meteo](https://open-meteo.com/) current conditions + [NHC CurrentStorms](https://www.nhc.noaa.gov/CurrentStorms.json) | NWS and Open-Meteo are browser-callable. NHC has no CORS header; the scheduled snapshot covers it. |
| Conflict zones | **Live** (snapshot fallback) | [GDELT 2.0](https://www.gdeltproject.org/) 15-minute export ZIPs (CORS `*` on GCS) + [DOC 2.0](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) headlines | CAMEO roots 14/18/19/20 with coordinates. News-mention events, **not** verified incidents. UCDP now requires a token; ACLED needs a key — neither is used. |
| Intel hotspots | **Live** (derived) | Grid clusters of the current GDELT conflict points | Recalculated when the time-range chip changes. |
| Sanctions | **Live (cached)** | [US Treasury OFAC SDN](https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists) CSV + ADD.CSV | The full SDN is **not** copied into the repo. Actions write country aggregates (counts, programs, a few example names) to `public/data/live/sanctions.json`. Country dots/overlays are **not** a legal coverage map. |
| Internet disruptions | **Live** (snapshot fallback) | [IODA](https://ioda.inetintel.cc.gatech.edu/) country events/summary; optional [Cloudflare Radar](https://developers.cloudflare.com/radar/investigate/outages/) if `VITE_CLOUDFLARE_RADAR_TOKEN` is set | IODA JSON is public but usually has no browser CORS header, so the scheduled snapshot is the reliable path. |

Layer chips show **Live**, **Live (cached)**, **Fallback**, or **Sample**. The footer lists providers and last-updated time.

Fallback order for every enabled layer: **browser API → `public/data/live/` snapshot → in-memory fixtures**.

## Snapshots (GitHub Actions)

[`.github/workflows/refresh-live-data.yml`](.github/workflows/refresh-live-data.yml) runs every 6 hours and writes:

- `public/data/live/earthquakes.geojson`
- `public/data/live/weather-alerts.geojson`
- `public/data/live/storms.json`
- `public/data/live/conflicts.json` (filtered GDELT subset)
- `public/data/live/hotspots.json`
- `public/data/live/sanctions.json` (OFAC country aggregates only)
- `public/data/live/outages.json` (IODA)
- `public/data/live/sources.json`

Refresh locally with `node scripts/refresh-live-data.mjs`.

Do **not** call World Monitor or scrape another commercial dashboard.

## Tech

- Vite + React 19 + TypeScript
- MapLibre GL JS
- Tailwind CSS v4
- No authentication in the MVP

## License / data

Application code is original to this repository. Country polygons are [Natural Earth](https://www.naturalearthdata.com/) 110m (public domain).

**Attribution (live feeds):**

- Earthquakes: [U.S. Geological Survey](https://earthquake.usgs.gov/) (U.S. public domain)
- U.S. alerts: [National Weather Service](https://www.weather.gov/documentation/services-web-api) (U.S. public domain)
- Active cyclones: [National Hurricane Center](https://www.nhc.noaa.gov/) (U.S. public domain)
- Global station weather: [Open-Meteo](https://open-meteo.com/) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))
- Conflict / hotspot points: [The GDELT Project](https://www.gdeltproject.org/) (news-mention events; filtered snapshot, not the full database)
- Sanctions country aggregates: [U.S. Treasury OFAC SDN](https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists) (U.S. public domain; **not** legal advice or a coverage map)
- Internet outages: [IODA](https://ioda.inetintel.cc.gatech.edu/), Georgia Institute of Technology (attribution required)

Fixture headlines remain only as a last-resort fallback when a provider is down. Reuters / AP / BBC (and similar) briefing tabs are still sample desk copy.
