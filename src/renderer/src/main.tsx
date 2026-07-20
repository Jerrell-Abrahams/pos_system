import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CustomerDisplayScreen } from './components/customerDisplay/CustomerDisplayScreen'
import { ErrorBoundary } from './components/shell/ErrorBoundary'
import './stores/themeStore'
import './styles/index.css'

const isCustomerDisplay = location.hash.startsWith('#customer-display')
const profileId = Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('profile'))

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>{isCustomerDisplay ? <CustomerDisplayScreen profileId={profileId} /> : <App />}</ErrorBoundary>
  </StrictMode>
)
