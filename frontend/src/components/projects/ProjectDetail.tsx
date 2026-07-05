import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useProjectNav } from '../../hooks/useProjects';
import Sidebar from '../layout/Sidebar';
import StatusBadge from '../shared/StatusBadge';
import MediaCarousel from './MediaCarousel';
import MarkdownRenderer from '../shared/MarkdownRenderer';
import ScrollMinimap from '../shared/ScrollMinimap';
import type { ProjectDetail as ProjectDetailType } from '../../types';

type FileExt = 'ts' | 'swift' | 'phys';

function getCategoryExtension(category?: string): FileExt | null {
  if (!category) return null;
  const cat = category.toLowerCase().trim();
  if (cat === 'web') return 'ts';
  if (/^(ios|macos|watchos|tvos|visionos)\s+app$/.test(cat)) return 'swift';
  if (cat === 'hardware') return 'phys';
  return null;
}

const EXT_COLORS: Record<FileExt, string> = {
  swift: 'text-xcode-orange',
  ts: 'text-xcode-accent',
  phys: 'text-xcode-green',
};

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
  const navigate = useNavigate();
  const articleRef = useRef<HTMLElement>(null);
  const [project, setProject] = useState<ProjectDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { nav, loading: navLoading } = useProjectNav();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.projects.get(id)
      .then(setProject)
      .catch(err => {
        if ((err as Error).message.startsWith('404')) navigate('/projects', { replace: true });
        else setError('Failed to load project.');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const ext = project ? getCategoryExtension(project.category) : null;
  const extColor = ext ? EXT_COLORS[ext] : null;

  return (
    <div className="flex flex-1">
      <Sidebar type="projects" items={nav ?? []} loading={navLoading} />

      <main className="flex-1 min-w-0">
        {loading && (
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

        {error && (
          <div className="max-w-2xl mx-auto px-6 py-10 text-xcode-red font-mono text-sm">{error}</div>
        )}

        {project && (
          <article ref={articleRef} className="max-w-2xl mx-auto px-6 py-10 animate-fade-in">
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

            {project.media && project.media.length > 0 && (
              <div className="mb-8">
                <MediaCarousel media={project.media} title={project.title} />
              </div>
            )}

            {project.heroImage && !project.media?.length && (
              <img
                src={project.heroImage}
                alt={project.title}
                className="w-full rounded-xl object-cover mb-8 max-h-72"
              />
            )}

            <MarkdownRenderer content={project.description} className="mb-8" />

            {project.techStack?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-[11px] font-mono uppercase tracking-widest text-xcode-muted mb-3">Tech Stack</h2>
                <div className="space-y-1 font-mono text-sm">
                  {project.techStack.map(t => (
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
                  {Object.entries(project.links).map(([label, href]) => (
                    <LinkButton key={label} href={href} label={label} />
                  ))}
                </div>
              </div>
            )}
          </article>
        )}
      </main>

      <ScrollMinimap contentRef={articleRef} seed={id ?? 'project'} />
    </div>
  );
}
