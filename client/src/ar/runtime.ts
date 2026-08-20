import type {
  CameraPipelineModule,
  CameraStatus,
  ImageTargetData,
  XrEngine,
} from './engine-contract'
import { calculateCameraCanvasLayout } from './camera-canvas-layout'
import type { XrEngineLoader } from './engine-loader'
import type { ImageTargetDataLoader } from './image-target-data'
import {
  createImageTargetController,
  type ImageTargetController,
  installThreeGlobal,
  type ThreeGlobalHandle,
} from './image-target-module'
import type {
  ArRuntime,
  ArRuntimeListener,
  ArRuntimeState,
  TrackingLabConfig,
  TrackingSnapshot,
  TrackingSnapshotListener,
} from './types'

const LIFECYCLE_MODULE_NAME = 'webar-runtime-lifecycle'

export interface ArRuntimeOptions {
  document: Document
  imageTargetLoader: ImageTargetDataLoader
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
  const trackingListeners = new Set<TrackingSnapshotListener>()
  let state: ArRuntimeState = { status: 'booting' }
  let engine: XrEngine | null = null
  let imageTargetData: ImageTargetData | null = null
  let preloadPromise: Promise<void> | null = null
  let startPromise: Promise<void> | null = null
  let settleStart: ((error?: Error) => void) | null = null
  let modules: CameraPipelineModule[] = []
  let threeGlobal: ThreeGlobalHandle | null = null
  let imageTargetController: ImageTargetController | null = null
  let canvas: HTMLCanvasElement | null = null
  let cameraBackdrop: HTMLVideoElement | null = null
  let running = false
  let disposed = false
  let trackedTargetName: string | null = null
  let videoSize: { height: number; width: number } | null = null
  let trackingLabConfig: TrackingLabConfig = {
    cameraDistanceMeters: 1.25,
    enabled: false,
    fieldLengthMeters: 1.5,
    mode: 'image-only',
    targetHeightMeters: 0.2,
    targetWidthMeters: 0.15,
    trialScenario: 'acquisition',
  }
  let trackingSnapshot: TrackingSnapshot = {
    fieldCorners: [],
    framesPerSecond: null,
    metersPerSceneUnit: 1,
    recalibrationRequired: false,
    targetPose: null,
    targetStatus: 'scanning',
    timestampMs: Date.now(),
    worldLimitedExceeded: false,
    worldReason: null,
    worldStatus: 'unavailable',
  }

  const emit = (nextState: ArRuntimeState) => {
    state = nextState
    for (const listener of listeners) {
      listener(state)
    }
  }

