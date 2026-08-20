import * as THREE from 'three'

import { createCalibrationField, type CalibrationField } from './calibration-field'
import type { CameraPipelineEvent, CameraPipelineModule, XrEngine } from './engine-contract'
import type {
  TrackingLabConfig,
  TrackingSnapshot,
  TrackingTargetPose,
  WorldTrackingStatus,
} from './types'

export const IMAGE_TARGET_MODULE_NAME = 'pong-image-target'
export const TARGET_LOSS_GRACE_MS = 300
export const WORLD_LIMITED_GRACE_MS = 1500
export const ANCHOR_CORRECTION_MS = 750

interface AnchorCorrection {
  endPosition: THREE.Vector3
  endQuaternion: THREE.Quaternion
  endScale: number
  startPosition: THREE.Vector3
  startQuaternion: THREE.Quaternion
  startScale: number
  startedAtMs: number
}

export interface ImageTargetControllerOptions {
  config: TrackingLabConfig
  engine: XrEngine
  now?: () => number
  onFound(targetName: string): void
  onLost(targetName: string): void
  onScanning(): void
  onTrackingSnapshot(snapshot: TrackingSnapshot): void
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

function fieldDimensions(
  config: TrackingLabConfig,
  pose: TrackingTargetPose,
): {
  length: number
  width: number
} {
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
  const isWorldMode = options.config.enabled && options.config.mode !== 'image-only'
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
  let worldStatus: WorldTrackingStatus = isWorldMode ? 'limited' : 'unavailable'
  let worldReason: string | null = isWorldMode ? 'INITIALIZING' : null
  let worldLimitedExceeded = false
  let recalibrationRequired = false
  let anchorSet = false
  let correction: AnchorCorrection | null = null
  let lastFrameAtMs: number | null = null
  let lastFrameSnapshotAtMs: number | null = null
  let framesPerSecond: number | null = null

  const emitSnapshot = () => {
    const metersPerSceneUnit =
      options.config.mode === 'world-absolute' || !lastPose
        ? 1
        : options.config.targetHeightMeters / (lastPose.scaledHeight * lastPose.scale)
    options.onTrackingSnapshot({
      fieldCorners: field && root?.visible ? field.fieldCorners() : [],
      framesPerSecond,
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
    if (root && scene) {
      scene.remove(root)
    }
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

    const planeGeometry = new THREE.PlaneGeometry(1, 1)
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x52e5ff,
      depthWrite: false,
      opacity: options.config.enabled ? 0.1 : 0.18,
      side: THREE.DoubleSide,
      transparent: true,
    })
    const outlineGeometry = new THREE.EdgesGeometry(planeGeometry)
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x52e5ff })
    const markerGeometry = new THREE.BoxGeometry(1, 1, 1)
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffbf47 })

    const nextRoot = new THREE.Group()
    nextRoot.name = 'tracked-experience-root'
    const nextSurface = new THREE.Mesh(planeGeometry, planeMaterial)
    const nextOutline = new THREE.LineSegments(outlineGeometry, outlineMaterial)
    const nextOriginMarker = new THREE.Mesh(markerGeometry, markerMaterial)
    nextRoot.visible = false
    nextRoot.add(nextSurface, nextOutline, nextOriginMarker)
    if (options.config.enabled) {
      field = createCalibrationField()
      nextRoot.add(field.group)
    }
    nextScene.add(nextRoot)

    resources = [
      planeGeometry,
      planeMaterial,
      outlineGeometry,
      outlineMaterial,
      markerGeometry,
      markerMaterial,
    ]
    scene = nextScene
    root = nextRoot
    targetSurface = nextSurface
    targetOutline = nextOutline
    originMarker = nextOriginMarker
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

  const applyPoseImmediately = (pose: TrackingTargetPose) => {
    if (!root) {
      return
    }
    const desired = desiredTransform(pose)
    root.position.copy(desired.position)
    root.quaternion.copy(desired.quaternion)
    root.scale.setScalar(desired.scale)
    correction = null
    recalibrationRequired = false
    anchorSet = true
  }

  const updateGeometry = (pose: TrackingTargetPose) => {
    if (!targetSurface || !targetOutline || !originMarker) {
      return
    }
    const target = targetDimensions(options.config, pose)
    const referenceSize = Math.min(target.width, target.height)
    targetSurface.scale.set(target.width, target.height, 1)
    targetOutline.scale.set(target.width, target.height, 1)
    originMarker.position.set(0, 0, referenceSize * 0.075)
    originMarker.scale.setScalar(referenceSize * 0.15)
    const dimensions = fieldDimensions(options.config, pose)
    field?.setDimensions(dimensions.width, dimensions.length)
  }

  const requestAnchorCorrection = (pose: TrackingTargetPose) => {
    if (!root) {
      return
    }
    const desired = desiredTransform(pose)
    const metersPerSceneUnit =
      options.config.mode === 'world-absolute'
        ? 1
        : options.config.targetHeightMeters / (pose.scaledHeight * pose.scale)
    const translationThreshold = (options.config.fieldLengthMeters * 0.02) / metersPerSceneUnit
    const angularDifference = THREE.MathUtils.radToDeg(root.quaternion.angleTo(desired.quaternion))
    if (
      root.position.distanceTo(desired.position) > translationThreshold ||
      angularDifference > 2
    ) {
      recalibrationRequired = true
      correction = null
      return
    }
    correction = {
      endPosition: desired.position,
      endQuaternion: desired.quaternion,
      endScale: desired.scale,
      startPosition: root.position.clone(),
      startQuaternion: root.quaternion.clone(),
      startScale: root.scale.x,
      startedAtMs: now(),
    }
    recalibrationRequired = false
  }

  const showTarget = (event: CameraPipelineEvent) => {
    const pose = parseFlatTargetPose(event.detail)
    if (!pose || pose.name !== options.targetName) {
      return
    }
    const wasLost = targetStatus === 'lost'
    cancelPendingLoss()
    lastPose = pose
    targetStatus = 'visible'
    updateGeometry(pose)

    if (!isWorldMode || !anchorSet) {
      applyPoseImmediately(pose)
    } else if (event.name === 'reality.imagefound' && wasLost) {
      requestAnchorCorrection(pose)
    }
    if (root) {
      root.visible = true
    }
    options.onFound(pose.name)
    const eventAtMs = now()
    if (
      event.name === 'reality.imagefound' ||
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
    cancelPendingLoss()
    pendingLoss = setTimeout(() => {
      pendingLoss = null
      targetStatus = 'lost'
      if (root && !isWorldMode) {
        root.visible = false
      }
      options.onLost(targetName)
      emitSnapshot()
    }, options.targetLossGraceMs ?? TARGET_LOSS_GRACE_MS)
  }

  const handleScanning = () => {
    targetStatus = 'scanning'
    options.onScanning()
    emitSnapshot()
  }

  const handleWorldTracking = (event: CameraPipelineEvent) => {
    const tracking = parseWorldTracking(event)
    if (!tracking || !isWorldMode) {
      return
    }
    worldStatus = tracking.status
    worldReason = tracking.reason
    cancelPendingLimited()
    if (worldStatus === 'limited') {
      pendingLimited = setTimeout(() => {
        pendingLimited = null
        worldLimitedExceeded = true
        correction = null
        emitSnapshot()
      }, WORLD_LIMITED_GRACE_MS)
    } else {
      worldLimitedExceeded = false
    }
    emitSnapshot()
  }

  const updateFrame = () => {
    const frameAtMs = now()
    if (lastFrameAtMs !== null) {
      const elapsed = frameAtMs - lastFrameAtMs
      if (elapsed > 0) {
        framesPerSecond = 1000 / elapsed
      }
    }
    lastFrameAtMs = frameAtMs

    if (root && correction) {
      const progress = Math.min(1, (frameAtMs - correction.startedAtMs) / ANCHOR_CORRECTION_MS)
      root.position.lerpVectors(correction.startPosition, correction.endPosition, progress)
      root.quaternion.slerpQuaternions(
        correction.startQuaternion,
        correction.endQuaternion,
        progress,
      )
      const scale = THREE.MathUtils.lerp(correction.startScale, correction.endScale, progress)
      root.scale.setScalar(scale)
      if (progress === 1) {
        correction = null
      }
    }
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
      onPaused: () => {
        cancelPendingLoss()
        if (root) {
          root.visible = false
        }
      },
      onRemove: disposeScene,
      onResume: handleScanning,
      onStart: initializeScene,
      onUpdate: updateFrame,
    },
    recalibrate() {
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
