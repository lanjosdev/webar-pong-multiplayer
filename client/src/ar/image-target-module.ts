import * as THREE from 'three'

import type { AnchoredContent } from './anchored-content'
import { createCalibrationField, type CalibrationField } from './calibration-field'
import type { CameraPipelineEvent, CameraPipelineModule, XrEngine } from './engine-contract'
import type {
  AnchorStatus,
  ImageTrackingEventCounts,
  ImageTrackingEventKind,
  TrackingLabConfig,
  TrackingSnapshot,
  TrackingTargetPose,
  TrackingTimelineEvent,
  TrackingTimelineEventKind,
  WorldTrackingStatus,
} from './types'

export const IMAGE_TARGET_MODULE_NAME = 'pong-image-target'
export const TARGET_LOSS_GRACE_MS = 300
export const WORLD_LIMITED_GRACE_MS = 1500
export const ANCHOR_CORRECTION_MS = 750
export const RELATIVE_VALIDATION_MIN_MS = 150
export const RELATIVE_VALIDATION_MAX_MS = 600
export const RELATIVE_VALIDATION_SAMPLE_COUNT = 3
export const LARGE_REANCHOR_FADE_OUT_MS = 150
export const LARGE_REANCHOR_FADE_IN_MS = 250
export const TRACKING_EVENT_SAMPLE_MS = 100

interface AnchorCorrection {
  endDimensions: FieldDimensions
  endPose: TrackingTargetPose
  endPosition: THREE.Vector3
  endQuaternion: THREE.Quaternion
  endScale: number
  startDimensions: FieldDimensions
  startPosition: THREE.Vector3
  startQuaternion: THREE.Quaternion
  startScale: number
  startedAtMs: number
}

interface PoseCandidate {
  observedAtMs: number
  pose: TrackingTargetPose
}

interface FieldDimensions {
  length: number
  width: number
}

interface AcceptedCalibration {
  dimensions: FieldDimensions
  pose: TrackingTargetPose
}

interface ReanchorTransition {
  applied: boolean
  endCalibration: AcceptedCalibration
  originalCalibration: AcceptedCalibration
  originalPosition: THREE.Vector3
  originalQuaternion: THREE.Quaternion
  originalScale: number
  phase: 'fading-in' | 'fading-out'
  startedAtMs: number
}

export interface ImageTargetControllerOptions {
  anchoredContent?: AnchoredContent
  config: TrackingLabConfig
  engine: XrEngine
  now?: () => number
  onFound(targetName: string): void
  onLost(targetName: string): void
  onScanning(): void
  onTrackingSnapshot(snapshot: TrackingSnapshot): void
  onTrackingTimelineEvent(event: TrackingTimelineEvent): void
  targetName: string
  targetLossGraceMs?: number
}

export interface ImageTargetController {
  module: CameraPipelineModule
  recalibrate(): void
}