  const emitTracking = (nextSnapshot: TrackingSnapshot) => {
    trackingSnapshot = nextSnapshot
    for (const listener of trackingListeners) {
      listener(trackingSnapshot)
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
    const layout = calculateCameraCanvasLayout({
      devicePixelRatio: options.window.devicePixelRatio || 1,
      ...(videoSize ? { videoHeight: videoSize.height, videoWidth: videoSize.width } : {}),
      viewportHeight: cssHeight,
      viewportWidth: cssWidth,
    })

    canvas.style.left = `${String((viewport?.offsetLeft ?? 0) + cssWidth / 2)}px`
    canvas.style.top = `${String((viewport?.offsetTop ?? 0) + cssHeight / 2)}px`
    // XR8.Threejs calls renderer.setSize() with updateStyle enabled and writes
    // the backing-buffer dimensions into canvas.style. Keep the display size in
    // CSS custom properties so the stylesheet can protect it from that write.
    canvas.style.setProperty('--camera-canvas-width', `${String(layout.cssWidth)}px`)
    canvas.style.setProperty('--camera-canvas-height', `${String(layout.cssHeight)}px`)
    if (canvas.width !== layout.pixelWidth || canvas.height !== layout.pixelHeight) {
      canvas.width = layout.pixelWidth
      canvas.height = layout.pixelHeight
    }
  }

  const removeCameraBackdrop = () => {
    if (!cameraBackdrop) {
      return
    }

    cameraBackdrop.pause()
    cameraBackdrop.srcObject = null
    cameraBackdrop.remove()
    cameraBackdrop = null
  }

  const setCameraBackdropActive = (active: boolean) => {
    if (!cameraBackdrop) {
      return
    }

    cameraBackdrop.hidden = !active
    if (!active) {
      cameraBackdrop.pause()
      return
    }

    const backdrop = cameraBackdrop
    void backdrop.play().catch(() => {
      if (cameraBackdrop === backdrop) {
        removeCameraBackdrop()
      }
    })
  }

  const attachCameraBackdrop = (stream: MediaStream) => {
    if (!canvas) {
      return
    }

    removeCameraBackdrop()
    const backdrop = options.document.createElement('video')
    backdrop.className = 'camera-backdrop'
    backdrop.autoplay = false
    backdrop.defaultMuted = true
    backdrop.muted = true
    backdrop.playsInline = true
    backdrop.hidden = trackedTargetName === null
    backdrop.setAttribute('aria-hidden', 'true')
    backdrop.srcObject = stream
    canvas.before(backdrop)
    cameraBackdrop = backdrop

    if (trackedTargetName !== null) {
      setCameraBackdropActive(true)
    }
  }

  const addViewportListeners = () => {
    options.window.addEventListener('resize', resizeCanvas)
    options.window.addEventListener('orientationchange', resizeCanvas)
    options.window.visualViewport?.addEventListener('resize', resizeCanvas)
    options.window.visualViewport?.addEventListener('scroll', resizeCanvas)
  }

  const removeViewportListeners = () => {
    options.window.removeEventListener('resize', resizeCanvas)
    options.window.removeEventListener('orientationchange', resizeCanvas)
    options.window.visualViewport?.removeEventListener('resize', resizeCanvas)
    options.window.visualViewport?.removeEventListener('scroll', resizeCanvas)
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

  const handleTargetScanning = () => {
    if (!running || disposed) {
      return
    }

    trackedTargetName = null
    setCameraBackdropActive(false)
    emit({ status: 'searching-target' })
  }

  const handleTargetFound = (targetName: string) => {
    if (!running || disposed || trackedTargetName === targetName) {
      return
    }

    trackedTargetName = targetName
    setCameraBackdropActive(true)
    emit({ status: 'target-found', targetName })
  }

  const handleTargetLost = (targetName: string) => {
    if (!running || disposed || trackedTargetName !== targetName) {
      return
    }

    trackedTargetName = null
    setCameraBackdropActive(false)
    emit({ status: 'target-lost', targetName })
  }

  const createLifecycleModule = (): CameraPipelineModule => ({
    name: LIFECYCLE_MODULE_NAME,
    onAttach: ({ stream }) => attachCameraBackdrop(stream),
    onCameraStatusChange: ({ status }) => handleCameraStatus(status),
    onDetach: removeCameraBackdrop,
    onDeviceOrientationChange: resizeCanvas,
    onException: handleEngineException,
    onResume: () => {
      if (running && !disposed) {
        setCameraBackdropActive(false)
        emit({ status: 'searching-target' })
      }
    },
    onVideoSizeChange: ({ videoHeight, videoWidth }) => {
      videoSize = { height: videoHeight, width: videoWidth }
      resizeCanvas()
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

    threeGlobal?.dispose()
    threeGlobal = null
    imageTargetController = null
    removeCameraBackdrop()

    running = false
    trackedTargetName = null
    videoSize = null
    modules = []
    settlePendingStart(new Error('The XR session was stopped'))
  }

  const handleVisibilityChange = () => {
    if (!engine || !running || disposed) {
      return
    }

    try {
      const isActive = [
        'camera-active',
        'searching-target',
        'target-found',
        'target-lost',
      ].includes(state.status)
      if (options.document.visibilityState === 'hidden' && isActive) {
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
    configureTrackingLab(config) {
      if (disposed) {
        throw new Error('The AR runtime has been disposed')
      }
      if (running) {
        throw new Error('Encerre a sessão antes de alterar a configuração do laboratório.')
      }
      trackingLabConfig = { ...config }
    },

    recalibrateTracking() {
      imageTargetController?.recalibrate()
    },

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
          const [loadedEngine, loadedTarget] = await Promise.all([
            options.loader.load(),
            options.imageTargetLoader.load(),
          ])
          engine = loadedEngine
          imageTargetData = loadedTarget
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

      if (!engine || !imageTargetData || state.status === 'unsupported') {
        throw new Error('The XR Engine is not available')
      }

      if (startPromise) {
        return startPromise
      }

      if (running) {
        removePipeline(true)
      }

      videoSize = null
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
        const xrOptions: Parameters<XrEngine['XrController']['configure']>[0] = {
          disableWorldTracking: true,
          imageTargetData: [imageTargetData],
        }
        if (trackingLabConfig.enabled) {
          xrOptions.disableWorldTracking = trackingLabConfig.mode === 'image-only'
          xrOptions.scale = trackingLabConfig.mode === 'world-absolute' ? 'absolute' : 'responsive'
        }
        engine.XrController.configure(xrOptions)
        engine.Threejs.configure({ renderCameraTexture: false })
        threeGlobal = installThreeGlobal(options.window)
        imageTargetController = createImageTargetController({
          config: trackingLabConfig,
          engine,
          now: options.window.performance.now.bind(options.window.performance),
          onFound: handleTargetFound,
          onLost: handleTargetLost,
          onScanning: handleTargetScanning,
          onTrackingSnapshot: emitTracking,
          targetName: imageTargetData.name,
        })
        modules = [
          engine.GlTextureRenderer.pipelineModule(),
          engine.XrController.pipelineModule(),
          engine.Threejs.pipelineModule(),
          imageTargetController.module,
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

    subscribeTracking(listener) {
      trackingListeners.add(listener)
      listener(trackingSnapshot)
      return () => trackingListeners.delete(listener)
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
      trackingListeners.clear()
    },
  }

  return runtime
}
