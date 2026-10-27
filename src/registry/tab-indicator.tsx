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
  label: string;
  badge?: React.ReactNode;
  content: React.ReactNode;
};

type TabIndicatorProps = {
  tabs: Tab[];
  defaultIndex?: number;
  onValueChange?: (index: number) => void;
  'aria-label': string;
  className?: string;
};

// The element manages selection, focus, and the line after it upgrades. Give the component a new
// key when its tabs change, so the element reads the new markup.
export function TabIndicator({
  tabs,
  defaultIndex = 0,
  onValueChange,
  'aria-label': ariaLabel,
  className,
}: TabIndicatorProps) {
  const root = React.useRef<HTMLElement>(null);
  const change = React.useRef(onValueChange);
  change.current = onValueChange;

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./tab-indicator-element');
    const element = root.current!;
    let selected = defaultIndex;
    // The element updates aria-selected on the tab before the event reaches the list.
    const report = () => {
      const index = [...element.querySelectorAll('[data-tab]')].findIndex(
        (tab) => tab.getAttribute('aria-selected') === 'true',
      );
      if (index === selected || index < 0) return;
      selected = index;
      change.current?.(index);
    };
    element.addEventListener('click', report);
    element.addEventListener('keydown', report);
    return () => {
      element.removeEventListener('click', report);
      element.removeEventListener('keydown', report);
    };
  }, [defaultIndex]);

  return (
    <tab-indicator
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
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            className="group/tab relative inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-[background-color,color] duration-120 ease-[ease] [-webkit-tap-highlight-color:transparent] before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-selected:text-foreground group-not-data-ready/tbi:aria-selected:after:absolute group-not-data-ready/tbi:aria-selected:after:inset-x-0 group-not-data-ready/tbi:aria-selected:after:-bottom-(--tbi-pad) group-not-data-ready/tbi:aria-selected:after:h-0.5 group-not-data-ready/tbi:aria-selected:after:bg-foreground group-not-data-ready/tbi:aria-selected:after:content-[''] pointer-coarse:before:-inset-y-1.5 pointer-fine:hover:bg-accent pointer-fine:hover:text-accent-foreground"
            type="button"
            role="tab"
            aria-selected={index === defaultIndex}
            tabIndex={index === defaultIndex ? undefined : -1}
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
      {tabs.map((tab, index) => (
        <div
          key={tab.label}
          className="border-t border-border bg-muted/50 px-2 py-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          role="tabpanel"
          tabIndex={0}
          hidden={index !== defaultIndex}
          data-panel
        >
          {tab.content}
        </div>
      ))}
    </tab-indicator>
  );
}
