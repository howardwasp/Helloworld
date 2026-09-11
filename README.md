# SignalMap

SignalMap is a real-time global situation dashboard: a large tactical map on the left and live intel panels on the right. The MVP runs entirely on typed mock GeoJSON and news fixtures so it works offline. It is original software inspired by the *feel* of public situation dashboards — not a copy of World Monitor, and it does not use that product’s source, trademarks, or APIs.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

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
  api/client.ts          Data access. Mocks today, live fetchers tomorrow.
  data/catalog.ts        Regions, chips, colors, source tabs.
  data/fixtures/         Typed events, polygons, and news.
  map/                   MapLibre style, graticule, GeoJSON helpers, map view.
  state/useDashboard.ts  URL sync + filtering + selection.
  components/            Chrome, panels, detail card.
  types/intel.ts         Shared contracts.
public/data/             Natural Earth 110m countries (beige land / pale ocean).
```

The map is MapLibre GL JS with a **local** style: pale-blue ocean, 10° graticule, beige land from Natural Earth. No commercial tile key is required. Glyphs for marker labels come from MapLibre’s public demo font endpoint; labels simply omit if that request is blocked.

## Swap mocks for live APIs

`src/api/client.ts` is the only module the UI talks to. Keep returning an `IntelBundle`:

```ts
{
  events: IntelEvent[]
  polygons: IntelPolygon[]
  news: NewsItem[]
  generatedAt: string
}
```

Suggested public sources (read each provider’s terms first):

| Layer | Starting point |
| --- | --- |
| Natural events | [USGS earthquake GeoJSON](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson) |
| Weather | [Open-Meteo](https://api.open-meteo.com/) or [NWS alerts](https://api.weather.gov/alerts/active) |
| Outages | IODA / Cloudflare Radar (keys + attribution often required) |
| Conflicts | Licensed incident feeds (e.g. ACLED). Do not scrape other dashboards. |
| Sanctions | Official list text + your own geocoding — lists are not geometries |

Do **not** call World Monitor or scrape another commercial dashboard.

## Tech

- Vite + React 19 + TypeScript
- MapLibre GL JS
- Tailwind CSS v4
- No authentication in the MVP

## License / data

Application code is original to this repository. Country polygons are [Natural Earth](https://www.naturalearthdata.com/) 110m (public domain). Fixture headlines and incident descriptions are invented for the demo and are not real-time reporting.
