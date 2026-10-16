import { useState, type ReactNode, type CSSProperties } from 'react';
import { Info, AlertCircle } from 'lucide-react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="kpi-card">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32 mt-1.5" />
      <Skeleton className="h-3.5 w-40 mt-1" />
    </div>
  );
}

export function ChartPanelSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`panel flex items-center justify-center ${height}`}>
      <div className="text-center space-y-3 w-full p-6">
        <Skeleton className="h-4 w-40 mx-auto" />
        <Skeleton className={`w-full ${height}`} />
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className = '' }: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 px-4 text-center rounded-xl bg-rose-50/70 border border-rose-200/80 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
        <AlertCircle size={20} />
      </div>
      <div>
        <p className="text-slate-800 text-sm font-semibold">Service Notice</p>
        <p className="text-slate-600 text-xs mt-1 max-w-md">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-xs mt-1">
          Retry Request
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message, icon = '📭' }: { message: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="text-3xl mb-1">{icon}</span>
      <p className="text-slate-600 text-sm font-medium">{message}</p>
    </div>
  );
}

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClass = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size];
  return (
    <div
      className={`${sizeClass} border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

interface PanelProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
}

export function Panel({ title, subtitle, children, className = '', headerRight }: PanelProps) {
  return (
    <div className={`panel ${className}`}>
      {(title || headerRight) && (
        <div className="panel-header flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-normal">{subtitle}</p>}
          </div>
          {headerRight}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  subtext?: string;
  accent?: boolean;
  tooltip?: string;
  icon?: ReactNode;
}

export function KpiCard({ label, value, subtext, accent = false, tooltip, icon }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="metric-label">{label}</span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className={`metric-value ${accent ? 'text-teal-700' : 'text-slate-900'}`}>
        {value}
      </div>
      {subtext && <span className="text-[12.5px] text-slate-500 font-normal leading-tight">{subtext}</span>}
    </div>
  );
}

interface DataSourceTagProps {
  source: string;
  className?: string;
}

export function DataSourceTag({ source, className = '' }: DataSourceTagProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 border border-slate-200/90 rounded-md px-2.5 py-0.5 font-medium ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 inline-block" />
      <span>{source}</span>
    </span>
  );
}

interface InfoTooltipProps {
  text: string;
  title?: string;
}

export function InfoTooltip({ text, title }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-slate-400 hover:text-slate-600 focus:outline-none p-0.5 rounded transition-colors"
        aria-label="More information"
      >
        <Info size={13} />
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-900 text-white rounded-lg shadow-xl text-xs leading-relaxed z-50 animate-in fade-in zoom-in-95 pointer-events-none">
          {title && <p className="font-semibold text-slate-100 mb-1 border-b border-slate-800 pb-0.5">{title}</p>}
          <p className="text-slate-300">{text}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

interface ExplanationBoxProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function ExplanationBox({ title = 'What this means', children, className = '' }: ExplanationBoxProps) {
  return (
    <div className={`mt-3.5 p-3.5 rounded-lg bg-teal-50/70 border border-teal-200/80 text-xs sm:text-[13px] text-slate-700 leading-relaxed flex items-start gap-2.5 ${className}`}>
      <Info size={16} className="text-teal-700 shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-teal-900 mr-1">{title}:</span>
        <span>{children}</span>
      </div>
    </div>
  );
}
