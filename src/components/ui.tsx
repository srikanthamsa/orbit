import { useEffect, useMemo, useState } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import {
  ArrowDownToLine,
  Camera,
  Search,
  Check,
  ChevronDown,
  CircleAlert,
  Compass,
  Flag,
  Globe,
  Keyboard,
  Loader2,
  Minus,
  MousePointer2,
  MousePointerClick,
  Plus,
  Timer,
} from 'lucide-react';
import type { AgentStatus, ActionType } from '@/types';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Brand                                                                      */
/* -------------------------------------------------------------------------- */

export function OrbMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('orb-mark inline-block shrink-0', className)}
      style={{ width: size, height: size }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    'focus-ring inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40';
  const sizes = {
    sm: 'h-7 px-2 text-label',
    md: 'h-8 px-2.5 text-label',
  };
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'bg-raised text-fg hover:bg-line-strong',
    ghost: 'text-muted hover:bg-raised hover:text-fg',
    danger: 'text-danger hover:bg-danger-tint',
  };
  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : null}
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
        'focus-ring inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 12, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn('animate-spin', className)} />;
}

export function Badge({
  tone = 'muted',
  children,
  className,
}: {
  tone?: 'muted' | 'accent' | 'success' | 'warn' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    muted: 'bg-surface text-muted',
    accent: 'bg-accent-tint text-accent',
    success: 'bg-success-tint text-success',
    warn: 'bg-warn-tint text-warn',
    danger: 'bg-danger-tint text-danger',
  };
  return (
    <span
      className={cn(
        'inline-flex h-4 items-center rounded-sm px-1 text-[10.5px] font-medium leading-none',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

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
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-caption font-medium text-muted">{label}</span>
        {hint ? <span className="text-right text-micro text-faint">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'h-8 w-full rounded-sm border border-line bg-field px-2.5 text-label text-fg transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent-line focus:ring-2 focus:ring-accent-tint';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn('relative block', className)}>
      <select className={cn(inputClass, 'cursor-pointer appearance-none pr-7')} {...rest}>
        {children}
      </select>
      <ChevronDown
        size={12}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
      />
    </span>
  );
}

export function NumberField({
  value,
  onChange,
  label,
  min,
  max,
  step = 1,
  fallback,
  decimals = 0,
  width = 38,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  fallback?: number;
  decimals?: number;
  width?: number;
}) {
  const format = (n: number) => (decimals > 0 ? n.toFixed(decimals) : String(Math.round(n)));
  const [text, setText] = useState(() => format(value));

  useEffect(() => {
    setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);

  const clamp = (n: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));
  const round = (n: number) => (decimals > 0 ? Number(n.toFixed(decimals)) : Math.round(n));

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(/[^0-9.-]/g, ''));
    const next =
      raw.trim() === '' || !Number.isFinite(parsed) ? (fallback ?? min ?? 0) : clamp(parsed);
    const rounded = round(next);
    onChange(rounded);
    setText(format(rounded));
  };

  const nudge = (direction: 1 | -1) => {
    const base = text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : value;
    const rounded = round(clamp(base + direction * step));
    onChange(rounded);
    setText(format(rounded));
  };

  const stepper =
    'focus-ring-inset flex w-6 items-center justify-center text-faint transition-colors hover:bg-field-hover hover:text-fg';

  return (
    <span className="inline-flex h-7 items-stretch overflow-hidden rounded-sm border border-line bg-field focus-within:border-accent-line focus-within:ring-2 focus-within:ring-accent-tint">
      <button type="button" tabIndex={-1} aria-label={`Decrease ${label}`} onClick={() => nudge(-1)} className={stepper}>
        <Minus size={11} />
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(text);
            event.currentTarget.blur();
          }
        }}
        style={{ width }}
        className="border-x border-line bg-transparent text-center text-label tabular-nums text-fg"
      />
      <button type="button" tabIndex={-1} aria-label={`Increase ${label}`} onClick={() => nudge(1)} className={stepper}>
        <Plus size={11} />
      </button>
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center rounded-md border border-line bg-sunken p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'focus-ring-inset h-6 rounded-sm px-2 text-caption font-medium transition-colors duration-150',
            value === option.value
              ? 'bg-raised text-fg shadow-[0_1px_2px_rgba(0,0,0,0.18)]'
              : 'text-muted hover:text-fg',
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
        'focus-ring relative h-5 w-[34px] shrink-0 rounded-full transition-colors duration-150',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-[left] duration-150',
          checked ? 'left-[17px]' : 'left-[3px]',
        )}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mt-7 first:mt-0', className)}>
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h2 className="text-label font-medium text-muted">{title}</h2>
          {description ? (
            <p className="mt-1 text-caption leading-[1.45] text-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

export function Row({
  title,
  description,
  meta,
  control,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  control?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2.5', className)}>
      <div className="min-w-0 flex-1">
        <p className="text-body text-fg">{title}</p>
        {description ? (
          <p className="mt-0.5 text-caption leading-[1.45] text-muted">{description}</p>
        ) : null}
        {meta ? <div className="mt-1 text-micro text-faint">{meta}</div> : null}
        {children}
      </div>
      {control ? <div className="flex shrink-0 items-center gap-1.5 pt-0.5">{control}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

type Tone = 'muted' | 'accent' | 'success' | 'warn' | 'danger';

const STATUS_META: Record<AgentStatus, { label: string; tone: Tone }> = {
  idle: { label: 'Ready', tone: 'muted' },
  planning: { label: 'Thinking', tone: 'accent' },
  running: { label: 'Working', tone: 'accent' },
  waiting_for_approval: { label: 'Needs your approval', tone: 'warn' },
  paused: { label: 'Paused', tone: 'muted' },
  completed: { label: 'Done', tone: 'success' },
  failed: { label: "Couldn't finish", tone: 'danger' },
  cancelled: { label: 'Stopped', tone: 'muted' },
};

const TONE_TEXT: Record<Tone, string> = {
  muted: 'text-muted',
  accent: 'text-accent',
  success: 'text-success',
  warn: 'text-warn',
  danger: 'text-danger',
};

const TONE_DOT: Record<Tone, string> = {
  muted: 'bg-faint',
  accent: 'bg-accent',
  success: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-danger',
};

export function statusLabel(status: AgentStatus): string {
  return (STATUS_META[status] ?? STATUS_META.idle).label;
}

export function statusTone(status: AgentStatus): Tone {
  return (STATUS_META[status] ?? STATUS_META.idle).tone;
}

export function StatusPill({
  status,
  label,
  className,
}: {
  status: AgentStatus;
  label?: string;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.idle;
  const animate = status === 'running' || status === 'planning';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-caption font-medium',
        TONE_TEXT[meta.tone],
        className,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[meta.tone], animate && 'live-dot')}
      />
      {label ?? meta.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: AgentStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.idle;
  return <span className={cn('block h-1.5 w-1.5 rounded-full', TONE_DOT[meta.tone], className)} />;
}

export function StepMark({ status }: { status: 'success' | 'failed' | 'rejected' }) {
  const color =
    status === 'success' ? 'var(--success)' : status === 'rejected' ? 'var(--warn)' : 'var(--danger)';
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full border"
      style={{
        borderColor: `color-mix(in srgb, ${color} 36%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
      }}
    >
      {status === 'success' ? (
        <Check size={10} strokeWidth={3} />
      ) : (
        <CircleAlert size={10} strokeWidth={3} />
      )}
    </span>
  );
}



/* -------------------------------------------------------------------------- */
/* Agent phase                                                                */
/* -------------------------------------------------------------------------- */

export type AgentPhase = 'thinking' | 'working' | 'waiting' | 'paused';

const PHASE_COPY: Record<AgentPhase, string> = {
  thinking: 'Thinking',
  working: 'Working',
  waiting: 'Waiting on you',
  paused: 'Paused',
};

/**
 * What the agent is doing this second. Deliberately the only moving thing on a
 * running screen, so the eye lands on it and nothing competes.
 */
export function AgentPhaseLabel({ phase, detail }: { phase: AgentPhase; detail?: string }) {
  const active = phase === 'thinking' || phase === 'working';
  // The header already names the state, so while acting this line says *what*
  // is happening instead of repeating "Working".
  const label = phase === 'working' && detail ? detail : PHASE_COPY[phase];
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="phase-dots" aria-hidden data-live={active ? '' : undefined}>
        <i />
        <i />
        <i />
      </span>
      <span
        className={
          active ? 'phase-shimmer min-w-0 truncate text-caption' : 'min-w-0 truncate text-caption text-muted'
        }
        title={label}
      >
        {phase === 'thinking' ? `${label}…` : label}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Rich text                                                                  */
/* -------------------------------------------------------------------------- */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

function inlineNodes(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let index = 0;
  INLINE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const raw = match[0];
    const key = `${keyBase}-${index}`;
    if (raw.startsWith('**')) {
      out.push(
        <strong key={key} className="font-semibold text-fg">
          {raw.slice(2, -2)}
        </strong>,
      );
    } else if (raw.startsWith('`')) {
      out.push(
        <code key={key} className="rounded-sm bg-raised px-1 py-0.5 font-mono text-[0.9em]">
          {raw.slice(1, -1)}
        </code>,
      );
    } else {
      out.push(<em key={key}>{raw.slice(1, -1)}</em>);
    }
    last = match.index + raw.length;
    index += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function parseBlocks(text: string): Block[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
      const bullet = /^[-*•]\s+/;
      const ordered = /^\d+[.)]\s+/;
      if (lines.length > 0 && lines.every((line) => bullet.test(line))) {
        return { kind: 'ul', items: lines.map((line) => line.replace(bullet, '')) } as const;
      }
      if (lines.length > 0 && lines.every((line) => ordered.test(line))) {
        return { kind: 'ol', items: lines.map((line) => line.replace(ordered, '')) } as const;
      }
      const row = (line: string) =>
        line
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());
      if (
        lines.length >= 2 &&
        lines.every((line) => line.startsWith('|')) &&
        /^\|?[\s:|-]+\|/.test(lines[1])
      ) {
        const [head, , ...rows] = lines;
        return { kind: 'table', head: row(head), rows: rows.map(row) } as const;
      }
      return { kind: 'p', text: lines.join(' ') } as const;
    });
}

/**
 * Renders an assistant answer as normal chat prose: paragraphs, short lists and
 * inline emphasis. The prompt asks for plain text; this is the safety net for
 * the model that reaches for ** or - anyway, so the user never sees raw syntax.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className={cn('text-body leading-[1.65] text-fg', className)}>
      {blocks.map((block, index) => {
        const spacing = index > 0 ? 'mt-2.5' : undefined;
        if (block.kind === 'p') {
          return (
            <p key={index} className={spacing}>
              {inlineNodes(block.text, `p${index}`)}
            </p>
          );
        }
        if (block.kind === 'table') {
          return (
            <div key={index} className={cn('overflow-x-auto', spacing)}>
              <table className="w-full border-collapse text-caption">
                <thead>
                  <tr>
                    {block.head.map((cell, cellIndex) => (
                      <th
                        key={cellIndex}
                        className="border-b border-line-strong py-1 pr-3 text-left font-medium text-muted"
                      >
                        {inlineNodes(cell, `h${index}-${cellIndex}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((cells, rowIndex) => (
                    <tr key={rowIndex}>
                      {cells.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border-b border-line py-1 pr-3 align-top text-fg"
                        >
                          {inlineNodes(cell, `c${index}-${rowIndex}-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const List = block.kind === 'ul' ? 'ul' : 'ol';
        return (
          <List
            key={index}
            className={cn(block.kind === 'ul' ? 'list-disc' : 'list-decimal', 'space-y-1 pl-4', spacing)}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{inlineNodes(item, `l${index}-${itemIndex}`)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

export function actionIcon(type: ActionType, size = 12) {
  switch (type) {
    case 'navigate':
      return <Globe size={size} />;
    case 'search':
      return <Search size={size} />;
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
