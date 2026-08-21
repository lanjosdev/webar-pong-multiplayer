import {
  createDefaultArRuntime,
  type ArRuntime,
  type ArRuntimeState,
  type PerformanceProfile,
  type TrackingSnapshot,
} from './ar'
import {
  createLocalPongExperience,
  type LocalPongExperience,
  type LocalPongTrackingState,
  type LocalPongViewState,
} from './game/local-pong-experience'
import { createTrackingLabUi } from './tracking-lab-ui'

export interface AppHandle {
  dispose(): void
}

export interface MountAppOptions {
  pongExperience?: LocalPongExperience | null
  runtime?: ArRuntime
  performanceProfile?: PerformanceProfile
  trackingLabEnabled?: boolean
}

interface StateContent {
  action?: 'retry' | 'start'
  actionLabel?: string
  description: string
  eyebrow: string
  title: string
}

function contentForState(state: ArRuntimeState): StateContent {
  switch (state.status) {
    case 'booting':
      return {
        eyebrow: 'Preparando WebAR',
        title: 'Carregando a experiência',
        description: 'Estamos preparando os recursos necessários para acessar a câmera.',
      }
    case 'camera-permission':
      return {
        eyebrow: 'Câmera necessária',
        title: 'Veja a experiência no seu ambiente',
        description:
          'Ao continuar, o navegador pedirá acesso à câmera traseira. Nenhuma imagem é enviada pela rede.',
        action: 'start',
        actionLabel: 'Iniciar experiência',
      }
    case 'requesting-camera':
      return {
        eyebrow: 'Permissão de câmera',
        title: 'Abrindo a câmera',
        description: 'Autorize o acesso no aviso do navegador para continuar.',
      }
    case 'camera-active':
      return {
        eyebrow: 'WebAR ativa',
        title: 'Preparando o marcador',
        description: 'Aguarde enquanto o rastreamento é iniciado.',
      }
    case 'searching-target':
      return {
        eyebrow: 'Rastreamento ativo',
        title: 'Aponte para o marcador',
        description: 'Enquadre toda a imagem impressa, sem reflexos e com boa iluminação.',
      }
    case 'target-found':
      return {
        eyebrow: 'Marcador reconhecido',
        title: 'Target encontrado',
        description: 'O objeto de referência está ancorado à imagem.',
      }
    case 'target-lost':
      return {
        eyebrow: 'Marcador fora de vista',
        title: 'Reenquadre o marcador',
        description: 'Mantenha toda a imagem visível para recuperar o conteúdo.',
      }
    case 'paused':
      return {
        eyebrow: 'Sessão pausada',
        title: 'Câmera pausada',
        description: 'A experiência será retomada quando esta página voltar ao primeiro plano.',
      }
    case 'recovering':
      return {
        eyebrow: 'Retomando',
        title: 'Recuperando a câmera',
        description: 'Aguarde enquanto a sessão WebAR é retomada.',
      }
    case 'camera-denied':
      return {
        eyebrow: 'Câmera bloqueada',
        title: 'Não foi possível abrir a câmera',
        description:
          'Permita o acesso à câmera nas configurações do navegador e toque em tentar novamente.',
        action: 'retry',
        actionLabel: 'Tentar novamente',
      }
    case 'unsupported':
      return {
        eyebrow: 'WebAR indisponível',
        title: 'Este navegador não é compatível',
        description: state.message,
      }
    case 'fatal-error':
      return {
        eyebrow: 'Falha ao iniciar',
        title: 'A experiência encontrou um erro',
        description: state.message,
        action: 'retry',
        actionLabel: 'Tentar novamente',
      }
    case 'disposed':
      return {
        eyebrow: 'Sessão encerrada',
        title: 'Experiência encerrada',
        description: 'A câmera e os recursos da sessão foram liberados.',
      }
  }
}

function isCameraVisible(state: ArRuntimeState): boolean {
  return [
    'requesting-camera',
    'camera-active',
    'searching-target',
    'target-found',
    'target-lost',
    'paused',
    'recovering',
  ].includes(state.status)
}

function trackingLabCameraTitle(snapshot: TrackingSnapshot): string | null {
  if (snapshot.anchorStatus === 'frozen' || snapshot.worldLimitedExceeded) {
    return 'Tracking limitado · reenquadre o marcador'
  }
  if (snapshot.anchorStatus === 'reanchoring') {
    return 'Reancorando campo'
  }
  if (snapshot.anchorStatus === 'validating' || snapshot.candidateSampleCount > 0) {
    return `Verificando alinhamento ${String(Math.min(snapshot.candidateSampleCount, 3))}/3`
  }
  if (snapshot.targetStatus === 'lost' && snapshot.worldStatus === 'normal') {
    return 'Marcador perdido · campo mantido pelo SLAM'
  }
  if (snapshot.recalibrationRequired) {
    return 'Recalibração necessária'
  }
  if (snapshot.targetStatus === 'visible' && snapshot.anchorStatus === 'aligned') {
    return 'Target e campo alinhados'
  }
  return null
}

