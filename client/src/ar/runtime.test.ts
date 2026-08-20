import { afterEach, describe, expect, it } from 'vitest'

import type { CameraPipelineModule, CameraStatus, XrEngine } from './engine-contract'
import type { XrEngineLoader } from './engine-loader'
import { createArRuntime } from './runtime'
import type { ArRuntimeState } from './types'

class FakeEngine implements XrEngine {
  readonly calls: string[] = []
  readonly GlTextureRenderer = {
    pipelineModule: () => {
      this.calls.push('gl.pipeline')
      return { name: 'gl' }
    },
  }
  readonly XrController = {
    configure: (options: { disableWorldTracking: boolean }) => {
      this.calls.push(`xr.configure:${String(options.disableWorldTracking)}`)
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
  }

  pause(): void {
    this.calls.push('pause')
  }

  resume(): void {
    this.calls.push('resume')
    this.lifecycle()?.onResume?.()
  }

  stop(): void {
    this.calls.push('stop')
  }

  emitCameraStatus(status: CameraStatus): void {
    this.lifecycle()?.onCameraStatusChange?.({ status })
  }

  emitException(error: unknown): void {
    this.lifecycle()?.onException?.(error)
  }

  private lifecycle(): CameraPipelineModule | undefined {
    return this.modules.find((module) => module.name === 'webar-runtime-lifecycle')
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

function setup() {
  const engine = new FakeEngine()
  const loader = new FakeLoader(engine)
  const runtime = createArRuntime({
    document,
    isEnvironmentSupported: () => null,
    loader,
    window,
  })
  const states: ArRuntimeState[] = []
  runtime.subscribe((state) => states.push(state))
  return { engine, loader, runtime, states }
}

afterEach(() => {
  setVisibility('visible')
  document.body.replaceChildren()
})

describe('createArRuntime', () => {
  it('preloads the engine without opening the camera', async () => {
    const { engine, loader, runtime, states } = setup()

    await runtime.preload()

    expect(loader.loadCount).toBe(1)
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
      'xr.configure:true',
      'gl.pipeline',
      'xr.pipeline',
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
    expect(engine.calls).toContain('remove-modules:3')
    engine.emitCameraStatus('hasVideo')
    await retry

    expect(states.at(-1)).toEqual({ status: 'camera-active' })
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
