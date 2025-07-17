import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Extend global interface
declare global {
  var vi: typeof import('vitest').vi
}

// Make vi globally available
globalThis.vi = vi

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock DragEvent
global.DragEvent = vi.fn().mockImplementation((type, eventInitDict) => {
  const event = new Event(type, eventInitDict)
  Object.assign(event, {
    dataTransfer: {
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
      setDragImage: vi.fn(),
    }
  })
  return event
})