function pongCameraTitle(snapshot: TrackingSnapshot): string | null {
  if (snapshot.anchorStatus === 'reanchoring') {
    return 'Reancorando campo · jogo pausado'
  }
  if (snapshot.anchorStatus === 'validating') {
    return 'Validando alinhamento · jogo pausado'
  }
  if (
    snapshot.anchorStatus === 'frozen' ||
    snapshot.worldConfidence === 'unsafe' ||
    snapshot.worldLimitedExceeded
  ) {
    return 'Tracking limitado · jogo pausado'
  }
  if (snapshot.anchorStatus === 'aligned' && snapshot.worldConfidence === 'degraded') {
    return 'Sinal instável · campo mantido'
  }
  if (
    snapshot.anchorStatus === 'aligned' &&
    (snapshot.worldConfidence === 'healthy' || snapshot.worldConfidence === 'degraded')
  ) {
    return snapshot.targetStatus === 'lost' ? 'Campo mantido pelo SLAM' : 'Campo alinhado'
  }
  return null
}

function pongTrackingState(
  snapshot: TrackingSnapshot,
  sessionActive: boolean,
): LocalPongTrackingState {
  if (!sessionActive) {
    return { cause: 'lifecycle', safe: false }
  }
  if (snapshot.anchorStatus === 'reanchoring' || snapshot.anchorStatus === 'validating') {
    return { cause: 'anchor', safe: false }
  }
  if (snapshot.worldConfidence === 'unsafe' || snapshot.anchorStatus === 'frozen') {
    return { cause: 'world', safe: false }
  }
  if (snapshot.anchorStatus !== 'aligned') {
    return { cause: 'anchor', safe: false }
  }
  const worldUsable =
    snapshot.worldConfidence === 'healthy' || snapshot.worldConfidence === 'degraded'
  return worldUsable ? { cause: null, safe: true } : { cause: 'world', safe: false }
}

