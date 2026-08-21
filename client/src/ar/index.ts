import { createXrEngineLoader } from './engine-loader'
import { createImageTargetDataLoader } from './image-target-data'
import { createArRuntime } from './runtime'
import type { AnchoredContent } from './anchored-content'
import type { ArRuntime } from './types'

export type { AnchoredContent } from './anchored-content'

export type {
  ArRuntime,
  ArRuntimeListener,
  ArRuntimeState,
  AnchorStatus,
  CameraDistanceMeters,
  FieldLengthMeters,
  ImageTrackingEventCounts,
  ImageTrackingEventKind,
  TrackingLabConfig,
  TrackingMode,
  TrackingSnapshot,
  TrackingSnapshotListener,
  TrackingTimelineEvent,
  TrackingTimelineEventKind,
  TrackingTimelineEventListener,
  TrackingTargetPose,
  TrackingVector3,
  TrialScenario,
  WorldTrackingStatus,
} from './types'

export function createDefaultArRuntime(
  options: { anchoredContent?: AnchoredContent } = {},
): ArRuntime {
  const loader = createXrEngineLoader({
    baseUrl: import.meta.env.BASE_URL,
    document,
    window,
  })
  const imageTargetLoader = createImageTargetDataLoader({
    baseUrl: import.meta.env.BASE_URL,
    fetch: window.fetch.bind(window),
  })

  return createArRuntime({
    ...(options.anchoredContent ? { anchoredContent: options.anchoredContent } : {}),
    document,
    imageTargetLoader,
    loader,
    window,
  })
}
