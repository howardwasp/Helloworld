import { DetailCard } from '@/components/DetailCard'
import { FooterBar } from '@/components/FooterBar'
import { LayerChips, MapHeader, MapLegend, TimeRangeBar, ZoomControls } from '@/components/MapChrome'
import { RightPanels } from '@/components/RightPanels'
import { TopBar } from '@/components/TopBar'
import { SituationMap } from '@/map/SituationMap'
import { useDashboard } from '@/state/useDashboard'
import { useEffect } from 'react'

export default function App() {
  const dash = useDashboard()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dash.selectFeature(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dash])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f1ea] text-[#2b2b2b]">
      <TopBar dash={dash} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative min-h-[52%] min-w-0 flex-1 overflow-hidden bg-[#d7e6f2]">
          <SituationMap
            events={dash.visibleEvents}
            polygons={dash.visiblePolygons}
            view={dash.view}
            selectedId={dash.selected?.id ?? null}
            onViewChange={dash.setView}
            onSelect={dash.selectFeature}
          />
          <MapHeader dash={dash} />
          <TimeRangeBar dash={dash} />
          <LayerChips dash={dash} />
          <ZoomControls dash={dash} />
          <MapLegend />
          {dash.selected && (
            <DetailCard feature={dash.selected} onClose={() => dash.selectFeature(null)} />
          )}
        </section>
        <RightPanels dash={dash} />
      </div>
      <FooterBar dash={dash} />
    </div>
  )
}