export function mountApp(root: HTMLElement, options: MountAppOptions = {}): AppHandle {
  const searchParams = new URLSearchParams(window.location.search)
  const trackingLabEnabled = options.trackingLabEnabled ?? searchParams.get('trackingLab') === '1'
  const performanceProfile =
    options.performanceProfile ??
    (searchParams.get('performanceProfile') === 'minimal' ? 'minimal' : 'standard')
  const pongExperience =
    options.pongExperience === undefined
      ? trackingLabEnabled
        ? null
        : createLocalPongExperience()
      : options.pongExperience
  const runtime =
    options.runtime ??
    createDefaultArRuntime({
      ...(pongExperience ? { anchoredContent: pongExperience } : {}),
      performanceProfile,
    })
  const shell = document.createElement('main')
  shell.className = 'app-shell'
  shell.dataset['performanceProfile'] = performanceProfile

  const canvas = document.createElement('canvas')
  canvas.className = 'camera-feed'
  canvas.setAttribute('aria-hidden', 'true')

  const overlay = document.createElement('div')
  overlay.className = 'experience-overlay'

  const panel = document.createElement('section')
  panel.className = 'status-panel'
  panel.setAttribute('aria-labelledby', 'app-title')

  const eyebrow = document.createElement('p')
  eyebrow.className = 'eyebrow'

  const title = document.createElement('h1')
  title.id = 'app-title'

  const status = document.createElement('p')
  status.className = 'status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  const primaryAction = document.createElement('button')
  primaryAction.className = 'primary-action'
  primaryAction.type = 'button'

  const cameraHud = document.createElement('div')
  cameraHud.className = 'camera-hud'
  cameraHud.hidden = true

  const cameraStatus = document.createElement('p')
  cameraStatus.className = 'camera-status'
  cameraStatus.setAttribute('role', 'status')
  cameraStatus.setAttribute('aria-live', 'polite')

  const stopAction = document.createElement('button')
  stopAction.className = 'stop-action'
  stopAction.type = 'button'
  stopAction.textContent = 'Encerrar'

  const gameHud = document.createElement('section')
  gameHud.className = 'game-hud'
  gameHud.hidden = true
  gameHud.setAttribute('aria-label', 'Placar e controles do Pong')

  const targetGuide = document.createElement('div')
  targetGuide.className = 'target-guide'
  targetGuide.hidden = true
  targetGuide.setAttribute('aria-hidden', 'true')

  const scoreboard = document.createElement('div')
  scoreboard.className = 'scoreboard'

  const playerScore = document.createElement('span')
  playerScore.className = 'score score-player'
  playerScore.setAttribute('aria-label', 'Pontos do jogador azul')
  playerScore.textContent = '0'

  const scoreSeparator = document.createElement('span')
  scoreSeparator.className = 'score-separator'
  scoreSeparator.textContent = '×'

  const aiScore = document.createElement('span')
  aiScore.className = 'score score-ai'
  aiScore.setAttribute('aria-label', 'Pontos da inteligência artificial vermelha')
  aiScore.textContent = '0'

  const gamePrompt = document.createElement('div')
  gamePrompt.className = 'game-prompt'
  gamePrompt.setAttribute('role', 'status')
  gamePrompt.setAttribute('aria-live', 'polite')

  const gameMessage = document.createElement('p')
  gameMessage.className = 'game-message'

  const gameAction = document.createElement('button')
  gameAction.className = 'game-action'
  gameAction.type = 'button'

  const touchZone = document.createElement('div')
  touchZone.className = 'pong-touch-zone'
  touchZone.setAttribute('aria-label', 'Arraste para mover a raquete azul')

  const touchHint = document.createElement('span')
  touchHint.className = 'touch-hint'
  touchHint.textContent = 'Arraste para mover a raquete'

  panel.append(eyebrow, title, status, primaryAction)
  cameraHud.append(cameraStatus, stopAction)
  scoreboard.append(playerScore, scoreSeparator, aiScore)
  gamePrompt.append(gameMessage, gameAction)
  touchZone.append(touchHint)
  gameHud.append(scoreboard, gamePrompt, touchZone)
  overlay.append(panel, cameraHud, targetGuide, gameHud)
  shell.append(canvas, overlay)
  const trackingLabUi = trackingLabEnabled ? createTrackingLabUi(runtime, window) : null
  if (trackingLabUi) {
    shell.append(trackingLabUi.element)
  }
  root.replaceChildren(shell)

  let disposed = false
  let currentState: ArRuntimeState = { status: 'booting' }
  let latestTrackingSnapshot: TrackingSnapshot | null = null
  let latestPongState: LocalPongViewState | null = null
  let activePointerId: number | null = null
  let lastPointerX = 0

  const resetPointer = () => {
    activePointerId = null
    touchZone.dataset['dragging'] = 'false'
  }

  const sessionAllowsTracking = () =>
    ['camera-active', 'searching-target', 'target-found', 'target-lost'].includes(
      currentState.status,
    )

  const updatePongTrackingSafety = () => {
    pongExperience?.setTrackingState(
      latestTrackingSnapshot
        ? pongTrackingState(latestTrackingSnapshot, sessionAllowsTracking())
        : { cause: 'lifecycle', safe: false },
    )
  }

  const updateCameraStatus = () => {
    const fallback = contentForState(currentState).title
    cameraStatus.textContent =
      (latestTrackingSnapshot
        ? trackingLabEnabled
          ? trackingLabCameraTitle(latestTrackingSnapshot)
          : pongCameraTitle(latestTrackingSnapshot)
        : null) ?? fallback
  }

  const renderCurrentPongState = () => {
    const state = latestPongState
    if (!state) {
      return
    }
    const targetObserved =
      latestTrackingSnapshot !== null && latestTrackingSnapshot.targetPose !== null
    const acquiringTarget = !trackingLabEnabled && sessionAllowsTracking() && !targetObserved
    targetGuide.hidden = !acquiringTarget
    gamePrompt.dataset['acquisition'] = String(acquiringTarget)

    playerScore.textContent = String(state.playerScore)
    aiScore.textContent = String(state.aiScore)
    gamePrompt.hidden = false
    gameAction.hidden = true
    gameAction.disabled = false
    gameAction.dataset['action'] = ''

    if (state.trackingPaused) {
      if (!targetObserved) {
        gameMessage.textContent = 'Jogo pausado · aponte para o marcador'
      } else {
        gameMessage.textContent =
          state.countdown === null
            ? 'Jogo pausado · estabilizando tracking'
            : state.trackingPauseCause === 'world'
              ? 'Retomando…'
              : `Retomando em ${String(state.countdown)}`
      }
    } else if (state.phase === 'ready') {
      if (!targetObserved) {
        gameMessage.textContent =
          'Aproxime-se a 0,75–1 m, centralize o marcador e mantenha o celular firme'
      } else if (!state.readyAvailable) {
        gameMessage.textContent = 'Mantenha o celular firme enquanto o campo estabiliza'
      } else {
        gameMessage.textContent = 'Vá para o lado azul'
        gameAction.hidden = false
        gameAction.dataset['action'] = 'start'
        gameAction.textContent = 'Estou pronto'
      }
    } else if (state.phase === 'countdown') {
      gameMessage.textContent = String(state.countdown ?? 1)
    } else if (state.phase === 'point') {
      gameMessage.textContent = state.pointWinner === 'player' ? 'Ponto azul' : 'Ponto vermelho'
    } else if (state.phase === 'finished') {
      gameMessage.textContent = state.winner === 'player' ? 'Azul venceu!' : 'Vermelho venceu'
      gameAction.hidden = false
      gameAction.disabled = !state.readyAvailable
      gameAction.dataset['action'] = 'restart'
      gameAction.textContent = 'Jogar novamente'
    } else {
      gameMessage.textContent = ''
      gamePrompt.hidden = true
    }

    const inputEnabled = state.phase === 'playing' && state.trackingSafe && !state.trackingPaused
    touchZone.dataset['enabled'] = String(inputEnabled)
    touchZone.setAttribute('aria-disabled', String(!inputEnabled))
    touchHint.hidden = !inputEnabled
    if (!inputEnabled) {
      resetPointer()
    }
  }

  const renderPong = (state: LocalPongViewState) => {
    latestPongState = state
    renderCurrentPongState()
  }

  const render = (nextState: ArRuntimeState) => {
    currentState = nextState
    const content = contentForState(nextState)
    const cameraVisible = isCameraVisible(nextState)
    const sessionRunning = isCameraVisible(nextState) && nextState.status !== 'requesting-camera'
    const trialEnabled = [
      'camera-active',
      'searching-target',
      'target-found',
      'target-lost',
    ].includes(nextState.status)

    shell.dataset['arState'] = nextState.status
    canvas.hidden = !cameraVisible
    panel.hidden = cameraVisible
    cameraHud.hidden = !cameraVisible
    updateCameraStatus()
    stopAction.hidden = !sessionRunning
    trackingLabUi?.setSessionState(cameraVisible, trialEnabled)
    gameHud.hidden = !pongExperience || !trialEnabled
    if (!trialEnabled) {
      targetGuide.hidden = true
    }
    if (!trialEnabled) {
      resetPointer()
    }
    updatePongTrackingSafety()
    renderCurrentPongState()

    eyebrow.textContent = content.eyebrow
    title.textContent = content.title
    status.textContent = content.description
    primaryAction.hidden = !content.action
    primaryAction.textContent = content.actionLabel ?? ''
    primaryAction.dataset['action'] = content.action ?? ''
  }

  const unsubscribe = runtime.subscribe(render)
  const unsubscribeTracking =
    trackingLabEnabled || pongExperience
      ? runtime.subscribeTracking((snapshot) => {
          latestTrackingSnapshot = snapshot
          updateCameraStatus()
          updatePongTrackingSafety()
          renderCurrentPongState()
        })
      : () => undefined
  const unsubscribePong = pongExperience?.subscribe(renderPong) ?? (() => undefined)

  const handlePrimaryAction = () => {
    const action = primaryAction.dataset['action']
    const operation = action === 'start' ? runtime.start(canvas) : runtime.retry()
    void operation.catch(() => undefined)
  }

  const handleStop = () => runtime.stop()

  const handleGameAction = () => {
    if (gameAction.dataset['action'] === 'start') {
      pongExperience?.start()
    } else if (gameAction.dataset['action'] === 'restart') {
      pongExperience?.restart()
    }
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (!pongExperience || activePointerId !== null || touchZone.dataset['enabled'] !== 'true') {
      return
    }
    activePointerId = event.pointerId
    lastPointerX = event.clientX
    touchZone.dataset['dragging'] = 'true'
    event.preventDefault()
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!pongExperience || event.pointerId !== activePointerId) {
      return
    }
    const deltaX = event.clientX - lastPointerX
    lastPointerX = event.clientX
    const viewportWidth = Math.max(1, document.documentElement.clientWidth)
    pongExperience.movePlayerBy(deltaX / viewportWidth)
    event.preventDefault()
  }

  const releasePointer = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return
    }
    resetPointer()
  }

  primaryAction.addEventListener('click', handlePrimaryAction)
  stopAction.addEventListener('click', handleStop)
  gameAction.addEventListener('click', handleGameAction)
  touchZone.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', releasePointer)
  window.addEventListener('pointercancel', releasePointer)
  void runtime.preload().catch(() => undefined)

  return {
    dispose() {
      if (disposed) {
        return
      }

      primaryAction.removeEventListener('click', handlePrimaryAction)
      stopAction.removeEventListener('click', handleStop)
      gameAction.removeEventListener('click', handleGameAction)
      touchZone.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', releasePointer)
      window.removeEventListener('pointercancel', releasePointer)
      unsubscribe()
      unsubscribeTracking()
      unsubscribePong()
      trackingLabUi?.dispose()
      runtime.dispose()
      pongExperience?.dispose()
      shell.remove()
      disposed = true
    },
  }
}
