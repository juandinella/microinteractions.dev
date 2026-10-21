import { ease } from './ease';

interface TimedTrace {
  // The specimen's longest duration; progress is reported as a share of it.
  duration: number;
  // Attribute the component sets while it plays, in place of :hover.
  attribute: string;
}

// `render` gets the elapsed share of the specimen's duration and, when it differs, the share of the current control's own duration.
export function traceHover(
  stage: HTMLElement,
  render: (progress: number, curveX?: number) => void,
  curve: number[],
  timed?: TimedTrace,
) {
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const controls = [...stage.querySelectorAll<HTMLElement>('button, a')];
  const hovered = new Set<HTMLElement>();
  const inverseCurve = [curve[1], curve[0], curve[3], curve[2]];
  const active = `:focus-visible, [data-touch-active]${timed ? `, [${timed.attribute}]` : ''}`;
  let current = controls[0];
  let frame = 0;

  // Read the running transition's clock instead of its output, for easings that can't be inverted.
  function timedProgress(target: Element, duration: number) {
    if (!current.matches(active)) return [0];
    const animation = target
      .getAnimations()
      .find((animation) => animation.playState === 'running' || animation.pending);
    if (!animation) {
      // Settled: hold at this element's own duration.
      const own = parseFloat(getComputedStyle(target).transitionDuration) * 1000;
      return own > 0 ? [own / duration, 1] : [1];
    }
    const { delay = 0, duration: own } = animation.effect!.getTiming();
    const elapsed = Math.max(Number(animation.currentTime ?? 0) - delay, 0);
    return [elapsed / duration, elapsed / Number(own)];
  }

  function sync() {
    current = [...hovered].at(-1)
      ?? controls.find((control) => control.matches(active))
      ?? current;
    cancelAnimationFrame(frame);
    if (reduceMotion.matches) {
      render(hovered.has(current) || current.matches(active) ? 1 : 0);
      return;
    }
    const target = current.querySelector('[data-trace-progress]');
    if (!target) return;

    const tick = () => {
      if (timed) {
        const [progress, curveX] = timedProgress(target, timed.duration);
        render(Math.min(progress, 1), curveX === undefined ? undefined : Math.min(curveX, 1));
      } else {
        // Invert the easing so the time axis and glyph follow the actual CSS state, including reversals.
        const progress = Number(getComputedStyle(target).opacity);
        render(progress <= 0 ? 0 : progress >= 1 ? 1 : ease(inverseCurve, progress));
      }
      if (target.getAnimations().some((animation) => animation.playState === 'running' || animation.pending)) {
        frame = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  controls.forEach((control) => {
    control.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse' || !hover.matches) return;
      hovered.add(control);
      sync();
    });
    control.addEventListener('pointerleave', () => {
      hovered.delete(control);
      sync();
    });
    control.addEventListener('focus', sync);
    control.addEventListener('blur', sync);
    new MutationObserver(sync).observe(control, {
      attributes: true,
      attributeFilter: ['data-touch-active', ...(timed ? [timed.attribute] : [])],
    });
  });

  reduceMotion.addEventListener('change', sync);
  return sync;
}
