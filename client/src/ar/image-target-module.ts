import * as THREE from 'three'

import type { CameraPipelineEvent, CameraPipelineModule, XrEngine } from './engine-contract'

export const IMAGE_TARGET_MODULE_NAME = 'pong-image-target'
export const TARGET_LOSS_GRACE_MS = 300

interface Vector3Data {
  x: number
  y: number
  z: number
}

interface QuaternionData extends Vector3Data {
  w: number
}

interface FlatTargetPose {
  name: string
  position: Vector3Data
  rotation: QuaternionData
  scale: number
  scaledHeight: number
  scaledWidth: number
}

export interface ImageTargetModuleOptions {
  engine: XrEngine
  onFound(targetName: string): void
  onLost(targetName: string): void
  onScanning(): void
  targetName: string
  targetLossGraceMs?: number
}

export interface ThreeGlobalHandle {
  dispose(): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseVector3(value: unknown): Vector3Data | null {
  if (!isRecord(value)) {
    return null
  }

  const { x, y, z } = value
  return typeof x === 'number' && typeof y === 'number' && typeof z === 'number'
    ? { x, y, z }
    : null
}

function parseQuaternion(value: unknown): QuaternionData | null {
  const vector = parseVector3(value)
  if (!vector || !isRecord(value) || typeof value['w'] !== 'number') {
    return null
  }

  return { ...vector, w: value['w'] }
}

function parseFlatTargetPose(value: unknown): FlatTargetPose | null {
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
    typeof scaledHeight !== 'number' ||
    typeof scaledWidth !== 'number'
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

export function createImageTargetModule(options: ImageTargetModuleOptions): CameraPipelineModule {
  let scene: THREE.Scene | null = null
  let root: THREE.Group | null = null
  let targetSurface: THREE.Mesh | null = null
  let targetOutline: THREE.LineSegments | null = null
  let originMarker: THREE.Mesh | null = null
  let resources: Array<THREE.BufferGeometry | THREE.Material> = []
  let pendingLoss: ReturnType<typeof setTimeout> | null = null

  const cancelPendingLoss = () => {
    if (pendingLoss !== null) {
      clearTimeout(pendingLoss)
      pendingLoss = null
    }
  }

  const disposeScene = () => {
    cancelPendingLoss()
    if (root && scene) {
      scene.remove(root)
    }
    for (const resource of resources) {
      resource.dispose()
    }
    resources = []
    scene = null
    root = null
    targetSurface = null
    targetOutline = null
    originMarker = null
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
      opacity: 0.18,
      side: THREE.DoubleSide,
      transparent: true,
    })
    const outlineGeometry = new THREE.EdgesGeometry(planeGeometry)
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x52e5ff })
    const markerGeometry = new THREE.BoxGeometry(1, 1, 1)
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffbf47 })

    const nextRoot = new THREE.Group()
    const nextSurface = new THREE.Mesh(planeGeometry, planeMaterial)
    const nextOutline = new THREE.LineSegments(outlineGeometry, outlineMaterial)
    const nextOriginMarker = new THREE.Mesh(markerGeometry, markerMaterial)
    nextRoot.visible = false
    nextRoot.add(nextSurface, nextOutline, nextOriginMarker)
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

  const showTarget = (event: CameraPipelineEvent) => {
    const pose = parseFlatTargetPose(event.detail)
    if (!pose || pose.name !== options.targetName) {
      return
    }

    cancelPendingLoss()

    if (root && targetSurface && targetOutline && originMarker) {
      const referenceSize = Math.min(pose.scaledWidth, pose.scaledHeight)
      root.position.set(pose.position.x, pose.position.y, pose.position.z)
      root.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w)
      root.scale.setScalar(pose.scale)
      targetSurface.scale.set(pose.scaledWidth, pose.scaledHeight, 1)
      targetOutline.scale.set(pose.scaledWidth, pose.scaledHeight, 1)
      originMarker.position.set(0, 0, referenceSize * 0.075)
      originMarker.scale.setScalar(referenceSize * 0.15)
      root.visible = true
    }
    options.onFound(pose.name)
  }

  const scheduleTargetLoss = (event: CameraPipelineEvent) => {
    const targetName = targetNameFromEvent(event)
    if (targetName !== options.targetName) {
      return
    }

    cancelPendingLoss()
    pendingLoss = setTimeout(() => {
      pendingLoss = null
      if (root) {
        root.visible = false
      }
      options.onLost(targetName)
    }, options.targetLossGraceMs ?? TARGET_LOSS_GRACE_MS)
  }

  return {
    listeners: [
      { event: 'reality.imagescanning', process: () => options.onScanning() },
      { event: 'reality.imagefound', process: showTarget },
      { event: 'reality.imageupdated', process: showTarget },
      { event: 'reality.imagelost', process: scheduleTargetLoss },
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
    onResume: () => options.onScanning(),
    onStart: initializeScene,
  }
}
