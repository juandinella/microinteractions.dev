'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'aligned-select': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { name?: string };
    }
  }
}

// A select needs an accessible name: one of aria-label or aria-labelledby is required.
type AlignedSelectName =
  | { 'aria-label': string; 'aria-labelledby'?: string }
  | { 'aria-label'?: string; 'aria-labelledby': string };

type AlignedSelectProps = Omit<
  React.ComponentProps<'button'>,
  'children' | 'defaultValue' | 'value' | 'onChange' | 'type' | 'role' | 'aria-label' | 'aria-labelledby'
> & AlignedSelectName & {
  // The choices. Each string is both the value and the label.
  options: string[];
  // The selected option, controlled: a pick calls onValueChange, and the select shows the pick only once
  // value says so. Set it in the same update, as with a controlled input, or the select goes back to value.
  // A change from here shows at once. A value that isn't an option shows the first one.
  value?: string;
  // The option selected at first when value isn't set. Without one, the first option.
  defaultValue?: string;
  // Called when a pick or a form reset changes the value, never when a pick keeps the same one or value
  // changes it.
  onValueChange?: (value: string) => void;
  // Submits the value with a surrounding form under this name, as a native select does. A form reset
  // restores the value it started with; disabled (or a disabled fieldset) leaves it out.
  name?: string;
};

type SelectElement = HTMLElement & { value: string };

// The element writes the selection itself (aria-selected, the trigger's text, a bubbling change event),
// so the value React renders follows that event instead of racing it. The element reads its options
// once, so a different list remounts it and keeps the value if it is still there.
// The name comes from aria-label or aria-labelledby, which land on the trigger and the list; className
// and the other props go to the trigger.
export function AlignedSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: AlignedSelectProps) {
  const id = React.useId();
  const element = React.useRef<SelectElement>(null);
  const [current, setCurrent] = React.useState(defaultValue ?? options[0]);
  const [, rerender] = React.useReducer((count: number) => count + 1, 0);
  const key = JSON.stringify(options);
  const onValueChangeRef = React.useRef(onValueChange);
  const controlled = React.useRef(false);
  const shown = React.useRef('');

  React.useEffect(() => {
    onValueChangeRef.current = onValueChange;
  });

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./aligned-select-element');
  }, []);

  React.useEffect(() => {
    const target = element.current;
    if (!target) return;
    const onChange = () => {
      const picked = target.value;
      if (picked === shown.current) return;
      // Controlled, the render below puts value back unless onValueChange changed it.
      if (controlled.current) rerender();
      else setCurrent(picked);
      onValueChangeRef.current?.(picked);
    };
    target.addEventListener('change', onChange);
    // A form reset restores the element without a change event, in a task of its own after the reset; this reads
    // it in the task after that.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => (timer = setTimeout(onChange)));
    };
    const form = target.closest('form');
    form?.addEventListener('reset', reset);
    return () => {
      target.removeEventListener('change', onChange);
      form?.removeEventListener('reset', reset);
      clearTimeout(timer);
    };
  }, [key]);

  const wanted = value ?? current;
  const selected = options.includes(wanted) ? wanted : options[0];

  React.useLayoutEffect(() => {
    controlled.current = value !== undefined;
    shown.current = selected;
    const target = element.current;
    // React has already rendered aria-selected, so the getter can't tell; setting the same value is silent.
    // Before the element upgrades, the markup already shows selected; a value set then would hide its setter.
    if (target && customElements.get('aligned-select')) target.value = selected;
  });

  if (options.length === 0) return null;

  return (
    <aligned-select key={key} ref={element} className="contents" name={name}>
      <button
        className={cn(
          'relative inline-flex h-8 max-w-full min-w-0 flex-none cursor-default items-center gap-2 rounded-lg border border-border bg-background ps-2.5 pe-1.5 font-sans text-[13px]/none text-foreground [-webkit-tap-highlight-color:transparent] select-none touch-manipulation pointer-coarse:after:absolute pointer-coarse:after:-inset-y-1.75 pointer-coarse:after:inset-x-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:bg-accent aria-expanded:focus-visible:outline-none pointer-fine:hover:border-muted-foreground/50',
          className,
        )}
        {...props}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls={`${id}-list`}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        data-trigger
      >
        <span className="min-w-0 truncate" data-display>
          {selected}
        </span>
        <svg className="size-3.5 flex-none fill-none stroke-muted-foreground stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />
        </svg>
      </button>
      {/* A popover, so the menu sits in the top layer: no ancestor's overflow or stacking can cut it. The script sets
          its position and size. It is flex only while open: an author display would override the closed popover's. */}
      <div
        className="group/menu fixed inset-auto m-0 box-border max-w-[calc(100vw-16px)] overflow-hidden rounded-[10px] border border-border bg-popover p-0 font-sans text-[13px]/none text-popover-foreground shadow-md select-none [-webkit-tap-highlight-color:transparent] [--als-arrow:18px] [--als-row:32px] open:flex open:flex-col pointer-coarse:[--als-row:40px]"
        popover="manual"
        data-menu
      >
        <div
          className="relative min-h-0 flex-auto overflow-y-auto overscroll-contain p-1 scrollbar-none"
          id={`${id}-list`}
          role="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          data-list
        >
          {options.map((option, index) => (
            <div
              key={option}
              className="group/opt grid h-(--als-row) cursor-default grid-cols-[14px_minmax(0,1fr)] items-center gap-1.5 rounded-md ps-2 pe-3 whitespace-nowrap data-highlighted:bg-accent data-highlighted:text-accent-foreground group-data-keyed/menu:data-highlighted:outline-2 group-data-keyed/menu:data-highlighted:-outline-offset-2 group-data-keyed/menu:data-highlighted:outline-ring forced-colors:data-highlighted:-outline-offset-2 forced-colors:data-highlighted:outline-2 forced-colors:data-highlighted:outline-[Highlight]"
              role="option"
              id={`${id}-${index}`}
              aria-selected={option === selected ? 'true' : 'false'}
              data-value={option}
            >
              <svg className="invisible size-3.5 flex-none fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round] group-aria-selected/opt:visible" viewBox="0 0 16 16" aria-hidden="true">
                <path d="m3.5 8.5 3 3 6-7" />
              </svg>
              <span className="truncate" data-label>
                {option}
              </span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 grid h-(--als-arrow) place-items-center bg-popover text-muted-foreground touch-none opacity-0 group-data-up/menu:pointer-events-auto group-data-up/menu:opacity-100" aria-hidden="true" data-arrow="up">
          <svg className="size-3 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 16 16">
            <path d="m5 10 3-3 3 3" />
          </svg>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 grid h-(--als-arrow) place-items-center bg-popover text-muted-foreground touch-none opacity-0 group-data-down/menu:pointer-events-auto group-data-down/menu:opacity-100" aria-hidden="true" data-arrow="down">
          <svg className="size-3 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 16 16">
            <path d="m5 6 3 3 3-3" />
          </svg>
        </div>
      </div>
    </aligned-select>
  );
}
