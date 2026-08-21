import { afterEach, describe, expect, it } from 'vitest'

import type {
  ArRuntime,
  ArRuntimeListener,
  ArRuntimeState,
  TrackingLabConfig,
  TrackingSnapshot,
  TrackingSnapshotListener,
  TrackingTimelineEventListener,
} from './ar'
import { mountApp } from './app'

class FakeRuntime implements ArRuntime {
  startCount = 0
  retryCount = 0
  stopCount = 0
  preloadCount = 0
  disposeCount = 0
  trackingConfig: TrackingLabConfig | null = null
  recalibrateCount = 0
  private state: ArRuntimeState = { status: 'booting' }
  private readonly listeners = new Set<ArRuntimeListener>()
  private readonly trackingListeners = new Set<TrackingSnapshotListener>()
  private readonly trackingEventListeners = new Set<TrackingTimelineEventListener>()
  private trackingSnapshot: TrackingSnapshot = {
    anchorAngularErrorDegrees: null,
    anchorStatus: 'uncalibrated',
    anchorTranslationErrorMeters: null,
    automaticReanchorCount: 0,
    candidateSampleCount: 0,
    fieldCorners: [],
    framesPerSecond: null,
    imageEventCounts: { found: 0, lost: 0, updated: 0 },
    lastImageEvent: null,
    lastImageEventAtMs: null,
    metersPerSceneUnit: 1,
    recalibrationRequired: false,
    targetPose: null,
    targetStatus: 'scanning',
    timestampMs: Date.now(),
    worldLimitedExceeded: false,
    worldReason: null,
    worldStatus: 'unavailable',
  }

  configureTrackingLab(config: TrackingLabConfig): void {
    this.trackingConfig = config
  }

  recalibrateTracking(): void {
    this.recalibrateCount += 1
  }

  preload(): Promise<void> {
    this.preloadCount += 1
    this.emit({ status: 'camera-permission' })
    return Promise.resolve()
  }

  start(): Promise<void> {
    this.startCount += 1
    return Promise.resolve()
  }

  retry(): Promise<void> {
    this.retryCount += 1
    return Promise.resolve()
  }

  stop(): void {
    this.stopCount += 1
    this.emit({ status: 'camera-permission' })
  }

  subscribe(listener: ArRuntimeListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  subscribeTracking(listener: TrackingSnapshotListener): () => void {
    this.trackingListeners.add(listener)
    listener(this.trackingSnapshot)
    return () => this.trackingListeners.delete(listener)
  }

  subscribeTrackingEvents(listener: TrackingTimelineEventListener): () => void {
    this.trackingEventListeners.add(listener)
    return () => this.trackingEventListeners.delete(listener)
  }

  dispose(): void {
    this.disposeCount += 1
  }

  emit(state: ArRuntimeState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener(state)
    }
  }

  emitTracking(snapshot: Partial<TrackingSnapshot>): void {
    this.trackingSnapshot = { ...this.trackingSnapshot, ...snapshot }
    for (const listener of this.trackingListeners) {
      listener(this.trackingSnapshot)
    }
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('mountApp', () => {
  it('explains camera access and waits for an explicit user action', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    document.body.append(root)

    mountApp(root, { runtime })

    expect(runtime.preloadCount).toBe(1)
    expect(runtime.startCount).toBe(0)
    expect(root.querySelector('h1')?.textContent).toBe('Veja a experiência no seu ambiente')
    expect(root.querySelector<HTMLButtonElement>('.primary-action')?.textContent).toBe(
      'Iniciar experiência',
    )
    expect(root.querySelector('.legal-link')).toBeNull()

    root.querySelector<HTMLButtonElement>('.primary-action')?.click()

    expect(runtime.startCount).toBe(1)
  })

  it('shows a minimal camera HUD and allows the user to stop the session', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    mountApp(root, { runtime })

    runtime.emit({ status: 'searching-target' })

    expect(root.querySelector<HTMLCanvasElement>('.camera-feed')?.hidden).toBe(false)
    expect(root.querySelector<HTMLElement>('.status-panel')?.hidden).toBe(true)
    expect(root.querySelector<HTMLElement>('.camera-hud')?.hidden).toBe(false)
    expect(root.querySelector('.camera-status')?.textContent).toBe('Aponte para o marcador')

    root.querySelector<HTMLButtonElement>('.stop-action')?.click()

    expect(runtime.stopCount).toBe(1)
    expect(root.querySelector<HTMLButtonElement>('.primary-action')?.textContent).toBe(
      'Iniciar experiência',
    )
  })

  it('guides target acquisition, loss and reacquisition in the camera HUD', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    mountApp(root, { runtime })

    runtime.emit({ status: 'target-found', targetName: 'pong-marker-v2' })
    expect(root.querySelector('.camera-status')?.textContent).toBe('Target encontrado')

    runtime.emit({ status: 'target-lost', targetName: 'pong-marker-v2' })
    expect(root.querySelector('.camera-status')?.textContent).toBe('Reenquadre o marcador')

    runtime.emit({ status: 'target-found', targetName: 'pong-marker-v2' })
    expect(root.querySelector('.camera-status')?.textContent).toBe('Target encontrado')
  })

