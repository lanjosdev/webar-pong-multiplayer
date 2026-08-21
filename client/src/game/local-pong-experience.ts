import * as THREE from 'three'

import type { AnchoredContent } from '../ar/anchored-content'
import { PONG_CONFIG, PongGameCore, type PongPhase, type PongSide } from './pong-core'

const FIXED_STEP_SECONDS = 1 / 60
const MAX_ACCUMULATED_SECONDS = 0.25
const TRACKING_STABILITY_SECONDS = 0.75
const TRACKING_RESUME_COUNTDOWN_SECONDS = 3

export interface LocalPongViewState {
  aiScore: number
  countdown: number | null
  phase: PongPhase
  playerScore: number
  pointWinner: PongSide | null
  readyAvailable: boolean
  trackingPaused: boolean
  trackingSafe: boolean
  winner: PongSide | null
}

export type LocalPongListener = (state: LocalPongViewState) => void

export interface LocalPongExperience extends AnchoredContent {
  movePlayerBy(deltaNormalized: number): void
  restart(): void
  setTrackingSafe(safe: boolean): void
  start(): void
  subscribe(listener: LocalPongListener): () => void
}

interface OpacityBinding {
  baseOpacity: number
  material: THREE.Material & { opacity: number }
}

function lineGeometry(): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.25, -0.5, 0.006),
    new THREE.Vector3(0.25, -0.5, 0.006),
    new THREE.Vector3(0.25, -0.5, 0.006),
    new THREE.Vector3(0.25, 0.5, 0.006),
    new THREE.Vector3(0.25, 0.5, 0.006),
    new THREE.Vector3(-0.25, 0.5, 0.006),
    new THREE.Vector3(-0.25, 0.5, 0.006),
    new THREE.Vector3(-0.25, -0.5, 0.006),
    new THREE.Vector3(-0.25, 0, 0.007),
    new THREE.Vector3(0.25, 0, 0.007),
  ])
}

