import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import RouteChangeHandler from './components/layout/RouteChangeHandler';
import Console from './components/shared/Console';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { RouteErrorFallback } from './components/shared/ErrorFallback';
import Home from './pages/Home';
import Projects from './pages/Projects';
import NotFound from './pages/NotFound';

const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const AppPage = lazy(() => import('./pages/AppPage'));

/** The routed page, inside an error boundary that resets whenever the path changes. */
function Page() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname} fallback={props => <RouteErrorFallback {...props} />}>
      <Suspense fallback={<div className="flex-1" />}>
        <div className="flex flex-1 flex-col">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:id" element={<BlogPost />} />
            <Route path="/apps/:appId/:pageType" element={<AppPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

const MAIN_ID = 'main-content';

export default function App() {
  return (
    <BrowserRouter>
      <RouteChangeHandler mainId={MAIN_ID} />
      <div className="flex flex-col min-h-screen">
        <a
          href={`#${MAIN_ID}`}
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:rounded-md focus:bg-xcode-accent focus:text-white dark:focus:text-[#1C1C1E] font-mono text-sm"
        >
          Skip to content
        </a>
        <Navbar />
        {/* Not a <main>: detail pages have their own <main> beside their sidebars. */}
        <div id={MAIN_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none">
          <Page />
        </div>
        <Console />
      </div>
    </BrowserRouter>
  );
}
