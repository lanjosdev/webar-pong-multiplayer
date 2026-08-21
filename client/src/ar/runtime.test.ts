import { afterEach, describe, expect, it, vi } from 'vitest'
import { Material, type Object3D, Scene } from 'three'

import type {
  CameraPipelineModule,
  CameraStatus,
  ImageTargetData,
  XrEngine,
} from './engine-contract'
import type { XrEngineLoader } from './engine-loader'
import type { ImageTargetDataLoader } from './image-target-data'
import { createArRuntime } from './runtime'
import type {
  ArRuntimeState,
  TrackingLabConfig,
  TrackingSnapshot,
  TrackingTimelineEvent,
} from './types'

class FakeEngine implements XrEngine {
  readonly calls: string[] = []
  readonly GlTextureRenderer = {
    pipelineModule: () => {
      this.calls.push('gl.pipeline')
      return { name: 'gl' }
    },
  }
  readonly scene = new Scene()
  readonly Threejs = {
    configure: (options: { renderCameraTexture: boolean }) => {
      this.calls.push(`three.configure:${String(options.renderCameraTexture)}`)
    },
    pipelineModule: () => {
      this.calls.push('three.pipeline')
      return { name: 'threejs' }
    },
    xrScene: () => ({ scene: this.scene }),
  }
  readonly XrController = {
    configure: (options: {
      disableWorldTracking: boolean
      imageTargetData: ImageTargetData[]
      scale?: 'absolute' | 'responsive'
    }) => {
      this.calls.push(
        `xr.configure:${String(options.disableWorldTracking)}:${options.imageTargetData[0]?.name ?? ''}${options.scale ? `:${options.scale}` : ''}`,
      )
    },
    pipelineModule: () => {
      this.calls.push('xr.pipeline')
      return { name: 'reality' }
    },
  }
  readonly XrConfig = {
    camera: () => ({ BACK: 'back' }),
    device: () => ({ MOBILE: 'mobile' }),
  }
  modules: CameraPipelineModule[] = []
  runOptions: Parameters<XrEngine['run']>[0] | null = null

  addCameraPipelineModules(modules: CameraPipelineModule[]): void {
    this.calls.push('add-modules')
    this.modules = modules
  }

  removeCameraPipelineModules(modules: CameraPipelineModule[]): void {
    this.calls.push(`remove-modules:${String(modules.length)}`)
    this.modules = []
  }

  run(options: Parameters<XrEngine['run']>[0]): void {
    this.calls.push('run')
    this.runOptions = options
    for (const module of this.modules) {
      module.onStart?.({})
    }
  }

  pause(): void {
    this.calls.push('pause')
    for (const module of this.modules) {
      module.onPaused?.()
    }
  }

  resume(): void {
    this.calls.push('resume')
    for (const module of this.modules) {
      module.onResume?.()
    }
  }

  stop(): void {
    this.calls.push('stop')
    for (const module of this.modules) {
      module.onDetach?.()
    }
  }

  emitCameraStatus(status: CameraStatus): void {
    this.lifecycle()?.onCameraStatusChange?.({ status })
  }

  emitAttach(stream: MediaStream): void {
    this.lifecycle()?.onAttach?.({ stream })
  }

  emitException(error: unknown): void {
    this.lifecycle()?.onException?.(error)
  }

  emitVideoSize(videoWidth: number, videoHeight: number): void {
    this.lifecycle()?.onVideoSizeChange?.({ videoHeight, videoWidth })
  }

  emitPipelineEvent(event: string, detail: unknown): void {
    for (const module of this.modules) {
      for (const listener of module.listeners ?? []) {
        if (listener.event === event) {
          listener.process({ detail, name: event })
        }
      }
    }
  }

  emitUpdate(): void {
    for (const module of this.modules) {
      module.onUpdate?.({})
    }
  }

  private lifecycle(): CameraPipelineModule | undefined {
    return this.modules.find((module) => module.name === 'webar-runtime-lifecycle')
  }
}

const imageTarget: ImageTargetData = {
  imagePath: '/image-targets/pong-marker-v2/pong-marker-v2_luminance.png',
  metadata: null,
  name: 'pong-marker-v2',
  properties: { height: 1448, width: 1086 },
  type: 'PLANAR',
}

