import type {
  CameraDistanceMeters,
  FieldLengthMeters,
  TrackingLabConfig,
  TrackingSnapshot,
  TrackingVector3,
  TrialScenario,
} from './ar'

export const DEFAULT_TRACKING_LAB_CONFIG: TrackingLabConfig = {
  cameraDistanceMeters: 1.25,
  enabled: true,
  fieldLengthMeters: 1.5,
  mode: 'image-only',
  targetHeightMeters: 0.26,
  targetWidthMeters: 0.195,
  trialScenario: 'acquisition',
}

export const FIELD_LENGTH_OPTIONS: FieldLengthMeters[] = [1, 1.5, 2]
export const CAMERA_DISTANCE_OPTIONS: CameraDistanceMeters[] = [0.75, 1, 1.25, 1.5, 2]
export const TRIAL_SCENARIO_OPTIONS: Array<{ label: string; value: TrialScenario }> = [
  { label: 'Aquisição', value: 'acquisition' },
  { label: 'Câmera parada', value: 'stationary' },
  { label: 'Movimento lento', value: 'movement' },
  { label: 'Reaquisição', value: 'reacquisition' },
  { label: 'Sessão térmica', value: 'thermal' },
]

export const TARGET_SIZE_OPTIONS = [
  { heightMeters: 0.2, label: '150 × 200 mm', widthMeters: 0.15 },
  { heightMeters: 0.26, label: '195 × 260 mm', widthMeters: 0.195 },
  { heightMeters: 0.24, label: '180 × 240 mm (fallback)', widthMeters: 0.18 },
] as const

interface TrackingLabEnvironment {
  browser: string
  device: string
  orientation: string
  viewportHeight: number
  viewportWidth: number
}

interface LossInterval {
  durationMs: number | null
  startedAtMs: number
}

export interface TrackingTrialMetrics {
  acquisitionTimeMs: number | null
  completedLossCount: number
  driftMeters: number | null
  jitterP95Meters: number | null
  maximumLossDurationMs: number | null
  medianFramesPerSecond: number | null
  recalibrationRequired: boolean
  worldLimitedDurationMs: number
  worldLimitedExceeded: boolean
}

export interface TrackingTrialReport {
  config: TrackingLabConfig
  endedAt: string
  environment: TrackingLabEnvironment
  lossIntervals: LossInterval[]
  metrics: TrackingTrialMetrics
  samples: TrackingSnapshot[]
  schemaVersion: 1
  startedAt: string
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  return sorted[index] ?? null
}

function distance(left: TrackingVector3, right: TrackingVector3): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

function average(points: TrackingVector3[]): TrackingVector3 | null {
  if (points.length === 0) {
    return null
  }

  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y, z: sum.z + point.z }),
    { x: 0, y: 0, z: 0 },
  )
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  }
}

function calculateCornerMetrics(samples: TrackingSnapshot[]): {
  driftMeters: number | null
  jitterP95Meters: number | null
} {
  const cornerSamples = samples.filter(({ fieldCorners }) => fieldCorners.length === 4)
  if (cornerSamples.length < 2) {
    return { driftMeters: null, jitterP95Meters: null }
  }

  let maximumDrift = 0
  const allDeviations: number[] = []
  const edgeWindow = Math.max(1, Math.floor(cornerSamples.length * 0.1))

  for (let cornerIndex = 0; cornerIndex < 4; cornerIndex += 1) {
    const points = cornerSamples
      .map(({ fieldCorners, metersPerSceneUnit }) => {
        const point = fieldCorners[cornerIndex]
        return point
          ? {
              x: point.x * metersPerSceneUnit,
              y: point.y * metersPerSceneUnit,
              z: point.z * metersPerSceneUnit,
            }
          : undefined
      })
      .filter((point): point is TrackingVector3 => point !== undefined)
    const center = average(points)
    const start = average(points.slice(0, edgeWindow))
    const end = average(points.slice(-edgeWindow))
    if (!center || !start || !end) {
      continue
    }

    allDeviations.push(...points.map((point) => distance(point, center)))
    maximumDrift = Math.max(maximumDrift, distance(start, end))
  }

  return {
    driftMeters: maximumDrift,
    jitterP95Meters: percentile(allDeviations, 0.95),
  }
}

