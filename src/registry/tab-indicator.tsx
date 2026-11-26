'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'tab-indicator': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type Tab = {
  value: string;
  label: string;
  badge?: React.ReactNode;
  content: React.ReactNode;
};

// React 18 warns about a layout effect during server rendering; React 19 skips it quietly.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

type TabIndicatorProps = {
  tabs: Tab[];
  // The selected tab, controlled: a click or an arrow key calls onValueChange, and the tab stays only once
  // value says so. Set it in the same update, as with a controlled input, or the selection goes back to value.
  // A change from here, such as from the URL, moves the line at once. A value that isn't a tab shows the first.
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  'aria-label': string;
  className?: string;
};

// Without `value`, `defaultValue` is read once. The element manages selection, focus, and the line
// after it upgrades. It reads the tabs once, so a different set of tabs remounts it. The selected
// tab survives while it's still there; otherwise `defaultValue`, or the first tab, takes over and
// `onValueChange` reports it. With no tabs it renders nothing.
export function TabIndicator({
  tabs,
  value,
  defaultValue,
  onValueChange,
  'aria-label': ariaLabel,
  className,
}: TabIndicatorProps) {
  const root = React.useRef<HTMLElement & { selectedIndex: number }>(null);
  const change = React.useRef(onValueChange);
  change.current = onValueChange;
  const controlled = React.useRef(false);
  const [, rerender] = React.useReducer((count: number) => count + 1, 0);
  const initial = React.useRef(defaultValue).current;
  const selection = React.useRef<string | undefined>(undefined);
  const key = JSON.stringify(tabs.map((tab) => tab.value));
  // Read once per set of tabs, so a render never rewrites the selection the element manages.
  const selected = React.useMemo(() => {
    const values: string[] = JSON.parse(key);
    if (selection.current !== undefined && values.includes(selection.current)) return selection.current;
    return initial !== undefined && values.includes(initial) ? initial : values[0];
  }, [key, initial]);

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./tab-indicator-element');
    const element = root.current;
    // Nothing is rendered when the list is empty.
    if (!element) return;
    const values: string[] = JSON.parse(key);
    // The element updates aria-selected on the tab before the event reaches the list.
    const report = () => {
      const index = [...element.querySelectorAll('[data-tab]')].findIndex(
        (tab) => tab.getAttribute('aria-selected') === 'true',
      );
      const value = values[index];
      if (value === undefined || value === selection.current) return;
      // The first read only records the starting tab, so Strict Mode can't report it twice.
      const changed = selection.current !== undefined;
      selection.current = value;
      if (!changed) return;
      // Controlled, the render below puts value back unless onValueChange changed it.
      if (controlled.current) rerender();
      change.current?.(value);
    };
    report();
    element.addEventListener('click', report);
    element.addEventListener('keydown', report);
    return () => {
      element.removeEventListener('click', report);
      element.removeEventListener('keydown', report);
    };
  }, [key]);

  const values: string[] = JSON.parse(key);
  const shown = value === undefined ? selected : values.includes(value) ? value : values[0];

  useIsomorphicLayoutEffect(() => {
    controlled.current = value !== undefined;
    if (value === undefined || shown === undefined) return;
    selection.current = shown;
    const element = root.current;
    // React has already rendered aria-selected, so the getter can't tell; the element skips the tab it has.
    // Before the element upgrades, the markup already shows the tab; an index set then would hide its setter.
    if (element && customElements.get('tab-indicator')) element.selectedIndex = values.indexOf(shown);
  });

  if (tabs.length === 0) return null;

  return (
    <tab-indicator
      key={key}
      ref={root}
      className={cn(
        'group/tbi block [--tbi-ease:cubic-bezier(0.23,1,0.32,1)] w-full overflow-hidden rounded-xl border border-border bg-background [--tbi-fade-end:0px] [--tbi-fade-start:0px] [--tbi-pad:8px] data-more-end:[--tbi-fade-end:32px] data-more-start:[--tbi-fade-start:32px]',
        className,
      )}
    >
      <div
        className="relative flex scrollbar-none gap-0.5 overflow-x-auto mask-[linear-gradient(to_right,transparent,#000_var(--tbi-fade-start),#000_calc(100%-var(--tbi-fade-end)),transparent)] p-(--tbi-pad) [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={ariaLabel}
        data-list
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className="group/tab relative inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground [-webkit-tap-highlight-color:transparent] before:absolute before:-inset-x-px before:-inset-y-1 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-selected:text-foreground group-not-data-ready/tbi:aria-selected:after:absolute group-not-data-ready/tbi:aria-selected:after:inset-x-0 group-not-data-ready/tbi:aria-selected:after:-bottom-(--tbi-pad) group-not-data-ready/tbi:aria-selected:after:h-0.5 group-not-data-ready/tbi:aria-selected:after:bg-foreground group-not-data-ready/tbi:aria-selected:after:content-[''] pointer-coarse:before:-inset-y-1.5 group-not-data-scrolling/tbi:pointer-fine:hover:bg-muted/50 group-not-data-scrolling/tbi:pointer-fine:hover:text-foreground"
            type="button"
            role="tab"
            aria-selected={tab.value === shown}
            tabIndex={tab.value === shown ? undefined : -1}
            data-tab
          >
            {/* The hidden bold copy reserves the selected width, so the row doesn't shift. */}
            <span
              className="inline-grid after:invisible after:col-start-1 after:row-start-1 after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-text)] after:select-none"
              data-text={tab.label}
            >
              <span className="col-start-1 row-start-1 group-aria-selected/tab:font-semibold">{tab.label}</span>
            </span>
            {tab.badge !== undefined && (
              <span className="rounded-full bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        <span
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-top-left bg-foreground group-not-data-ready/tbi:invisible motion-safe:group-data-ready/tbi:transition-transform motion-safe:group-data-ready/tbi:duration-250 motion-safe:group-data-ready/tbi:ease-(--tbi-ease)"
          aria-hidden="true"
          data-line
        />
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.value}
          className="border-t border-border bg-muted/50 px-2 py-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          role="tabpanel"
          tabIndex={0}
          hidden={tab.value !== shown}
          data-panel
        >
          {tab.content}
        </div>
      ))}
    </tab-indicator>
  );
}
