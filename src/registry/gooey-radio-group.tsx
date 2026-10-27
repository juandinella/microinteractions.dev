'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'gooey-radio-group': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type Option = {
  value: string;
  label: React.ReactNode;
};

type GooeyRadioGroupProps = {
  legend: React.ReactNode;
  options: Option[];
  defaultValue?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

// The element pours the dot between rings; each option is 44px tall, the distance it pours per step.
export function GooeyRadioGroup({
  legend,
  options,
  defaultValue,
  name,
  onValueChange,
  className,
}: GooeyRadioGroupProps) {
  const id = React.useId();
  const root = React.useRef<HTMLElement>(null);
  const [index, setIndex] = React.useState(() => options.findIndex((option) => option.value === defaultValue));

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./gooey-radio-group-element');
    // A form reset restores the default radio without a change event, once the reset event is over.
    const form = root.current!.closest('form');
    const reset = () =>
      setTimeout(() =>
        setIndex([...root.current!.querySelectorAll('input')].findIndex((input) => input.checked)),
      );
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, []);

  return (
    <fieldset className={cn('m-0 min-w-0 border-0 p-0 text-foreground', className)}>
      <legend className="mb-1.5 p-0 text-xs text-muted-foreground">{legend}</legend>
      <gooey-radio-group
        ref={root}
        className="group/goo relative isolate grid"
        style={{ '--goo-index': Math.max(index, 0) } as React.CSSProperties}
      >
        <svg className="absolute size-0" aria-hidden="true" focusable="false">
          <filter>
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </svg>
        <span className="pointer-events-none absolute top-0 left-0 z-1 h-full w-11 not-group-has-checked/goo:opacity-0 *:absolute *:top-4.25 *:left-4.25 *:size-2.5 *:transform-[translateY(calc(var(--goo-index)*44px))] *:rounded-full *:bg-foreground" aria-hidden="true">
          {Array.from({ length: 8 }, (_, blob) => (
            <span key={blob} data-goo-blob />
          ))}
        </span>
        {options.map((option, optionIndex) => (
          <label key={option.value} className="group/option relative flex h-11 cursor-pointer items-center rounded-[10px] pr-4 pl-11 text-sm text-muted-foreground transition-[color] delay-150 duration-140 ease-[ease] [-webkit-tap-highlight-color:transparent] has-checked:text-foreground has-checked:delay-315 in-data-keyboard:transition-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring in-data-keyboard:has-focus:outline-2 in-data-keyboard:has-focus:outline-offset-2 in-data-keyboard:has-focus:outline-ring motion-reduce:transition-none">
            <input
              className="absolute inset-0 m-0 cursor-[inherit] appearance-none rounded-[inherit] opacity-0"
              type="radio"
              name={name ?? id}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              onChange={() => {
                setIndex(optionIndex);
                onValueChange?.(option.value);
              }}
            />
            <span className="absolute top-3 left-3 size-5 rounded-full border-2 border-muted-foreground/50 transition-[border-color] delay-150 duration-140 ease-[ease] group-has-checked/option:border-foreground group-has-checked/option:delay-315 in-data-keyboard:transition-none motion-reduce:transition-none after:absolute after:-inset-0.5 after:rounded-[inherit] after:border-2 after:border-muted-foreground after:opacity-0 after:transition-opacity after:duration-150 after:ease-out pointer-fine:group-hover/option:not-group-has-checked/option:after:opacity-100 group-has-checked/option:after:delay-315 in-data-keyboard:after:transition-none motion-reduce:after:transition-none" aria-hidden="true" />
            {option.label}
          </label>
        ))}
      </gooey-radio-group>
    </fieldset>
  );
}
