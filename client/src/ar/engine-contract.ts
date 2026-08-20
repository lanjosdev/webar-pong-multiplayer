export type CameraStatus = 'requesting' | 'hasStream' | 'hasVideo' | 'failed'

export interface CameraPipelineModule {
  name: string
  onCameraStatusChange?(event: { status: CameraStatus }): void
  onDeviceOrientationChange?(): void
  onException?(error: unknown): void
  onResume?(): void
}

export interface XrEngine {
  GlTextureRenderer: {
    pipelineModule(): CameraPipelineModule
  }
  XrConfig: {
    camera(): { BACK: unknown }
    device(): { MOBILE: unknown }
  }
  XrController: {
    configure(options: { disableWorldTracking: boolean }): void
    pipelineModule(): CameraPipelineModule
  }
  addCameraPipelineModules(modules: CameraPipelineModule[]): void
  removeCameraPipelineModules(modules: CameraPipelineModule[]): void
  run(options: {
    canvas: HTMLCanvasElement
    allowedDevices: unknown
    cameraConfig: { direction: unknown }
    glContextConfig: { alpha: false; preserveDrawingBuffer: false }
  }): void
  pause(): void
  resume(): void
  stop(): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasFunction(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'function'
}

function hasEngineModule(value: unknown, functions: string[]): boolean {
  return isRecord(value) && functions.every((key) => hasFunction(value, key))
}

export function parseXrEngine(value: unknown): XrEngine | null {
  if (!isRecord(value)) {
    return null
  }

  const xrConfig = value['XrConfig']
  const hasRequiredApi =
    hasEngineModule(value['GlTextureRenderer'], ['pipelineModule']) &&
    hasEngineModule(value['XrController'], ['configure', 'pipelineModule']) &&
    isRecord(xrConfig) &&
    hasFunction(xrConfig, 'camera') &&
    hasFunction(xrConfig, 'device') &&
    [
      'addCameraPipelineModules',
      'removeCameraPipelineModules',
      'run',
      'pause',
      'resume',
      'stop',
    ].every((key) => hasFunction(value, key))

  return hasRequiredApi ? (value as unknown as XrEngine) : null
}
