import { createXrEngineLoader } from './engine-loader'
import { createImageTargetDataLoader } from './image-target-data'
import { createArRuntime } from './runtime'
import type { AnchoredContent } from './anchored-content'
import type { ArRuntime, PerformanceProfile } from './types'

export type { AnchoredContent } from './anchored-content'

export type {
  ArRuntime,
  ArRuntimeListener,
  ArRuntimeState,
  AnchorStatus,
  AnchorValidationOutcome,
  CameraDistanceMeters,
  FieldLengthMeters,
  ImageTrackingEventCounts,
  ImageTrackingEventKind,
  PerformanceProfile,
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
  WorldTrackingConfidence,
} from './types'

export function createDefaultArRuntime(
  options: { anchoredContent?: AnchoredContent; performanceProfile?: PerformanceProfile } = {},
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
    ...(options.performanceProfile ? { performanceProfile: options.performanceProfile } : {}),
    window,
  })
}
