import { LAYER_CHIPS, TIME_RANGE_LABELS } from '@/data/catalog'
import { formatUtcClock } from '@/lib/time'
import type { DashboardModel } from '@/state/useDashboard'
import { TIME_RANGES } from '@/types/intel'
import { useEffect, useState } from 'react'

export function MapHeader({ dash }: { dash: DashboardModel }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 py-2">
      <div className="pointer-events-auto text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5d574c]">
        Global situation
      </div>
      <UtcClock />
      <div className="pointer-events-auto flex items-center gap-1">
        <ModeToggle dash={dash} />
        <button
          type="button"
          title="Reset view"
          aria-label="Reset view"
          onClick={dash.resetView}
          className="grid h-7 w-7 place-items-center rounded-full border border-[#e4dfd4] bg-white/90 text-[13px] text-[#5d574c]"
        >
          ⌖
        </button>
      </div>
    </div>
  )
}

function UtcClock() {
  const [text, setText] = useState(() => formatUtcClock(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setText(formatUtcClock(new Date())), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="pointer-events-none font-mono text-[11px] tracking-[0.08em] text-[#6d675c]">
      {text}
    </div>
  )
}

function ModeToggle({ dash }: { dash: DashboardModel }) {
  const is3d = dash.view.pitch > 10
  return (
    <div className="flex overflow-hidden rounded-full border border-[#e4dfd4] bg-white/90 text-[10px] font-semibold tracking-[0.14em]">
      <button
        type="button"
        className={`px-2.5 py-1 ${!is3d ? 'bg-[#1f2a22] text-white' : 'text-[#6d675c]'}`}
        onClick={() => dash.setMode3d(false)}
      >
        2D
      </button>
      <button
        type="button"
        className={`px-2.5 py-1 ${is3d ? 'bg-[#1f2a22] text-white' : 'text-[#6d675c]'}`}
        onClick={() => dash.setMode3d(true)}
      >
        3D
      </button>
    </div>
  )
}

export function TimeRangeBar({ dash }: { dash: DashboardModel }) {
  return (
    <div className="pointer-events-none absolute left-3 top-10 z-10 flex gap-1">
      {TIME_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => dash.setTimeRange(range)}
          className={`pointer-events-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] ${
            dash.timeRange === range
              ? 'border-[#1f7a45] bg-[#eef8f1] text-[#1f7a45]'
              : 'border-[#e4dfd4] bg-white/90 text-[#6d675c]'
          }`}
        >
          {TIME_RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  )
}

export function LayerChips({ dash }: { dash: DashboardModel }) {
  return (
    <div className="pointer-events-none absolute left-3 top-20 z-10 grid max-w-[380px] grid-cols-2 gap-1.5">
      {LAYER_CHIPS.map((chip) => {
        const active = dash.layers.includes(chip.id)
        const count = chip.enabled
          ? dash.visibleEvents.filter((event) => event.layer === chip.id).length +
            dash.visiblePolygons.filter((polygon) => polygon.layer === chip.id).length
          : 0
        const source = dash.sources.find((item) => item.id === chip.id)
        const badge = !chip.enabled
          ? null
          : source?.mode === 'live'
            ? 'Live'
            : source?.mode === 'fallback'
              ? 'Fallback'
              : source
                ? 'Sample'
                : null
        return (
          <button
            key={chip.id}
            type="button"
            disabled={!chip.enabled}
            onClick={() => dash.toggleLayer(chip.id)}
            title={source ? `${source.provider} — ${source.note ?? source.attribution}` : undefined}
            className={`pointer-events-auto flex items-center justify-between gap-2 whitespace-nowrap rounded-full border bg-white/92 px-2.5 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.08em] shadow-sm ${
              !chip.enabled
                ? 'cursor-not-allowed border-[#eeeae1] text-[#b2ab9f] opacity-70'
                : active
                  ? 'border-[#2f9d5c] text-[#1f2a22]'
                  : 'border-[#e4dfd4] text-[#6d675c]'
            }`}
          >
            <span className="min-w-0 truncate">{chip.label}</span>
            {chip.enabled && (
              <span className="flex shrink-0 items-center gap-1">
                {badge && (
                  <span
                    className={`rounded-full px-1.5 text-[8px] tracking-[0.08em] ${
                      badge === 'Live'
                        ? 'bg-[#e8f7ee] text-[#1f7a45]'
                        : badge === 'Fallback'
                          ? 'bg-[#fff4d6] text-[#8a6a12]'
                          : 'bg-[#f3efe6] text-[#8a8376]'
                    }`}
                  >
                    {badge}
                  </span>
                )}
                <span
                  className={`rounded-full px-1.5 text-[9px] ${
                    active ? 'bg-[#e8f7ee] text-[#1f7a45]' : 'bg-[#f3efe6] text-[#8a8376]'
                  }`}
                >
                  {count}
                </span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ZoomControls({ dash }: { dash: DashboardModel }) {
  return (
    <div className="absolute right-3 top-20 z-10 flex flex-col overflow-hidden rounded-xl border border-[#e4dfd4] bg-white/92 shadow-sm">
      <button
        type="button"
        className="h-8 w-8 text-lg text-[#5d574c]"
        onClick={() => dash.adjustZoom(0.6)}
        aria-label="Zoom in"
      >
        +
      </button>
      <div className="h-px bg-[#e4dfd4]" />
      <button
        type="button"
        className="h-8 w-8 text-lg text-[#5d574c]"
        onClick={() => dash.adjustZoom(-0.6)}
        aria-label="Zoom out"
      >
        −
      </button>
    </div>
  )
}

export function MapLegend() {
  const items = [
    { label: 'High', color: '#d83a2f' },
    { label: 'Elevated', color: '#e39b14' },
    { label: 'Watch', color: '#d6b84a' },
    { label: 'Conflict', color: '#d83a2f', ring: true },
    { label: 'Natural', color: '#e56a1a' },
  ]
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1">
      <div className="flex items-center gap-3 rounded-full border border-[#e4dfd4] bg-white/92 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#6d675c] shadow-sm">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: item.ring ? 'transparent' : item.color,
                boxShadow: item.ring ? `inset 0 0 0 1.5px ${item.color}` : undefined,
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="rounded-full border border-[#e4dfd4] bg-white/88 px-2.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#8a8376]">
        Live USGS · NWS · Open-Meteo · Sample conflict / sanctions / outages
      </div>
    </div>
  )
}
