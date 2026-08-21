export const PONG_CONFIG = {
  aiDeadZoneMeters: 0.02,
  aiMaximumSpeedMetersPerSecond: 0.24,
  aiReactionSeconds: 0.15,
  ballInitialSpeedMetersPerSecond: 0.42,
  ballMaximumSpeedMetersPerSecond: 0.65,
  ballRadiusMeters: 0.018,
  ballSpeedIncreaseMetersPerSecond: 0.025,
  countdownSeconds: 3,
  fieldLengthMeters: 1,
  fieldWidthMeters: 0.5,
  maximumBounceAngleDegrees: 55,
  paddleDepthMeters: 0.025,
  paddleWidthMeters: 0.14,
  playerMaximumSpeedMetersPerSecond: 1.2,
  pointPauseSeconds: 1,
  scoreToWin: 5,
} as const

export type PongSide = 'ai' | 'player'
export type PongPhase = 'countdown' | 'finished' | 'playing' | 'point' | 'ready'

export interface PongBallState {
  radius: number
  velocityX: number
  velocityY: number
  x: number
  y: number
}

export interface PongState {
  aiPaddleX: number
  ball: PongBallState
  countdownRemainingSeconds: number
  phase: PongPhase
  playerPaddleX: number
  pointRemainingSeconds: number
  pointWinner: PongSide | null
  rallyHits: number
  score: { ai: number; player: number }
  totalPoints: number
  winner: PongSide | null
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function moveToward(current: number, target: number, maximumDelta: number): number {
  const delta = target - current
  if (Math.abs(delta) <= maximumDelta) {
    return target
  }
  return current + Math.sign(delta) * maximumDelta
}

function blankState(): PongState {
  return {
    aiPaddleX: 0,
    ball: {
      radius: PONG_CONFIG.ballRadiusMeters,
      velocityX: 0,
      velocityY: 0,
      x: 0,
      y: 0,
    },
    countdownRemainingSeconds: 0,
    phase: 'ready',
    playerPaddleX: 0,
    pointRemainingSeconds: 0,
    pointWinner: null,
    rallyHits: 0,
    score: { ai: 0, player: 0 },
    totalPoints: 0,
    winner: null,
  }
}

export class PongGameCore {
  private aiReactionRemainingSeconds = 0
  private aiTargetX = 0
  private playerTargetX = 0
  private serveToward: PongSide = 'ai'
  private state = blankState()

  constructor(initialState?: PongState) {
    if (initialState) {
      this.state = structuredClone(initialState)
      this.playerTargetX = initialState.playerPaddleX
      this.aiTargetX = initialState.aiPaddleX
    }
  }

  get snapshot(): PongState {
    return structuredClone(this.state)
  }

  start(): void {
    if (this.state.phase !== 'ready') {
      return
    }
    this.serveToward = 'ai'
    this.beginCountdown()
  }

  restart(): void {
    this.state = blankState()
    this.playerTargetX = 0
    this.aiTargetX = 0
    this.aiReactionRemainingSeconds = 0
    this.serveToward = 'ai'
    this.beginCountdown()
  }

  setPlayerTarget(x: number): void {
    this.playerTargetX = clamp(x, -this.maximumPaddleX(), this.maximumPaddleX())
  }

  step(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return
    }
    const delta = Math.min(deltaSeconds, 0.25)

    if (this.state.phase === 'countdown') {
      this.state.countdownRemainingSeconds = Math.max(
        0,
        this.state.countdownRemainingSeconds - delta,
      )
      if (this.state.countdownRemainingSeconds === 0) {
        this.launchServe()
      }
      return
    }

    if (this.state.phase === 'point') {
      this.state.pointRemainingSeconds = Math.max(0, this.state.pointRemainingSeconds - delta)
      if (this.state.pointRemainingSeconds === 0) {
        this.beginCountdown()
      }
      return
    }

    if (this.state.phase !== 'playing') {
      return
    }

    this.updatePaddles(delta)
    this.updateBall(delta)
  }

  private maximumPaddleX(): number {
    return (PONG_CONFIG.fieldWidthMeters - PONG_CONFIG.paddleWidthMeters) / 2
  }

  private beginCountdown(): void {
    this.resetRoundObjects()
    this.state.phase = 'countdown'
    this.state.countdownRemainingSeconds = PONG_CONFIG.countdownSeconds
    this.state.pointRemainingSeconds = 0
    this.state.pointWinner = null
  }

  private resetRoundObjects(): void {
    this.state.ball.x = 0
    this.state.ball.y = 0
    this.state.ball.velocityX = 0
    this.state.ball.velocityY = 0
    this.state.playerPaddleX = 0
    this.state.aiPaddleX = 0
    this.state.rallyHits = 0
    this.playerTargetX = 0
    this.aiTargetX = 0
    this.aiReactionRemainingSeconds = 0
  }

  private launchServe(): void {
    const directionY = this.serveToward === 'ai' ? 1 : -1
    const directionX = this.state.totalPoints % 2 === 0 ? 1 : -1
    const angle = (20 * Math.PI) / 180
    const speed = PONG_CONFIG.ballInitialSpeedMetersPerSecond
    this.state.ball.velocityX = Math.sin(angle) * speed * directionX
    this.state.ball.velocityY = Math.cos(angle) * speed * directionY
    this.state.phase = 'playing'
  }

