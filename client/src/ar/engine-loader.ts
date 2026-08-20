import { parseXrEngine, type XrEngine } from './engine-contract'

const SCRIPT_ID = 'xr-engine-script'

export type XrEngineLoadErrorCode = 'disposed' | 'invalid-runtime' | 'script-error' | 'timeout'

export class XrEngineLoadError extends Error {
  constructor(
    readonly code: XrEngineLoadErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'XrEngineLoadError'
  }
}

export interface XrEngineLoader {
  load(): Promise<XrEngine>
  dispose(): void
}

export interface XrEngineLoaderOptions {
  baseUrl: string
  document: Document
  timeoutMs?: number
  window: Window
}

function readGlobalEngine(windowRef: Window): XrEngine | null {
  return parseXrEngine(Reflect.get(windowRef, 'XR8'))
}

function engineAssetUrl(baseUrl: string, documentRef: Document): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return new URL(`${normalizedBase}external/xr/xr.js`, documentRef.baseURI).href
}

export function createXrEngineLoader(options: XrEngineLoaderOptions): XrEngineLoader {
  const timeoutMs = options.timeoutMs ?? 30_000
  let disposed = false
  let loadedEngine: XrEngine | null = null
  let loadPromise: Promise<XrEngine> | null = null
  let cancelPendingLoad: (() => void) | null = null

  return {
    load() {
      if (disposed) {
        return Promise.reject(
          new XrEngineLoadError('disposed', 'The XR Engine loader has been disposed'),
        )
      }

      loadedEngine ??= readGlobalEngine(options.window)
      if (loadedEngine) {
        return Promise.resolve(loadedEngine)
      }

      if (loadPromise) {
        return loadPromise
      }

      loadPromise = new Promise<XrEngine>((resolve, reject) => {
        let settled = false
        let script = options.document.querySelector<HTMLScriptElement>(`#${SCRIPT_ID}`)

        const cleanup = () => {
          options.window.removeEventListener('xrloaded', handleLoaded)
          script?.removeEventListener('error', handleScriptError)
          options.window.clearTimeout(timeoutId)
          cancelPendingLoad = null
        }

        const fail = (error: XrEngineLoadError) => {
          if (settled) {
            return
          }
          settled = true
          cleanup()
          script?.remove()
          loadPromise = null
          reject(error)
        }

        const handleLoaded = () => {
          const engine = readGlobalEngine(options.window)
          if (!engine) {
            fail(
              new XrEngineLoadError(
                'invalid-runtime',
                'XR Engine loaded without the required runtime API',
              ),
            )
            return
          }

          if (settled) {
            return
          }
          settled = true
          loadedEngine = engine
          cleanup()
          resolve(engine)
        }

        const handleScriptError = () => {
          fail(new XrEngineLoadError('script-error', 'Could not download the XR Engine script'))
        }

        const timeoutId = options.window.setTimeout(() => {
          fail(new XrEngineLoadError('timeout', 'Timed out while loading the XR Engine'))
        }, timeoutMs)

        cancelPendingLoad = () => {
          fail(new XrEngineLoadError('disposed', 'The XR Engine loader was disposed while loading'))
        }

        options.window.addEventListener('xrloaded', handleLoaded)

        if (!script) {
          script = options.document.createElement('script')
          script.id = SCRIPT_ID
          script.async = true
          script.src = engineAssetUrl(options.baseUrl, options.document)
          script.dataset['preloadChunks'] = 'slam'
          options.document.head.append(script)
        }

        script.addEventListener('error', handleScriptError, { once: true })

        const engineAfterSetup = readGlobalEngine(options.window)
        if (engineAfterSetup) {
          handleLoaded()
        }
      })

      return loadPromise
    },

    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      cancelPendingLoad?.()
      cancelPendingLoad = null
      loadPromise = null
      loadedEngine = null
    },
  }
}