  it('mounts the opt-in tracking lab without changing the normal application', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    mountApp(root, { runtime, trackingLabEnabled: true })

    expect(root.querySelector('.tracking-lab')).not.toBeNull()
    expect(runtime.trackingConfig).toMatchObject({
      enabled: true,
      fieldLengthMeters: 1,
      mode: 'image-only',
      targetHeightMeters: 0.26,
    })

    const fieldSelect = root.querySelectorAll<HTMLSelectElement>('.lab-field select')[1]
    expect(fieldSelect).toBeDefined()
    expect(fieldSelect?.value).toBe('1')
    expect(fieldSelect?.options).toHaveLength(1)
    expect(runtime.trackingConfig?.fieldLengthMeters).toBe(1)

    runtime.emit({ status: 'searching-target' })
    expect(fieldSelect?.disabled).toBe(true)
    expect(root.querySelector<HTMLButtonElement>('.lab-actions button')?.disabled).toBe(false)
  })

  it('shows independent target and anchor states in the laboratory HUD', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    mountApp(root, { runtime, trackingLabEnabled: true })
    runtime.emit({ status: 'target-lost', targetName: 'pong-marker-v2' })
    runtime.emitTracking({
      anchorStatus: 'aligned',
      targetStatus: 'lost',
      worldStatus: 'normal',
    })
    expect(root.querySelector('.camera-status')?.textContent).toBe(
      'Marcador perdido · campo mantido pelo SLAM',
    )

    runtime.emitTracking({ anchorStatus: 'validating', candidateSampleCount: 2 })
    expect(root.querySelector('.camera-status')?.textContent).toBe('Verificando alinhamento 2/3')

    runtime.emitTracking({ anchorStatus: 'reanchoring', candidateSampleCount: 0 })
    expect(root.querySelector('.camera-status')?.textContent).toBe('Reancorando campo')

    runtime.emitTracking({ anchorStatus: 'aligned', targetStatus: 'visible' })
    expect(root.querySelector('.camera-status')?.textContent).toBe('Target e campo alinhados')
    expect(
      root.querySelector<HTMLButtonElement>('.lab-actions button:last-child')?.textContent,
    ).toBe('Buscar nova calibração')
  })

  it('renders recoverable camera and engine failures', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    mountApp(root, { runtime })

    runtime.emit({ status: 'camera-denied', message: 'denied' })
    expect(root.querySelector('h1')?.textContent).toBe('Não foi possível abrir a câmera')
    root.querySelector<HTMLButtonElement>('.primary-action')?.click()
    expect(runtime.retryCount).toBe(1)

    runtime.emit({ status: 'fatal-error', message: 'Falha de rede no engine.' })
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Falha de rede no engine.')
  })

  it('disposes owned DOM and runtime exactly once', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    const app = mountApp(root, { runtime })

    app.dispose()
    app.dispose()

    expect(root.childElementCount).toBe(0)
    expect(runtime.disposeCount).toBe(1)
  })
})
