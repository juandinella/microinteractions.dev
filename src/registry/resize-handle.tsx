'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'resizable-sidebar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type ResizableSidebarProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  // Starting sidebar width in px. The element keeps the main area at least `mainMinWidth` wide.
  defaultWidth?: number;
  mainMinWidth?: number;
  className?: string;
};

export function ResizableSidebar({
  sidebar,
  children,
  defaultWidth = 160,
  mainMinWidth = 140,
  className,
}: ResizableSidebarProps) {
  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./resize-handle-element');
  }, []);

  return (
    <resizable-sidebar
      className={cn(
        'group/rsb relative [--rsb-ease:cubic-bezier(0.23,1,0.32,1)] grid h-55 w-full grid-cols-[min(var(--rsb-width),100%-var(--rsb-main-min))_minmax(0,1fr)] overflow-hidden rounded-[14px] border border-border bg-background text-[13px] text-foreground [--rsb-hit:12px] [--rsb-reveal:1] pointer-coarse:[--rsb-hit:24px] motion-safe:[--rsb-reveal:0.5]',
        className,
      )}
      style={{ '--rsb-width': `${defaultWidth}px`, '--rsb-main-min': `${mainMinWidth}px` } as React.CSSProperties}
    >
      <div className="min-w-0 overflow-hidden bg-sidebar text-sidebar-foreground" data-side>
        {sidebar}
      </div>
      <div
        className="group/handle absolute inset-y-0 left-[calc(var(--rsb-hit)/-2)] z-1 w-(--rsb-hit) translate-x-[max(var(--rsb-width),var(--rsb-hit)/2)] cursor-col-resize touch-none outline-none select-none [-webkit-tap-highlight-color:transparent] group-not-[&:defined]/rsb:hidden before:pointer-events-none before:absolute before:inset-y-0 before:left-[calc(50%-1px)] before:w-px before:bg-border before:content-[''] group-data-collapsed/rsb:before:opacity-0 focus-visible:before:bg-ring forced-colors:focus-visible:before:bg-[Highlight]"
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        data-handle
        data-state="idle"
      >
        <span
          className="pointer-events-none absolute top-0 left-1/2 h-8 w-1 -translate-x-[calc(50%+0.5px)] translate-y-(--rsb-grip-y) scale-y-(--rsb-reveal) rounded-full bg-muted-foreground opacity-0 transition-[opacity,scale,background-color,width] duration-[100ms,100ms,120ms,100ms] ease-[ease-out,var(--rsb-ease),ease-out,var(--rsb-ease)] group-focus-visible/handle:scale-y-100 group-focus-visible/handle:bg-ring group-focus-visible/handle:opacity-100 group-focus-visible/handle:duration-[120ms,120ms,120ms,100ms] group-data-[state=drag]/handle:w-1.5 group-data-[state=drag]/handle:scale-y-100 group-data-[state=drag]/handle:bg-foreground group-data-[state=drag]/handle:opacity-100 group-data-[state=drag]/handle:duration-[120ms,120ms,120ms,100ms] group-data-[state=hover]/handle:scale-y-100 group-data-[state=hover]/handle:opacity-100 group-data-[state=hover]/handle:delay-[60ms,60ms,0s,0s] group-data-[state=hover]/handle:duration-[120ms,120ms,120ms,100ms] forced-colors:bg-[CanvasText] forced-colors:group-focus-visible/handle:bg-[Highlight] motion-reduce:transition-[opacity,scale,background-color] [@media(hover:none)]:scale-y-100 [@media(hover:none)]:opacity-100"
          data-grip
        />
      </div>
      <div className="min-w-0 overflow-hidden">{children}</div>
    </resizable-sidebar>
  );
}
