import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Platform Administration root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
