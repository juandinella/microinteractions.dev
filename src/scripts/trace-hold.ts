export function traceHold(button: HTMLElement, trace: (to: number, ms: number) => void, duration: number, release: number, confirmationDuration = 0) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const holdEnd = duration / (duration + confirmationDuration);
  let previous = 'idle';
  let input: string | undefined;

  function sync() {
    const state = button.dataset.state ?? 'idle';
    if (state === previous) return;
    previous = state;
    if (state !== 'idle') input = button.dataset.input;

    if (state === 'holding') {
      trace(0, 0);
      if (!reduceMotion.matches) trace(holdEnd, duration);
    } else if (state === 'confirmed') {
      trace(holdEnd, 0);
      trace(1, button.dataset.input === 'pointer' ? confirmationDuration : 0);
    } else {
      trace(0, input === 'pointer' ? release : 0);
    }
  }

  new MutationObserver(sync).observe(button, {
    attributes: true,
    attributeFilter: ['data-state'],
  });
}
