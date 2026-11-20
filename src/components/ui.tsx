import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  ArrowDownToLine,
  Camera,
  Check,
  CircleAlert,
  Compass,
  Flag,
  Globe,
  Keyboard,
  Loader2,
  MousePointerClick,
  MousePointer2,
  Timer,
} from 'lucide-react';
import type { AgentStatus, ActionType } from '@/types';
import { cn } from '@/lib/utils';

export function OrbMark({ size = 18, className }: { size?: number; className?: string }) {
  return <span aria-hidden className={cn('orb-mark inline-block shrink-0', className)} style={{ width: size, height: size }} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  const base =
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition-all duration-200 ease-[cubic-bezier(.22,1,.36,1)] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]';
  const sizes = {
    sm: 'h-7 px-2.5 text-[12.5px]',
    md: 'h-9 px-3.5 text-[13px]',
  };
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] shadow-[0_6px_20px_rgba(90,155,255,0.25)]',
    secondary: 'bg-[var(--panel-strong)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)]',
    ghost: 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-strong)]',
    danger: 'bg-[rgba(255,107,107,0.12)] text-[var(--danger)] border border-[rgba(255,107,107,0.22)] hover:bg-[rgba(255,107,107,0.18)]',
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--panel-strong)] hover:text-[var(--text)] disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn('animate-spin', className)} />;
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-[var(--muted)]">{label}</span>
        {hint ? <span className="text-[11px] text-[var(--faint)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--faint)] transition-colors focus:border-[var(--accent)]';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[8px] px-2.5 py-1 text-[12px] font-medium transition-all duration-200',
            value === option.value
              ? 'bg-[var(--panel-strong)] text-[var(--text)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)]',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200',
        checked ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)] bg-[var(--panel-strong)]',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-[14px] w-[14px] rounded-full bg-white shadow transition-[left] duration-200 ease-[cubic-bezier(.22,1,.36,1)]',
          checked ? 'left-[20px]' : 'left-[4px]',
        )}
      />
    </button>
  );
}

const STATUS_META: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: 'Ready', color: 'var(--muted)' },
  planning: { label: 'Thinking', color: 'var(--accent)' },
  running: { label: 'Acting', color: 'var(--accent)' },
  waiting_for_approval: { label: 'Needs approval', color: 'var(--warn)' },
  paused: { label: 'Paused', color: 'var(--muted)' },
  completed: { label: 'Completed', color: 'var(--success)' },
  failed: { label: 'Failed', color: 'var(--danger)' },
  cancelled: { label: 'Stopped', color: 'var(--muted)' },
};

export function StatusPill({ status, label }: { status: AgentStatus; label?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.idle;
  const animate = status === 'running' || status === 'planning';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-[3px] text-[11px] font-medium"
      style={{ color: meta.color }}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', animate && 'live-dot')} style={{ background: meta.color }} />
      {label ?? meta.label}
    </span>
  );
}

export function actionIcon(type: ActionType, size = 13) {
  switch (type) {
    case 'navigate':
      return <Globe size={size} />;
    case 'click':
      return <MousePointerClick size={size} />;
    case 'click_at':
      return <MousePointer2 size={size} />;
    case 'type':
      return <Keyboard size={size} />;
    case 'scroll':
      return <ArrowDownToLine size={size} />;
    case 'press_key':
      return <Keyboard size={size} />;
    case 'screenshot':
      return <Camera size={size} />;
    case 'wait':
      return <Timer size={size} />;
    case 'finish':
      return <Flag size={size} />;
    default:
      return <Compass size={size} />;
  }
}

export function StepMark({ status }: { status: 'success' | 'failed' | 'rejected' }) {
  const color = status === 'success' ? 'var(--success)' : status === 'rejected' ? 'var(--warn)' : 'var(--danger)';
  return (
    <span
      className="flex h-[22px] w-[22px] items-center justify-center rounded-full border"
      style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
    >
      {status === 'success' ? <Check size={11} strokeWidth={3} /> : <CircleAlert size={11} strokeWidth={3} />}
    </span>
  );
}

export function providerName(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'gemini':
      return 'Google Gemini';
    case 'deepseek':
      return 'DeepSeek';
    case 'compatible':
      return 'Compatible endpoint';
    default:
      return provider;
  }
}
