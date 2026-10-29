import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { EXT_COLORS, getCategoryExtension } from '../../lib/category';
import { useProjectNav } from '../../hooks/useProjects';
import { useResource } from '../../hooks/useResource';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import Sidebar from '../layout/Sidebar';
import StatusBadge from '../shared/StatusBadge';
import MediaCarousel from './MediaCarousel';
import MarkdownRenderer from '../shared/MarkdownRenderer';
import ScrollMinimap from '../shared/ScrollMinimap';
import ResponsiveImage from '../shared/ResponsiveImage';
import { LoadErrorMessage, NotFoundMessage } from '../shared/LoadProblem';

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-xcode-border-light dark:border-xcode-border text-sm text-xcode-text-light dark:text-xcode-text hover:border-xcode-accent hover:text-xcode-accent transition-colors"
    >
      {label}
    </a>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const articleRef = useRef<HTMLElement>(null);
  const { state, retry } = useResource(id, api.projects.get);
  const project = state.status === 'ok' ? state.data : null;
  const { nav, loading: navLoading } = useProjectNav();
  const media = Array.isArray(project?.media) ? project.media : [];
  const techStack = Array.isArray(project?.techStack) ? project.techStack : [];
  useDocumentTitle(
    project ? project.title : state.status === 'not-found' ? 'Project Not Found' : state.status === 'error' ? 'Error' : null,
    project?.tagline,
  );

  const ext = project ? getCategoryExtension(project.category) : null;
  const extColor = ext ? EXT_COLORS[ext] : null;

  return (
    <div className="flex flex-1">
      <Sidebar type="projects" items={nav ?? []} loading={navLoading} />

      <main className="flex-1 min-w-0">
        {state.status === 'loading' && (
          <div className="max-w-2xl mx-auto px-6 py-10 animate-pulse space-y-4">
            <div className="h-8 w-1/2 rounded bg-xcode-surface-light dark:bg-xcode-surface" />
            <div className="h-48 rounded-xl bg-xcode-surface-light dark:bg-xcode-surface" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="h-4 rounded bg-xcode-surface-light dark:bg-xcode-surface" style={{ width: `${70 + n * 5}%` }} />
              ))}
            </div>
          </div>
        )}

        {state.status === 'not-found' && (
          <NotFoundMessage what="project" id={id} backTo="/projects" backLabel="All projects" />
        )}

        {state.status === 'error' && <LoadErrorMessage what="project" onRetry={retry} />}

        {project && (
          <article ref={articleRef} className="max-w-2xl mx-auto px-6 py-10 animate-fade-in">
            {/* The sidebar is hidden below lg, so small screens get a way back. */}
            <Link to="/projects" className="lg:hidden inline-block mb-4 font-mono text-xs text-xcode-accent hover:underline">
              ← All projects
            </Link>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="font-mono text-2xl font-semibold text-xcode-text-light dark:text-xcode-text">
                  {project.title}
                  {ext && extColor && (
                    <span className={`${extColor} opacity-70`}>.{ext}</span>
                  )}
                </h1>
                <p className="text-xcode-muted text-sm mt-1">
                  {new Date(project.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                  {project.updatedAt && ' · Updated ' + new Date(project.updatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
              <StatusBadge status={project.status} showLabel />
            </div>

            {media.length > 0 && (
              <div className="mb-8">
                {/* Keyed by project so the selected image resets when switching projects. */}
                <MediaCarousel key={project.id} media={media} title={project.title} />
              </div>
            )}

            {project.heroImage && media.length === 0 && (
              <ResponsiveImage
                src={project.heroImage}
                sizes="(min-width: 768px) 672px, 100vw"
                loading="eager"
                alt=""
                className="w-full rounded-xl object-cover mb-8 max-h-72"
              />
            )}

            <MarkdownRenderer content={project.description} className="mb-8" />

            {techStack.length > 0 && (
              <div className="mb-8">
                <h2 className="text-[11px] font-mono uppercase tracking-widest text-xcode-muted mb-3">Tech Stack</h2>
                <div className="space-y-1 font-mono text-sm">
                  {techStack.map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <span className="text-xcode-pink">import</span>
                      <span className="text-xcode-text-light dark:text-xcode-text">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(project.links ?? {}).length > 0 && (
              <div>
                <h2 className="text-[11px] font-mono uppercase tracking-widest text-xcode-muted mb-3">Links</h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(project.links ?? {}).map(([label, href]) => (
                    <LinkButton key={label} href={href} label={label} />
                  ))}
                </div>
              </div>
            )}
          </article>
        )}
      </main>

      <ScrollMinimap contentRef={articleRef} contentKey={project ? project.id : null} />
    </div>
  );
}