function calculateWorldLimitedDuration(samples: TrackingSnapshot[], endedAtMs: number): number {
  let limitedStartedAt: number | null = null
  let total = 0

  for (const sample of samples) {
    if (sample.worldStatus === 'limited' && limitedStartedAt === null) {
      limitedStartedAt = sample.timestampMs
    } else if (sample.worldStatus !== 'limited' && limitedStartedAt !== null) {
      total += sample.timestampMs - limitedStartedAt
      limitedStartedAt = null
    }
  }

  return total + (limitedStartedAt === null ? 0 : endedAtMs - limitedStartedAt)
}

export class TrackingTrialRecorder {
  private config: TrackingLabConfig | null = null
  private environment: TrackingLabEnvironment | null = null
  private lossIntervals: LossInterval[] = []
  private samples: TrackingSnapshot[] = []
  private startedAt: Date | null = null
  private startedAtMs = 0
  private acquisitionTimeMs: number | null = null
  private openLossIndex: number | null = null

  get isRecording(): boolean {
    return this.startedAt !== null
  }

  start(config: TrackingLabConfig, environment: TrackingLabEnvironment, now = new Date()): void {
    this.config = { ...config }
    this.environment = { ...environment }
    this.lossIntervals = []
    this.samples = []
    this.startedAt = now
    this.startedAtMs = now.getTime()
    this.acquisitionTimeMs = null
    this.openLossIndex = null
  }

  add(snapshot: TrackingSnapshot): void {
    if (!this.isRecording) {
      return
    }

    const previous = this.samples.at(-1)
    this.samples.push(structuredClone(snapshot))

    if (this.acquisitionTimeMs === null && snapshot.targetStatus === 'visible') {
      this.acquisitionTimeMs = Math.max(0, snapshot.timestampMs - this.startedAtMs)
    }

    if (snapshot.targetStatus === 'lost' && previous?.targetStatus !== 'lost') {
      this.lossIntervals.push({ durationMs: null, startedAtMs: snapshot.timestampMs })
      this.openLossIndex = this.lossIntervals.length - 1
    } else if (snapshot.targetStatus === 'visible' && this.openLossIndex !== null) {
      const interval = this.lossIntervals[this.openLossIndex]
      if (interval) {
        interval.durationMs = snapshot.timestampMs - interval.startedAtMs
      }
      this.openLossIndex = null
    }
  }

  finish(now = new Date()): TrackingTrialReport {
    if (!this.config || !this.environment || !this.startedAt) {
      throw new Error('Nenhum ensaio de tracking está em andamento.')
    }

    const { driftMeters, jitterP95Meters } = calculateCornerMetrics(this.samples)
    const fpsValues = this.samples
      .map(({ framesPerSecond }) => framesPerSecond)
      .filter((value): value is number => value !== null && Number.isFinite(value))
    const completedLosses = this.lossIntervals.filter(({ durationMs }) => durationMs !== null)
    const report: TrackingTrialReport = {
      config: { ...this.config },
      endedAt: now.toISOString(),
      environment: { ...this.environment },
      lossIntervals: this.lossIntervals.map((interval) => ({ ...interval })),
      metrics: {
        acquisitionTimeMs: this.acquisitionTimeMs,
        completedLossCount: completedLosses.length,
        driftMeters,
        jitterP95Meters,
        maximumLossDurationMs:
          percentile(
            completedLosses
              .map(({ durationMs }) => durationMs)
              .filter((duration): duration is number => duration !== null),
            1,
          ) ?? null,
        medianFramesPerSecond: percentile(fpsValues, 0.5),
        recalibrationRequired: this.samples.some(
          ({ recalibrationRequired }) => recalibrationRequired,
        ),
        worldLimitedDurationMs: calculateWorldLimitedDuration(this.samples, now.getTime()),
        worldLimitedExceeded: this.samples.some(({ worldLimitedExceeded }) => worldLimitedExceeded),
      },
      samples: this.samples.map((sample) => structuredClone(sample)),
      schemaVersion: 1,
      startedAt: this.startedAt.toISOString(),
    }

    this.config = null
    this.environment = null
    this.startedAt = null
    this.samples = []
    this.lossIntervals = []
    this.openLossIndex = null
    return report
  }
}

export function reportFilename(report: TrackingTrialReport): string {
  const timestamp = report.startedAt.replaceAll(/[:.]/g, '-').replace('Z', '')
  return `tracking-${report.config.mode}-${String(report.config.fieldLengthMeters)}m-${timestamp}.json`
}
