import { formatRelative } from '@/lib/time'
import type { DashboardModel } from '@/state/useDashboard'

export function FooterBar({ dash }: { dash: DashboardModel }) {
  const events = dash.visibleEvents.length
  const polygons = dash.visiblePolygons.length
  const layers = dash.layers.length
  const live = dash.sources.filter((source) => source.mode === 'live' && source.id !== 'news')
  const sample = dash.sources.filter((source) => source.mode !== 'live' && source.id !== 'news')
  const updated = dash.lastUpdated ? formatRelative(dash.lastUpdated) : 'pending'
  return (
    <footer className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#e4dfd4] bg-white px-3 py-1.5 text-[11px] text-[#6d675c]">
      <strong className="tracking-[0.16em] text-[#1f2a22]">SIGNALMAP</strong>
      <span>
        {live.length ? `Live · ${live.map((source) => source.provider.split(' / ')[0]).join(' · ')}` : 'Connecting…'}
        {sample.length ? ` · Sample · ${sample.map((source) => source.label).join(', ')}` : ''}
      </span>
      <span className="hidden sm:inline">
        {events} events · {polygons} overlays · {layers} layers · {dash.visibleNews.length} briefings
      </span>
      <span className="ml-auto text-right">
        Updated {updated}
        <span className="hidden lg:inline">
          {' '}
          · USGS · NWS · Open-Meteo (CC BY 4.0) · Natural Earth
        </span>
      </span>
    </footer>
  )
}
