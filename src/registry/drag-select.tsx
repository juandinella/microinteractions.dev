'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'drag-select-table': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type Row = {
  id: string;
  label: string;
  detail?: React.ReactNode;
};

type DragSelectTableProps = {
  title: string;
  rows: Row[];
  headers?: { label: string; detail: string };
  onSelectionChange?: (ids: string[]) => void;
  className?: string;
};

const check = (
  <svg viewBox="0 0 18 18" aria-hidden="true" className="pointer-events-none absolute inset-0 size-4.5 fill-none stroke-primary-foreground stroke-2 [stroke-linecap:round] [stroke-linejoin:round] forced-colors:stroke-[HighlightText] forced-colors:forced-color-adjust-none [stroke-dasharray:1] [stroke-dashoffset:1] peer-checked:[stroke-dashoffset:0] peer-checked:transition-[stroke-dashoffset] peer-checked:duration-(--dst-draw) peer-checked:ease-(--dst-ease) peer-indeterminate:[stroke-dashoffset:1] peer-indeterminate:transition-none">
    <path pathLength={1} d="M5 9.4l2.7 2.6L13 6.5" />
  </svg>
);

// The element manages checking, the drag band, and the announcements after it upgrades.
// Give the component a new key when its rows change, so the element reads the new markup.
export function DragSelectTable({
  title,
  rows,
  headers = { label: 'Name', detail: 'Detail' },
  onSelectionChange,
  className,
}: DragSelectTableProps) {
  const root = React.useRef<HTMLElement>(null);
  const change = React.useRef(onSelectionChange);
  change.current = onSelectionChange;

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./drag-select-element');
    const element = root.current!;
    let pending = false;
    // A drag changes many boxes at once; report the selection once they have all changed.
    const report = () => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        const boxes = [...element.querySelectorAll<HTMLInputElement>('tbody input')];
        change.current?.(rows.filter((_, index) => boxes[index]?.checked).map((row) => row.id));
      });
    };
    element.addEventListener('change', report);
    return () => element.removeEventListener('change', report);
  }, [rows]);

  return (
    <drag-select-table ref={root} className={cn('block [--dst-ease:cubic-bezier(0.23,1,0.32,1)] w-[min(100%,480px)] rounded-2xl border border-border bg-background text-foreground [--dst-draw:0ms] [--dst-follow:0ms] [--dst-row:40px] pointer-coarse:[--dst-row:44px] motion-safe:[--dst-draw:160ms] motion-safe:[--dst-follow:90ms] data-dragging:select-none', className)}>
      <div className="flex items-baseline justify-between gap-4 px-5 pt-4.5 pb-2.5">
        <p className="m-0 text-[15px] font-medium">{title}</p>
        <p className="m-0 font-mono text-xs text-muted-foreground tabular-nums" data-count>
          {`0 of ${rows.length}`}
        </p>
      </div>
      <div className="relative isolate max-h-[calc(36px+var(--dst-row)*5.5)] overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-color:var(--color-input)_transparent] scrollbar-thin" data-scroll>
        <table className="w-full border-separate border-spacing-0 text-sm" aria-label={title}>
          <thead>
            <tr>
              <th className="sticky top-0 z-2 h-9 border-b border-border bg-background shadow-[0_-8px_0_var(--color-background)] text-start font-mono text-[11px] font-normal text-muted-foreground w-11" scope="col">
                <span className="relative mx-auto grid size-4.5 place-items-center">
                  <input type="checkbox" aria-label="Select all" data-all className="peer m-0 size-4.5 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-input bg-background scroll-mt-12 scroll-mb-3 transition-[background-color,border-color] duration-100 ease-[ease] checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring not-forced-colors:data-pointer-focus:outline-none forced-colors:checked:border-[Highlight] forced-colors:checked:bg-[Highlight] forced-colors:indeterminate:border-[Highlight] forced-colors:indeterminate:bg-[Highlight] forced-colors:forced-color-adjust-none forced-colors:focus-visible:outline-[Highlight]" />
                  {check}
                  <svg viewBox="0 0 18 18" aria-hidden="true" className="pointer-events-none absolute inset-0 size-4.5 fill-none stroke-primary-foreground stroke-2 [stroke-linecap:round] [stroke-linejoin:round] forced-colors:stroke-[HighlightText] forced-colors:forced-color-adjust-none opacity-0 peer-indeterminate:opacity-100">
                    <path d="M5.5 9h7" />
                  </svg>
                </span>
              </th>
              <th className="sticky top-0 z-2 h-9 border-b border-border bg-background shadow-[0_-8px_0_var(--color-background)] pe-3 text-start font-mono text-[11px] font-normal text-muted-foreground" scope="col">
                {headers.label}
              </th>
              <th className="sticky top-0 z-2 h-9 border-b border-border bg-background shadow-[0_-8px_0_var(--color-background)] pe-3 text-start font-mono text-[11px] font-normal text-muted-foreground" scope="col">
                {headers.detail}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer *:h-(--dst-row) *:align-middle [&[data-selected]]:*:bg-foreground/8 data-[edge~=top]:*:first:rounded-ss-lg data-[edge~=top]:*:last:rounded-se-lg data-[edge~=bottom]:*:first:rounded-es-lg data-[edge~=bottom]:*:last:rounded-ee-lg pointer-fine:not-[&[data-selected]]:hover:*:bg-muted pointer-fine:not-[&[data-selected]]:hover:*:first:rounded-s-lg pointer-fine:not-[&[data-selected]]:hover:*:last:rounded-e-lg forced-colors:[&[data-selected]]:*:bg-[SelectedItem] forced-colors:[&[data-selected]]:*:text-[SelectedItemText] forced-colors:[&[data-selected]]:*:forced-color-adjust-none">
                <td className="group/cell w-11 cursor-pointer touch-none p-0 select-none [-webkit-touch-callout:none]" data-box-cell>
                  <span className="relative mx-auto grid size-4.5 place-items-center">
                    <input type="checkbox" aria-label={row.label} className="peer m-0 size-4.5 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-input bg-background scroll-mt-12 scroll-mb-3 transition-[background-color,border-color] duration-100 ease-[ease] checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring not-forced-colors:data-pointer-focus:outline-none forced-colors:checked:border-[Highlight] forced-colors:checked:bg-[Highlight] forced-colors:indeterminate:border-[Highlight] forced-colors:indeterminate:bg-[Highlight] forced-colors:forced-color-adjust-none forced-colors:focus-visible:outline-[Highlight] pointer-fine:group-hover/cell:not-checked:not-indeterminate:border-muted-foreground" />
                    {check}
                  </span>
                </td>
                <th className="pe-3 text-start font-normal whitespace-nowrap" scope="row">
                  {row.label}
                </th>
                <td className="pe-3 font-mono text-[11px]/[1.3] text-muted-foreground">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <span className="pointer-events-none absolute top-0 left-0 z-1 w-7 opacity-0 transition-opacity duration-150 ease-out [--dst-band-fill:color-mix(in_oklch,var(--color-ring)_12%,transparent)] [--dst-band-line:var(--color-ring)] data-shown:opacity-100 data-[mode=clear]:[--dst-band-fill:transparent] data-[mode=clear]:[--dst-band-line:var(--color-muted-foreground)]" data-band aria-hidden="true">
          <span className="absolute top-0 left-0 w-7 origin-top border-[1.5px] border-(--dst-band-line) bg-(--dst-band-fill) transition-transform duration-(--dst-follow) ease-(--dst-ease) in-data-instant:transition-none forced-colors:border-[Highlight] h-3.5 rounded-t-[14px] border-b-0" data-band-top />
          <span className="absolute top-0 left-0 w-7 origin-top border-[1.5px] border-(--dst-band-line) bg-(--dst-band-fill) transition-transform duration-(--dst-follow) ease-(--dst-ease) in-data-instant:transition-none forced-colors:border-[Highlight] h-px border-y-0" data-band-body />
          <span className="absolute top-0 left-0 w-7 origin-top border-[1.5px] border-(--dst-band-line) bg-(--dst-band-fill) transition-transform duration-(--dst-follow) ease-(--dst-ease) in-data-instant:transition-none forced-colors:border-[Highlight] h-3.5 rounded-b-[14px] border-t-0" data-band-bottom />
        </span>
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-5 pt-2.5 pb-3 font-mono text-[11px]/5 text-muted-foreground [@media(hover:none)]:hidden" aria-hidden="true">
        <span>
          <kbd className="inline-block min-w-4.5 rounded-sm border border-border bg-muted/50 px-1 text-center font-[inherit] leading-4 text-muted-foreground">Shift</kbd> click or <kbd className="inline-block min-w-4.5 rounded-sm border border-border bg-muted/50 px-1 text-center font-[inherit] leading-4 text-muted-foreground">Shift</kbd>{' '}
          <kbd className="inline-block min-w-4.5 rounded-sm border border-border bg-muted/50 px-1 text-center font-[inherit] leading-4 text-muted-foreground">↑</kbd>
          <kbd className="inline-block min-w-4.5 rounded-sm border border-border bg-muted/50 px-1 text-center font-[inherit] leading-4 text-muted-foreground">↓</kbd> to extend
        </span>
        <span>
          <kbd className="inline-block min-w-4.5 rounded-sm border border-border bg-muted/50 px-1 text-center font-[inherit] leading-4 text-muted-foreground">Esc</kbd> to cancel
        </span>
      </p>
      <span className="sr-only" data-instructions>
        Each box toggles its row, and so does a click anywhere on the row. Drag down the box column to give a run of
        rows the first row's new state, or Shift+click to extend from the last row you changed. With focus on a box,
        Shift+Up and Shift+Down give that box's state to the rows you move onto, and moving back restores them. Escape
        cancels a drag.
      </span>
      <span className="sr-only" role="status" />
    </drag-select-table>
  );
}
