import * as THREE from 'three'

import type { AnchoredContent } from '../ar/anchored-content'
import { PONG_CONFIG, PongGameCore, type PongPhase, type PongSide } from './pong-core'

const FIXED_STEP_SECONDS = 1 / 60
const MAX_ACCUMULATED_SECONDS = 0.25
const TRACKING_STABILITY_SECONDS = 0.75
const TRACKING_RESUME_COUNTDOWN_SECONDS = 3
const TRACKING_BRIEF_RESUME_SECONDS = 1
const ANCHOR_CORRECTION_WINDOW_SECONDS = 0.75

export type TrackingPauseCause = 'anchor' | 'lifecycle' | 'world'

export interface LocalPongTrackingState {
  cause: TrackingPauseCause | null
  safe: boolean
}

export interface LocalPongViewState {
  aiScore: number
  countdown: number | null
  phase: PongPhase
  playerScore: number
  pointWinner: PongSide | null
  readyAvailable: boolean
  trackingPaused: boolean
  trackingPauseCause: TrackingPauseCause | null
  trackingSafe: boolean
  winner: PongSide | null
}

export type LocalPongListener = (state: LocalPongViewState) => void

export interface LocalPongExperience extends AnchoredContent {
  movePlayerBy(deltaNormalized: number): void
  restart(): void
  setTrackingState(state: LocalPongTrackingState): void
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
  const renderState = core.snapshot
  let accumulatorSeconds = 0
  let disposed = false
  let playerTargetX = 0
  let trackingSafe = false
  let stableTrackingSeconds = 0
  let trackingPaused = false
  let trackingPauseCause: TrackingPauseCause | null = null
  let recoveryCountdownSeconds: number | null = null
  let lastViewState: LocalPongViewState | null = null

  const readyAvailable = () => trackingSafe && stableTrackingSeconds >= TRACKING_STABILITY_SECONDS

  const currentCountdown = () =>
    trackingPaused
      ? recoveryCountdownSeconds === null
        ? null
        : Math.max(1, Math.ceil(recoveryCountdownSeconds))
      : renderState.phase === 'countdown'
        ? Math.max(1, Math.ceil(renderState.countdownRemainingSeconds))
        : null

  const viewState = (): LocalPongViewState => {
    return {
      aiScore: renderState.score.ai,
      countdown: currentCountdown(),
      phase: renderState.phase,
      playerScore: renderState.score.player,
      pointWinner: renderState.pointWinner,
      readyAvailable: readyAvailable(),
      trackingPaused,
      trackingPauseCause,
      trackingSafe,
      winner: renderState.winner,
    }
  }

  const emit = (force = false) => {
    const countdown = currentCountdown()
    if (
      !force &&
      lastViewState &&
      lastViewState.aiScore === renderState.score.ai &&
      lastViewState.countdown === countdown &&
      lastViewState.phase === renderState.phase &&
      lastViewState.playerScore === renderState.score.player &&
      lastViewState.pointWinner === renderState.pointWinner &&
      lastViewState.readyAvailable === readyAvailable() &&
      lastViewState.trackingPaused === trackingPaused &&
      lastViewState.trackingPauseCause === trackingPauseCause &&
      lastViewState.trackingSafe === trackingSafe &&
      lastViewState.winner === renderState.winner
    ) {
      return
    }
    const state = viewState()
    lastViewState = state
    for (const listener of listeners) {
      listener(state)
    }
  }

  const render = () => {
    playerPaddle.position.x = renderState.playerPaddleX
    aiPaddle.position.x = renderState.aiPaddleX
    ball.position.x = renderState.ball.x
    ball.position.y = renderState.ball.y
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
      if (renderState.phase === 'point') {
        trackingPaused = false
        trackingPauseCause = null
        accumulatorSeconds = 0
        return false
      }
      if (renderState.phase === 'countdown' && trackingPauseCause !== 'world') {
        core.restartCountdown()
        core.copyStateInto(renderState)
        trackingPaused = false
        trackingPauseCause = null
        accumulatorSeconds = 0
        return false
      }
      recoveryCountdownSeconds =
        trackingPauseCause === 'world'
          ? TRACKING_BRIEF_RESUME_SECONDS
          : TRACKING_RESUME_COUNTDOWN_SECONDS
      return true
    }
    recoveryCountdownSeconds = Math.max(0, recoveryCountdownSeconds - deltaSeconds)
    if (recoveryCountdownSeconds === 0) {
      trackingPaused = false
      trackingPauseCause = null
      recoveryCountdownSeconds = null
      accumulatorSeconds = 0
    }
    return true
  }

  render()
  lastViewState = viewState()

  return {
    canApplyAnchorCorrection() {
      return (
        renderState.phase === 'ready' ||
        renderState.phase === 'finished' ||
        (renderState.phase === 'point' &&
          renderState.pointRemainingSeconds >= ANCHOR_CORRECTION_WINDOW_SECONDS)
      )
    },
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
      if (
        disposed ||
        !Number.isFinite(deltaNormalized) ||
        renderState.phase !== 'playing' ||
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
      core.copyStateInto(renderState)
      trackingPaused = false
      trackingPauseCause = null
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
    setTrackingState(nextState) {
      if (disposed) {
        return
      }
      const causePriority = (cause: TrackingPauseCause | null) =>
        cause === 'world' ? 1 : cause === null ? 0 : 2
      const shouldPromoteCause =
        !nextState.safe && causePriority(nextState.cause) > causePriority(trackingPauseCause)
      if (trackingSafe === nextState.safe && !shouldPromoteCause) {
        return
      }
      trackingSafe = nextState.safe
      stableTrackingSeconds = 0
      if (!nextState.safe) {
        if (shouldPromoteCause || trackingPauseCause === null) {
          trackingPauseCause = nextState.cause
        }
        const phase = renderState.phase
        trackingPaused = phase !== 'ready' && phase !== 'finished'
        recoveryCountdownSeconds = null
        accumulatorSeconds = 0
      } else if (!trackingPaused) {
        trackingPauseCause = null
      }
      emit(true)
    },
    start() {
      if (disposed || !readyAvailable() || renderState.phase !== 'ready') {
        return
      }
      playerTargetX = 0
      core.start()
      core.copyStateInto(renderState)
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
      core.copyStateInto(renderState)
      render()
      emit()
    },
  }
}
