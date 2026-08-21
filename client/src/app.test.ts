import { afterEach, describe, expect, it } from 'vitest'
import { Group } from 'three'

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
import type {
  LocalPongExperience,
  LocalPongListener,
  LocalPongTrackingState,
  LocalPongViewState,
} from './game/local-pong-experience'

class FakePongExperience implements LocalPongExperience {
  readonly object3d = new Group()
  disposeCount = 0
  moveDeltas: number[] = []
  restartCount = 0
  startCount = 0
  trackingSafety: boolean[] = []
  private readonly listeners = new Set<LocalPongListener>()
  private state: LocalPongViewState = {
    aiScore: 0,
    countdown: null,
    phase: 'ready',
    playerScore: 0,
    pointWinner: null,
    readyAvailable: false,
    trackingPaused: false,
    trackingPauseCause: null,
    trackingSafe: false,
    winner: null,
  }

  dispose(): void {
    this.disposeCount += 1
  }

  movePlayerBy(deltaNormalized: number): void {
    this.moveDeltas.push(deltaNormalized)
  }

  restart(): void {
    this.restartCount += 1
  }

  setDimensions(): void {}

  setOpacity(): void {}

  setTrackingState(state: LocalPongTrackingState): void {
    this.trackingSafety.push(state.safe)
  }

  start(): void {
    this.startCount += 1
  }

  subscribe(listener: LocalPongListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  update(): void {}

  emit(state: Partial<LocalPongViewState>): void {
    this.state = { ...this.state, ...state }
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }
}

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
    anchorCorrectionPending: false,
    anchorStatus: 'uncalibrated',
    anchorTranslationErrorMeters: null,
    anchorValidationOutcome: null,
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
    worldConfidence: 'unavailable',
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
    const inferredConfidence =
      snapshot.worldConfidence === undefined && snapshot.worldStatus === 'normal'
        ? { worldConfidence: 'healthy' as const }
        : {}
    this.trackingSnapshot = { ...this.trackingSnapshot, ...inferredConfidence, ...snapshot }
    for (const listener of this.trackingListeners) {
      listener(this.trackingSnapshot)
    }
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('mountApp', () => {
  const observedTargetPose = {
    name: 'pong-marker-v2',
    position: { x: 0, y: 0, z: 0 },
    rotation: { w: 1, x: 0, y: 0, z: 0 },
    scale: 1,
    scaledHeight: 0.26,
    scaledWidth: 0.195,
  }

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

  it('keeps the public game safe when only the marker leaves the camera', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    const pong = new FakePongExperience()
    mountApp(root, { pongExperience: pong, runtime })

    runtime.emit({ status: 'target-found', targetName: 'pong-marker-v2' })
    runtime.emitTracking({
      anchorStatus: 'aligned',
      targetStatus: 'visible',
      worldStatus: 'normal',
    })
    runtime.emit({ status: 'target-lost', targetName: 'pong-marker-v2' })
    runtime.emitTracking({ targetStatus: 'lost' })

    expect(pong.trackingSafety.at(-1)).toBe(true)
    expect(root.querySelector('.camera-status')?.textContent).toBe('Campo mantido pelo SLAM')

    runtime.emitTracking({ worldConfidence: 'degraded', worldStatus: 'limited' })
    expect(pong.trackingSafety.at(-1)).toBe(true)
    expect(root.querySelector('.camera-status')?.textContent).toBe('Sinal instável · campo mantido')

    runtime.emitTracking({ worldConfidence: 'unsafe' })
    expect(pong.trackingSafety.at(-1)).toBe(false)

    runtime.emitTracking({ anchorStatus: 'reanchoring', worldConfidence: 'healthy' })
    expect(pong.trackingSafety.at(-1)).toBe(false)
    expect(root.querySelector('.camera-status')?.textContent).toBe(
      'Reancorando campo · jogo pausado',
    )
  })

  it('selects the minimal performance profile explicitly', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    mountApp(root, { performanceProfile: 'minimal', runtime })

    expect(root.querySelector<HTMLElement>('.app-shell')?.dataset['performanceProfile']).toBe(
      'minimal',
    )
  })

