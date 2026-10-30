import { Popover } from '@base-ui/react/popover';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import InstallCommand from './InstallCommand';
import styles from './InstallPopover.module.css';

// One beam of three equal chunks, one per color, laid end to end along the outline (pathLength 100 keeps it in percent).
const CHUNK = 5;

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
  const [node, setNode] = useState<HTMLButtonElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // Where the beam starts. Each hover remounts the strokes, which restarts the run from there.
  const [entry, setEntry] = useState<{ at: number; run: number }>({ at: 0, run: 0 });
  const ref = useCallback((element: HTMLButtonElement | null) => setNode(element), []);

  useEffect(() => {
    if (!node) return;
    const measure = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      setSize({ width, height });
      // Keyboard focus has no pointer, so the beam starts at the top center.
      setEntry((current) => (current.run === 0 ? { at: outlinePercent(width / 2, 0, width, height), run: 0 } : current));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  const beam = (inset: number) => {
    if (!size) return null;
    const width = size.width - 2 * inset;
    const height = size.height - 2 * inset;
    return (
      <svg width={size.width} height={size.height} key={entry.run} aria-hidden="true">
        {[0, 1, 2].map((chunk) => {
          const start = -(entry.at + chunk * CHUNK);
          return (
            <rect
              key={chunk}
              x={inset}
              y={inset}
              width={width}
              height={height}
              rx={height / 2}
              pathLength={100}
              strokeDasharray={`${CHUNK} ${100 - CHUNK}`}
              style={{ strokeDashoffset: start, '--o': start, '--o2': start - 100 } as CSSProperties}
            />
          );
        })}
      </svg>
    );
  };

  return (
    <Popover.Root>
      <Popover.Trigger
        ref={ref}
        className={styles.trigger}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'mouse' || !size) return;
          const box = event.currentTarget.getBoundingClientRect();
          const x = Math.min(Math.max(event.clientX - box.left, 0), box.width);
          const y = Math.min(Math.max(event.clientY - box.top, 0), box.height);
          setEntry((current) => ({ at: outlinePercent(x, y, size.width, size.height), run: current.run + 1 }));
        }}
      >
        {/* The halo paints behind the face and the beam on it, so the border it replaces stays gray everywhere else. */}
        <span className={styles.halo} aria-hidden="true">{beam(0)}</span>
        <span className={styles.ring} aria-hidden="true">{beam(0.5)}</span>
        <span className={styles.face} aria-hidden="true" />
        <svg className={styles.icon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className={styles.label}>Add with shadcn</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={styles.positioner} side="bottom" align="end" sideOffset={8} collisionPadding={16}>
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
