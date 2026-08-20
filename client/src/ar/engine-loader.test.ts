import { afterEach, describe, expect, it, vi } from 'vitest'

import { createXrEngineLoader } from './engine-loader'

function engineShape(): unknown {
  return {
    GlTextureRenderer: { pipelineModule: () => ({ name: 'gl' }) },
    XrConfig: {
      camera: () => ({ BACK: 'back' }),
      device: () => ({ MOBILE: 'mobile' }),
    },
    XrController: {
      configure: () => undefined,
      pipelineModule: () => ({ name: 'reality' }),
    },
    addCameraPipelineModules: () => undefined,
    removeCameraPipelineModules: () => undefined,
    run: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    stop: () => undefined,
  }
}

function setGlobalEngine(value?: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(window, 'XR8')
  } else {
    Reflect.set(window, 'XR8', value)
  }
}

afterEach(() => {
  vi.useRealTimers()
  setGlobalEngine()
  document.head.replaceChildren()
})

describe('createXrEngineLoader', () => {
  it('resolves an engine that is already available without adding a script', async () => {
    const engine = engineShape()
    setGlobalEngine(engine)
    const loader = createXrEngineLoader({ baseUrl: '/', document, window })

    await expect(loader.load()).resolves.toBe(engine)
    expect(document.querySelector('script')).toBeNull()
  })

  it('loads the self-hosted engine with the SLAM chunk and waits for xrloaded', async () => {
    const engine = engineShape()
    const loader = createXrEngineLoader({ baseUrl: '/pong/', document, window })
    const loaded = loader.load()
    const script = document.querySelector<HTMLScriptElement>('#xr-engine-script')

    expect(script?.src).toBe('http://localhost:3000/pong/external/xr/xr.js')
    expect(script?.dataset['preloadChunks']).toBe('slam')

    setGlobalEngine(engine)
    window.dispatchEvent(new Event('xrloaded'))

    await expect(loaded).resolves.toBe(engine)
  })

  it('rejects a script download failure and removes the failed element', async () => {
    const loader = createXrEngineLoader({ baseUrl: '/', document, window })
    const loaded = loader.load()
    document
      .querySelector<HTMLScriptElement>('#xr-engine-script')
      ?.dispatchEvent(new Event('error'))

    await expect(loaded).rejects.toMatchObject({ code: 'script-error' })
    expect(document.querySelector('#xr-engine-script')).toBeNull()
  })

  it('rejects when loading exceeds the configured timeout', async () => {
    vi.useFakeTimers()
    const loader = createXrEngineLoader({ baseUrl: '/', document, timeoutMs: 50, window })
    const loaded = loader.load()
    const rejection = expect(loaded).rejects.toMatchObject({ code: 'timeout' })

    await vi.advanceTimersByTimeAsync(50)

    await rejection
  })

  it('settles a pending load when disposed', async () => {
    const loader = createXrEngineLoader({ baseUrl: '/', document, window })
    const loaded = loader.load()

    loader.dispose()

    await expect(loaded).rejects.toMatchObject({ code: 'disposed' })
    await expect(loader.load()).rejects.toMatchObject({ code: 'disposed' })
  })
})
