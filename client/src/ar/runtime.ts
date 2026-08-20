import type { CameraPipelineModule, CameraStatus, XrEngine } from './engine-contract'
import type { XrEngineLoader } from './engine-loader'
import type { ArRuntime, ArRuntimeListener, ArRuntimeState } from './types'

const LIFECYCLE_MODULE_NAME = 'webar-runtime-lifecycle'

export interface ArRuntimeOptions {
  document: Document
  isEnvironmentSupported?: () => string | null
  loader: XrEngineLoader
  window: Window
}

function defaultEnvironmentIssue(windowRef: Window): string | null {
  if (windowRef.isSecureContext === false) {
    return 'Abra a experiência em uma conexão HTTPS segura.'
  }

  if (typeof windowRef.navigator.mediaDevices?.getUserMedia !== 'function') {
    return 'Este navegador não oferece acesso compatível à câmera.'
  }

  return null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido do runtime WebAR.'
}

export function createArRuntime(options: ArRuntimeOptions): ArRuntime {
  const environmentIssue =
    options.isEnvironmentSupported ?? (() => defaultEnvironmentIssue(options.window))
  const listeners = new Set<ArRuntimeListener>()
  let state: ArRuntimeState = { status: 'booting' }
  let engine: XrEngine | null = null
  let preloadPromise: Promise<void> | null = null
  let startPromise: Promise<void> | null = null
  let settleStart: ((error?: Error) => void) | null = null
  let modules: CameraPipelineModule[] = []
  let canvas: HTMLCanvasElement | null = null
  let running = false
  let disposed = false

  const emit = (nextState: ArRuntimeState) => {
    state = nextState
    for (const listener of listeners) {
      listener(state)
    }
  }

  const settlePendingStart = (error?: Error) => {
    settleStart?.(error)
    settleStart = null
    startPromise = null
  }

  const resizeCanvas = () => {
    if (!canvas) {
      return
    }

    const viewport = options.window.visualViewport
    const cssWidth = viewport?.width ?? options.window.innerWidth
    const cssHeight = viewport?.height ?? options.window.innerHeight
    const pixelRatio = options.window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(cssWidth * pixelRatio))
    const height = Math.max(1, Math.round(cssHeight * pixelRatio))

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }

  const addViewportListeners = () => {
    options.window.addEventListener('resize', resizeCanvas)
    options.window.addEventListener('orientationchange', resizeCanvas)
    options.window.visualViewport?.addEventListener('resize', resizeCanvas)
  }

  const removeViewportListeners = () => {
    options.window.removeEventListener('resize', resizeCanvas)
    options.window.removeEventListener('orientationchange', resizeCanvas)
    options.window.visualViewport?.removeEventListener('resize', resizeCanvas)
  }

  const handleCameraStatus = (status: CameraStatus) => {
    if (!running || disposed) {
      return
    }

    if (status === 'requesting' || status === 'hasStream') {
      emit({ status: 'requesting-camera' })
      return
    }

    if (status === 'hasVideo') {
      emit({ status: 'camera-active' })
      settlePendingStart()
      return
    }

    const error = new Error('A câmera foi bloqueada ou não pôde ser iniciada.')
    emit({ status: 'camera-denied', message: error.message })
    settlePendingStart(error)
    removePipeline(true)
  }

  const handleEngineException = (error: unknown) => {
    if (!running || disposed) {
      return
    }

    const message = errorMessage(error)
    emit({ status: 'fatal-error', message })
    settlePendingStart(new Error(message))
    removePipeline(true)
  }

  const createLifecycleModule = (): CameraPipelineModule => ({
    name: LIFECYCLE_MODULE_NAME,
    onCameraStatusChange: ({ status }) => handleCameraStatus(status),
    onDeviceOrientationChange: resizeCanvas,
    onException: handleEngineException,
    onResume: () => {
      if (running && !disposed) {
        emit({ status: 'camera-active' })
      }
    },
  })

  const removePipeline = (stopEngine: boolean) => {
    removeViewportListeners()

    if (engine && running && stopEngine) {
      try {
        engine.stop()
      } catch {
        // Teardown continues so listeners and modules are never leaked.
      }
    }

    if (engine && modules.length > 0) {
      try {
        engine.removeCameraPipelineModules(modules)
      } catch {
        // Modules may already have been detached by the engine.
      }
    }

    running = false
    modules = []
    settlePendingStart(new Error('The XR session was stopped'))
  }

  const handleVisibilityChange = () => {
    if (!engine || !running || disposed) {
      return
    }

    try {
      if (options.document.visibilityState === 'hidden' && state.status === 'camera-active') {
        engine.pause()
        emit({ status: 'paused' })
      } else if (options.document.visibilityState === 'visible' && state.status === 'paused') {
        emit({ status: 'recovering' })
        engine.resume()
      }
    } catch (error) {
      handleEngineException(error)
    }
  }

  options.document.addEventListener('visibilitychange', handleVisibilityChange)

  const runtime: ArRuntime = {
    async preload() {
      if (disposed) {
        throw new Error('The AR runtime has been disposed')
      }

      const issue = environmentIssue()
      if (issue) {
        emit({ status: 'unsupported', message: issue })
        return
      }

      if (engine) {
        emit({ status: 'camera-permission' })
        return
      }

      if (preloadPromise) {
        return preloadPromise
      }

      emit({ status: 'booting' })
      preloadPromise = (async () => {
        try {
          engine = await options.loader.load()
          if (!disposed) {
            emit({ status: 'camera-permission' })
          }
        } catch (error) {
          const message = errorMessage(error)
          emit({ status: 'fatal-error', message })
          throw error
        } finally {
          preloadPromise = null
        }
      })()

      return preloadPromise
    },

    async start(nextCanvas) {
      if (disposed) {
        throw new Error('The AR runtime has been disposed')
      }

      if (!engine) {
        await runtime.preload()
      }

      if (!engine || state.status === 'unsupported') {
        throw new Error('The XR Engine is not available')
      }

      if (startPromise) {
        return startPromise
      }

      if (running) {
        removePipeline(true)
      }

      canvas = nextCanvas
      resizeCanvas()
      addViewportListeners()
      emit({ status: 'requesting-camera' })

      const pendingStart = new Promise<void>((resolve, reject) => {
        settleStart = (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        }
      })
      startPromise = pendingStart

      try {
        engine.XrController.configure({ disableWorldTracking: true })
        modules = [
          engine.GlTextureRenderer.pipelineModule(),
          engine.XrController.pipelineModule(),
          createLifecycleModule(),
        ]
        engine.addCameraPipelineModules(modules)
        running = true
        engine.run({
          canvas,
          allowedDevices: engine.XrConfig.device().MOBILE,
          cameraConfig: { direction: engine.XrConfig.camera().BACK },
          glContextConfig: { alpha: false, preserveDrawingBuffer: false },
        })
      } catch (error) {
        const message = errorMessage(error)
        emit({ status: 'fatal-error', message })
        settlePendingStart(new Error(message))
        removePipeline(true)
      }

      return pendingStart
    },

    async retry() {
      if (disposed) {
        throw new Error('The AR runtime has been disposed')
      }

      const previousCanvas = canvas
      removePipeline(true)

      if (!engine) {
        await runtime.preload()
        return
      }

      if (previousCanvas) {
        await runtime.start(previousCanvas)
      } else {
        emit({ status: 'camera-permission' })
      }
    },

    stop() {
      if (disposed) {
        return
      }
      removePipeline(true)
      canvas = null
      if (engine) {
        emit({ status: 'camera-permission' })
      }
    },

    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },

    dispose() {
      if (disposed) {
        return
      }
      removePipeline(true)
      options.document.removeEventListener('visibilitychange', handleVisibilityChange)
      options.loader.dispose()
      disposed = true
      canvas = null
      engine = null
      emit({ status: 'disposed' })
      listeners.clear()
    },
  }

  return runtime
}
