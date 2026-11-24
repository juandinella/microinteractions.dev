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
  'aria-label': ariaLabel = `${label}, ${nextLabel}`,
  ...props
}: TextSwapButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'group/swap inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center overflow-hidden rounded-xl border border-transparent bg-primary px-5 py-2.5 text-base/[1.2] font-medium text-primary-foreground transition-transform duration-160 ease-[cubic-bezier(0.19,1,0.22,1)] [--swap-state:0] pointer-fine:hover:[--swap-state:1] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring focus-visible:[--swap-state:1] motion-safe:active:scale-[0.97]',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="inline-grid *:col-start-1 *:row-start-1 *:text-center *:text-balance *:transition-[opacity,transform,filter] *:duration-[calc(160ms+var(--swap-state)*60ms)] *:ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/swap:*:duration-0 motion-reduce:*:transform-none motion-reduce:*:filter-none motion-reduce:*:transition-opacity motion-reduce:*:duration-150"
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
