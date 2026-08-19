export interface AppHandle {
  dispose(): void
}

export function mountApp(root: HTMLElement): AppHandle {
  const shell = document.createElement('main')
  shell.className = 'app-shell'

  const panel = document.createElement('section')
  panel.className = 'status-panel'
  panel.setAttribute('aria-labelledby', 'app-title')

  const eyebrow = document.createElement('p')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = 'Experiência WebAR mobile'

  const title = document.createElement('h1')
  title.id = 'app-title'
  title.textContent = 'WebAR Pong 3D'

  const status = document.createElement('p')
  status.className = 'status'
  status.setAttribute('role', 'status')
  status.textContent = 'Fundação pronta. A integração WebAR será a próxima etapa.'

  panel.append(eyebrow, title, status)
  shell.append(panel)
  root.replaceChildren(shell)

  let disposed = false

  return {
    dispose() {
      if (disposed) {
        return
      }

      shell.remove()
      disposed = true
    },
  }
}