class FakeImageTargetLoader implements ImageTargetDataLoader {
  loadCount = 0

  load(): Promise<ImageTargetData> {
    this.loadCount += 1
    return Promise.resolve(imageTarget)
  }
}

class FakeLoader implements XrEngineLoader {
  loadCount = 0
  disposeCount = 0

  constructor(private readonly engine: XrEngine) {}

  load(): Promise<XrEngine> {
    this.loadCount += 1
    return Promise.resolve(this.engine)
  }

  dispose(): void {
    this.disposeCount += 1
  }
}

function setVisibility(value: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
}

function materialOpacities(object: Object3D | undefined): number[] {
  const opacities: number[] = []
  object?.traverse((child) => {
    const value = Reflect.get(child, 'material') as unknown
    const materials = Array.isArray(value) ? value : [value]
    for (const material of materials) {
      if (material instanceof Material) {
        opacities.push(material.opacity)
      }
    }
  })
  return opacities
}

function setup() {
  const engine = new FakeEngine()
  const loader = new FakeLoader(engine)
  const imageTargetLoader = new FakeImageTargetLoader()
  const runtime = createArRuntime({
    document,
    imageTargetLoader,
    isEnvironmentSupported: () => null,
    loader,
    window,
  })
  const states: ArRuntimeState[] = []
  runtime.subscribe((state) => states.push(state))
  return { engine, imageTargetLoader, loader, runtime, states }
}

const worldRelativeLabConfig: TrackingLabConfig = {
  cameraDistanceMeters: 1.25,
  enabled: true,
  fieldLengthMeters: 1,
  mode: 'world-relative',
  targetHeightMeters: 0.26,
  targetWidthMeters: 0.195,
  trialScenario: 'movement',
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  setVisibility('visible')
  document.body.replaceChildren()
})

