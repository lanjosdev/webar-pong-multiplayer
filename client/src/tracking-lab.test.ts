import { describe, expect, it } from 'vitest'

import type { TrackingSnapshot, TrackingTimelineEvent, TrackingVector3 } from './ar'
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
    anchorAngularErrorDegrees: null,
    anchorStatus: 'aligned',
    anchorTranslationErrorMeters: null,
    automaticReanchorCount: 0,
    candidateSampleCount: 0,
    fieldCorners: corners(0),
    framesPerSecond: 60,
    imageEventCounts: { found: 1, lost: 0, updated: 0 },
    lastImageEvent: 'found',
    lastImageEventAtMs: timestampMs,
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
    expect(report.schemaVersion).toBe(2)
    expect(recorder.isRecording).toBe(false)
  })

  it('records the event timeline and separates image reacquisition from anchor realignment', () => {
    const recorder = new TrackingTrialRecorder()
    recorder.start(
      { ...DEFAULT_TRACKING_LAB_CONFIG, mode: 'world-relative' },
      {
        browser: 'test-browser',
        device: 'test-device',
        orientation: 'portrait',
        viewportHeight: 800,
        viewportWidth: 400,
      },
      new Date(1000),
    )
    const event = (
      sequence: number,
      timestampMs: number,
      kind: TrackingTimelineEvent['kind'],
      anchorStatus: TrackingTimelineEvent['anchorStatus'],
    ): TrackingTimelineEvent => ({
      anchorAngularErrorDegrees: kind === 'image-updated' ? 4 : null,
      anchorStatus,
      anchorTranslationErrorMeters: kind === 'image-updated' ? 0.08 : null,
      candidateSampleCount: anchorStatus === 'validating' ? 1 : 0,
      kind,
      pose: null,
      sequence,
      targetName: 'pong-marker-v2',
      timestampMs,
      worldStatus: 'normal',
    })
    recorder.addEvent(event(1, 1200, 'image-lost', 'aligned'))
    recorder.addEvent(event(2, 1500, 'image-updated', 'validating'))
    recorder.addEvent(event(3, 1800, 'anchor-state', 'aligned'))
    recorder.add(
      snapshot(1800, {
        anchorAngularErrorDegrees: 4,
        anchorTranslationErrorMeters: 0.08,
        automaticReanchorCount: 1,
        imageEventCounts: { found: 1, lost: 1, updated: 3 },
      }),
    )

    const report = recorder.finish(new Date(2000))

    expect(report.events).toHaveLength(3)
    expect(report.reacquisitions).toEqual([
      {
        alignedAtMs: 1800,
        firstObservationAtMs: 1500,
        imageReacquisitionMs: 300,
        lostAtMs: 1200,
        realignmentMs: 300,
      },
    ])
    expect(report.metrics).toMatchObject({
      automaticReanchorCount: 1,
      imageEventCounts: { found: 1, lost: 1, updated: 3 },
      maximumAnchorAngularErrorDegrees: 4,
      maximumAnchorRealignmentMs: 300,
      maximumAnchorTranslationErrorMeters: 0.08,
      maximumImageReacquisitionMs: 300,
    })
  })

  it('reports image events and automatic reanchors relative to the trial start', () => {
    const recorder = new TrackingTrialRecorder()
    const baseline = snapshot(1000, {
      automaticReanchorCount: 4,
      imageEventCounts: { found: 3, lost: 2, updated: 20 },
    })
    recorder.start(
      { ...DEFAULT_TRACKING_LAB_CONFIG, mode: 'world-relative' },
      {
        browser: 'test-browser',
        device: 'test-device',
        orientation: 'portrait',
        viewportHeight: 800,
        viewportWidth: 400,
      },
      new Date(1000),
      baseline,
    )
    recorder.add(
      snapshot(1500, {
        automaticReanchorCount: 5,
        imageEventCounts: { found: 4, lost: 3, updated: 27 },
      }),
    )

    expect(recorder.finish(new Date(2000)).metrics).toMatchObject({
      automaticReanchorCount: 1,
      imageEventCounts: { found: 1, lost: 1, updated: 7 },
    })
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
    expect(reportFilename(report)).toBe('tracking-world-relative-1m-2026-08-20T12-34-56-000.json')
  })
})
