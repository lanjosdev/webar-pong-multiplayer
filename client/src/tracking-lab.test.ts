import { describe, expect, it } from 'vitest'

import type { TrackingSnapshot, TrackingVector3 } from './ar'
import { DEFAULT_TRACKING_LAB_CONFIG, reportFilename, TrackingTrialRecorder } from './tracking-lab'

function corners(offset: number): TrackingVector3[] {
  return [
    { x: offset, y: 0, z: 0 },
    { x: 1 + offset, y: 0, z: 0 },
    { x: 1 + offset, y: 2, z: 0 },
    { x: offset, y: 2, z: 0 },
  ]
}

function snapshot(
  timestampMs: number,
  overrides: Partial<TrackingSnapshot> = {},
): TrackingSnapshot {
  return {
    fieldCorners: corners(0),
    framesPerSecond: 60,
    metersPerSceneUnit: 1,
    recalibrationRequired: false,
    targetPose: null,
    targetStatus: 'visible',
    timestampMs,
    worldLimitedExceeded: false,
    worldReason: null,
    worldStatus: 'normal',
    ...overrides,
  }
}

describe('TrackingTrialRecorder', () => {
  it('calculates acquisition, loss, jitter, drift and SLAM metrics', () => {
    const recorder = new TrackingTrialRecorder()
    recorder.start(
      DEFAULT_TRACKING_LAB_CONFIG,
      {
        browser: 'test-browser',
        device: 'test-device',
        orientation: 'portrait',
        viewportHeight: 800,
        viewportWidth: 400,
      },
      new Date(1000),
    )

    recorder.add(snapshot(1500))
    recorder.add(
      snapshot(1600, {
        fieldCorners: corners(0.01),
        framesPerSecond: 30,
        targetStatus: 'lost',
        worldStatus: 'limited',
      }),
    )
    recorder.add(snapshot(1900, { fieldCorners: corners(0.01) }))
    const report = recorder.finish(new Date(2000))

    expect(report.metrics.acquisitionTimeMs).toBe(500)
    expect(report.metrics.completedLossCount).toBe(1)
    expect(report.metrics.maximumLossDurationMs).toBe(300)
    expect(report.metrics.jitterP95Meters).toBeCloseTo(0.0067, 3)
    expect(report.metrics.driftMeters).toBeCloseTo(0.01, 5)
    expect(report.metrics.worldLimitedDurationMs).toBe(300)
    expect(report.metrics.medianFramesPerSecond).toBe(60)
    expect(report.schemaVersion).toBe(1)
    expect(recorder.isRecording).toBe(false)
  })

  it('converts responsive scene units to meters before calculating corner metrics', () => {
    const recorder = new TrackingTrialRecorder()
    recorder.start(
      DEFAULT_TRACKING_LAB_CONFIG,
      {
        browser: 'test-browser',
        device: 'test-device',
        orientation: 'portrait',
        viewportHeight: 800,
        viewportWidth: 400,
      },
      new Date(1000),
    )
    recorder.add(snapshot(1100, { fieldCorners: corners(0), metersPerSceneUnit: 0.5 }))
    recorder.add(snapshot(1200, { fieldCorners: corners(0.02), metersPerSceneUnit: 0.5 }))

    const report = recorder.finish(new Date(1300))
    expect(report.metrics.driftMeters).toBeCloseTo(0.01, 5)
  })

  it('creates stable descriptive report filenames', () => {
    const recorder = new TrackingTrialRecorder()
    recorder.start(
      { ...DEFAULT_TRACKING_LAB_CONFIG, mode: 'world-relative' },
      {
        browser: 'test-browser',
        device: 'test-device',
        orientation: 'landscape',
        viewportHeight: 400,
        viewportWidth: 800,
      },
      new Date('2026-08-20T12:34:56.000Z'),
    )
    const report = recorder.finish(new Date('2026-08-20T12:35:00.000Z'))
    expect(reportFilename(report)).toBe('tracking-world-relative-1.5m-2026-08-20T12-34-56-000.json')
  })
})
