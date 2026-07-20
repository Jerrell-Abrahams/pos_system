import { describe, expect, it } from 'vitest'
import type { Display } from 'electron'
import { secondaryDisplaysOf } from './customerDisplay'

function fakeDisplay(id: number): Display {
  return { id } as unknown as Display
}

describe('secondaryDisplaysOf', () => {
  it('returns an empty list when only the primary display is connected', () => {
    expect(secondaryDisplaysOf([fakeDisplay(1)], 1)).toEqual([])
  })

  it('returns the non-primary display when exactly one is connected', () => {
    const secondary = fakeDisplay(2)
    expect(secondaryDisplaysOf([fakeDisplay(1), secondary], 1)).toEqual([secondary])
  })

  it('returns all non-primary displays, in order, when multiple are connected', () => {
    const first = fakeDisplay(2)
    const second = fakeDisplay(3)
    expect(secondaryDisplaysOf([fakeDisplay(1), first, second], 1)).toEqual([first, second])
  })
})
