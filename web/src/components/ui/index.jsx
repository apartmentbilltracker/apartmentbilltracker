// Shared UI primitives

export function Spinner({ size = 'md', className = '' }) {
  const s = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6';
  return (
    <svg className={`animate-spin ${s} ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Alert({ type = 'error', children }) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[type]}`}>{children}</div>
  );
}

export function Avatar({ src, name = '', size = 'md', className = '' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-20 w-20 text-xl' };
  const palette = ['#e91e63','#9c27b0','#3f51b5','#2196f3','#009688','#ff5722','#795548','#607d8b'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const bg = palette[Math.abs(hash) % palette.length];
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  if (src) return <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover ${className}`} />;
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`} style={{ backgroundColor: bg }}>
      {initials}
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-5xl mb-4">{icon}</div>}
      <p className="text-gray-900 dark:text-white font-semibold text-base">{title}</p>
      {subtitle && <p className="text-gray-500 dark:text-white/50 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    active: { label: 'Active', cls: 'badge-success' },
    closed: { label: 'Closed', cls: 'badge-info' },
    pending: { label: 'Pending', cls: 'badge-warning' },
    overdue: { label: 'Overdue', cls: 'badge-error' },
    paid: { label: 'Paid', cls: 'badge-success' },
    unpaid: { label: 'Unpaid', cls: 'badge-error' },
    partial: { label: 'Partial', cls: 'badge-warning' },
    open: { label: 'Open', cls: 'badge-info' },
    resolved: { label: 'Resolved', cls: 'badge-success' },
    approved: { label: 'Approved', cls: 'badge-success' },
    rejected: { label: 'Rejected', cls: 'badge-error' },
    verified: { label: 'Verified', cls: 'badge-success' },
  };
  const s = map[status?.toLowerCase()] || { label: status, cls: 'badge bg-gray-100 text-gray-600' };
  return <span className={s.cls}>{s.label}</span>;
}
