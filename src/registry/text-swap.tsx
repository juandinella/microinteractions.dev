'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type TextSwapButtonProps = Omit<React.ComponentProps<'button'>, 'ref' | 'children'> & {
  label: string;
  nextLabel: string;
};

export function TextSwapButton({
  label,
  nextLabel,
  className,
  onClick,
  onBlur,
  'aria-label': ariaLabel = `${label}, ${nextLabel}`,
  ...props
}: TextSwapButtonProps) {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  // Touch has no hover, so a tap shows the next label until the next tap or a tap outside.
  const [touchActive, setTouchActive] = React.useState(false);

  React.useEffect(() => {
    if (!touchActive) return;
    const dismiss = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) setTouchActive(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [touchActive]);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={ariaLabel}
      data-touch-active={touchActive || undefined}
      className={cn(
        'group/swap inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center overflow-hidden rounded-xl border border-transparent bg-primary px-5 py-2.5 text-base/[1.2] font-medium whitespace-nowrap text-primary-foreground transition-transform duration-160 ease-[cubic-bezier(0.19,1,0.22,1)] [--swap-state:0] pointer-fine:hover:[--swap-state:1] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring focus-visible:[--swap-state:1] data-touch-active:[--swap-state:1] motion-safe:active:not-focus-visible:scale-[0.97]',
        className,
      )}
      onClick={(event) => {
        if (!matchMedia('(hover: hover) and (pointer: fine)').matches) setTouchActive((active) => !active);
        onClick?.(event);
      }}
      onBlur={(event) => {
        setTouchActive(false);
        onBlur?.(event);
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="inline-grid *:col-start-1 *:row-start-1 *:text-center *:transition-[opacity,transform,filter] *:duration-220 *:ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/swap:*:duration-0 motion-reduce:*:transform-none motion-reduce:*:filter-none motion-reduce:*:transition-opacity motion-reduce:*:duration-150 motion-reduce:*:ease-linear"
      >
        <span className="opacity-[calc(1-var(--swap-state))] blur-[calc(var(--swap-state)*5px)] transform-[translateY(calc(var(--swap-state)*120%))]">
          {label}
        </span>
        <span className="opacity-(--swap-state) blur-[calc((1-var(--swap-state))*5px)] transform-[translateY(calc((var(--swap-state)-1)*120%))]">
          {nextLabel}
        </span>
      </span>
    </button>
  );
}
