'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'plucked-underline': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type PluckedLinkProps = Omit<React.ComponentProps<'a'>, 'ref'>;

// A longer link rings longer and lower: the element times each underline from its width.
export function PluckedLink({ className, children, ...props }: PluckedLinkProps) {
  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./plucked-underline-element');
  }, []);

  return (
    <plucked-underline className="contents">
      <a data-pluck className={cn('group/pluck relative [--pluck-ease-out:cubic-bezier(0.23,1,0.32,1)] [--pluck-ease:linear(0,0.157,0.424,0.741,1.051,1.304,1.471,1.536,1.506,1.401,1.247,1.078,0.923,0.804,0.734,0.718,0.749,0.815,0.9,0.989,1.065,1.119,1.146,1.146,1.122,1.083,1.036,0.991,0.954,0.931,0.922,0.926,0.942,0.965,0.989,1.012,1)] inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-foreground no-underline [--pluck-duration:720ms] [--pluck-x:50%] [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', className)} {...props}>
        {children}
        <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute bottom-1 left-2.5 h-3 w-[calc(100%-20px)] overflow-visible [clip-path:inset(-4px_calc(100%-var(--pluck-x))_-4px_var(--pluck-x))] transition-[clip-path] duration-110 ease-(--pluck-ease-out) group-focus-visible/pluck:[clip-path:inset(-4px_-1px)] group-focus-visible/pluck:transition-none group-data-plucked/pluck:[clip-path:inset(-4px_-1px)] group-data-plucked/pluck:duration-140 motion-reduce:transition-none">
          <path d="M0 6 Q50 16 100 6" className="fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [vector-effect:non-scaling-stroke] transform-view origin-center transition-transform delay-110 duration-0 group-focus-visible/pluck:transform-[scaleY(0.001)] group-focus-visible/pluck:transition-none group-data-ringing/pluck:transform-[scaleY(0.001)] group-data-ringing/pluck:delay-0 group-data-ringing/pluck:duration-(--pluck-duration) group-data-ringing/pluck:ease-(--pluck-ease) motion-reduce:transition-none" />
        </svg>
      </a>
    </plucked-underline>
  );
}
