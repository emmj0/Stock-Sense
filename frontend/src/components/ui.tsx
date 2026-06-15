import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/* ──────────────────────────────────────────────────────────
   Shared UI primitives — keep every page visually consistent.
   ────────────────────────────────────────────────────────── */

/** Page heading: gradient icon chip + title + subtitle + optional action slot. */
export function PageHeader({
  title,
  subtitle,
  accent = 'brand',
  action,
}: {
  /** icon is accepted for API compatibility but no longer rendered */
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  accent?: 'brand' | 'sky' | 'emerald' | 'violet';
  action?: ReactNode;
}) {
  const bar = {
    brand: 'from-brand-400 to-brand-600',
    sky: 'from-sky-400 to-sky-600',
    emerald: 'from-emerald-400 to-teal-600',
    violet: 'from-violet-400 to-fuchsia-600',
  }[accent];

  return (
    <div className="flex items-start justify-between gap-4 mb-7 reveal">
      <div className="flex items-stretch gap-3 min-w-0">
        {/* slim accent bar replaces the icon chip */}
        <span className={`w-1 rounded-full bg-gradient-to-b ${bar} shrink-0`} />
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Small titled section header used inside cards / panels. */
export function SectionTitle({
  icon: Icon,
  children,
  right,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} className="text-slate-400" />}
        <h3 className="text-sm font-bold text-slate-900">{children}</h3>
      </div>
      {right}
    </div>
  );
}

/** Colored summary stat card (gradient surface). */
export function StatCard({
  label,
  value,
  sub,
  tone = 'slate',
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'slate' | 'sky' | 'brand' | 'emerald' | 'red' | 'violet';
  icon?: LucideIcon;
}) {
  const tones = {
    slate: 'from-slate-50 to-slate-100/60 border-slate-200 text-slate-900',
    sky: 'from-sky-50 to-sky-100/50 border-sky-200 text-slate-900',
    brand: 'from-brand-50 to-orange-100/50 border-brand-200 text-slate-900',
    emerald: 'from-emerald-50 to-emerald-100/50 border-emerald-200 text-slate-900',
    red: 'from-red-50 to-red-100/50 border-red-200 text-slate-900',
    violet: 'from-violet-50 to-fuchsia-100/50 border-violet-200 text-slate-900',
  }[tone];
  const iconTone = {
    slate: 'text-slate-400',
    sky: 'text-sky-500',
    brand: 'text-brand-500',
    emerald: 'text-emerald-500',
    red: 'text-red-500',
    violet: 'text-violet-500',
  }[tone];

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones} px-5 py-4 shadow-soft hover:shadow-card transition-all`}>
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        {Icon && <Icon size={16} className={iconTone} />}
      </div>
      <p className="text-2xl font-bold mt-2 tracking-tight">{value}</p>
      {sub && <div className="text-sm font-semibold mt-1">{sub}</div>}
    </div>
  );
}

/** Directional pill (+/- change). Pass a numeric value or pre-signed string. */
export function ChangePill({
  value,
  children,
  size = 'sm',
}: {
  value: number;
  children: ReactNode;
  size?: 'sm' | 'md';
}) {
  const cls = value > 0 ? 'pill-up' : value < 0 ? 'pill-down' : 'pill-flat';
  const pad = size === 'md' ? 'px-3 py-1.5 text-sm' : '';
  return <span className={`pill ${cls} ${pad}`}>{children}</span>;
}

/** Empty-state block. */
export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-12 sm:p-16 text-center reveal">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-200/60">
        <Icon size={28} className="text-slate-400" />
      </div>
      <p className="text-slate-900 font-bold text-lg">{title}</p>
      {message && <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
