import { useMemo, useState } from 'react';
import { ArrowUpDown, ExternalLink } from 'lucide-react';
import type { AnswerBlock } from '@/types';
import { cn } from '@/lib/utils';

/* Categorical palette for chart slices. Semantic colours come from the theme
   tokens; the extra hues exist only to separate series and never carry meaning. */
const SERIES = ['var(--accent)', 'var(--success)', 'var(--warn)', 'var(--danger)', '#8b7cf6', '#2fb8c6'];

const numeric = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

function BlockTitle({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="mb-1.5 text-label font-medium text-muted">{children}</p>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

function TableBlock({ columns, rows, title }: { columns: string[]; rows: string[][]; title?: string }) {
  const [sort, setSort] = useState<{ column: number; direction: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const left = a[sort.column] ?? '';
      const right = b[sort.column] ?? '';
      const leftNumber = numeric(left);
      const rightNumber = numeric(right);
      if (leftNumber !== null && rightNumber !== null) return (leftNumber - rightNumber) * sort.direction;
      return left.localeCompare(right, undefined, { numeric: true }) * sort.direction;
    });
    return copy;
  }, [rows, sort]);

  const numericColumn = (index: number) =>
    index > 0 &&
    rows.every((row) => {
      const cell = (row[index] ?? '').trim();
      return cell === '' || numeric(cell) !== null;
    });

  return (
    <div>
      <BlockTitle>{title}</BlockTitle>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full border-collapse text-label">
          <thead>
            <tr>
              {columns.map((column, index) => {
                const active = sort?.column === index;
                return (
                  <th
                    key={column + index}
                    scope="col"
                    className={cn(
                      'border-b border-line-strong py-1.5 pr-3 align-bottom font-medium',
                      numericColumn(index) ? 'text-right' : 'text-left',
                      index === 0 && 'pl-0',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSort((current) =>
                          current?.column === index
                            ? current.direction === 1
                              ? { column: index, direction: -1 }
                              : null
                            : { column: index, direction: 1 },
                        )
                      }
                      className={cn(
                        'focus-ring-inset inline-flex items-center gap-1 rounded-sm transition-colors',
                        active ? 'text-fg' : 'text-muted hover:text-fg',
                      )}
                      aria-label={`Sort by ${column}`}
                    >
                      <span className="truncate">{column}</span>
                      <ArrowUpDown
                        size={10}
                        aria-hidden
                        className={cn('shrink-0 transition-opacity', active ? 'opacity-100' : 'opacity-35')}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition-colors hover:bg-surface">
                {columns.map((column, cellIndex) => (
                  <td
                    key={column + cellIndex}
                    className={cn(
                      'py-1.5 pr-3 align-top text-fg',
                      numericColumn(cellIndex) && 'text-right tabular-nums',
                      cellIndex === 0 && 'pl-0',
                    )}
                  >
                    {row[cellIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Chart                                                                      */
/* -------------------------------------------------------------------------- */

const W = 320;

function BarChart({ data, unit }: { data: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(...data.map((point) => Math.abs(point.value)), 1);
  const H = 108;
  const height = H - 26;
  const step = W / data.length;
  const width = Math.min(step * 0.56, 34);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[108px] w-full"
      role="img"
      aria-label={`Bar chart: ${data.map((point) => `${point.label} ${point.value}${unit ?? ''}`).join(', ')}`}
    >
      <line x1="0" y1={height + 0.5} x2={W} y2={height + 0.5} stroke="var(--line-strong)" />
      {data.map((point, index) => {
        const barHeight = Math.max(2, (Math.abs(point.value) / max) * (height - 12));
        const x = index * step + (step - width) / 2;
        return (
          <g key={point.label + index}>
            <rect
              x={x}
              y={height - barHeight}
              width={width}
              height={barHeight}
              rx="2"
              fill="var(--accent)"
              opacity="0.9"
            >
              <title>{`${point.label}: ${point.value}${unit ?? ''}`}</title>
            </rect>
            <text
              x={x + width / 2}
              y={height - barHeight - 4}
              textAnchor="middle"
              className="fill-[var(--muted)] text-[9px] tabular-nums"
            >
              {point.value}
            </text>
            <text
              x={x + width / 2}
              y={H - 8}
              textAnchor="middle"
              className="fill-[var(--faint)] text-[9px]"
            >
              {point.label.length > 10 ? `${point.label.slice(0, 9)}…` : point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, unit }: { data: { label: string; value: number }[]; unit?: string }) {
  const values = data.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const H = 108;
  const top = 12;
  const bottom = H - 24;
  const points = data.map((point, index) => {
    const x = data.length === 1 ? W / 2 : (index / (data.length - 1)) * (W - 4) + 2;
    const y = bottom - ((point.value - min) / span) * (bottom - top);
    return { ...point, x, y };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[108px] w-full"
      role="img"
      aria-label={`Line chart: ${data.map((point) => `${point.label} ${point.value}${unit ?? ''}`).join(', ')}`}
    >
      <line x1="0" y1={bottom + 0.5} x2={W} y2={bottom + 0.5} stroke="var(--line-strong)" />
      <polyline points={path} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" />
      {points.map((point, index) => (
        <g key={point.label + index}>
          <circle cx={point.x} cy={point.y} r="2.5" fill="var(--accent)">
            <title>{`${point.label}: ${point.value}${unit ?? ''}`}</title>
          </circle>
          <text
            x={point.x}
            y={H - 8}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            className="fill-[var(--faint)] text-[9px]"
          >
            {point.label.length > 10 ? `${point.label.slice(0, 9)}…` : point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function DonutChart({ data, unit }: { data: { label: string; value: number }[]; unit?: string }) {
  const total = data.reduce((sum, point) => sum + Math.abs(point.value), 0) || 1;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] shrink-0" role="img" aria-label={`Donut chart: ${data.map((point) => `${point.label} ${point.value}${unit ?? ''}`).join(', ')}`}>
        <g transform="rotate(-90 36 36)">
          {data.map((point, index) => {
            const fraction = Math.abs(point.value) / total;
            const dash = fraction * circumference;
            const segment = (
              <circle
                key={point.label + index}
                cx="36"
                cy="36"
                r={radius}
                fill="none"
                stroke={SERIES[index % SERIES.length]}
                strokeWidth="9"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${point.label}: ${point.value}${unit ?? ''}`}</title>
              </circle>
            );
            offset += dash;
            return segment;
          })}
        </g>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {data.map((point, index) => (
          <li key={point.label + index} className="flex items-center gap-1.5 text-caption">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: SERIES[index % SERIES.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted">{point.label}</span>
            <span className="shrink-0 tabular-nums text-fg">
              {point.value}
              {unit ?? ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

function StatBlock({ items, title }: { items: { label: string; value: string; hint?: string }[]; title?: string }) {
  return (
    <div>
      <BlockTitle>{title}</BlockTitle>
      <div className={cn('grid gap-2', items.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {items.map((item) => (
          <div key={item.label} className="rounded-sm bg-surface px-2.5 py-2">
            <p className="truncate text-micro text-muted">{item.label}</p>
            <p className="mt-0.5 truncate text-title font-semibold tabular-nums text-fg">{item.value}</p>
            {item.hint ? <p className="mt-0.5 truncate text-micro text-faint">{item.hint}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkBlock({ items, title }: { items: { label: string; url: string }[]; title?: string }) {
  const host = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };
  return (
    <div>
      <BlockTitle>{title}</BlockTitle>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.url + item.label}>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="focus-ring-inset group flex items-center gap-2 rounded-sm py-1.5 text-label"
            >
              <ExternalLink size={11} aria-hidden className="shrink-0 text-faint group-hover:text-muted" />
              <span className="min-w-0 flex-1 truncate text-fg group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-2">
                {item.label}
              </span>
              <span className="shrink-0 truncate text-micro text-faint">{host(item.url)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnswerBlocks({ blocks, className }: { blocks: AnswerBlock[]; className?: string }) {
  if (!blocks.length) return null;
  return (
    <div className={cn('space-y-3.5', className)}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'table':
            return <TableBlock key={index} title={block.title} columns={block.columns} rows={block.rows} />;
          case 'chart':
            return (
              <div key={index}>
                <BlockTitle>{block.title}</BlockTitle>
                {block.chart === 'bar' ? <BarChart data={block.data} unit={block.unit} /> : null}
                {block.chart === 'line' ? <LineChart data={block.data} unit={block.unit} /> : null}
                {block.chart === 'donut' ? <DonutChart data={block.data} unit={block.unit} /> : null}
              </div>
            );
          case 'stats':
            return <StatBlock key={index} title={block.title} items={block.items} />;
          case 'links':
            return <LinkBlock key={index} title={block.title} items={block.items} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
