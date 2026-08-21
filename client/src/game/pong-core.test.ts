import { describe, expect, it } from 'vitest'

import { PONG_CONFIG, PongGameCore, type PongState } from './pong-core'

function advance(core: PongGameCore, seconds: number): void {
  const steps = Math.ceil(seconds * 60)
  for (let index = 0; index < steps; index += 1) {
    core.step(1 / 60)
  }
}

function playingState(overrides: Partial<PongState> = {}): PongState {
  const state = new PongGameCore().snapshot
  return {
    ...state,
    ...overrides,
    ball: {
      ...state.ball,
      velocityX: 0,
      velocityY: 0.42,
      ...(overrides.ball ?? {}),
    },
    phase: 'playing',
    score: { ...state.score, ...(overrides.score ?? {}) },
  }
}

describe('PongGameCore', () => {
  it('copies state into a reusable buffer without replacing nested objects', () => {
    const core = new PongGameCore()
    const buffer = core.snapshot
    const ball = buffer.ball
    const score = buffer.score

    core.start()
    advance(core, 3.1)
    core.copyStateInto(buffer)

    expect(buffer.ball).toBe(ball)
    expect(buffer.score).toBe(score)
    expect(buffer).toEqual(core.snapshot)
  })

  it('starts with a deterministic three-second serve toward the AI', () => {
    const core = new PongGameCore()
    const comparison = new PongGameCore()

    core.start()
    comparison.start()
    expect(core.snapshot.phase).toBe('countdown')
    advance(core, 2)
    expect(core.snapshot.phase).toBe('countdown')
    advance(core, 1.1)
    advance(comparison, 3.1)

    expect(core.snapshot.phase).toBe('playing')
    expect(core.snapshot).toEqual(comparison.snapshot)
    expect(core.snapshot.ball.velocityX).toBeGreaterThan(0)
    expect(core.snapshot.ball.velocityY).toBeGreaterThan(0)
    expect(Math.hypot(core.snapshot.ball.velocityX, core.snapshot.ball.velocityY)).toBeCloseTo(
      PONG_CONFIG.ballInitialSpeedMetersPerSecond,
      5,
    )
  })

  it('clamps the player paddle and moves it at the configured maximum speed', () => {
    const core = new PongGameCore(playingState())
    core.setPlayerTarget(10)

    core.step(1 / 60)
    expect(core.snapshot.playerPaddleX).toBeCloseTo(
      PONG_CONFIG.playerMaximumSpeedMetersPerSecond / 60,
      5,
    )
    advance(core, 1)
    expect(core.snapshot.playerPaddleX).toBeCloseTo(
      (PONG_CONFIG.fieldWidthMeters - PONG_CONFIG.paddleWidthMeters) / 2,
      5,
    )
  })

  it('reflects from side walls without leaving the playable width', () => {
    const horizontalLimit = PONG_CONFIG.fieldWidthMeters / 2 - PONG_CONFIG.ballRadiusMeters
    const core = new PongGameCore(
      playingState({
        ball: {
          ...playingState().ball,
          velocityX: 0.4,
          velocityY: 0,
          x: horizontalLimit - 0.001,
          y: 0,
        },
      }),
    )

    core.step(1 / 60)

    expect(core.snapshot.ball.x).toBe(horizontalLimit)
    expect(core.snapshot.ball.velocityX).toBeLessThan(0)
  })

  it('changes the bounce angle from the paddle impact and increases ball speed', () => {
    const playerSurface = -0.46 + PONG_CONFIG.paddleDepthMeters / 2
    const initialSpeed = 0.42
    const core = new PongGameCore(
      playingState({
        ball: {
          ...playingState().ball,
          velocityX: 0,
          velocityY: -initialSpeed,
          x: PONG_CONFIG.paddleWidthMeters * 0.35,
          y: playerSurface + PONG_CONFIG.ballRadiusMeters + 0.001,
        },
      }),
    )

    core.step(1 / 60)

    expect(core.snapshot.rallyHits).toBe(1)
    expect(core.snapshot.ball.velocityY).toBeGreaterThan(0)
    expect(core.snapshot.ball.velocityX).toBeGreaterThan(0)
    expect(Math.hypot(core.snapshot.ball.velocityX, core.snapshot.ball.velocityY)).toBeCloseTo(
      initialSpeed + PONG_CONFIG.ballSpeedIncreaseMetersPerSecond,
      5,
    )
  })

  it('supports central and edge paddle impacts and caps the accelerated speed', () => {
    const playerSurface = -0.46 + PONG_CONFIG.paddleDepthMeters / 2
    const collisionState = (x: number, speed: number) =>
      playingState({
        ball: {
          ...playingState().ball,
          velocityX: 0,
          velocityY: -speed,
          x,
          y: playerSurface + PONG_CONFIG.ballRadiusMeters + 0.001,
        },
      })

    const center = new PongGameCore(collisionState(0, 0.42))
    center.step(1 / 60)
    expect(center.snapshot.ball.velocityX).toBeCloseTo(0, 5)

    const edge = new PongGameCore(collisionState(PONG_CONFIG.paddleWidthMeters / 2, 0.64))
    edge.step(1 / 60)
    const edgeBall = edge.snapshot.ball
    expect(Math.hypot(edgeBall.velocityX, edgeBall.velocityY)).toBeCloseTo(
      PONG_CONFIG.ballMaximumSpeedMetersPerSecond,
      5,
    )
    expect(
      Math.atan2(Math.abs(edgeBall.velocityX), Math.abs(edgeBall.velocityY)) * (180 / Math.PI),
    ).toBeCloseTo(PONG_CONFIG.maximumBounceAngleDegrees, 5)
  })

  it('awards points, pauses, counts down and serves toward the player who conceded', () => {
    const scoringLimit = PONG_CONFIG.fieldLengthMeters / 2 + PONG_CONFIG.ballRadiusMeters
    const core = new PongGameCore(
      playingState({
        ball: {
          ...playingState().ball,
          velocityX: 0,
          velocityY: 0.42,
          x: 0.2,
          y: scoringLimit - 0.001,
        },
      }),
    )

    core.step(1 / 60)
    expect(core.snapshot).toMatchObject({ phase: 'point', pointWinner: 'player' })
    expect(core.snapshot.score.player).toBe(1)
    expect(core.snapshot.ball).toMatchObject({ velocityX: 0, velocityY: 0, x: 0, y: 0 })

    advance(core, 1.1)
    expect(core.snapshot.phase).toBe('countdown')
    advance(core, 3.1)
    expect(core.snapshot.phase).toBe('playing')
    expect(core.snapshot.ball.velocityY).toBeGreaterThan(0)
    expect(core.snapshot.ball.velocityX).toBeLessThan(0)
  })

  it('finishes at three points and restarts a fresh match', () => {
    const scoringLimit = PONG_CONFIG.fieldLengthMeters / 2 + PONG_CONFIG.ballRadiusMeters
    const core = new PongGameCore(
      playingState({
        ball: {
          ...playingState().ball,
          velocityX: 0,
          velocityY: 0.42,
          x: 0.2,
          y: scoringLimit - 0.001,
        },
        score: { ai: 2, player: 2 },
      }),
    )

    core.step(1 / 60)
    expect(core.snapshot).toMatchObject({
      phase: 'finished',
      score: { ai: 2, player: 3 },
      winner: 'player',
    })

    core.restart()
    expect(core.snapshot).toMatchObject({
      phase: 'countdown',
      score: { ai: 0, player: 0 },
      winner: null,
    })
  })

  it('moves the AI with a reaction delay, speed limit and fallible return-to-center policy', () => {
    const core = new PongGameCore(
      playingState({
        ball: {
          ...playingState().ball,
          velocityX: 0,
          velocityY: 0.42,
          x: 0.18,
          y: -0.2,
        },
      }),
    )

    core.step(PONG_CONFIG.aiReactionSeconds)
    expect(core.snapshot.aiPaddleX).toBeCloseTo(
      PONG_CONFIG.aiMaximumSpeedMetersPerSecond * PONG_CONFIG.aiReactionSeconds,
      5,
    )

    const returningState = core.snapshot
    returningState.ball.velocityY = -0.42
    const returning = new PongGameCore(returningState)
    returning.step(PONG_CONFIG.aiReactionSeconds)
    expect(Math.abs(returning.snapshot.aiPaddleX)).toBeLessThan(Math.abs(returningState.aiPaddleX))
  })

  it('holds the AI target between reaction ticks and respects its dead zone', () => {
    const moving = new PongGameCore(
      playingState({
        ball: {
          ...playingState().ball,
          velocityX: -0.65,
          velocityY: 0.1,
          x: 0.18,
          y: -0.2,
        },
      }),
    )

    moving.step(0.05)
    const firstPosition = moving.snapshot.aiPaddleX
    moving.step(0.05)
    expect(moving.snapshot.aiPaddleX - firstPosition).toBeCloseTo(
      PONG_CONFIG.aiMaximumSpeedMetersPerSecond * 0.05,
      5,
    )

    const deadZone = new PongGameCore(
      playingState({
        ball: {
          ...playingState().ball,
          velocityX: 0,
          velocityY: 0.42,
          x: PONG_CONFIG.aiDeadZoneMeters / 2,
          y: -0.2,
        },
      }),
    )
    deadZone.step(PONG_CONFIG.aiReactionSeconds)
    expect(deadZone.snapshot.aiPaddleX).toBe(0)
  })
})
