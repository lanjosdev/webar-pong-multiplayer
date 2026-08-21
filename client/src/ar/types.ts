export type ArRuntimeState =
  | { status: 'booting' }
  | { status: 'camera-permission' }
  | { status: 'requesting-camera' }
  | { status: 'camera-active' }
  | { status: 'searching-target' }
  | { status: 'target-found'; targetName: string }
  | { status: 'target-lost'; targetName: string }
  | { status: 'paused' }
  | { status: 'recovering' }
  | { status: 'camera-denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'fatal-error'; message: string }
  | { status: 'disposed' }

export type ArRuntimeListener = (state: ArRuntimeState) => void

export type TrackingMode = 'image-only' | 'world-absolute' | 'world-relative'
export type FieldLengthMeters = 1
export type CameraDistanceMeters = 0.75 | 1 | 1.25 | 1.5 | 2
export type TrialScenario = 'acquisition' | 'movement' | 'reacquisition' | 'stationary' | 'thermal'

export interface TrackingLabConfig {
  cameraDistanceMeters: CameraDistanceMeters
  enabled: boolean
  fieldLengthMeters: FieldLengthMeters
  mode: TrackingMode
  targetHeightMeters: number
  targetWidthMeters: number
  trialScenario: TrialScenario
}

export interface TrackingVector3 {
  x: number
  y: number
  z: number
}

export interface TrackingQuaternion extends TrackingVector3 {
  w: number
}

export interface TrackingTargetPose {
  name: string
  position: TrackingVector3
  rotation: TrackingQuaternion
  scale: number
  scaledHeight: number
  scaledWidth: number
}

export type WorldTrackingStatus = 'limited' | 'normal' | 'unavailable'
export type TargetTrackingStatus = 'lost' | 'scanning' | 'visible'
export type AnchorStatus = 'aligned' | 'frozen' | 'reanchoring' | 'uncalibrated' | 'validating'
export type ImageTrackingEventKind = 'found' | 'lost' | 'scanning' | 'updated'

export interface ImageTrackingEventCounts {
  found: number
  lost: number
  updated: number
}

export type TrackingTimelineEventKind =
  | 'anchor-state'
  | 'image-found'
  | 'image-lost'
  | 'image-scanning'
  | 'image-updated'
  | 'world-status'

export interface TrackingTimelineEvent {
  anchorAngularErrorDegrees: number | null
  anchorStatus: AnchorStatus
  anchorTranslationErrorMeters: number | null
  candidateSampleCount: number
  kind: TrackingTimelineEventKind
  pose: TrackingTargetPose | null
  sequence: number
  targetName: string | null
  timestampMs: number
  worldStatus: WorldTrackingStatus
}

export interface TrackingSnapshot {
  anchorAngularErrorDegrees: number | null
  anchorStatus: AnchorStatus
  anchorTranslationErrorMeters: number | null
  automaticReanchorCount: number
  candidateSampleCount: number
  fieldCorners: TrackingVector3[]
  framesPerSecond: number | null
  imageEventCounts: ImageTrackingEventCounts
  lastImageEvent: ImageTrackingEventKind | null
  lastImageEventAtMs: number | null
  metersPerSceneUnit: number
  recalibrationRequired: boolean
  targetPose: TrackingTargetPose | null
  targetStatus: TargetTrackingStatus
  timestampMs: number
  worldReason: string | null
  worldStatus: WorldTrackingStatus
  worldLimitedExceeded: boolean
}

export type TrackingSnapshotListener = (snapshot: TrackingSnapshot) => void
export type TrackingTimelineEventListener = (event: TrackingTimelineEvent) => void

export interface ArRuntime {
  configureTrackingLab(config: TrackingLabConfig): void
  recalibrateTracking(): void
  preload(): Promise<void>
  start(canvas: HTMLCanvasElement): Promise<void>
  retry(): Promise<void>
  stop(): void
  subscribe(listener: ArRuntimeListener): () => void
  subscribeTracking(listener: TrackingSnapshotListener): () => void
  subscribeTrackingEvents(listener: TrackingTimelineEventListener): () => void
  dispose(): void
}
