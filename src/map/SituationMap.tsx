import { CanvasSituationMap } from '@/map/CanvasSituationMap'
import { MapLibreMap, type SituationMapProps } from '@/map/MapLibreMap'
import { canUseMapLibre } from '@/map/webgl'
import { useState } from 'react'

export function SituationMap(props: SituationMapProps) {
  const [engine, setEngine] = useState<'gl' | 'canvas'>(() => (canUseMapLibre() ? 'gl' : 'canvas'))

  if (engine === 'canvas') {
    return <CanvasSituationMap {...props} />
  }

  return <MapLibreMap {...props} onFatal={() => setEngine('canvas')} />
}
