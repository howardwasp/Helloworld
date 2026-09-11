export function canUseMapLibre(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl2 = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    if (gl2) return true
    const gl1 = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true })
    return Boolean(gl1)
  } catch {
    return false
  }
}
