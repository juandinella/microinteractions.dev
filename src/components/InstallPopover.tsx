import { Popover } from '@base-ui/react/popover';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import InstallCommand from './InstallCommand';
import styles from './InstallPopover.module.css';

// One 1px glint spanning 18% of the pill outline (pathLength 100 keeps it in percent).
const GLINT = 18;

// The nearest point on the pill's outline to a point inside it, as a percent of the SVG rect path:
// top edge left to right, right cap, bottom edge right to left, left cap.
function outlinePercent(x: number, y: number, width: number, height: number) {
  const r = height / 2;
  const straight = width - 2 * r;
  const total = 2 * straight + 2 * Math.PI * r;
  let at: number;
  if (x >= r && x <= width - r) {
    at = y < r ? x - r : straight + Math.PI * r + (width - r - x);
  } else if (x < r) {
    const alpha = Math.atan2(-(x - r), y - r);
    at = 2 * straight + Math.PI * r + Math.min(Math.max(alpha, 0), Math.PI) * r;
  } else {
    const beta = Math.atan2(x - (width - r), -(y - r));
    at = straight + Math.min(Math.max(beta, 0), Math.PI) * r;
  }
  return ((at % total) / total) * 100;
}

// The install command waits behind a small trigger, so the live preview stays the first thing on the page.
export default function InstallPopover({ url }: { url: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const lastTouch = useRef(0);
  const [node, setNode] = useState<HTMLButtonElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  // One-shot border glint: runs once from the entry point and clears when finished.
  const [glint, setGlint] = useState<{ at: number; run: number } | null>(null);
  const ref = useCallback((element: HTMLButtonElement | null) => setNode(element), []);

  useEffect(() => {
    if (!node) return;
    const measure = () => setSize({ width: node.offsetWidth, height: node.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  const startGlint = (x: number, y: number) => {
    if (!size || open || glint) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setGlint((current) => ({ at: outlinePercent(x, y, size.width, size.height), run: (current?.run ?? 0) + 1 }));
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setGlint(null);
      }}
    >
      {/* The popup follows this box, not the trigger: the trigger scales while pressed and would drag the popup along. */}
      <span ref={anchor} className={styles.anchor}>
        <Popover.Trigger
          ref={ref}
          className={styles.trigger}
          onPointerUp={(event) => {
            if (event.pointerType === 'touch') lastTouch.current = performance.now();
          }}
          onPointerEnter={(event) => {
            // iOS emits an emulated mouse pointerenter right after a tap; ignore it.
            if (event.pointerType !== 'mouse' || performance.now() - lastTouch.current < 50) return;
            if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
            const box = event.currentTarget.getBoundingClientRect();
            const x = Math.min(Math.max(event.clientX - box.left, 0), box.width);
            const y = Math.min(Math.max(event.clientY - box.top, 0), box.height);
            startGlint(x, y);
          }}
          onFocus={(event) => {
            if (size && event.currentTarget.matches(':focus-visible')) startGlint(size.width / 2, 0);
          }}
        >
          <span className={styles.face} aria-hidden="true" />
          {size && glint && (
            <span className={styles.ring} aria-hidden="true">
              <svg width={size.width} height={size.height} key={glint.run}>
                <rect
                  x={0.5}
                  y={0.5}
                  width={size.width - 1}
                  height={size.height - 1}
                  rx={(size.height - 1) / 2}
                  pathLength={100}
                  strokeDasharray={`${GLINT} ${100 - GLINT}`}
                  style={{ strokeDashoffset: -glint.at, '--o': -glint.at, '--o2': -(glint.at + 100) } as CSSProperties}
                  onAnimationEnd={() => setGlint(null)}
                />
              </svg>
            </span>
          )}
          <svg className={styles.icon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className={styles.label}>Add with shadcn</span>
        </Popover.Trigger>
      </span>
      <Popover.Portal>
        <Popover.Positioner className={styles.positioner} anchor={anchor} side="bottom" align="end" sideOffset={8} collisionPadding={16}>
          <Popover.Popup className={styles.popup}>
            <Popover.Title className={styles.title}>Add with shadcn</Popover.Title>
            <Popover.Description className={styles.description}>
              Installs the React component into your project, themed with your shadcn tokens.
            </Popover.Description>
            <div className={styles.body}>
              <InstallCommand url={url} />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
