// Follows the transition a selection starts on `[data-trace-progress]`, by its clock, from 0 to 1.
export function traceSelect(
  stage: HTMLElement,
  render: (progress: number) => void,
) {
  const target = stage.querySelector('[data-trace-progress]');
  if (!target) return;
  let frame = 0;

  stage.addEventListener('change', () => {
    cancelAnimationFrame(frame);
    render(0);
    // The transition starts with the next style recalculation, so read it a frame later.
    const tick = () => {
      const animation = target
        .getAnimations()
        .find((animation) => animation.playState === 'running' || animation.pending);
      if (!animation) {
        render(1);
        return;
      }
      const { delay = 0, duration } = animation.effect!.getTiming();
      const elapsed = Math.max(Number(animation.currentTime ?? 0) - delay, 0);
      render(Math.min(elapsed / Number(duration), 1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });
}
