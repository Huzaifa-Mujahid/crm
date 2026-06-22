import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from './lib/stripe'
import './index.css'
import App from './App.jsx'

const stripePromise = getStripe();

const stripeAppearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#6366f1',
    colorBackground: '#1a1a2e',
    colorText: '#e2e8f0',
    colorDanger: '#f43f5e',
    fontFamily: '"Inter", system-ui, sans-serif',
    borderRadius: '10px',
    spacingUnit: '4px',
  },
};

if (import.meta.env.PROD) {
  console.error = () => {};
  console.log = () => {};
  console.warn = () => {};
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Elements stripe={stripePromise} options={{ appearance: stripeAppearance }}>
      <App />
    </Elements>
  </StrictMode>,
)
