'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'worm-dots': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type WormDotsProps = {
  slides: React.ReactNode[];
  'aria-label': string;
  className?: string;
  slideClassName?: string;
};

// The element manages the current slide, the worm, and the announcements after it upgrades.
// It counts the slides once, so a different number of slides remounts it, back on the first.
export function WormDots({ slides, 'aria-label': ariaLabel, className, slideClassName }: WormDotsProps) {
  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./worm-dots-element');
  }, []);

  const total = slides.length;

  return (
    <worm-dots
      key={total}
      className={cn(
        'group/wd @container grid w-full gap-1.5 [--wd-dot:6px] [--wd-gap:24px] [--wd-hit:40px] [--wd-pill:12px] [--wd-reach:12px] [--wd-ring:16px] pointer-coarse:[--wd-hit:44px]',
        className,
      )}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
    >
      <div
        className="flex scrollbar-none snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain mask-[linear-gradient(to_right,transparent,#000_var(--wd-peek),#000_calc(100%-var(--wd-peek)),transparent)] px-[calc((100cqi-var(--wd-slide))/2)] [--wd-peek:clamp(16px,8cqi,36px)] [--wd-slide:min(100cqi-2*var(--wd-peek),280px)] [&::-webkit-scrollbar]:hidden"
        tabIndex={-1}
        data-track
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            className={cn(
              'h-35 w-(--wd-slide) flex-none snap-center snap-always rounded-xl border border-border bg-card text-card-foreground',
              slideClassName,
            )}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${total}`}
            data-slide
          >
            {slide}
          </div>
        ))}
      </div>
      <div className="grid w-(--wd-slide) grid-cols-[1fr_auto_1fr] items-center justify-self-center [--wd-peek:clamp(16px,8cqi,36px)] [--wd-slide:min(100cqi-2*var(--wd-peek),280px)]">
        <div
          className="group/strip relative isolate col-start-2 flex cursor-pointer touch-pan-y px-(--wd-reach) select-none forced-color-adjust-none [-webkit-tap-highlight-color:transparent] group-data-scrubbing/wd:cursor-grabbing"
          role="group"
          aria-label="Choose slide"
          data-strip
        >
          <span
            className="pointer-events-none absolute top-[calc(50%-var(--wd-ring)/2)] left-(--wd-reach) size-(--wd-ring) rounded-full bg-foreground/8 opacity-0 transition-[transform,width,opacity] duration-80 ease-[ease-out] data-visible:opacity-100 forced-colors:bg-transparent forced-colors:shadow-[inset_0_0_0_1px_CanvasText] motion-reduce:transition-opacity"
            aria-hidden="true"
            data-ring
          />
          <span
            className="pointer-events-none absolute top-[calc(50%-var(--wd-dot)/2)] left-(--wd-reach) z-1 h-(--wd-dot) w-(--wd-pill) transform-[translateX(calc(var(--wd-gap)/2-var(--wd-pill)/2))] rounded-full bg-foreground group-has-focus-visible/strip:outline-2 group-has-focus-visible/strip:outline-offset-2 group-has-focus-visible/strip:outline-ring forced-colors:bg-[CanvasText] forced-colors:group-has-focus-visible/strip:outline-[Highlight]"
            aria-hidden="true"
            data-worm
          />
          {slides.map((_, index) => (
            <button
              key={index}
              className="relative h-(--wd-hit) w-(--wd-gap) cursor-[inherit] before:absolute before:top-[calc(50%-var(--wd-dot)/2)] before:left-[calc(50%-var(--wd-dot)/2)] before:size-(--wd-dot) before:rounded-full before:bg-muted-foreground/60 before:transition-[background-color] before:duration-150 before:ease-[ease-out] before:content-[''] focus-visible:outline-none data-pressed:before:bg-muted-foreground forced-colors:before:bg-[GrayText] forced-colors:data-pressed:before:bg-[CanvasText]"
              type="button"
              aria-label={`Slide ${index + 1} of ${total}`}
              aria-current={index === 0 ? 'true' : undefined}
              tabIndex={index === 0 ? undefined : -1}
              data-dot
            />
          ))}
        </div>
        <p
          className="justify-self-end font-mono text-[11px] whitespace-nowrap text-muted-foreground tabular-nums"
          aria-hidden="true"
          data-counter
        >
          {`1 / ${total}`}
        </p>
      </div>
      <p className="sr-only" aria-live="polite" data-status />
    </worm-dots>
  );
}
