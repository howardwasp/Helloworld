import { LAYER_LABELS, NEWS_SOURCES, SEVERITY_COLORS } from '@/data/catalog'
import { formatRelative } from '@/lib/time'
import type { DashboardModel } from '@/state/useDashboard'
import type { NewsItem } from '@/types/intel'
import { useEffect, useMemo, useState } from 'react'

export function RightPanels({ dash }: { dash: DashboardModel }) {
  const [webcamsOpen, setWebcamsOpen] = useState(false)
  const current = dash.visibleNews[dash.liveIndex % Math.max(dash.visibleNews.length, 1)]

  const newsCount = dash.visibleNews.length
  const setLiveIndex = dash.setLiveIndex

  useEffect(() => {
    if (!dash.livePlaying || newsCount === 0) return
    const id = window.setInterval(() => {
      setLiveIndex((index) => (index + 1) % newsCount)
    }, 4500)
    return () => window.clearInterval(id)
  }, [dash.livePlaying, newsCount, setLiveIndex])

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-[#e4dfd4] bg-[#fbfaf6] lg:h-full lg:max-w-[420px] lg:border-l lg:border-t-0">
      <LiveNews dash={dash} current={current} />
      <NewsList dash={dash} />
      <BriefList dash={dash} />
      <div className="border-t border-[#e4dfd4]">
        <button
          type="button"
          onClick={() => setWebcamsOpen((open) => !open)}
          className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d675c]"
        >
          <span>Live webcams</span>
          <span className="text-[#b2ab9f]">0 · stub</span>
        </button>
        {webcamsOpen && (
          <p className="px-3 pb-3 text-[12px] text-[#8a8376]">
            Camera tiles are a layout stub in v1. Hook a public webcam directory here later.
          </p>
        )}
      </div>
    </aside>
  )
}

function LiveNews({ dash, current }: { dash: DashboardModel; current?: NewsItem }) {
  return (
    <section className="border-b border-[#e4dfd4] bg-white">
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2b2b2b]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e24b3a]" />
          Live news
          <span className="rounded-full bg-[#f3efe6] px-1.5 text-[10px] text-[#8a8376]">
            {dash.visibleNews.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-full border border-[#e4dfd4] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
            onClick={() => dash.setLivePlaying(!dash.livePlaying)}
          >
            {dash.livePlaying ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 py-2">
        {NEWS_SOURCES.map((source) => (
          <button
            key={source.id}
            type="button"
            onClick={() => {
              dash.setNewsSource(source.id)
              dash.setLiveIndex(0)
            }}
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
              dash.newsSource === source.id ? 'text-white' : 'bg-[#f3efe6] text-[#6d675c]'
            }`}
            style={dash.newsSource === source.id ? { background: source.accent } : undefined}
          >
            {source.label}
          </button>
        ))}
      </div>
      <div className="mx-3 mb-3 rounded-2xl border border-[#efe8da] bg-[#fffdf8] px-4 py-8 text-center">
        {dash.livePlaying && current ? (
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#1f7a45]">Live briefing</div>
            <div className="mt-2 text-[16px] font-semibold leading-snug text-[#1f1f1f]">{current.headline}</div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#5d574c]">{current.summary}</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#8a8376]">
              <span className="h-2 w-2 rounded-full bg-[#e24b3a]" />
              Ready when you are
            </div>
            <div className="mt-2 text-[22px] font-semibold tracking-wide text-[#2b2b2b]">
              {dash.newsSource === 'all'
                ? 'Signal desk'
                : NEWS_SOURCES.find((source) => source.id === dash.newsSource)?.label}
            </div>
            <button
              type="button"
              onClick={() => dash.setLivePlaying(true)}
              className="mt-4 rounded-full border border-[#f0c2bd] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c43b32]"
            >
              Play live feed
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function NewsList({ dash }: { dash: DashboardModel }) {
  const items = useMemo(() => dash.visibleNews.slice(0, 8), [dash.visibleNews])
  return (
    <section className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-3 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a8376]">
        Alert cards
      </div>
      <div className="space-y-2 p-3 pt-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-[#efe8da] bg-white p-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8376]">
                {item.source} · {item.region}
                {item.sourceId === 'reuters' ||
                item.sourceId === 'ap' ||
                item.sourceId === 'bbc' ||
                item.sourceId === 'afp' ||
                item.sourceId === 'aljazeera' ||
                item.sourceId === 'nhk' ||
                item.sourceId === 'france24'
                  ? ' · sample'
                  : ''}
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white"
                style={{ background: SEVERITY_COLORS[item.severity] }}
              >
                {item.severity}
              </span>
            </div>
            <h3 className="text-[13px] font-semibold leading-snug text-[#1f1f1f]">{item.headline}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-[#5d574c]">{item.summary}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-[#8a8376]">{formatRelative(item.occurredAt)}</span>
              {item.relatedEventId && (
                <button
                  type="button"
                  className="text-[10px] uppercase tracking-[0.12em] text-[#1f7a45]"
                  onClick={() => {
                    const match = dash.visibleEvents.find((event) => event.id === item.relatedEventId)
                    if (match) dash.selectEvent(match)
                  }}
                >
                  Show on map
                </button>
              )}
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e4dfd4] px-3 py-6 text-center text-[12px] text-[#8a8376]">
            No briefings in this time range or source tab.
          </p>
        )}
      </div>
    </section>
  )
}

function BriefList({ dash }: { dash: DashboardModel }) {
  return (
    <section className="border-t border-[#e4dfd4] bg-white">
      <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a8376]">
        Brief · hotspots
      </div>
      <ol className="space-y-1.5 p-3 pt-2">
        {dash.hotspots.map((event, index) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => dash.selectEvent(event)}
              className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-[#f7f3ea]"
            >
              <span className="mt-0.5 w-4 font-mono text-[10px] text-[#b2ab9f]">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-[#2b2b2b]">{event.title}</span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-[#8a8376]">
                  {LAYER_LABELS[event.layer]} · {formatRelative(event.occurredAt)}
                </span>
              </span>
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ background: SEVERITY_COLORS[event.severity] }}
              />
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
