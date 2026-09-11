/** Inflate the first file of a single-entry ZIP (GDELT 15-minute exports). */

export async function unzipFirstFile(buffer: ArrayBuffer): Promise<string> {
  const view = new DataView(buffer)
  if (view.byteLength < 30 || view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('Not a ZIP archive')
  }
  const method = view.getUint16(8, true)
  const compSize = view.getUint32(18, true)
  const nameLen = view.getUint16(26, true)
  const extraLen = view.getUint16(28, true)
  const start = 30 + nameLen + extraLen
  if (start + compSize > view.byteLength) {
    throw new Error('ZIP entry truncated')
  }
  const compressed = buffer.slice(start, start + compSize)
  if (method === 0) {
    return new TextDecoder('utf-8').decode(compressed)
  }
  if (method === 8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Deflate ZIP is not supported in this browser')
    }
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return await new Response(stream).text()
  }
  throw new Error(`Unsupported ZIP method ${method}`)
}
