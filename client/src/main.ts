import { mountApp } from './app'
import './styles.css'

const root = document.querySelector<HTMLElement>('#app')

if (!root) {
  throw new Error('Application root #app was not found')
}

const app = mountApp(root)

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose())
}
