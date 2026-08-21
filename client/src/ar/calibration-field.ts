import * as THREE from 'three'

import type { TrackingVector3 } from './types'

const LINE_Z = 0.006

export interface CalibrationField {
  dispose(): void
  fieldCorners(): TrackingVector3[]
  group: THREE.Group
  setDimensions(width: number, length: number): void
  setOpacity(opacity: number): void
}

function lineGeometry(): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.5, -0.5, LINE_Z),
    new THREE.Vector3(0.5, -0.5, LINE_Z),
    new THREE.Vector3(0.5, -0.5, LINE_Z),
    new THREE.Vector3(0.5, 0.5, LINE_Z),
    new THREE.Vector3(0.5, 0.5, LINE_Z),
    new THREE.Vector3(-0.5, 0.5, LINE_Z),
    new THREE.Vector3(-0.5, 0.5, LINE_Z),
    new THREE.Vector3(-0.5, -0.5, LINE_Z),
    new THREE.Vector3(-0.5, 0, LINE_Z),
    new THREE.Vector3(0.5, 0, LINE_Z),
    new THREE.Vector3(0, -0.5, LINE_Z),
    new THREE.Vector3(0, 0.5, LINE_Z),
  ])
}

export function createCalibrationField(): CalibrationField {
  const group = new THREE.Group()
  group.name = 'tracking-lab-calibration-field'

  const surfaceGeometry = new THREE.PlaneGeometry(1, 1)
  const surfaceMaterial = new THREE.MeshBasicMaterial({
    color: 0x143c51,
    depthWrite: false,
    opacity: 0.22,
    side: THREE.DoubleSide,
    transparent: true,
  })
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial)

  const boundaryGeometry = lineGeometry()
  const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x70e2ff, transparent: true })
  const boundary = new THREE.LineSegments(boundaryGeometry, boundaryMaterial)

  const markerGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.05)
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffbf47, transparent: true })
  for (const [x, y] of [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ] as const) {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial)
    marker.position.set(x, y, 0.025)
    group.add(marker)
  }

  const endBarGeometry = new THREE.BoxGeometry(0.45, 0.025, 0.035)
  const endBarMaterial = new THREE.MeshBasicMaterial({ color: 0xff6d9f, transparent: true })
  for (const y of [-0.47, 0.47]) {
    const endBar = new THREE.Mesh(endBarGeometry, endBarMaterial)
    endBar.position.set(0, y, 0.018)
    group.add(endBar)
  }

  group.add(surface, boundary)
  let disposed = false

  return {
    dispose() {
      if (disposed) {
        return
      }
      surfaceGeometry.dispose()
      surfaceMaterial.dispose()
      boundaryGeometry.dispose()
      boundaryMaterial.dispose()
      markerGeometry.dispose()
      markerMaterial.dispose()
      endBarGeometry.dispose()
      endBarMaterial.dispose()
      disposed = true
    },
    fieldCorners() {
      group.updateWorldMatrix(true, false)
      return [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([x, y]) => {
        const point = group.localToWorld(new THREE.Vector3(x, y, 0))
        return { x: point.x, y: point.y, z: point.z }
      })
    },
    group,
    setDimensions(width, length) {
      group.scale.set(width, length, Math.min(width, length))
      group.updateMatrixWorld(true)
    },
    setOpacity(opacity) {
      const normalizedOpacity = THREE.MathUtils.clamp(opacity, 0, 1)
      surfaceMaterial.opacity = 0.22 * normalizedOpacity
      boundaryMaterial.opacity = normalizedOpacity
      markerMaterial.opacity = normalizedOpacity
      endBarMaterial.opacity = normalizedOpacity
    },
  }
}
