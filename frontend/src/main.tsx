import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { AppErrorFallback } from './components/shared/ErrorFallback';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={props => <AppErrorFallback {...props} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