export interface ThreeGlobalHandle {
  dispose(): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseVector3(value: unknown): { x: number; y: number; z: number } | null {
  if (!isRecord(value)) {
    return null
  }
  const { x, y, z } = value
  return typeof x === 'number' &&
    Number.isFinite(x) &&
    typeof y === 'number' &&
    Number.isFinite(y) &&
    typeof z === 'number' &&
    Number.isFinite(z)
    ? { x, y, z }
    : null
}

function parseQuaternion(value: unknown): { w: number; x: number; y: number; z: number } | null {
  const vector = parseVector3(value)
  if (
    !vector ||
    !isRecord(value) ||
    typeof value['w'] !== 'number' ||
    !Number.isFinite(value['w'])
  ) {
    return null
  }
  return { ...vector, w: value['w'] }
}

function parseFlatTargetPose(value: unknown): TrackingTargetPose | null {
  if (!isRecord(value)) {
    return null
  }
  const position = parseVector3(value['position'])
  const rotation = parseQuaternion(value['rotation'])
  const { name, scale, scaledHeight, scaledWidth } = value
  if (
    typeof name !== 'string' ||
    !position ||
    !rotation ||
    typeof scale !== 'number' ||
    !Number.isFinite(scale) ||
    scale <= 0 ||
    typeof scaledHeight !== 'number' ||
    !Number.isFinite(scaledHeight) ||
    scaledHeight <= 0 ||
    typeof scaledWidth !== 'number' ||
    !Number.isFinite(scaledWidth) ||
    scaledWidth <= 0
  ) {
    return null
  }
  return { name, position, rotation, scale, scaledHeight, scaledWidth }
}

function targetNameFromEvent(event: CameraPipelineEvent): string | null {
  return isRecord(event.detail) && typeof event.detail['name'] === 'string'
    ? event.detail['name']
    : null
}

function parseWorldTracking(event: CameraPipelineEvent): {
  reason: string | null
  status: WorldTrackingStatus
} | null {
  if (!isRecord(event.detail) || typeof event.detail['status'] !== 'string') {
    return null
  }
  const rawStatus = event.detail['status'].toLowerCase()
  if (rawStatus !== 'limited' && rawStatus !== 'normal') {
    return null
  }
  return {
    reason: typeof event.detail['reason'] === 'string' ? event.detail['reason'] : null,
    status: rawStatus,
  }
}

export function installThreeGlobal(windowRef: Window): ThreeGlobalHandle {
  const hadOwnThree = Object.hasOwn(windowRef, 'THREE')
  const previousThree = Reflect.get(windowRef, 'THREE') as unknown
  Reflect.set(windowRef, 'THREE', THREE)
  let disposed = false

  return {
    dispose() {
      if (disposed || Reflect.get(windowRef, 'THREE') !== THREE) {
        return
      }
      if (hadOwnThree) {
        Reflect.set(windowRef, 'THREE', previousThree)
      } else {
        Reflect.deleteProperty(windowRef, 'THREE')
      }
      disposed = true
    },
  }
}

function targetDimensions(
  config: TrackingLabConfig,
  pose: TrackingTargetPose,
): {
  height: number
  width: number
} {
  return config.mode === 'world-absolute'
    ? { height: config.targetHeightMeters, width: config.targetWidthMeters }
    : { height: pose.scaledHeight, width: pose.scaledWidth }
}

function fieldDimensions(config: TrackingLabConfig, pose: TrackingTargetPose): FieldDimensions {
  if (config.mode === 'world-absolute') {
    return { length: config.fieldLengthMeters, width: config.fieldLengthMeters / 2 }
  }
  return {
    length: pose.scaledHeight * (config.fieldLengthMeters / config.targetHeightMeters),
    width: pose.scaledWidth * (config.fieldLengthMeters / 2 / config.targetWidthMeters),
  }
}

export function createImageTargetController(
  options: ImageTargetControllerOptions,
): ImageTargetController {
  const now = options.now ?? (() => performance.now())
  const isWorldMode = options.config.mode !== 'image-only'
  const isRefinedRelativeMode = options.config.mode === 'world-relative'
  let scene: THREE.Scene | null = null
  let root: THREE.Group | null = null
  let targetSurface: THREE.Mesh | null = null
  let targetOutline: THREE.LineSegments | null = null
  let originMarker: THREE.Mesh | null = null
  let field: CalibrationField | null = null
  let resources: Array<THREE.BufferGeometry | THREE.Material> = []
  let pendingLoss: ReturnType<typeof setTimeout> | null = null
  let pendingLimited: ReturnType<typeof setTimeout> | null = null
  let lastPose: TrackingTargetPose | null = null
  let targetStatus: TrackingSnapshot['targetStatus'] = 'scanning'
  let worldStatus: WorldTrackingStatus = 'unavailable'
  let worldReason: string | null = isWorldMode ? 'INITIALIZING' : null
  let worldLimitedExceeded = false
  let recalibrationRequired = false
  let anchorSet = false
  let correction: AnchorCorrection | null = null
  let lastFrameAtMs: number | null = null
  let lastFrameSnapshotAtMs: number | null = null
  let framesPerSecond: number | null = null
  let anchorStatus: AnchorStatus = 'uncalibrated'
  let anchorTranslationErrorMeters: number | null = null
  let anchorAngularErrorDegrees: number | null = null
  let automaticReanchorCount = 0
  let candidates: PoseCandidate[] = []
  let manualValidationRequested = false
  let reanchorTransition: ReanchorTransition | null = null
  let acceptedCalibration: AcceptedCalibration | null = null
  let appliedDimensions: FieldDimensions | null = null
  let timelineSequence = 0
  let lastTimelineImageUpdatedAtMs: number | null = null
  let lastImageEvent: ImageTrackingEventKind | null = null
  let lastImageEventAtMs: number | null = null
  let waitingForFirstObservationAfterLoss = false
  const imageEventCounts: ImageTrackingEventCounts = { found: 0, lost: 0, updated: 0 }

  const metersPerSceneUnitForPose = (pose: TrackingTargetPose | null) =>
    options.config.mode === 'world-absolute' || !pose
      ? 1
      : options.config.targetHeightMeters / (pose.scaledHeight * pose.scale)

  const timelineEvent = (
    kind: TrackingTimelineEventKind,
    pose: TrackingTargetPose | null = null,
  ) => {
    const eventPose = pose ?? lastPose
    timelineSequence += 1
    options.onTrackingTimelineEvent({
      anchorAngularErrorDegrees,
      anchorStatus,
      anchorTranslationErrorMeters,
      candidateSampleCount: candidates.length,
      kind,
      pose: eventPose ? structuredClone(eventPose) : null,
      sequence: timelineSequence,
      targetName: eventPose?.name ?? null,
      timestampMs: Date.now(),
      worldStatus,
    })
  }

  const setAnchorStatus = (nextStatus: AnchorStatus) => {
    if (anchorStatus === nextStatus) {
      return
    }
    anchorStatus = nextStatus
    timelineEvent('anchor-state')
  }

  const emitSnapshot = () => {
    const metersPerSceneUnit = metersPerSceneUnitForPose(lastPose)
    options.onTrackingSnapshot({
      anchorAngularErrorDegrees,
      anchorStatus,
      anchorTranslationErrorMeters,
      automaticReanchorCount,
      candidateSampleCount: candidates.length,
      fieldCorners: field && root?.visible ? field.fieldCorners() : [],
      framesPerSecond,
      imageEventCounts: { ...imageEventCounts },
      lastImageEvent,
      lastImageEventAtMs,
      metersPerSceneUnit,
      recalibrationRequired,
      targetPose: lastPose ? structuredClone(lastPose) : null,
      targetStatus,
      timestampMs: Date.now(),
      worldLimitedExceeded,
      worldReason,
      worldStatus,
    })
  }

  const cancelPendingLoss = () => {
    if (pendingLoss !== null) {
      clearTimeout(pendingLoss)
      pendingLoss = null
    }
  }

  const cancelPendingLimited = () => {
    if (pendingLimited !== null) {
      clearTimeout(pendingLimited)
      pendingLimited = null
    }
  }

  const disposeScene = () => {
    cancelPendingLoss()
    cancelPendingLimited()
    correction = null
    candidates = []
    reanchorTransition = null
    acceptedCalibration = null
    appliedDimensions = null
    if (root && scene) {
      scene.remove(root)
    }
    options.anchoredContent?.object3d.removeFromParent()
    field?.dispose()
    field = null
    for (const resource of resources) {
      resource.dispose()
    }
    resources = []
    scene = null
    root = null
    targetSurface = null
    targetOutline = null
    originMarker = null
    anchorSet = false
  }

  const initializeScene = () => {
    disposeScene()
    const nextScene = options.engine.Threejs.xrScene().scene
    if (!(nextScene instanceof THREE.Scene)) {
      throw new Error('A cena Three.js do XR Engine não está disponível.')
    }

    const nextRoot = new THREE.Group()
    nextRoot.name = 'tracked-experience-root'
    nextRoot.visible = false
    if (options.config.enabled) {
      const planeGeometry = new THREE.PlaneGeometry(1, 1)
      const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0x52e5ff,
        depthWrite: false,
        opacity: 0.1,
        side: THREE.DoubleSide,
        transparent: true,
      })
      const outlineGeometry = new THREE.EdgesGeometry(planeGeometry)
      const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x52e5ff })
      const markerGeometry = new THREE.BoxGeometry(1, 1, 1)
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffbf47 })
      const nextSurface = new THREE.Mesh(planeGeometry, planeMaterial)
      const nextOutline = new THREE.LineSegments(outlineGeometry, outlineMaterial)
      const nextOriginMarker = new THREE.Mesh(markerGeometry, markerMaterial)
      nextRoot.add(nextSurface, nextOutline, nextOriginMarker)
      resources = [
        planeGeometry,
        planeMaterial,
        outlineGeometry,
        outlineMaterial,
        markerGeometry,
        markerMaterial,
      ]
      targetSurface = nextSurface
      targetOutline = nextOutline
      originMarker = nextOriginMarker
      field = createCalibrationField()
      nextRoot.add(field.group)
    }
    if (options.anchoredContent) {
      nextRoot.add(options.anchoredContent.object3d)
    }
    nextScene.add(nextRoot)

    scene = nextScene
    root = nextRoot
  }

  const desiredTransform = (pose: TrackingTargetPose) => ({
    position: new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
    quaternion: new THREE.Quaternion(
      pose.rotation.x,
      pose.rotation.y,
      pose.rotation.z,
      pose.rotation.w,
    ),
    scale: options.config.mode === 'world-absolute' ? 1 : pose.scale,
  })

  const applyRootTransform = (pose: TrackingTargetPose) => {
    if (!root) {
      return
    }
    const desired = desiredTransform(pose)
    root.position.copy(desired.position)
    root.quaternion.copy(desired.quaternion)
    root.scale.setScalar(desired.scale)
    anchorSet = true
  }

  const cloneCalibration = (calibration: AcceptedCalibration): AcceptedCalibration => ({
    dimensions: { ...calibration.dimensions },
    pose: structuredClone(calibration.pose),
  })

  const updateTargetGeometry = (pose: TrackingTargetPose) => {
    const target = targetDimensions(options.config, pose)
    const referenceSize = Math.min(target.width, target.height)
    targetSurface?.scale.set(target.width, target.height, 1)
    targetOutline?.scale.set(target.width, target.height, 1)
    originMarker?.position.set(0, 0, referenceSize * 0.075)
    originMarker?.scale.setScalar(referenceSize * 0.15)
  }

  const applyFieldDimensions = (dimensions: FieldDimensions) => {
    if (
      appliedDimensions &&
      appliedDimensions.width === dimensions.width &&
      appliedDimensions.length === dimensions.length
    ) {
      return
    }
    field?.setDimensions(dimensions.width, dimensions.length)
    options.anchoredContent?.setDimensions(dimensions.width, dimensions.length)
    appliedDimensions = { ...dimensions }
  }

  const commitCalibration = (calibration: AcceptedCalibration) => {
    updateTargetGeometry(calibration.pose)
    applyFieldDimensions(calibration.dimensions)
    acceptedCalibration = cloneCalibration(calibration)
  }

  const cancelAnchorCorrection = () => {
    if (!correction) {
      return
    }
    if (root) {
      root.position.copy(correction.startPosition)
      root.quaternion.copy(correction.startQuaternion)
      root.scale.setScalar(correction.startScale)
    }
    if (acceptedCalibration) {
      commitCalibration(acceptedCalibration)
    } else {
      applyFieldDimensions(correction.startDimensions)
    }
    correction = null
  }

  const applyPoseImmediately = (pose: TrackingTargetPose) => {
    if (!root) {
      return
    }
    applyRootTransform(pose)
    commitCalibration({ dimensions: fieldDimensions(options.config, pose), pose })
    correction = null
    reanchorTransition = null
    setContentOpacity(1)
    recalibrationRequired = false
    anchorTranslationErrorMeters = 0
    anchorAngularErrorDegrees = 0
    candidates = []
    manualValidationRequested = false
    setAnchorStatus('aligned')
  }

  const calculateAnchorErrors = (pose: TrackingTargetPose) => {
    if (!root) {
      return { angularDegrees: 0, translationMeters: 0 }
    }
    const desired = desiredTransform(pose)
    return {
      angularDegrees: THREE.MathUtils.radToDeg(root.quaternion.angleTo(desired.quaternion)),
      translationMeters:
        root.position.distanceTo(desired.position) * metersPerSceneUnitForPose(pose),
    }
  }

  const posesAreConsistent = (left: TrackingTargetPose, right: TrackingTargetPose) => {
    const leftTransform = desiredTransform(left)
    const rightTransform = desiredTransform(right)
    const translationMeters =
      leftTransform.position.distanceTo(rightTransform.position) * metersPerSceneUnitForPose(right)
    const angularDegrees = THREE.MathUtils.radToDeg(
      leftTransform.quaternion.angleTo(rightTransform.quaternion),
    )
    return translationMeters <= options.config.fieldLengthMeters * 0.01 && angularDegrees <= 1
  }

  const setContentOpacity = (opacity: number) => {
    field?.setOpacity(opacity)
    options.anchoredContent?.setOpacity(opacity)
  }

  const requestAnchorCorrection = (pose: TrackingTargetPose) => {
    if (!root) {
      return
    }
    const desired = desiredTransform(pose)
    const errors = calculateAnchorErrors(pose)
    anchorTranslationErrorMeters = errors.translationMeters
    anchorAngularErrorDegrees = errors.angularDegrees
    if (
      errors.translationMeters > options.config.fieldLengthMeters * 0.02 ||
      errors.angularDegrees > 2
    ) {
      recalibrationRequired = true
      correction = null
      return
    }
    const endDimensions = fieldDimensions(options.config, pose)
    correction = {
      endDimensions,
      endPose: structuredClone(pose),
      endPosition: desired.position,
      endQuaternion: desired.quaternion,
      endScale: desired.scale,
      startDimensions: appliedDimensions ? { ...appliedDimensions } : { ...endDimensions },
      startPosition: root.position.clone(),
      startQuaternion: root.quaternion.clone(),
      startScale: root.scale.x,
      startedAtMs: now(),
    }
    recalibrationRequired = false
    candidates = []
    manualValidationRequested = false
    if (!isRefinedRelativeMode) {
      setAnchorStatus('aligned')
    }
  }

  const cancelReanchorTransition = () => {
    if (!root || !reanchorTransition) {
      reanchorTransition = null
      setContentOpacity(1)
      return
    }
    if (reanchorTransition.applied) {
      root.position.copy(reanchorTransition.originalPosition)
      root.quaternion.copy(reanchorTransition.originalQuaternion)
      root.scale.setScalar(reanchorTransition.originalScale)
      commitCalibration(reanchorTransition.originalCalibration)
    }
    reanchorTransition = null
    setContentOpacity(1)
  }

  const invalidateTrackingForLifecycle = (reason: string) => {
    cancelPendingLoss()
    cancelPendingLimited()
    cancelAnchorCorrection()
    candidates = []
    cancelReanchorTransition()
    lastPose = null
    waitingForFirstObservationAfterLoss = false
    manualValidationRequested = false
    recalibrationRequired = false
    anchorTranslationErrorMeters = null
    anchorAngularErrorDegrees = null
    targetStatus = 'scanning'
    worldStatus = 'unavailable'
    worldReason = reason
    worldLimitedExceeded = false
    anchorSet = false
    acceptedCalibration = null
    appliedDimensions = null
    lastFrameAtMs = null
    lastFrameSnapshotAtMs = null
    framesPerSecond = null
    lastTimelineImageUpdatedAtMs = null
    lastImageEvent = 'scanning'
    lastImageEventAtMs = Date.now()
    if (root) {
      root.visible = false
    }
    setAnchorStatus('uncalibrated')
    emitSnapshot()
  }

  const startLargeReanchor = (pose: TrackingTargetPose) => {
    if (!root || !acceptedCalibration) {
      return
    }
    correction = null
    candidates = []
    manualValidationRequested = false
    recalibrationRequired = false
    reanchorTransition = {
      applied: false,
      endCalibration: {
        dimensions: fieldDimensions(options.config, pose),
        pose: structuredClone(pose),
      },
      originalCalibration: cloneCalibration(acceptedCalibration),
      originalPosition: root.position.clone(),
      originalQuaternion: root.quaternion.clone(),
      originalScale: root.scale.x,
      phase: 'fading-out',
      startedAtMs: now(),
    }
    setAnchorStatus('reanchoring')
  }

  const validateRelativePose = (pose: TrackingTargetPose, forceValidation: boolean) => {
    if (!root || !anchorSet || !isRefinedRelativeMode || correction) {
      return
    }
    const errors = calculateAnchorErrors(pose)
    anchorTranslationErrorMeters = errors.translationMeters
    anchorAngularErrorDegrees = errors.angularDegrees
    const exceedsAnchorThreshold =
      errors.translationMeters > options.config.fieldLengthMeters * 0.02 ||
      errors.angularDegrees > 2
    const shouldValidate =
      forceValidation ||
      manualValidationRequested ||
      anchorStatus === 'validating' ||
      exceedsAnchorThreshold
    if (!shouldValidate) {
      return
    }
    if (worldStatus !== 'normal' || reanchorTransition) {
      candidates = []
      return
    }

    recalibrationRequired = true
    setAnchorStatus('validating')
    const observedAtMs = now()
    const firstCandidate = candidates[0]
    const candidateWindowExpired =
      firstCandidate !== undefined &&
      observedAtMs - firstCandidate.observedAtMs > RELATIVE_VALIDATION_MAX_MS
    const consistentWithWindow = candidates.every((candidate) =>
      posesAreConsistent(candidate.pose, pose),
    )
    if (candidateWindowExpired || !consistentWithWindow) {
      candidates = []
    }

    const sample = { observedAtMs, pose: structuredClone(pose) }
    if (candidates.length < RELATIVE_VALIDATION_SAMPLE_COUNT) {
      candidates.push(sample)
    } else {
      candidates[RELATIVE_VALIDATION_SAMPLE_COUNT - 1] = sample
    }
    const validationStartedAtMs = candidates[0]?.observedAtMs ?? observedAtMs
    if (
      candidates.length < RELATIVE_VALIDATION_SAMPLE_COUNT ||
      observedAtMs - validationStartedAtMs < RELATIVE_VALIDATION_MIN_MS
    ) {
      return
    }

    const confirmedPose = candidates.at(-1)?.pose
    if (!confirmedPose) {
      return
    }
    const confirmedErrors = calculateAnchorErrors(confirmedPose)
    anchorTranslationErrorMeters = confirmedErrors.translationMeters
    anchorAngularErrorDegrees = confirmedErrors.angularDegrees
    if (
      confirmedErrors.translationMeters > options.config.fieldLengthMeters * 0.02 ||
      confirmedErrors.angularDegrees > 2
    ) {
      startLargeReanchor(confirmedPose)
    } else {
      requestAnchorCorrection(confirmedPose)
    }
  }

  const showTarget = (event: CameraPipelineEvent) => {
    const pose = parseFlatTargetPose(event.detail)
    if (!pose || pose.name !== options.targetName) {
      return
    }
    const imageEvent: ImageTrackingEventKind =
      event.name === 'reality.imagefound' ? 'found' : 'updated'
    imageEventCounts[imageEvent] += 1
    lastImageEvent = imageEvent
    lastImageEventAtMs = Date.now()
    const wasLost = targetStatus === 'lost'
    const isFirstObservationAfterLoss = waitingForFirstObservationAfterLoss
    const previousAnchorStatus = anchorStatus
    const previousCandidateCount = candidates.length
    cancelPendingLoss()
    lastPose = pose
    targetStatus = 'visible'

    if (!isWorldMode || !anchorSet) {
      applyPoseImmediately(pose)
    } else if (isRefinedRelativeMode) {
      validateRelativePose(pose, wasLost || isFirstObservationAfterLoss)
    } else if (event.name === 'reality.imagefound' && wasLost) {
      requestAnchorCorrection(pose)
    }
    if (root) {
      root.visible = true
    }
    options.onFound(pose.name)
    const eventAtMs = now()
    const anchorStateChanged =
      previousAnchorStatus !== anchorStatus || previousCandidateCount !== candidates.length
    const shouldRecordTimeline =
      imageEvent === 'found' ||
      waitingForFirstObservationAfterLoss ||
      anchorStateChanged ||
      lastTimelineImageUpdatedAtMs === null ||
      eventAtMs - lastTimelineImageUpdatedAtMs >= TRACKING_EVENT_SAMPLE_MS
    if (shouldRecordTimeline) {
      if (imageEvent === 'updated') {
        lastTimelineImageUpdatedAtMs = eventAtMs
      }
      timelineEvent(imageEvent === 'found' ? 'image-found' : 'image-updated', pose)
    }
    waitingForFirstObservationAfterLoss = false
    if (
      imageEvent === 'found' ||
      anchorStateChanged ||
      lastFrameSnapshotAtMs === null ||
      eventAtMs - lastFrameSnapshotAtMs >= 100
    ) {
      lastFrameSnapshotAtMs = eventAtMs
      emitSnapshot()
    }
  }

  const scheduleTargetLoss = (event: CameraPipelineEvent) => {
    const targetName = targetNameFromEvent(event)
    if (targetName !== options.targetName) {
      return
    }
    imageEventCounts.lost += 1
    lastImageEvent = 'lost'
    lastImageEventAtMs = Date.now()
    waitingForFirstObservationAfterLoss = true
    timelineEvent('image-lost')
    cancelPendingLoss()
    pendingLoss = setTimeout(() => {
      pendingLoss = null
      targetStatus = 'lost'
      candidates = []
      if (isRefinedRelativeMode && anchorStatus === 'validating' && !manualValidationRequested) {
        recalibrationRequired = false
        setAnchorStatus('aligned')
      }
      if (root && !isWorldMode) {
        root.visible = false
      }
      options.onLost(targetName)
      emitSnapshot()
    }, options.targetLossGraceMs ?? TARGET_LOSS_GRACE_MS)
  }

  const handleScanning = () => {
    lastImageEvent = 'scanning'
    lastImageEventAtMs = Date.now()
    targetStatus = 'scanning'
    options.onScanning()
    timelineEvent('image-scanning')
    emitSnapshot()
  }

  const handleWorldTracking = (event: CameraPipelineEvent) => {
    const tracking = parseWorldTracking(event)
    if (!tracking || !isWorldMode) {
      return
    }
    worldStatus = tracking.status
    worldReason = tracking.reason
    if (worldStatus === 'limited') {
      cancelAnchorCorrection()
      candidates = []
      if (isRefinedRelativeMode && !manualValidationRequested) {
        recalibrationRequired = false
      }
      cancelReanchorTransition()
      if (anchorSet && anchorStatus !== 'frozen') {
        setAnchorStatus('aligned')
      }
      if (!isRefinedRelativeMode) {
        cancelPendingLimited()
      }
      const shouldStartLimitedTimer = isRefinedRelativeMode
        ? !pendingLimited && !worldLimitedExceeded
        : true
      if (shouldStartLimitedTimer) {
        pendingLimited = setTimeout(() => {
          pendingLimited = null
          worldLimitedExceeded = true
          correction = null
          candidates = []
          cancelReanchorTransition()
          setAnchorStatus(anchorSet ? 'frozen' : 'uncalibrated')
          emitSnapshot()
        }, WORLD_LIMITED_GRACE_MS)
      }
    } else {
      cancelPendingLimited()
      worldLimitedExceeded = false
      if (anchorStatus === 'frozen') {
        setAnchorStatus(
          anchorSet ? (manualValidationRequested ? 'validating' : 'aligned') : 'uncalibrated',
        )
      }
    }
    timelineEvent('world-status')
    emitSnapshot()
  }

  const updateFrame = () => {
    const frameAtMs = now()
    const deltaSeconds = lastFrameAtMs === null ? 0 : Math.max(0, frameAtMs - lastFrameAtMs) / 1000
    if (lastFrameAtMs !== null) {
      const elapsed = frameAtMs - lastFrameAtMs
      if (elapsed > 0) {
        framesPerSecond = 1000 / elapsed
      }
    }
    lastFrameAtMs = frameAtMs

    if (root && correction) {
      const activeCorrection = correction
      const progress = Math.min(
        1,
        (frameAtMs - activeCorrection.startedAtMs) / ANCHOR_CORRECTION_MS,
      )
      root.position.lerpVectors(
        activeCorrection.startPosition,
        activeCorrection.endPosition,
        progress,
      )
      root.quaternion.slerpQuaternions(
        activeCorrection.startQuaternion,
        activeCorrection.endQuaternion,
        progress,
      )
      const scale = THREE.MathUtils.lerp(
        activeCorrection.startScale,
        activeCorrection.endScale,
        progress,
      )
      root.scale.setScalar(scale)
      applyFieldDimensions({
        length: THREE.MathUtils.lerp(
          activeCorrection.startDimensions.length,
          activeCorrection.endDimensions.length,
          progress,
        ),
        width: THREE.MathUtils.lerp(
          activeCorrection.startDimensions.width,
          activeCorrection.endDimensions.width,
          progress,
        ),
      })
      if (progress === 1) {
        commitCalibration({
          dimensions: activeCorrection.endDimensions,
          pose: activeCorrection.endPose,
        })
        correction = null
        anchorTranslationErrorMeters = 0
        anchorAngularErrorDegrees = 0
        if (isRefinedRelativeMode) {
          setAnchorStatus('aligned')
          emitSnapshot()
        }
      }
    }
    if (root && reanchorTransition) {
      const transition = reanchorTransition
      const phaseDuration =
        transition.phase === 'fading-out' ? LARGE_REANCHOR_FADE_OUT_MS : LARGE_REANCHOR_FADE_IN_MS
      const progress = Math.min(1, (frameAtMs - transition.startedAtMs) / phaseDuration)
      setContentOpacity(transition.phase === 'fading-out' ? 1 - progress : progress)
      if (progress === 1 && transition.phase === 'fading-out') {
        applyRootTransform(transition.endCalibration.pose)
        commitCalibration(transition.endCalibration)
        transition.applied = true
        transition.phase = 'fading-in'
        transition.startedAtMs = frameAtMs
        anchorTranslationErrorMeters = 0
        anchorAngularErrorDegrees = 0
        emitSnapshot()
      } else if (progress === 1) {
        reanchorTransition = null
        setContentOpacity(1)
        automaticReanchorCount += 1
        setAnchorStatus('aligned')
        emitSnapshot()
      }
    }
    options.anchoredContent?.update(deltaSeconds)
    if (lastFrameSnapshotAtMs === null || frameAtMs - lastFrameSnapshotAtMs >= 100) {
      lastFrameSnapshotAtMs = frameAtMs
      emitSnapshot()
    }
  }

  return {
    module: {
      listeners: [
        { event: 'reality.imagescanning', process: handleScanning },
        { event: 'reality.imagefound', process: showTarget },
        { event: 'reality.imageupdated', process: showTarget },
        { event: 'reality.imagelost', process: scheduleTargetLoss },
        { event: 'reality.trackingstatus', process: handleWorldTracking },
      ],
      name: IMAGE_TARGET_MODULE_NAME,
      onDetach: disposeScene,
      onPaused: () => invalidateTrackingForLifecycle('LIFECYCLE_PAUSED'),
      onRemove: disposeScene,
      onResume: handleScanning,
      onStart: () => {
        initializeScene()
        invalidateTrackingForLifecycle('SESSION_STARTED')
      },
      onUpdate: updateFrame,
    },
    recalibrate() {
      if (isRefinedRelativeMode && anchorSet) {
        manualValidationRequested = true
        recalibrationRequired = true
        candidates = []
        if (worldStatus === 'normal') {
          setAnchorStatus('validating')
        }
        emitSnapshot()
        return
      }
      if (lastPose && !worldLimitedExceeded) {
        applyPoseImmediately(lastPose)
        if (root) {
          root.visible = true
        }
        emitSnapshot()
      }
    },
  }
}
