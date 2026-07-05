import { useNavigate } from 'react-router-dom';
import StatusBadge from '../shared/StatusBadge';
import Minimap from '../shared/Minimap';
import type { ProjectPreview } from '../../types';

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

interface Props {
  project: ProjectPreview;
}

export default function ProjectCard({ project }: Props) {
  const navigate = useNavigate();
  const ext = getCategoryExtension(project.category);
  const extColor = ext ? EXT_COLORS[ext] : null;
  const isCodeProject = ext === 'ts' || ext === 'swift';
  const categoryLabel = project.category ? `${project.category} Project` : 'Project';

  return (
    <article
      onClick={() => navigate(`/projects/${project.id}`)}
      className="group relative flex flex-col rounded-xl border border-xcode-border-light dark:border-xcode-border bg-xcode-bg-light dark:bg-xcode-bg hover:border-xcode-accent/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-xcode-accent/5 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Hero image / placeholder */}
      <div className="relative h-40 bg-xcode-surface-light dark:bg-xcode-surface overflow-hidden flex-shrink-0">
        {project.heroImage ? (
          <img
            src={project.heroImage}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : ext ? (
          <div className="w-full h-full flex items-center justify-center">
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
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-mono text-sm font-medium text-xcode-text-light dark:text-xcode-text leading-tight">
              {project.title}
              {ext && extColor && (
                <span className={`${extColor} opacity-70`}>.{ext}</span>
              )}
            </h3>
            {ext && extColor && (
              <span className={`text-[10px] font-mono uppercase tracking-wider ${extColor} opacity-50`}>
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
