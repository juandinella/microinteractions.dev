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
  // Submits the value with a surrounding form under this name. A form reset restores defaultValue and
  // calls onValueChange; disabled (or a disabled fieldset) leaves it out and dims the slider.
  name?: string;
  disabled?: boolean;
  className?: string;
};

// A percentage slider: the element announces the value as "N percent" and the tooltip shows "N%".
// The tooltip sits 46px above the track, so leave room for it. It's as wide as the label and the
// widest value, at least 128px, and stays inside the slider at either end.
export function EdgeAwareSlider({
  label,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  name,
  disabled,
  className,
}: EdgeAwareSliderProps) {
  // Uncontrolled: `defaultValue` is read once. A later change would rewrite the input's value
  // without an input event, and the tooltip would fall out of step.
  const initial = React.useRef(defaultValue).current;
  const decimals = String(step).split('.')[1]?.length ?? 0;
  const input = React.useRef<HTMLInputElement>(null);
  const last = React.useRef(initial);
  const change = React.useRef(onValueChange);
  change.current = onValueChange;
  const report = (value: number) => {
    if (value === last.current) return;
    last.current = value;
    change.current?.(value);
  };
  const widest = [min, max].map((end) => end.toFixed(decimals)).reduce((a, b) => (b.length > a.length ? b : a));

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./edge-aware-tooltip-element');
    // A form reset restores the input without an input event, once the reset event is over.
    const form = input.current?.form;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => input.current && report(input.current.valueAsNumber));
    };
    form?.addEventListener('reset', reset);
    return () => {
      form?.removeEventListener('reset', reset);
      clearTimeout(timer);
    };
  }, []);

  return (
    <edge-aware-tooltip
      className={cn(
        'relative mt-12 block h-11 transition-none has-disabled:opacity-50 [--x:var(--value)] rtl:[--x:calc(1-var(--value))] [anchor-scope:--volume-thumb] **:transition-none',
        className,
      )}
      style={{ '--value': (initial - min) / (max - min) } as React.CSSProperties}
    >
      <div className="pointer-events-none absolute inset-x-3 top-5 h-1 rounded-xs bg-muted" aria-hidden="true">
        <span className="absolute inset-0 bg-primary [clip-path:inset(0_calc((1-var(--x))*100%)_0_0_round_2px)] rtl:[clip-path:inset(0_0_0_calc(var(--x)*100%)_round_2px)]" />
        <span className="absolute -top-2.5 left-[calc(var(--x)*100%-12px)] size-6 [anchor-name:--volume-thumb]" />
      </div>
      <span aria-hidden="true" data-tip className="pointer-events-none absolute bottom-11.5 left-[clamp(0px,calc(12px+(100%-24px)*var(--x)-var(--tip-w,128px)/2),calc(100%-var(--tip-w,128px)))] flex w-max max-w-full min-w-32 justify-center gap-1 rounded-lg bg-foreground px-3 py-2.25 text-center text-sm/5 font-medium text-background tabular-nums whitespace-nowrap supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:[position-anchor:--volume-thumb] supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:bottom-[calc(anchor(top)+12px)] supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:left-auto supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:[justify-self:anchor-center]">
        {/* Only a label wider than the slider itself is cut, and the value stays whole. */}
        <span className="min-w-0 truncate">{label}</span>
        {/* The current value sits over a hidden copy of the widest one, so the tooltip keeps one width. */}
        <span className="grid flex-none justify-items-start *:col-start-1 *:row-start-1">
          <span>
            <span data-volume>{initial}</span>%
          </span>
          <span className="invisible">{widest}%</span>
        </span>
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-10.5 left-[calc(12px+(100%-24px)*var(--x)-4px)] size-2 rotate-45 bg-foreground supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:[position-anchor:--volume-thumb] supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:bottom-[calc(anchor(top)+8px)] supports-[(position-anchor:--volume-thumb)_and_(justify-self:anchor-center)_and_(anchor-scope:--volume-thumb)]:left-[calc(anchor(center)-4px)]" />
      <input
        ref={input}
        className="relative m-0 block h-11 w-full cursor-ew-resize touch-pan-y appearance-none disabled:cursor-not-allowed bg-transparent p-0 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-slider-runnable-track]:h-6 [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:h-6 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background"
        type="range"
        min={min}
        max={max}
        step={step}
        name={name}
        disabled={disabled}
        defaultValue={initial}
        aria-label={label}
        aria-valuetext={`${initial} percent`}
        onChange={(event) => report(event.currentTarget.valueAsNumber)}
        data-position-input
      />
    </edge-aware-tooltip>
  );
}