describe('createArRuntime', () => {
  it('preloads the engine without opening the camera', async () => {
    const { engine, imageTargetLoader, loader, runtime, states } = setup()

    await runtime.preload()

    expect(loader.loadCount).toBe(1)
    expect(imageTargetLoader.loadCount).toBe(1)
    expect(engine.calls).toEqual([])
    expect(states.at(-1)).toEqual({ status: 'camera-permission' })
    runtime.dispose()
  })

  it('configures image tracking mode before creating and running the pipeline', async () => {
    const { engine, runtime, states } = setup()
    const canvas = document.createElement('canvas')
    await runtime.preload()

    const started = runtime.start(canvas)
    engine.emitCameraStatus('hasVideo')
    await started

    expect(engine.calls).toEqual([
      'xr.configure:true:pong-marker-v2',
      'three.configure:false',
      'gl.pipeline',
      'xr.pipeline',
      'three.pipeline',
      'add-modules',
      'run',
    ])
    expect(engine.runOptions).toMatchObject({
      allowedDevices: 'mobile',
      cameraConfig: { direction: 'back' },
      glContextConfig: { alpha: false, preserveDrawingBuffer: false },
    })
    expect(engine.runOptions?.canvas).toBe(canvas)
    expect(canvas.width).toBeGreaterThan(0)
    expect(canvas.height).toBeGreaterThan(0)
    engine.emitVideoSize(1920, 1080)
    const protectedWidth = canvas.style.getPropertyValue('--camera-canvas-width')
    const protectedHeight = canvas.style.getPropertyValue('--camera-canvas-height')
    expect(Number.parseFloat(protectedWidth)).toBeLessThanOrEqual(window.innerWidth)
    expect(Number.parseFloat(protectedHeight)).toBeLessThanOrEqual(window.innerHeight)
    expect(canvas.width / canvas.height).toBeCloseTo(1920 / 1080, 2)

    // Reproduce WebGLRenderer.setSize() updating the normal inline style. The
    // protected dimensions remain available to the !important stylesheet rule.
    canvas.style.width = `${String(canvas.width)}px`
    canvas.style.height = `${String(canvas.height)}px`
    expect(canvas.style.getPropertyValue('--camera-canvas-width')).toBe(protectedWidth)
    expect(canvas.style.getPropertyValue('--camera-canvas-height')).toBe(protectedHeight)
    expect(states.at(-1)).toEqual({ status: 'camera-active' })
    runtime.dispose()
  })

  it('maps a failed camera request and retries without duplicating modules', async () => {
    const { engine, runtime, states } = setup()
    const canvas = document.createElement('canvas')
    await runtime.preload()

    const firstStart = runtime.start(canvas)
    engine.emitCameraStatus('failed')
    await expect(firstStart).rejects.toThrow('bloqueada')

    const retry = runtime.retry()
    expect(engine.calls.filter((call) => call === 'run')).toHaveLength(2)
    expect(engine.calls).toContain('remove-modules:5')
    engine.emitCameraStatus('hasVideo')
    await retry

    expect(states.at(-1)).toEqual({ status: 'camera-active' })
    runtime.dispose()
  })

  it('reuses the camera stream as a decorative backdrop and removes it on stop', async () => {
    const { engine, runtime } = setup()
    const canvas = document.createElement('canvas')
    document.body.append(canvas)
    const stream = {} as MediaStream
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    await runtime.preload()

    const started = runtime.start(canvas)
    engine.emitAttach(stream)
    engine.emitCameraStatus('hasVideo')
    await started

    const backdrop = document.querySelector<HTMLVideoElement>('.camera-backdrop')
    expect(backdrop?.nextElementSibling).toBe(canvas)
    expect(backdrop?.srcObject).toBe(stream)
    expect(backdrop?.autoplay).toBe(false)
    expect(backdrop?.muted).toBe(true)
    expect(backdrop?.playsInline).toBe(true)
    expect(backdrop?.hidden).toBe(true)
    expect(play).not.toHaveBeenCalled()

    engine.emitPipelineEvent('reality.imagefound', {
      name: 'pong-marker-v2',
      position: { x: 1, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    expect(backdrop?.hidden).toBe(false)
    expect(play).toHaveBeenCalledOnce()

    engine.emitPipelineEvent('reality.imagescanning', {})
    expect(backdrop?.hidden).toBe(true)
    expect(pause).toHaveBeenCalledOnce()

    runtime.stop()

    expect(document.querySelector('.camera-backdrop')).toBeNull()
    expect(pause).toHaveBeenCalledTimes(2)
    expect(backdrop?.srcObject).toBeNull()
    runtime.dispose()
  })

  it('pauses and resumes the session across page visibility changes', async () => {
    const { engine, runtime, states } = setup()
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitCameraStatus('hasVideo')
    await started

    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(engine.calls).toContain('pause')
    expect(engine.calls).toContain('resume')
    expect(states.map((state) => state.status)).toEqual(
      expect.arrayContaining(['paused', 'recovering', 'camera-active']),
    )
    runtime.dispose()
  })

  it('maps image target scanning, found, lost and reacquired states', async () => {
    vi.useFakeTimers()
    const { engine, runtime, states } = setup()
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitCameraStatus('hasVideo')
    await started

    engine.emitPipelineEvent('reality.imagescanning', {})
    engine.emitPipelineEvent('reality.imagefound', {
      name: 'pong-marker-v2',
      position: { x: 1, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    expect(engine.scene.children[0]?.visible).toBe(true)
    expect(engine.scene.children[0]?.position.toArray()).toEqual([1, 2, 3])
    engine.emitPipelineEvent('reality.imageupdated', {
      name: 'pong-marker-v2',
      position: { x: 2, y: 3, z: 4 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    expect(engine.scene.children[0]?.position.toArray()).toEqual([2, 3, 4])
    engine.emitPipelineEvent('reality.imagelost', { name: 'pong-marker-v2' })
    expect(engine.scene.children[0]?.visible).toBe(true)
    vi.advanceTimersByTime(299)
    expect(engine.scene.children[0]?.visible).toBe(true)
    engine.emitPipelineEvent('reality.imageupdated', {
      name: 'pong-marker-v2',
      position: { x: 2, y: 3, z: 4 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    vi.advanceTimersByTime(1)
    expect(engine.scene.children[0]?.visible).toBe(true)
    engine.emitPipelineEvent('reality.imagelost', { name: 'pong-marker-v2' })
    vi.advanceTimersByTime(300)
    expect(engine.scene.children[0]?.visible).toBe(false)
    engine.emitPipelineEvent('reality.imagefound', {
      name: 'pong-marker-v2',
      position: { x: 1, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    expect(engine.scene.children[0]?.visible).toBe(true)

    expect(states.map(({ status }) => status)).toEqual(
      expect.arrayContaining(['searching-target', 'target-found', 'target-lost']),
    )
    expect(states.filter(({ status }) => status === 'target-found')).toHaveLength(2)
    expect(states.at(-1)).toEqual({ status: 'target-found', targetName: 'pong-marker-v2' })
    runtime.dispose()
  })

  it('keeps the calibration field visible after image loss while world tracking is normal', async () => {
    vi.useFakeTimers()
    const { engine, runtime } = setup()
    const snapshots: TrackingSnapshot[] = []
    runtime.configureTrackingLab(worldRelativeLabConfig)
    runtime.subscribeTracking((snapshot) => snapshots.push(snapshot))
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitCameraStatus('hasVideo')
    await started

    expect(engine.calls).toContain('xr.configure:false:pong-marker-v2:responsive')
    engine.emitPipelineEvent('reality.trackingstatus', { reason: 'UNDEFINED', status: 'NORMAL' })
    engine.emitPipelineEvent('reality.imagefound', {
      name: 'pong-marker-v2',
      position: { x: 1, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    const root = engine.scene.getObjectByName('tracked-experience-root')
    expect(root?.visible).toBe(true)

    engine.emitPipelineEvent('reality.imagelost', { name: 'pong-marker-v2' })
    vi.advanceTimersByTime(300)

    expect(root?.visible).toBe(true)
    expect(snapshots.at(-1)).toMatchObject({ targetStatus: 'lost', worldStatus: 'normal' })
    runtime.dispose()
  })

  it('validates divergent image updates and reanchors the relative field automatically', async () => {
    vi.useFakeTimers()
    const { engine, runtime } = setup()
    const snapshots: TrackingSnapshot[] = []
    const events: TrackingTimelineEvent[] = []
    runtime.configureTrackingLab(worldRelativeLabConfig)
    runtime.subscribeTracking((snapshot) => snapshots.push(snapshot))
    runtime.subscribeTrackingEvents((event) => events.push(event))
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitCameraStatus('hasVideo')
    await started
    engine.emitPipelineEvent('reality.trackingstatus', { reason: 'UNDEFINED', status: 'NORMAL' })
    const pose = (x: number) => ({
      name: 'pong-marker-v2',
      position: { x, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    engine.emitPipelineEvent('reality.imagefound', pose(1))
    const root = engine.scene.getObjectByName('tracked-experience-root')

    engine.emitPipelineEvent('reality.imageupdated', pose(2))
    expect(snapshots.at(-1)).toMatchObject({
      anchorStatus: 'validating',
      candidateSampleCount: 1,
    })
    vi.advanceTimersByTime(75)
    engine.emitPipelineEvent('reality.imageupdated', pose(2))
    vi.advanceTimersByTime(75)
    engine.emitPipelineEvent('reality.imageupdated', pose(2))

    expect(root?.position.x).toBe(1)
    expect(snapshots.at(-1)).toMatchObject({ anchorStatus: 'reanchoring' })
    const field = engine.scene.getObjectByName('tracking-lab-calibration-field')
    vi.advanceTimersByTime(75)
    engine.emitUpdate()
    expect(Math.max(...materialOpacities(field))).toBeCloseTo(0.5, 5)
    expect(root?.position.x).toBe(1)
    vi.advanceTimersByTime(75)
    engine.emitUpdate()
    expect(root?.position.x).toBe(2)
    expect(snapshots.at(-1)).toMatchObject({ automaticReanchorCount: 0 })
    vi.advanceTimersByTime(250)
    engine.emitUpdate()
    expect(Math.max(...materialOpacities(field))).toBe(1)
    expect(snapshots.at(-1)).toMatchObject({
      anchorStatus: 'aligned',
      automaticReanchorCount: 1,
    })
    expect(events.filter((event) => event.kind === 'image-updated')).toHaveLength(3)
    expect(
      events.filter((event) => event.kind === 'anchor-state').map((event) => event.anchorStatus),
    ).toEqual(expect.arrayContaining(['validating', 'reanchoring', 'aligned']))
    expect(events.map((event) => event.sequence)).toEqual(events.map((_, index) => index + 1))
    runtime.dispose()
  })

  it('interpolates a confirmed small correction after relative target reacquisition', async () => {
    vi.useFakeTimers()
    const { engine, runtime } = setup()
    const snapshots: TrackingSnapshot[] = []
    runtime.configureTrackingLab(worldRelativeLabConfig)
    runtime.subscribeTracking((snapshot) => snapshots.push(snapshot))
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitCameraStatus('hasVideo')
    await started
    engine.emitPipelineEvent('reality.trackingstatus', { reason: 'UNDEFINED', status: 'NORMAL' })
    const pose = (x: number) => ({
      name: 'pong-marker-v2',
      position: { x, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    engine.emitPipelineEvent('reality.imagefound', pose(1))
    const root = engine.scene.getObjectByName('tracked-experience-root')
    engine.emitPipelineEvent('reality.imagelost', { name: 'pong-marker-v2' })
    vi.advanceTimersByTime(75)
    engine.emitPipelineEvent('reality.imagefound', pose(1.1))
    expect(snapshots.at(-1)).toMatchObject({
      anchorStatus: 'validating',
      candidateSampleCount: 1,
    })
    vi.advanceTimersByTime(75)
    engine.emitPipelineEvent('reality.imageupdated', pose(1.1))
    vi.advanceTimersByTime(75)
    engine.emitPipelineEvent('reality.imageupdated', pose(1.1))

    expect(root?.position.x).toBe(1)
    expect(snapshots.at(-1)?.anchorStatus).toBe('validating')
    vi.advanceTimersByTime(375)
    engine.emitUpdate()
    expect(root?.position.x).toBeCloseTo(1.05, 5)
    expect(snapshots.at(-1)?.anchorStatus).toBe('validating')
    vi.advanceTimersByTime(375)
    engine.emitUpdate()
    expect(root?.position.x).toBeCloseTo(1.1, 5)
    expect(snapshots.at(-1)?.anchorStatus).toBe('aligned')
    runtime.dispose()
  })

  it('does not reanchor from an isolated or inconsistent relative pose', async () => {
    vi.useFakeTimers()
    const { engine, runtime } = setup()
    const snapshots: TrackingSnapshot[] = []
    runtime.configureTrackingLab(worldRelativeLabConfig)
    runtime.subscribeTracking((snapshot) => snapshots.push(snapshot))
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitCameraStatus('hasVideo')
    await started
    engine.emitPipelineEvent('reality.trackingstatus', { reason: 'UNDEFINED', status: 'NORMAL' })
    const pose = (x: number) => ({
      name: 'pong-marker-v2',
      position: { x, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    engine.emitPipelineEvent('reality.imagefound', pose(1))
    const root = engine.scene.getObjectByName('tracked-experience-root')

    engine.emitPipelineEvent('reality.imageupdated', pose(2))
    vi.advanceTimersByTime(75)
    engine.emitPipelineEvent('reality.imageupdated', pose(2.5))
    expect(snapshots.at(-1)).toMatchObject({
      anchorStatus: 'validating',
      automaticReanchorCount: 0,
      candidateSampleCount: 1,
    })
    vi.advanceTimersByTime(601)
    engine.emitPipelineEvent('reality.imageupdated', pose(2.5))
    vi.advanceTimersByTime(400)
    engine.emitUpdate()

    expect(root?.position.x).toBe(1)
    expect(snapshots.at(-1)?.automaticReanchorCount).toBe(0)
    runtime.dispose()
  })

  it('queues manual relative calibration without applying the stored pose', async () => {
    vi.useFakeTimers()
    const { engine, runtime } = setup()
    const snapshots: TrackingSnapshot[] = []
    runtime.configureTrackingLab(worldRelativeLabConfig)
    runtime.subscribeTracking((snapshot) => snapshots.push(snapshot))
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitCameraStatus('hasVideo')
    await started
    engine.emitPipelineEvent('reality.trackingstatus', { reason: 'UNDEFINED', status: 'NORMAL' })
    engine.emitPipelineEvent('reality.imagefound', {
      name: 'pong-marker-v2',
      position: { x: 1, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    const root = engine.scene.getObjectByName('tracked-experience-root')

    runtime.recalibrateTracking()

    expect(root?.position.toArray()).toEqual([1, 2, 3])
    expect(snapshots.at(-1)).toMatchObject({
      anchorStatus: 'validating',
      candidateSampleCount: 0,
    })
    runtime.dispose()
  })

  it('freezes relative validation while world tracking remains limited', async () => {
    vi.useFakeTimers()
    const { engine, runtime } = setup()
    const snapshots: TrackingSnapshot[] = []
    runtime.configureTrackingLab(worldRelativeLabConfig)
    runtime.subscribeTracking((snapshot) => snapshots.push(snapshot))
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitCameraStatus('hasVideo')
    await started
    engine.emitPipelineEvent('reality.trackingstatus', { reason: 'UNDEFINED', status: 'NORMAL' })
    engine.emitPipelineEvent('reality.imagefound', {
      name: 'pong-marker-v2',
      position: { x: 1, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    engine.emitPipelineEvent('reality.trackingstatus', {
      reason: 'INSUFFICIENT_FEATURES',
      status: 'LIMITED',
    })
    vi.advanceTimersByTime(1000)
    engine.emitPipelineEvent('reality.trackingstatus', {
      reason: 'INSUFFICIENT_FEATURES',
      status: 'LIMITED',
    })
    vi.advanceTimersByTime(500)

    expect(snapshots.at(-1)).toMatchObject({
      anchorStatus: 'frozen',
      worldLimitedExceeded: true,
    })
    engine.emitPipelineEvent('reality.trackingstatus', { reason: 'UNDEFINED', status: 'NORMAL' })
    expect(snapshots.at(-1)).toMatchObject({ anchorStatus: 'aligned', worldStatus: 'normal' })
    runtime.dispose()
  })

  it('configures absolute scale for the absolute-world laboratory mode', async () => {
    const { engine, runtime } = setup()
    runtime.configureTrackingLab({ ...worldRelativeLabConfig, mode: 'world-absolute' })
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitCameraStatus('hasVideo')
    await started

    expect(engine.calls).toContain('xr.configure:false:pong-marker-v2:absolute')
    engine.emitPipelineEvent('reality.trackingstatus', { reason: 'UNDEFINED', status: 'NORMAL' })
    engine.emitPipelineEvent('reality.imagefound', {
      name: 'pong-marker-v2',
      position: { x: 1, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    const root = engine.scene.getObjectByName('tracked-experience-root')
    engine.emitPipelineEvent('reality.imageupdated', {
      name: 'pong-marker-v2',
      position: { x: 2, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: 2,
      scaledHeight: 1,
      scaledWidth: 0.75,
    })
    expect(root?.position.x).toBe(1)
    runtime.dispose()
  })

  it('reports runtime exceptions and releases resources idempotently', async () => {
    const { engine, loader, runtime, states } = setup()
    await runtime.preload()
    const started = runtime.start(document.createElement('canvas'))
    engine.emitException(new Error('pipeline failed'))

    await expect(started).rejects.toThrow('pipeline failed')
    expect(states.at(-1)).toEqual({ status: 'fatal-error', message: 'pipeline failed' })

    runtime.dispose()
    runtime.dispose()

    expect(engine.calls.filter((call) => call === 'stop')).toHaveLength(1)
    expect(loader.disposeCount).toBe(1)
    expect(states.at(-1)).toEqual({ status: 'disposed' })
  })

  it('reports an unsupported environment without loading the engine', async () => {
    const engine = new FakeEngine()
    const loader = new FakeLoader(engine)
    const runtime = createArRuntime({
      document,
      imageTargetLoader: new FakeImageTargetLoader(),
      isEnvironmentSupported: () => 'HTTPS obrigatório.',
      loader,
      window,
    })
    const states: ArRuntimeState[] = []
    runtime.subscribe((state) => states.push(state))

    await runtime.preload()

    expect(loader.loadCount).toBe(0)
    expect(states.at(-1)).toEqual({ status: 'unsupported', message: 'HTTPS obrigatório.' })
    runtime.dispose()
  })
})
