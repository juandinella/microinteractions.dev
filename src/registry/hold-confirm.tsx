'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'hold-to-confirm': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

type HoldConfirmButtonProps = {
  label?: string;
  holdingLabel?: string;
  confirmedLabel?: string;
  // Assistive technologies that click without a sustained press get this dialog instead of the hold.
  dialog?: {
    label?: string;
    question?: React.ReactNode;
    cancel?: string;
    confirm?: string;
  };
  disabled?: boolean;
  onConfirm?: () => void;
  className?: string;
};

export function HoldConfirmButton({
  label = 'Hold to confirm',
  holdingLabel = 'Keep holding…',
  confirmedLabel = 'Confirmed',
  dialog = {},
  disabled = false,
  onConfirm,
  className,
}: HoldConfirmButtonProps) {
  const root = React.useRef<HTMLElement>(null);
  const confirm = React.useRef(onConfirm);
  confirm.current = onConfirm;

  React.useEffect(() => {
    // The element only exists in the browser, so it upgrades the markup after hydration.
    void import('./hold-confirm-element');
    const element = root.current!;
    const handle = () => confirm.current?.();
    element.addEventListener('holdconfirm', handle);
    return () => element.removeEventListener('holdconfirm', handle);
  }, []);

  const labels = (
    <span
      aria-hidden="true"
      className="inline-grid opacity-[calc(1-var(--hold-confirmed))] transition-opacity duration-(--hold-state) ease-(--hold-ease) *:col-start-1 *:row-start-1"
    >
      <span className="group-data-[state=confirmed]/hold:invisible group-data-[state=holding]/hold:invisible">
        {label}
      </span>
      <span className="invisible group-data-[state=confirmed]/hold:visible group-data-[state=holding]/hold:visible">
        {holdingLabel}
      </span>
    </span>
  );

  return (
    <hold-to-confirm
      ref={root}
      className={cn('relative inline-flex [--hold-ease:cubic-bezier(0.23,1,0.32,1)]', className)}
    >
      <button
        type="button"
        aria-label={label}
        data-state="idle"
        disabled={disabled}
        className="group/hold relative isolate inline-grid min-h-12 min-w-52 cursor-pointer touch-none place-items-center overflow-hidden rounded-full px-5.5 py-2.5 text-base/[1.2] font-medium tracking-[-0.01em] whitespace-nowrap text-secondary-foreground select-none [--hold-confirmed:0] [--hold-release:0ms] [--hold-state:0ms] [-webkit-touch-callout:none] before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:bg-secondary before:transition-[background-color,transform] before:duration-[150ms,140ms] before:ease-[ease,var(--hold-ease)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring data-[state=confirmed]:[--hold-confirmed:1] pointer-fine:enabled:hover:before:bg-secondary/80 forced-colors:text-[ButtonText] forced-colors:outline-1 forced-colors:outline-offset-0 forced-colors:outline-[ButtonText] forced-colors:before:bg-[ButtonFace] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-4 forced-colors:focus-visible:outline-[Highlight] not-forced-colors:data-pointer-focus:outline-none motion-safe:data-pressed:before:transform-[scale(0.98)] motion-safe:data-[input=pointer]:[--hold-release:180ms] motion-safe:data-[input=pointer]:[--hold-state:160ms] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {labels}
        <span
          data-hold-progress
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] text-primary-foreground transition-[clip-path] duration-(--hold-release) ease-(--hold-ease) [clip-path:inset(0_100%_0_0)] before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:bg-primary before:transition-transform before:duration-140 before:ease-(--hold-ease) group-data-[state=confirmed]/hold:[clip-path:inset(0)] group-data-[state=holding]/hold:duration-(--hold-duration) group-data-[state=holding]/hold:ease-linear group-data-[state=holding]/hold:[clip-path:inset(0)] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none forced-colors:before:bg-[Highlight] forced-colors:before:forced-color-adjust-none motion-safe:group-data-pressed/hold:before:transform-[scale(0.98)]"
        >
          {labels}
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex transform-[translateY(calc((1-var(--hold-confirmed))*-3px))] items-center justify-center gap-2 rounded-[inherit] text-primary-foreground opacity-(--hold-confirmed) transition-[opacity,transform] duration-(--hold-state) ease-(--hold-ease) forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none"
        >
          <svg
            viewBox="0 0 20 20"
            className="size-4.5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]"
          >
            <path d="m4.5 10 3.5 3.5 7.5-7.5" />
          </svg>
          {confirmedLabel}
        </span>
      </button>
      <span className="sr-only" data-hold-instructions />
      <span className="sr-only" role="status" />
      <dialog
        aria-label={dialog.label ?? 'Confirm this action'}
        className="m-auto w-[min(320px,calc(100vw-32px))] rounded-2xl border border-border bg-popover p-5 text-popover-foreground backdrop:bg-black/24"
      >
        <form method="dialog">
          <p className="mb-5 text-sm/normal">{dialog.question ?? 'Confirm this action?'}</p>
          <div className="flex justify-end gap-2 *:min-h-11 *:cursor-pointer *:rounded-full *:border *:border-transparent *:px-4.5 *:text-sm *:font-medium *:focus-visible:outline-2 *:focus-visible:outline-offset-2 *:focus-visible:outline-ring">
            <button value="cancel" className="pointer-fine:hover:bg-accent">
              {dialog.cancel ?? 'Cancel'}
            </button>
            <button value="confirm" className="bg-primary text-primary-foreground">
              {dialog.confirm ?? 'Confirm'}
            </button>
          </div>
        </form>
      </dialog>
    </hold-to-confirm>
  );
}
