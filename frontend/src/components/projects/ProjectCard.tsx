import { Link } from 'react-router-dom';
import StatusBadge from '../shared/StatusBadge';
import Minimap from '../shared/Minimap';
import ResponsiveImage from '../shared/ResponsiveImage';
import { EXT_COLORS, getCategoryExtension } from '../../lib/category';
import type { ProjectPreview } from '../../types';

interface Props {
  project: ProjectPreview;
}

export default function ProjectCard({ project }: Props) {
  const ext = getCategoryExtension(project.category);
  const extColor = ext ? EXT_COLORS[ext] : null;
  const isCodeProject = ext === 'ts' || ext === 'swift';
  const categoryLabel = project.category ? `${project.category} Project` : 'Project';

  return (
    // The title link stretches over the whole card (its ::after), so the card is one real link:
    // keyboard-focusable, and it supports open-in-new-tab and copy-link.
    <article className="group relative flex flex-col rounded-xl border border-xcode-border-light dark:border-xcode-border bg-xcode-bg-light dark:bg-xcode-bg hover:border-xcode-accent/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-xcode-accent/5 focus-within:ring-2 focus-within:ring-xcode-accent transition-all duration-200 overflow-hidden motion-reduce:transform-none motion-reduce:transition-none">
      {/* Hero image / placeholder */}
      <div className="relative h-40 bg-xcode-surface-light dark:bg-xcode-surface overflow-hidden flex-shrink-0">
        {project.heroImage ? (
          <ResponsiveImage
            src={project.heroImage}
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transform-none"
          />
        ) : ext ? (
          <div className="w-full h-full flex items-center justify-center" aria-hidden>
            <span className={`font-mono text-4xl select-none opacity-20 ${extColor}`}>.{ext}</span>
          </div>
        ) : (
          <div className="w-full h-full" />
        )}

        {/* Minimap overlay — code projects only */}
        {isCodeProject && (
          <div className="absolute top-2 right-2 w-16 opacity-70">
            <Minimap seed={project.id} rows={20} />
          </div>
        )}

        {/* Featured star (left, so it doesn't sit on the minimap) */}
        {project.featured && (
          <div className="absolute top-2 left-2 z-10 pointer-events-none" aria-hidden>
            <span className="text-yellow-400 text-lg leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">★</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-mono text-sm font-medium text-xcode-text-light dark:text-xcode-text leading-tight">
              <Link
                to={`/projects/${project.id}`}
                className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
              >
                {project.title}
                {ext && extColor && <span className={`${extColor} opacity-70`}>.{ext}</span>}
                {project.featured && <span className="sr-only"> (featured)</span>}
              </Link>
            </h3>
            {ext && extColor && (
              <span className={`text-[10px] font-mono uppercase tracking-wider ${extColor} opacity-50`} aria-hidden>
                {ext}
              </span>
            )}
          </div>
          <StatusBadge status={project.status} showLabel />
        </div>

        <p className="text-[13px] text-xcode-muted leading-5 line-clamp-2 flex-1">
          {project.tagline}
        </p>

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-xcode-border-light dark:border-xcode-border">
          <span className="text-[11px] font-mono text-xcode-muted uppercase tracking-wider">
            {categoryLabel}
          </span>
        </div>
      </div>
    </article>
  );
}
