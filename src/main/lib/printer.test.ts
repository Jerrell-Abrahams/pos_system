import { describe, expect, it } from 'vitest'
import { isPrintableInterface, normalizePrinterInterface } from './printer'

describe('normalizePrinterInterface', () => {
  it('accepts and trims a network interface', () => {
    expect(normalizePrinterInterface('  tcp://192.168.1.50:9100 ')).toBe('tcp://192.168.1.50:9100')
  })

  it('accepts a serial/COM port path', () => {
    expect(normalizePrinterInterface('\\\\.\\COM3')).toBe('\\\\.\\COM3')
  })

  it('rejects a blank interface', () => {
    expect(() => normalizePrinterInterface('   ')).toThrow(/No printer configured/)
  })

  it('rejects unsupported system-printer (printer:) mode', () => {
    expect(() => normalizePrinterInterface('printer:My Epson')).toThrow(/not supported/)
  })
})

describe('isPrintableInterface', () => {
  it('is true for network and serial interfaces', () => {
    expect(isPrintableInterface('tcp://192.168.1.50:9100')).toBe(true)
    expect(isPrintableInterface('\\\\.\\COM3')).toBe(true)
  })

  it('is false for blank or unsupported interfaces (so the queue drops them)', () => {
    expect(isPrintableInterface('')).toBe(false)
    expect(isPrintableInterface('printer:My Epson')).toBe(false)
  })
})