  private updatePaddles(deltaSeconds: number): void {
    this.state.playerPaddleX = moveToward(
      this.state.playerPaddleX,
      this.playerTargetX,
      PONG_CONFIG.playerMaximumSpeedMetersPerSecond * deltaSeconds,
    )

    this.aiReactionRemainingSeconds -= deltaSeconds
    if (this.aiReactionRemainingSeconds <= 0) {
      this.aiTargetX = this.state.ball.velocityY > 0 ? this.state.ball.x : 0
      this.aiReactionRemainingSeconds += PONG_CONFIG.aiReactionSeconds
    }
    const aiDelta = this.aiTargetX - this.state.aiPaddleX
    if (Math.abs(aiDelta) > PONG_CONFIG.aiDeadZoneMeters) {
      this.state.aiPaddleX = moveToward(
        this.state.aiPaddleX,
        clamp(this.aiTargetX, -this.maximumPaddleX(), this.maximumPaddleX()),
        PONG_CONFIG.aiMaximumSpeedMetersPerSecond * deltaSeconds,
      )
    }
  }

  private updateBall(deltaSeconds: number): void {
    const previousX = this.state.ball.x
    const previousY = this.state.ball.y
    this.state.ball.x += this.state.ball.velocityX * deltaSeconds
    this.state.ball.y += this.state.ball.velocityY * deltaSeconds

    const horizontalLimit = PONG_CONFIG.fieldWidthMeters / 2 - this.state.ball.radius
    if (this.state.ball.x < -horizontalLimit) {
      this.state.ball.x = -horizontalLimit
      this.state.ball.velocityX = Math.abs(this.state.ball.velocityX)
    } else if (this.state.ball.x > horizontalLimit) {
      this.state.ball.x = horizontalLimit
      this.state.ball.velocityX = -Math.abs(this.state.ball.velocityX)
    }

    this.resolvePaddleCollision(previousX, previousY, 'player')
    this.resolvePaddleCollision(previousX, previousY, 'ai')

    const scoringLimit = PONG_CONFIG.fieldLengthMeters / 2 + this.state.ball.radius
    if (this.state.ball.y < -scoringLimit) {
      this.awardPoint('ai')
    } else if (this.state.ball.y > scoringLimit) {
      this.awardPoint('player')
    }
  }

  private resolvePaddleCollision(previousX: number, previousY: number, side: PongSide): void {
    const paddleY = side === 'player' ? -0.46 : 0.46
    const surfaceY = paddleY + (side === 'player' ? 1 : -1) * (PONG_CONFIG.paddleDepthMeters / 2)
    const movingToward =
      side === 'player' ? this.state.ball.velocityY < 0 : this.state.ball.velocityY > 0
    const crossedSurface =
      side === 'player'
        ? previousY - this.state.ball.radius > surfaceY &&
          this.state.ball.y - this.state.ball.radius <= surfaceY
        : previousY + this.state.ball.radius < surfaceY &&
          this.state.ball.y + this.state.ball.radius >= surfaceY
    if (!movingToward || !crossedSurface) {
      return
    }

    const paddleX = side === 'player' ? this.state.playerPaddleX : this.state.aiPaddleX
    const impactX = (previousX + this.state.ball.x) / 2
    const collisionHalfWidth = PONG_CONFIG.paddleWidthMeters / 2 + this.state.ball.radius
    if (Math.abs(impactX - paddleX) > collisionHalfWidth) {
      return
    }

    const currentSpeed = Math.hypot(this.state.ball.velocityX, this.state.ball.velocityY)
    const nextSpeed = Math.min(
      PONG_CONFIG.ballMaximumSpeedMetersPerSecond,
      currentSpeed + PONG_CONFIG.ballSpeedIncreaseMetersPerSecond,
    )
    const normalizedOffset = clamp((impactX - paddleX) / (PONG_CONFIG.paddleWidthMeters / 2), -1, 1)
    const angle = normalizedOffset * ((PONG_CONFIG.maximumBounceAngleDegrees * Math.PI) / 180)
    this.state.ball.x = impactX
    this.state.ball.y = surfaceY + (side === 'player' ? 1 : -1) * this.state.ball.radius
    this.state.ball.velocityX = Math.sin(angle) * nextSpeed
    this.state.ball.velocityY = Math.cos(angle) * nextSpeed * (side === 'player' ? 1 : -1)
    this.state.rallyHits += 1
  }

  private awardPoint(side: PongSide): void {
    this.state.score[side] += 1
    this.state.totalPoints += 1
    this.state.ball.x = 0
    this.state.ball.y = 0
    this.state.ball.velocityX = 0
    this.state.ball.velocityY = 0
    this.state.pointWinner = side
    if (this.state.score[side] >= PONG_CONFIG.scoreToWin) {
      this.state.phase = 'finished'
      this.state.winner = side
      return
    }

    this.serveToward = side === 'player' ? 'ai' : 'player'
    this.state.phase = 'point'
    this.state.pointRemainingSeconds = PONG_CONFIG.pointPauseSeconds
    this.state.playerPaddleX = 0
    this.state.aiPaddleX = 0
    this.playerTargetX = 0
    this.aiTargetX = 0
  }
}
