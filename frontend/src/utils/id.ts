const fallbackId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

const bytesToUuid = (bytes: Uint8Array) => {
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const createId = () => {
  const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined

  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID()
  }

  if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    cryptoRef.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return bytesToUuid(bytes)
  }

  return fallbackId()
}
