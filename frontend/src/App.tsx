import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Console from './components/shared/Console';
import Home from './pages/Home';
import Projects from './pages/Projects';
import NotFound from './pages/NotFound';

const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <Suspense fallback={<div className="flex-1" />}>
          <div className="flex flex-1 flex-col">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:id" element={<BlogPost />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </Suspense>
        <Console />
      </div>
    </BrowserRouter>
  );
}
