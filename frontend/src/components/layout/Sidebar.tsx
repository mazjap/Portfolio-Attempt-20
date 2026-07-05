import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../shared/StatusBadge';
import type { ProjectNav, PostNav } from '../../types';

interface ProjectSidebarProps {
  type: 'projects';
  items: ProjectNav[];
  loading?: boolean;
}

interface PostSidebarProps {
  type: 'posts';
  items: PostNav[];
  loading?: boolean;
}

type Props = ProjectSidebarProps | PostSidebarProps;

export default function Sidebar({ type, items, loading }: Props) {
  const { id } = useParams<{ id: string }>();

  return (
    <aside className="w-52 flex-shrink-0 hidden lg:flex flex-col sticky top-12 h-[calc(100vh-3rem)] border-r border-xcode-border-light dark:border-xcode-border overflow-y-auto">
      <div className="px-3 py-2 border-b border-xcode-border-light dark:border-xcode-border">
        <span className="text-[11px] font-mono uppercase tracking-widest text-xcode-muted">
          {type === 'projects' ? 'Navigator' : 'Posts'}
        </span>
      </div>

      <nav className="flex-1 py-1">
        {loading && (
          <div className="px-3 py-4 space-y-2">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-4 rounded bg-xcode-surface-light dark:bg-xcode-surface animate-pulse" />
            ))}
          </div>
        )}

        {items.map(item => {
          const isActive = item.id === id;
          const to = type === 'projects' ? `/projects/${item.id}` : `/blog/${item.id}`;

          return (
            <Link
              key={item.id}
              to={to}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors border-l-2 ${
                isActive
                  ? 'border-xcode-accent bg-xcode-accent/10 text-xcode-text-light dark:text-xcode-text'
                  : 'border-transparent text-xcode-muted hover:text-xcode-text-light dark:hover:text-xcode-text hover:bg-xcode-surface-light dark:hover:bg-xcode-surface/50'
              }`}
            >
              {type === 'projects' && (item as ProjectNav).status && (
                <StatusBadge status={(item as ProjectNav).status} />
              )}
              <span className="truncate text-xs leading-5">{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
