import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const App = lazy(() => import('./App.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense
      fallback={
        <div className="app-loading" aria-busy="true" aria-live="polite">
          Loading Bill Split…
        </div>
      }
    >
      <App />
    </Suspense>
  </StrictMode>,
)
