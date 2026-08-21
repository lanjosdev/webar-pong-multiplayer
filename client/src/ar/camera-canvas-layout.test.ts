import { describe, expect, it } from 'vitest'

import { calculateCameraCanvasLayout } from './camera-canvas-layout'

describe('calculateCameraCanvasLayout', () => {
  it('uses the full viewport before the camera dimensions are known', () => {
    expect(
      calculateCameraCanvasLayout({
        devicePixelRatio: 2,
        viewportHeight: 844,
        viewportWidth: 390,
      }),
    ).toEqual({ cssHeight: 844, cssWidth: 390, pixelHeight: 1266, pixelWidth: 585 })
  })

  it('contains a portrait camera feed without cropping its field of view', () => {
    const layout = calculateCameraCanvasLayout({
      devicePixelRatio: 3,
      videoHeight: 1920,
      videoWidth: 1080,
      viewportHeight: 844,
      viewportWidth: 390,
    })

    expect(layout.cssWidth).toBe(390)
    expect(layout.cssHeight).toBeCloseTo(693.33, 2)
    expect(layout.pixelWidth).toBe(585)
    expect(layout.pixelHeight).toBe(1040)
  })

  it('contains the feed after rotation even when sensor dimensions arrive transposed', () => {
    const layout = calculateCameraCanvasLayout({
      devicePixelRatio: 2,
      videoHeight: 1920,
      videoWidth: 1080,
      viewportHeight: 390,
      viewportWidth: 844,
    })

    expect(layout.cssHeight).toBe(390)
    expect(layout.cssWidth).toBeCloseTo(693.33, 2)
    expect(layout.pixelHeight).toBe(585)
    expect(layout.pixelWidth).toBe(1040)
  })

  it('caps the render pixel ratio without changing the logical display size', () => {
    const layout = calculateCameraCanvasLayout({
      devicePixelRatio: 4,
      viewportHeight: 800,
      viewportWidth: 400,
    })

    expect(layout).toEqual({ cssHeight: 800, cssWidth: 400, pixelHeight: 1200, pixelWidth: 600 })
  })

  it('supports a stricter pixel-ratio cap for the minimal performance profile', () => {
    const layout = calculateCameraCanvasLayout({
      devicePixelRatio: 4,
      maximumPixelRatio: 1,
      viewportHeight: 800,
      viewportWidth: 400,
    })

    expect(layout).toEqual({ cssHeight: 800, cssWidth: 400, pixelHeight: 800, pixelWidth: 400 })
  })
})
