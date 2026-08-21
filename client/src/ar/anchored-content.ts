import type { Object3D } from 'three'

export interface AnchoredContent {
  readonly object3d: Object3D
  dispose(): void
  setDimensions(width: number, length: number): void
  setOpacity(opacity: number): void
  update(deltaSeconds: number): void
}
