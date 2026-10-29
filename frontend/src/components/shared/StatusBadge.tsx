type Status = 'active' | 'in-progress' | 'archived';

interface Props {
  status?: Status;
  showLabel?: boolean;
}

const config: Record<Status, { dot: string; label: string; text: string }> = {
  active: { dot: 'bg-xcode-green', label: 'Active', text: 'text-xcode-green' },
  'in-progress': { dot: 'bg-xcode-yellow', label: 'In Progress', text: 'text-xcode-yellow' },
  archived: { dot: 'bg-xcode-muted', label: 'Archived', text: 'text-xcode-muted' },
};

export default function StatusBadge({ status = 'active', showLabel = false }: Props) {
  // An unknown status (bad data or a stale cache) shows neutrally instead of crashing the page.
  const { dot, label, text } = config[status] ?? { dot: 'bg-xcode-muted', label: String(status), text: 'text-xcode-muted' };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0`} aria-hidden />
      {showLabel ? <span className={`text-xs font-mono ${text}`}>{label}</span> : <span className="sr-only">{label}: </span>}
    </span>
  );
}
