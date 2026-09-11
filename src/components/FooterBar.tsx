import type { DashboardModel } from '@/state/useDashboard'

export function FooterBar({ dash }: { dash: DashboardModel }) {
  const events = dash.visibleEvents.length
  const polygons = dash.visiblePolygons.length
  const layers = dash.layers.length
  return (
    <footer className="flex h-10 shrink-0 items-center gap-4 border-t border-[#e4dfd4] bg-white px-3 text-[11px] text-[#6d675c]">
      <strong className="tracking-[0.16em] text-[#1f2a22]">SIGNALMAP</strong>
      <span>Coverage desk · mock fixtures</span>
      <span className="hidden sm:inline">
        {events} events · {polygons} overlays · {layers} layers · {dash.visibleNews.length} briefings
      </span>
      <span className="ml-auto hidden md:inline">
        v0.1.0 · every configured live layer is covered in this cycle
      </span>
    </footer>
  )
}
