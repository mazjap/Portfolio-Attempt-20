import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { AppErrorFallback } from './components/shared/ErrorFallback';
import { logDevtoolsGreeting } from './lib/greeting';

// Once per page load: module level, outside React, so StrictMode's double render doesn't repeat it.
logDevtoolsGreeting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={props => <AppErrorFallback {...props} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
