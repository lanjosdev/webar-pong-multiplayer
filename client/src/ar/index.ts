import { createXrEngineLoader } from './engine-loader'
import { createImageTargetDataLoader } from './image-target-data'
import { createArRuntime } from './runtime'
import type { ArRuntime } from './types'

export type { ArRuntime, ArRuntimeListener, ArRuntimeState } from './types'

export function createDefaultArRuntime(): ArRuntime {
  const loader = createXrEngineLoader({
    baseUrl: import.meta.env.BASE_URL,
    document,
    window,
  })
  const imageTargetLoader = createImageTargetDataLoader({
    baseUrl: import.meta.env.BASE_URL,
    fetch: window.fetch.bind(window),
  })

  return createArRuntime({ document, imageTargetLoader, loader, window })
}
