import { createDefaultArRuntime, type ArRuntime, type ArRuntimeState } from './ar'
import { createTrackingLabUi } from './tracking-lab-ui'

export interface AppHandle {
  dispose(): void
}

export interface MountAppOptions {
  runtime?: ArRuntime
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

export function mountApp(root: HTMLElement, options: MountAppOptions = {}): AppHandle {
  const runtime = options.runtime ?? createDefaultArRuntime()
  const trackingLabEnabled =
    options.trackingLabEnabled ??
    new URLSearchParams(window.location.search).get('trackingLab') === '1'
  const shell = document.createElement('main')
  shell.className = 'app-shell'

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

  panel.append(eyebrow, title, status, primaryAction)
  cameraHud.append(cameraStatus, stopAction)
  overlay.append(panel, cameraHud)
  shell.append(canvas, overlay)
  const trackingLabUi = trackingLabEnabled ? createTrackingLabUi(runtime, window) : null
  if (trackingLabUi) {
    shell.append(trackingLabUi.element)
  }
  root.replaceChildren(shell)

  let disposed = false

  const render = (nextState: ArRuntimeState) => {
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
    cameraStatus.textContent = content.title
    stopAction.hidden = !sessionRunning
    trackingLabUi?.setSessionState(cameraVisible, trialEnabled)

    eyebrow.textContent = content.eyebrow
    title.textContent = content.title
    status.textContent = content.description
    primaryAction.hidden = !content.action
    primaryAction.textContent = content.actionLabel ?? ''
    primaryAction.dataset['action'] = content.action ?? ''
  }

  const unsubscribe = runtime.subscribe(render)

  const handlePrimaryAction = () => {
    const action = primaryAction.dataset['action']
    const operation = action === 'start' ? runtime.start(canvas) : runtime.retry()
    void operation.catch(() => undefined)
  }

  const handleStop = () => runtime.stop()

  primaryAction.addEventListener('click', handlePrimaryAction)
  stopAction.addEventListener('click', handleStop)
  void runtime.preload().catch(() => undefined)

  return {
    dispose() {
      if (disposed) {
        return
      }

      primaryAction.removeEventListener('click', handlePrimaryAction)
      stopAction.removeEventListener('click', handleStop)
      unsubscribe()
      trackingLabUi?.dispose()
      runtime.dispose()
      shell.remove()
      disposed = true
    },
  }
}
