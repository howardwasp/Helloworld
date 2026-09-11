import { Logo } from '@/components/Logo'
import { REGION_LABELS } from '@/data/catalog'
import { formatRelative } from '@/lib/time'
import type { DashboardModel } from '@/state/useDashboard'
import { REGION_IDS } from '@/types/intel'
import { useEffect, useRef, useState } from 'react'

export function TopBar({ dash }: { dash: DashboardModel }) {
  const [openSearch, setOpenSearch] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpenSearch(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#e4dfd4] bg-white px-3">
      <div className="flex items-center gap-2 pr-2">
        <Logo />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-[0.18em] text-[#1f2a22]">SIGNALMAP</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#8a8376]">Live situation</div>
        </div>
      </div>

      <div className="hidden items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-[#7a7468] md:flex">
        <span className="rounded-full bg-[#f3efe6] px-2 py-1">Monitor</span>
        <span className="rounded-full px-2 py-1">Brief</span>
      </div>

      <label className="ml-1 flex items-center gap-2 rounded-full border border-[#e4dfd4] bg-[#faf8f3] px-2.5 py-1 text-[12px]">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8376]">Region</span>
        <select
          className="bg-transparent font-medium text-[#2b2b2b] outline-none"
          value={dash.region}
          onChange={(event) => dash.setRegion(event.target.value as (typeof REGION_IDS)[number])}
        >
          {REGION_IDS.map((id) => (
            <option key={id} value={id}>
              {REGION_LABELS[id]}
            </option>
          ))}
        </select>
      </label>

      <div
        className="ml-1 flex items-center gap-1.5 rounded-full border border-[#d8efe0] bg-[#f3fbf6] px-2.5 py-1 text-[11px] font-medium text-[#1f7a45]"
        title="Mock watch level for the current region"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22c55e]" />
        </span>
        WATCH 2
      </div>

      <div ref={boxRef} className="relative ml-auto min-w-[200px] max-w-md flex-1">
        <input
          value={dash.query}
          onChange={(event) => {
            dash.setQuery(event.target.value)
            setOpenSearch(true)
          }}
          onFocus={() => setOpenSearch(true)}
          placeholder="Search events, places, layers"
          className="w-full rounded-full border border-[#e4dfd4] bg-[#faf8f3] px-3 py-1.5 text-[12px] outline-none placeholder:text-[#a39c90] focus:border-[#b7d8c4]"
        />
        {openSearch && dash.searchHits.length > 0 && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[#e4dfd4] bg-white shadow-lg">
            {dash.searchHits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-[#f7f3ea]"
                onClick={() => {
                  dash.selectEvent(hit)
                  setOpenSearch(false)
                }}
              >
                <span className="text-[12px] font-medium text-[#2b2b2b]">{hit.title}</span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-[#8a8376]">
                  {hit.country ?? hit.layer} · {formatRelative(hit.occurredAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void dash.refresh()}
        className="rounded-full border border-[#e4dfd4] px-2.5 py-1 text-[11px] text-[#5c564c] hover:bg-[#f7f3ea]"
      >
        {dash.loading ? 'Refreshing…' : dash.lastUpdated ? `Updated ${formatRelative(dash.lastUpdated)}` : 'Refresh'}
      </button>
    </header>
  )
}
