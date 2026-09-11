import { LAYER_LABELS, SEVERITY_COLORS } from '@/data/catalog'
import { formatAbsolute, formatRelative } from '@/lib/time'
import type { SelectableFeature } from '@/types/intel'

export function DetailCard({
  feature,
  onClose,
}: {
  feature: SelectableFeature
  onClose: () => void
}) {
  return (
    <aside className="absolute bottom-14 left-3 z-20 w-[min(380px,calc(100%-1.5rem))] rounded-2xl border border-[#e4dfd4] bg-white/96 p-3 shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a8376]">
            {LAYER_LABELS[feature.layer]}
            {feature.country ? ` · ${feature.country}` : ''}
          </div>
          <h2 className="mt-1 text-[15px] font-semibold leading-snug text-[#1f1f1f]">{feature.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-full border border-[#e4dfd4] text-[#6d675c]"
          aria-label="Close detail"
        >
          ×
        </button>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.12em]">
        <span
          className="rounded-full px-2 py-0.5 font-semibold text-white"
          style={{ background: SEVERITY_COLORS[feature.severity] }}
        >
          {feature.severity}
        </span>
        {feature.label && (
          <span className="rounded-full bg-[#f3efe6] px-2 py-0.5 text-[#5d574c]">{feature.label}</span>
        )}
        <span className="text-[#8a8376]">{formatRelative(feature.occurredAt)}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-[#3f3b34]">{feature.description}</p>
      <div className="mt-3 flex items-center justify-between border-t border-[#f0ebe1] pt-2 text-[11px] text-[#8a8376]">
        <span>Source · {feature.source}</span>
        <span className="font-mono">{formatAbsolute(feature.occurredAt)}</span>
      </div>
    </aside>
  )
}
