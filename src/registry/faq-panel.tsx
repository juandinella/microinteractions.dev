'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'faq-panel': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type Question = {
  value: string;
  question: React.ReactNode;
  answer: React.ReactNode;
};

type FaqPanelProps = {
  items: Question[];
  // The question open at first; `null` starts with every answer closed.
  defaultValue?: string | null;
  // Reports the open question, or `null` when the open one is closed.
  onValueChange?: (value: string | null) => void;
  className?: string;
};

// Uncontrolled: `defaultValue` is read once. The element manages which answer is open and moves
// the panel after it upgrades. It reads the questions once, so a different set of questions
// remounts it. The open question survives while it's still there; otherwise `defaultValue`
// takes over.
export function FaqPanel({ items, defaultValue, onValueChange, className }: FaqPanelProps) {
  const root = React.useRef<HTMLElement>(null);
  const change = React.useRef(onValueChange);
  change.current = onValueChange;
  const initial = React.useRef(defaultValue === undefined ? items[0]?.value ?? null : defaultValue).current;
  const opened = React.useRef<string | null | undefined>(undefined);
  const key = JSON.stringify(items.map((item) => item.value));
  // Read once per set of questions, so a render never rewrites what the element manages.
  const open = React.useMemo(() => {
    const values: string[] = JSON.parse(key);
    if (opened.current !== undefined && (opened.current === null || values.includes(opened.current))) return opened.current;
    return initial !== null && values.includes(initial) ? initial : null;
  }, [key, initial]);

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./faq-panel-element');
    const element = root.current!;
    const values: string[] = JSON.parse(key);
    // The element updates aria-expanded on the question before the click reaches the root.
    const report = () => {
      const index = [...element.querySelectorAll('[data-trigger]')].findIndex(
        (trigger) => trigger.getAttribute('aria-expanded') === 'true',
      );
      const value = values[index] ?? null;
      if (value === opened.current) return;
      // The first read only records the starting question, so Strict Mode can't report it twice.
      const changed = opened.current !== undefined;
      opened.current = value;
      if (changed) change.current?.(value);
    };
    report();
    element.addEventListener('click', report);
    // Find in page opens an answer without a click; the event bubbles after the element has opened it.
    element.addEventListener('beforematch', report);
    return () => {
      element.removeEventListener('click', report);
      element.removeEventListener('beforematch', report);
    };
  }, [key]);

  return (
    <faq-panel
      key={key}
      ref={root}
      className={cn(
        'group/fqp relative block w-full rounded-xl border border-border bg-background p-1.5',
        className,
      )}
    >
      <span
        className="pointer-events-none absolute inset-x-1.5 top-0 h-0 rounded-lg bg-muted group-not-data-ready/fqp:invisible"
        aria-hidden="true"
        data-panel
      />
      {items.map((item) => (
        <div
          key={item.value}
          className="relative rounded-lg group-not-data-ready/fqp:has-aria-expanded:bg-muted"
          data-item
        >
          <h3>
            <button
              className="group/q flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg p-3 text-left text-sm/[1.4] font-medium text-foreground transition-[background-color] duration-120 ease-[ease] [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-[expanded=false]:pointer-fine:hover:bg-muted/50"
              type="button"
              aria-expanded={item.value === open}
              data-trigger
            >
              <span>{item.question}</span>
              <svg
                className="size-4 flex-none fill-none stroke-muted-foreground stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round] group-aria-expanded/q:rotate-180 motion-safe:group-data-ready/fqp:transition-[rotate] motion-safe:group-data-ready/fqp:duration-(--fqp-move) motion-safe:group-data-ready/fqp:ease-(--fqp-ease)"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
          </h3>
          {/* The element turns `hidden` into hidden="until-found", so find in page reaches closed answers. */}
          <div className="overflow-hidden" role="region" hidden={item.value !== open} data-answer>
            <div className="px-3 pb-3 text-[13px]/[1.55] text-pretty text-muted-foreground">{item.answer}</div>
          </div>
        </div>
      ))}
    </faq-panel>
  );
}