  it('starts from the blue-side prompt and exposes score and transitions', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    const pong = new FakePongExperience()
    mountApp(root, { pongExperience: pong, runtime })
    runtime.emit({ status: 'target-found', targetName: 'pong-marker-v2' })
    runtime.emitTracking({
      anchorStatus: 'aligned',
      targetPose: observedTargetPose,
      targetStatus: 'visible',
      worldStatus: 'normal',
    })
    expect(root.querySelector<HTMLElement>('.target-guide')?.hidden).toBe(true)

    pong.emit({ readyAvailable: true, trackingSafe: true })
    expect(root.querySelector('.game-message')?.textContent).toBe('Vá para o lado azul')
    expect(root.querySelector<HTMLButtonElement>('.game-action')?.textContent).toBe('Estou pronto')
    root.querySelector<HTMLButtonElement>('.game-action')?.click()
    expect(pong.startCount).toBe(1)

    pong.emit({ aiScore: 3, countdown: 2, phase: 'countdown', playerScore: 4 })
    expect(root.querySelector('.score-player')?.textContent).toBe('4')
    expect(root.querySelector('.score-ai')?.textContent).toBe('3')
    expect(root.querySelector('.game-message')?.textContent).toBe('2')

    pong.emit({ countdown: null, phase: 'finished', winner: 'player' })
    expect(root.querySelector('.game-message')?.textContent).toBe('Azul venceu!')
    root.querySelector<HTMLButtonElement>('.game-action')?.click()
    expect(pong.restartCount).toBe(1)
  })

  it('guides marker acquisition before exposing the ready action', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    const pong = new FakePongExperience()
    mountApp(root, { pongExperience: pong, runtime })
    runtime.emit({ status: 'searching-target' })

    const message = root.querySelector('.game-message')
    const action = root.querySelector<HTMLButtonElement>('.game-action')
    expect(message?.textContent).toBe(
      'Aproxime-se a 0,75–1 m, centralize o marcador e mantenha o celular firme',
    )
    expect(root.querySelector<HTMLElement>('.target-guide')?.hidden).toBe(false)
    expect(action?.hidden).toBe(true)

    runtime.emitTracking({
      anchorStatus: 'validating',
      targetPose: observedTargetPose,
      targetStatus: 'visible',
    })
    expect(message?.textContent).toBe('Mantenha o celular firme enquanto o campo estabiliza')
    expect(action?.hidden).toBe(true)

    runtime.emitTracking({ anchorStatus: 'aligned', worldStatus: 'normal' })
    pong.emit({ readyAvailable: true, trackingSafe: true })
    expect(message?.textContent).toBe('Vá para o lado azul')
    expect(action?.hidden).toBe(false)
    expect(action?.disabled).toBe(false)
    expect(action?.textContent).toBe('Estou pronto')

    runtime.emitTracking({
      anchorStatus: 'uncalibrated',
      targetPose: null,
      targetStatus: 'scanning',
      worldStatus: 'unavailable',
    })
    expect(message?.textContent).toBe(
      'Aproxime-se a 0,75–1 m, centralize o marcador e mantenha o celular firme',
    )
    expect(action?.hidden).toBe(true)

    pong.emit({ phase: 'playing', readyAvailable: false, trackingPaused: true })
    expect(message?.textContent).toBe('Jogo pausado · aponte para o marcador')
  })

  it('maps a horizontal pointer drag to a viewport-relative player movement', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    const pong = new FakePongExperience()
    mountApp(root, { pongExperience: pong, runtime })
    runtime.emit({ status: 'target-found', targetName: 'pong-marker-v2' })
    pong.emit({ phase: 'playing', trackingSafe: true })
    expect(root.querySelector<HTMLElement>('.game-prompt')?.hidden).toBe(true)
    expect(root.querySelector('.touch-hint')?.textContent).toBe('Arraste para mover a raquete')

    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 400,
    })
    const zone = root.querySelector<HTMLElement>('.pong-touch-zone')
    expect(zone).not.toBeNull()
    const pointerEvent = (type: string, clientX: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX })
      Object.defineProperty(event, 'pointerId', { value: 7 })
      return event
    }
    zone?.dispatchEvent(pointerEvent('pointerdown', 100))
    expect(zone?.dataset['dragging']).toBe('true')
    window.dispatchEvent(pointerEvent('pointermove', 200))
    window.dispatchEvent(pointerEvent('pointercancel', 200))
    window.dispatchEvent(pointerEvent('pointermove', 300))

    expect(pong.moveDeltas).toEqual([0.25])
    expect(zone?.dataset['dragging']).toBe('false')
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
    const pong = new FakePongExperience()
    const app = mountApp(root, { pongExperience: pong, runtime })

    app.dispose()
    app.dispose()

    expect(root.childElementCount).toBe(0)
    expect(runtime.disposeCount).toBe(1)
    expect(pong.disposeCount).toBe(1)
  })
})
