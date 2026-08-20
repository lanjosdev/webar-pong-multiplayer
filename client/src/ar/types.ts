export type ArRuntimeState =
  | { status: 'booting' }
  | { status: 'camera-permission' }
  | { status: 'requesting-camera' }
  | { status: 'camera-active' }
  | { status: 'paused' }
  | { status: 'recovering' }
  | { status: 'camera-denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'fatal-error'; message: string }
  | { status: 'disposed' }

export type ArRuntimeListener = (state: ArRuntimeState) => void

export interface ArRuntime {
  preload(): Promise<void>
  start(canvas: HTMLCanvasElement): Promise<void>
  retry(): Promise<void>
  stop(): void
  subscribe(listener: ArRuntimeListener): () => void
  dispose(): void
}
