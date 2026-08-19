import { afterEach, describe, expect, it } from 'vitest'

import { mountApp } from './app'

describe('mountApp', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('mounts an accessible foundation status', () => {
    const root = document.createElement('div')
    document.body.append(root)

    mountApp(root)

    expect(root.querySelector('main')).not.toBeNull()
    expect(root.querySelector('h1')?.textContent).toBe('WebAR Pong 3D')
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Fundação pronta')
  })

  it('disposes its owned DOM idempotently', () => {
    const root = document.createElement('div')
    const app = mountApp(root)

    app.dispose()
    app.dispose()

    expect(root.childElementCount).toBe(0)
  })
})
