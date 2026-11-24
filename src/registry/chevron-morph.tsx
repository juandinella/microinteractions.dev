'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type ChevronMorphButtonProps = Omit<React.ComponentProps<'button'>, 'ref' | 'children'> & {
  direction: 'previous' | 'next';
};

const paths = {
  previous: { chevron: 'M14 7L9 12L14 17', line: 'M16 12H8' },
  next: { chevron: 'M10 7L15 12L10 17', line: 'M8 12H16' },
};

export function ChevronMorphButton({
  direction,
  className,
  'aria-label': ariaLabel = direction === 'previous' ? 'Previous item' : 'Next item',
  ...props
}: ChevronMorphButtonProps) {
  const previous = direction === 'previous';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'group/morph inline-grid [--morph-ease:cubic-bezier(0.19,1,0.22,1)] size-11 shrink-0 cursor-pointer touch-manipulation place-items-center [-webkit-tap-highlight-color:transparent] rounded-full border border-transparent bg-secondary p-0 text-secondary-foreground transition-[background-color,transform] duration-[190ms,160ms] ease-(--morph-ease) focus-visible:border-secondary-foreground focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ring focus-visible:duration-0 pointer-fine:hover:bg-secondary/80 motion-safe:active:transform-[scale(0.96)] motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-5.5 overflow-visible rtl:-scale-x-100 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
      >
        <path
          d={paths[direction].chevron}
          className={cn(
            'transition-transform duration-190 ease-(--morph-ease) group-focus-visible/morph:duration-0 motion-reduce:transition-none',
            previous
              ? 'group-focus-visible/morph:transform-[translateX(-2px)] pointer-fine:group-hover/morph:transform-[translateX(-2px)]'
              : 'group-focus-visible/morph:transform-[translateX(2px)] pointer-fine:group-hover/morph:transform-[translateX(2px)]',
          )}
        />
        <path
          d={paths[direction].line}
          className={cn(
            'transform-[scaleX(0.5)] opacity-0 transition-[opacity,transform] transform-fill duration-190 ease-(--morph-ease) group-focus-visible/morph:transform-[scaleX(1)] group-focus-visible/morph:opacity-100 group-focus-visible/morph:duration-0 pointer-fine:group-hover/morph:transform-[scaleX(1)] pointer-fine:group-hover/morph:opacity-100 motion-reduce:transition-none',
            previous ? 'origin-right' : 'origin-left',
          )}
        />
      </svg>
    </button>
  );
}
