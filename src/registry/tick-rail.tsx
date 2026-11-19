'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'tick-rail': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type TickRailItem = {
  // The id of the section the tick links to.
  id: string;
  // The tick's name, read by screen readers and shown in the card. Plain text.
  label: string;
  // Shown in the card under the label, and read as the link's description.
  description?: string;
};

type TickRailProps = {
  items: TickRailItem[];
  // The navigation's accessible name.
  label?: string;
  // The sections, rendered in a scrolling area beside the rail. Without children, the rail tracks
  // sections elsewhere on the page and scrolls the page.
  children?: React.ReactNode;
  className?: string;
};

// The element reads the ticks once, so a different set of items remounts it. It marks the current
// section and moves the card itself after it upgrades.
export function TickRail({ items, label = 'On this page', children, className }: TickRailProps) {
  const id = React.useId();
  const key = JSON.stringify(items.map((item) => item.id));

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./tick-rail-element');
  }, []);

  return (
    <tick-rail
      key={key}
      className={cn(
        'group/tkr relative isolate grid [--tkr-current:0.6667] [--tkr-rail:48px] [--tkr-rest:0.3333] [--tkr-size:24px] pointer-coarse:[--tkr-size:32px]',
        children ? 'grid-cols-[var(--tkr-rail)_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-background' : 'w-(--tkr-rail)',
        className,
      )}
    >
      <nav className="grid auto-rows-(--tkr-size) content-center py-4" aria-label={label} data-rail>
        {items.map((item, index) => (
          <a
            key={item.id}
            className="group/tick flex items-center pl-3 text-muted-foreground transition-[color] duration-120 ease-[ease] [-webkit-tap-highlight-color:transparent] not-data-lit:aria-[current=location]:text-primary focus-visible:rounded focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-lit:text-foreground"
            href={`#${item.id}`}
            aria-describedby={item.description ? `${id}-${index}` : undefined}
            aria-current={index === 0 ? 'location' : undefined}
            data-tick
          >
            <span className="sr-only">{item.label}</span>
            <span
              className="block h-0.5 w-6 origin-left rounded-[1px] bg-current transform-[scaleX(var(--tkr-rest))] transition-transform duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] group-aria-[current=location]/tick:transform-[scaleX(var(--tkr-current))] group-data-instant/tkr:transition-none motion-reduce:transition-none"
              aria-hidden="true"
              data-line
            />
          </a>
        ))}
      </nav>

      <div hidden>
        {items.map((item, index) =>
          item.description ? (
            <span key={item.id} id={`${id}-${index}`}>
              {item.description}
            </span>
          ) : null,
        )}
      </div>

      {children ? (
        <div className="overflow-y-auto overscroll-contain pr-5 pl-1 contain-size" data-scroll>
          {children}
        </div>
      ) : null}

      <div
        className={cn(
          'group/card pointer-events-none absolute top-0 left-(--tkr-rail) z-1 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-instant:transition-none data-jump:transition-none data-showing:pointer-events-auto data-showing:cursor-pointer motion-reduce:transition-none',
          children ? 'w-[min(260px,calc(100%-var(--tkr-rail)-16px))]' : 'w-65',
        )}
        aria-hidden="true"
        data-card
      >
        <div
          className="grid origin-left overflow-hidden rounded-md border border-border bg-popover px-3 py-2.5 opacity-0 shadow-md transform-[translateX(-4px)_scale(0.98)] transition-[opacity,transform,height] duration-[120ms,120ms,200ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-data-showing/card:transform-none group-data-showing/card:opacity-100 group-data-showing/card:duration-[180ms,180ms,200ms] group-data-jump/card:transition-[opacity,transform] group-data-instant/card:transition-none motion-reduce:transform-none motion-reduce:transition-none"
          data-card-box
        />
      </div>

      {/* A hidden element instead of a <template>, which React doesn't render into its content. */}
      <div hidden data-card-template>
        <div className="col-start-1 row-start-1 self-start" data-face>
          <p className="text-[13px] font-medium text-popover-foreground" data-face-title />
          <p className="mt-0.5 line-clamp-3 text-xs/normal text-pretty text-muted-foreground" data-face-text />
        </div>
      </div>
    </tick-rail>
  );
}
