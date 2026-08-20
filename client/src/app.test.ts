import { afterEach, describe, expect, it } from 'vitest'

import type { ArRuntime, ArRuntimeListener, ArRuntimeState } from './ar'
import { mountApp } from './app'

class FakeRuntime implements ArRuntime {
  startCount = 0
  retryCount = 0
  stopCount = 0
  preloadCount = 0
  disposeCount = 0
  private state: ArRuntimeState = { status: 'booting' }
  private readonly listeners = new Set<ArRuntimeListener>()

  preload(): Promise<void> {
    this.preloadCount += 1
    this.emit({ status: 'camera-permission' })
    return Promise.resolve()
  }

  start(): Promise<void> {
    this.startCount += 1
    return Promise.resolve()
  }

  retry(): Promise<void> {
    this.retryCount += 1
    return Promise.resolve()
  }

  stop(): void {
    this.stopCount += 1
    this.emit({ status: 'camera-permission' })
  }

  subscribe(listener: ArRuntimeListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.disposeCount += 1
  }

  emit(state: ArRuntimeState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener(state)
    }
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('mountApp', () => {
  it('explains camera access and waits for an explicit user action', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    document.body.append(root)

    mountApp(root, { runtime })

    expect(runtime.preloadCount).toBe(1)
    expect(runtime.startCount).toBe(0)
    expect(root.querySelector('h1')?.textContent).toBe('Veja a experiência no seu ambiente')
    expect(root.querySelector<HTMLButtonElement>('.primary-action')?.textContent).toBe(
      'Iniciar experiência',
    )
    expect(root.querySelector('.legal-link')).toBeNull()

    root.querySelector<HTMLButtonElement>('.primary-action')?.click()

    expect(runtime.startCount).toBe(1)
  })

  it('shows a minimal camera HUD and allows the user to stop the session', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    mountApp(root, { runtime })

    runtime.emit({ status: 'searching-target' })

    expect(root.querySelector<HTMLCanvasElement>('.camera-feed')?.hidden).toBe(false)
    expect(root.querySelector<HTMLElement>('.status-panel')?.hidden).toBe(true)
    expect(root.querySelector<HTMLElement>('.camera-hud')?.hidden).toBe(false)
    expect(root.querySelector('.camera-status')?.textContent).toBe('Aponte para o marcador')

    root.querySelector<HTMLButtonElement>('.stop-action')?.click()

    expect(runtime.stopCount).toBe(1)
    expect(root.querySelector<HTMLButtonElement>('.primary-action')?.textContent).toBe(
      'Iniciar experiência',
    )
  })

  it('guides target acquisition, loss and reacquisition in the camera HUD', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    mountApp(root, { runtime })

    runtime.emit({ status: 'target-found', targetName: 'pong-marker-v2' })
    expect(root.querySelector('.camera-status')?.textContent).toBe('Target encontrado')

    runtime.emit({ status: 'target-lost', targetName: 'pong-marker-v2' })
    expect(root.querySelector('.camera-status')?.textContent).toBe('Reenquadre o marcador')

    runtime.emit({ status: 'target-found', targetName: 'pong-marker-v2' })
    expect(root.querySelector('.camera-status')?.textContent).toBe('Target encontrado')
  })

  it('renders recoverable camera and engine failures', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    mountApp(root, { runtime })

    runtime.emit({ status: 'camera-denied', message: 'denied' })
    expect(root.querySelector('h1')?.textContent).toBe('Não foi possível abrir a câmera')
    root.querySelector<HTMLButtonElement>('.primary-action')?.click()
    expect(runtime.retryCount).toBe(1)

    runtime.emit({ status: 'fatal-error', message: 'Falha de rede no engine.' })
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Falha de rede no engine.')
  })

  it('disposes owned DOM and runtime exactly once', () => {
    const root = document.createElement('div')
    const runtime = new FakeRuntime()
    const app = mountApp(root, { runtime })

    app.dispose()
    app.dispose()

    expect(root.childElementCount).toBe(0)
    expect(runtime.disposeCount).toBe(1)
  })
})
