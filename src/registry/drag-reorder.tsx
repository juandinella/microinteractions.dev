'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'drag-reorder': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type DragReorderItem = { id: string; label: string };

type DragReorderProps = {
  items: DragReorderItem[];
  'aria-label': string;
  // Called with the ids in their new order, after a drop that moved something.
  onReorder?: (ids: string[]) => void;
  className?: string;
};

// The element moves the real list items after it upgrades, so React renders the rows once, in the order it
// first saw, and never moves them. Keep the new order in your own state from onReorder; passing it back as
// `items` changes nothing, and an order that comes from elsewhere moves the rows. A different set of items remounts the list.
export function DragReorder({ items, 'aria-label': ariaLabel, onReorder, className }: DragReorderProps) {
  const ref = React.useRef<HTMLElement>(null);
  const handler = React.useRef(onReorder);
  const ids = items.map((item) => item.id);
  const order = ids.join('\n');
  const key = [...ids].sort().join('\n');
  const [first, setFirst] = React.useState({ key, ids });
  const rendered = first.key === key ? first : { key, ids };
  if (rendered !== first) setFirst(rendered);
  const rows = rendered.ids.flatMap((id) => items.find((item) => item.id === id) ?? []);

  React.useEffect(() => {
    handler.current = onReorder;
  });

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./drag-reorder-element');
    const element = ref.current;
    if (!element) return;
    const listener = (event: Event) => handler.current?.((event as CustomEvent<{ ids: string[] }>).detail.ids);
    element.addEventListener('reorder', listener);
    return () => element.removeEventListener('reorder', listener);
  }, [key]);

  // After a drop the rows already sit in the order that comes back. Any other order moves them here.
  React.useEffect(() => {
    const list = ref.current?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;
    const placed = new Map(Array.from(list.querySelectorAll<HTMLElement>(':scope > [data-item]'), (row) => [row.dataset.id, row]));
    if ([...placed.keys()].join('\n') === order) return;
    const focused = document.activeElement;
    list.append(...order.split('\n').flatMap((id) => placed.get(id) ?? []));
    // Moving a focused node blurs it in some browsers.
    if (focused instanceof HTMLElement && list.contains(focused)) focused.focus({ preventScroll: true });
    list.querySelectorAll('[data-position]').forEach((position, index) => {
      position.textContent = String(index + 1).padStart(2, '0');
    });
  }, [order]);

  return (
    <drag-reorder
      key={key}
      ref={ref}
      className={cn('group/dr grid w-[min(100%,320px)] gap-3', className)}
    >
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-x-3 -top-0.75 h-0.5 rounded-xs bg-muted-foreground opacity-0 [transition:transform_150ms_ease-out,opacity_150ms_ease-out] data-active:opacity-100 motion-reduce:[transition:opacity_150ms_ease-out] forced-colors:bg-[CanvasText]"
          aria-hidden="true"
          data-line
        />
        <ul className="group/list isolate m-0 grid list-none gap-1 p-0" aria-label={ariaLabel} data-list>
          {rows.map((item, index) => (
            <li
              key={item.id}
              className="relative h-11 rounded-[10px] border border-border bg-card [transition:transform_250ms_cubic-bezier(0.23,1,0.32,1),box-shadow_150ms_ease-out] group-data-instant/list:[transition:none] data-dragging:z-2 dark:data-dragging:bg-accent dark:data-grabbed:bg-accent data-settling:z-2 data-dragging:border-input data-dragging:shadow-xl data-dragging:[transition:box-shadow_150ms_ease-out] data-grabbed:border-input data-grabbed:shadow-lg pointer-fine:not-group-data-dragging/dr:hover:border-input forced-colors:data-dragging:outline-2 forced-colors:data-dragging:outline-[Highlight] forced-colors:data-grabbed:outline-2 forced-colors:data-grabbed:outline-[Highlight] motion-reduce:[transition:box-shadow_150ms_ease-out]"
              data-item
              data-id={item.id}
            >
              <button
                className="flex size-full cursor-grab touch-none items-center gap-2.5 rounded-[inherit] px-3 text-left text-sm text-card-foreground select-none [-webkit-tap-highlight-color:transparent] group-data-dragging/dr:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                type="button"
                aria-pressed="false"
                data-handle
              >
                <svg className="flex-none text-muted-foreground" viewBox="0 0 10 16" width="10" height="16" fill="currentColor" aria-hidden="true">
                  <circle cx="2.5" cy="3" r="1.25" />
                  <circle cx="7.5" cy="3" r="1.25" />
                  <circle cx="2.5" cy="8" r="1.25" />
                  <circle cx="7.5" cy="8" r="1.25" />
                  <circle cx="2.5" cy="13" r="1.25" />
                  <circle cx="7.5" cy="13" r="1.25" />
                </svg>
                <span className="min-w-0 truncate" data-label>
                  {item.label}
                </span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums" aria-hidden="true" data-position>
                  {String(index + 1).padStart(2, '0')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only" data-help>
        Press Space to pick up, the arrow keys to move, Space to drop, Escape to cancel.
      </p>
      <p className="sr-only" aria-live="polite" data-status />
    </drag-reorder>
  );
}