export function createLocalPongExperience(): LocalPongExperience {
  const core = new PongGameCore()
  const group = new THREE.Group()
  group.name = 'local-pong-experience'

  const surfaceGeometry = new THREE.PlaneGeometry(
    PONG_CONFIG.fieldWidthMeters,
    PONG_CONFIG.fieldLengthMeters,
  )
  const surfaceMaterial = new THREE.MeshBasicMaterial({
    color: 0x0b2633,
    depthWrite: false,
    opacity: 0.24,
    side: THREE.DoubleSide,
    transparent: true,
  })
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial)

  const boundaryGeometry = lineGeometry()
  const boundaryMaterial = new THREE.LineBasicMaterial({
    color: 0x70e2ff,
    transparent: true,
  })
  const boundary = new THREE.LineSegments(boundaryGeometry, boundaryMaterial)

  const paddleGeometry = new THREE.BoxGeometry(
    PONG_CONFIG.paddleWidthMeters,
    PONG_CONFIG.paddleDepthMeters,
    0.035,
  )
  const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x2196f3, transparent: true })
  const aiMaterial = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true })
  const playerPaddle = new THREE.Mesh(paddleGeometry, playerMaterial)
  playerPaddle.name = 'player-paddle'
  playerPaddle.position.set(0, -0.46, 0.024)
  const aiPaddle = new THREE.Mesh(paddleGeometry, aiMaterial)
  aiPaddle.name = 'ai-paddle'
  aiPaddle.position.set(0, 0.46, 0.024)

  const ballGeometry = new THREE.SphereGeometry(PONG_CONFIG.ballRadiusMeters, 18, 12)
  const ballMaterial = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true })
  const ball = new THREE.Mesh(ballGeometry, ballMaterial)
  ball.name = 'pong-ball'
  ball.position.z = 0.03

  group.add(surface, boundary, playerPaddle, aiPaddle, ball)

  const opacityBindings: OpacityBinding[] = [
    { baseOpacity: 0.24, material: surfaceMaterial },
    { baseOpacity: 1, material: boundaryMaterial },
    { baseOpacity: 1, material: playerMaterial },
    { baseOpacity: 1, material: aiMaterial },
    { baseOpacity: 1, material: ballMaterial },
  ]
  const resources: Array<THREE.BufferGeometry | THREE.Material> = [
    surfaceGeometry,
    surfaceMaterial,
    boundaryGeometry,
    boundaryMaterial,
    paddleGeometry,
    playerMaterial,
    aiMaterial,
    ballGeometry,
    ballMaterial,
  ]
  const listeners = new Set<LocalPongListener>()
  let accumulatorSeconds = 0
  let disposed = false
  let playerTargetX = 0
  let trackingSafe = false
  let stableTrackingSeconds = 0
  let trackingPaused = false
  let recoveryCountdownSeconds: number | null = null
  let lastViewSignature = ''

  const readyAvailable = () => trackingSafe && stableTrackingSeconds >= TRACKING_STABILITY_SECONDS

  const viewState = (): LocalPongViewState => {
    const state = core.snapshot
    const countdown = trackingPaused
      ? recoveryCountdownSeconds === null
        ? null
        : Math.max(1, Math.ceil(recoveryCountdownSeconds))
      : state.phase === 'countdown'
        ? Math.max(1, Math.ceil(state.countdownRemainingSeconds))
        : null
    return {
      aiScore: state.score.ai,
      countdown,
      phase: state.phase,
      playerScore: state.score.player,
      pointWinner: state.pointWinner,
      readyAvailable: readyAvailable(),
      trackingPaused,
      trackingSafe,
      winner: state.winner,
    }
  }

  const emit = (force = false) => {
    const state = viewState()
    const signature = JSON.stringify(state)
    if (!force && signature === lastViewSignature) {
      return
    }
    lastViewSignature = signature
    for (const listener of listeners) {
      listener(state)
    }
  }

  const render = () => {
    const state = core.snapshot
    playerPaddle.position.x = state.playerPaddleX
    aiPaddle.position.x = state.aiPaddleX
    ball.position.x = state.ball.x
    ball.position.y = state.ball.y
  }

  const updateTrackingRecovery = (deltaSeconds: number): boolean => {
    if (!trackingPaused) {
      return false
    }
    if (!trackingSafe || stableTrackingSeconds < TRACKING_STABILITY_SECONDS) {
      recoveryCountdownSeconds = null
      return true
    }
    if (recoveryCountdownSeconds === null) {
      recoveryCountdownSeconds = TRACKING_RESUME_COUNTDOWN_SECONDS
      return true
    }
    recoveryCountdownSeconds = Math.max(0, recoveryCountdownSeconds - deltaSeconds)
    if (recoveryCountdownSeconds === 0) {
      trackingPaused = false
      recoveryCountdownSeconds = null
      accumulatorSeconds = 0
    }
    return true
  }

  render()

  return {
    dispose() {
      if (disposed) {
        return
      }
      group.removeFromParent()
      for (const resource of resources) {
        resource.dispose()
      }
      listeners.clear()
      disposed = true
    },
    movePlayerBy(deltaNormalized) {
      const state = core.snapshot
      if (
        disposed ||
        !Number.isFinite(deltaNormalized) ||
        state.phase !== 'playing' ||
        trackingPaused ||
        !trackingSafe
      ) {
        return
      }
      const playableWidth = PONG_CONFIG.fieldWidthMeters - PONG_CONFIG.paddleWidthMeters
      playerTargetX += deltaNormalized * playableWidth
      const maximumX = playableWidth / 2
      playerTargetX = THREE.MathUtils.clamp(playerTargetX, -maximumX, maximumX)
      core.setPlayerTarget(playerTargetX)
    },
    object3d: group,
    restart() {
      if (disposed || !readyAvailable()) {
        return
      }
      playerTargetX = 0
      core.restart()
      trackingPaused = false
      recoveryCountdownSeconds = null
      accumulatorSeconds = 0
      render()
      emit(true)
    },
    setDimensions(width, length) {
      if (disposed || width <= 0 || length <= 0) {
        return
      }
      const widthScale = width / PONG_CONFIG.fieldWidthMeters
      const lengthScale = length / PONG_CONFIG.fieldLengthMeters
      group.scale.set(widthScale, lengthScale, Math.min(widthScale, lengthScale))
      group.updateMatrixWorld(true)
    },
    setOpacity(opacity) {
      const normalizedOpacity = THREE.MathUtils.clamp(opacity, 0, 1)
      for (const binding of opacityBindings) {
        binding.material.opacity = binding.baseOpacity * normalizedOpacity
      }
    },
    setTrackingSafe(safe) {
      if (disposed || trackingSafe === safe) {
        return
      }
      trackingSafe = safe
      stableTrackingSeconds = 0
      if (!safe) {
        const phase = core.snapshot.phase
        trackingPaused = phase !== 'ready' && phase !== 'finished'
        recoveryCountdownSeconds = null
        accumulatorSeconds = 0
      }
      emit(true)
    },
    start() {
      if (disposed || !readyAvailable() || core.snapshot.phase !== 'ready') {
        return
      }
      playerTargetX = 0
      core.start()
      accumulatorSeconds = 0
      emit(true)
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(viewState())
      return () => listeners.delete(listener)
    },
    update(deltaSeconds) {
      if (disposed || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
        return
      }
      const boundedDelta = Math.min(deltaSeconds, MAX_ACCUMULATED_SECONDS)
      stableTrackingSeconds = trackingSafe
        ? Math.min(TRACKING_STABILITY_SECONDS, stableTrackingSeconds + boundedDelta)
        : 0

      if (!updateTrackingRecovery(boundedDelta)) {
        accumulatorSeconds = Math.min(MAX_ACCUMULATED_SECONDS, accumulatorSeconds + boundedDelta)
        while (accumulatorSeconds >= FIXED_STEP_SECONDS) {
          core.step(FIXED_STEP_SECONDS)
          accumulatorSeconds -= FIXED_STEP_SECONDS
        }
      }
      render()
      emit()
    },
  }
}
