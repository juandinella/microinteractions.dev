'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'edge-aware-tooltip': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type EdgeAwareSliderProps = {
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  className?: string;
};

// A percentage slider: the element announces the value as "N percent" and the tooltip shows "N%".
// The tooltip sits 46px above the track, so leave room for it.
export function EdgeAwareSlider({
  label,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
}: EdgeAwareSliderProps) {
  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./edge-aware-tooltip-element');
  }, []);

  return (
    <edge-aware-tooltip
      className={cn(
        'relative mt-12 block h-11 transition-none [anchor-scope:--volume-thumb] **:transition-none',
        className,
      )}
      style={{ '--value': (defaultValue - min) / (max - min) } as React.CSSProperties}
    >
      <div className="pointer-events-none absolute inset-x-3 top-5 h-1 rounded-xs bg-muted" aria-hidden="true">
        <span className="absolute inset-0 bg-primary [clip-path:inset(0_calc((1-var(--value))*100%)_0_0_round_2px)]" />
        <span className="absolute -top-2.5 left-[calc(var(--value)*100%-12px)] size-6 [anchor-name:--volume-thumb]" />
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-11.5 left-[clamp(0px,calc(12px+(100%-24px)*var(--value)-64px),calc(100%-128px))] w-32 rounded-lg bg-foreground px-3 py-2.25 text-center text-sm/5 font-medium text-background tabular-nums whitespace-nowrap supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:[position-anchor:--volume-thumb] supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:bottom-[calc(anchor(top)+12px)] supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:left-auto supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:[justify-self:anchor-center]">
        {label} <span data-volume>{defaultValue}</span>%
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-10.5 left-[calc(12px+(100%-24px)*var(--value)-4px)] size-2 rotate-45 bg-foreground supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:[position-anchor:--volume-thumb] supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:bottom-[calc(anchor(top)+8px)] supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:left-[calc(anchor(center)-4px)]" />
      <input
        className="relative m-0 block h-11 w-full cursor-ew-resize touch-pan-y appearance-none bg-transparent p-0 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-slider-runnable-track]:h-6 [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:h-6 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background"
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        aria-label={label}
        aria-valuetext={`${defaultValue} percent`}
        onChange={(event) => onValueChange?.(event.currentTarget.valueAsNumber)}
        data-position-input
      />
    </edge-aware-tooltip>
  );
}
