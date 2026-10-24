// What the pointer does in each study's og:video, one entry per slug.
// Every step runs in real time; the recorder captures it at 60fps on a virtual clock.
// A choreography starts and ends with the pointer at `rest` and the demo in its initial state, so the clip loops cleanly.
import type { SpecimenId } from '../src/data/specimens';

// A selector (center of its first match), a selector with the nth match and a point inside its box
// as fractions, or a point in the recorded frame as fractions.
export type Target =
  | string
  | { selector: string; nth?: number; x?: number; y?: number }
  | { frame: [number, number] };

export interface Director {
  wait(ms: number): Promise<void>;
  // Without a duration, the move takes as long as a quick hand would for that distance.
  move(to: Target, ms?: number): Promise<void>;
  down(): Promise<void>;
  up(): Promise<void>;
  // Moves there first when given a target.
  click(to?: Target): Promise<void>;
  // Presses where the pointer is, moves, and releases.
  drag(to: Target, ms?: number): Promise<void>;
}

export interface Choreography {
  // Width of the recorded frame in CSS pixels; the height keeps the 1200×630 aspect.
  width?: number;
  rest: Target;
  play(director: Director): Promise<void>;
}

const dot = (nth: number) => ({ selector: '[data-dot]', nth });
const tab = (nth: number) => ({ selector: '[data-tab]', nth, x: 0.4 });
const link = (nth: number) => ({ selector: '[data-pluck]', nth, x: 0.5, y: 0.55 });
const option = (nth: number) => ({ selector: '.goo-option', nth, x: 0.3 });
const box = (nth: number) => ({ selector: '[data-box-cell]', nth });
const volume = (x: number) => ({ selector: '.volume-range', x });

export const choreographies: Partial<Record<SpecimenId, Choreography>> = {
  'text-swap': {
    rest: { frame: [0.7, 0.84] },
    async play(d) {
      await d.wait(350);
      await d.move({ selector: '.swap', x: 0.62, y: 0.6 });
      await d.wait(1100);
      await d.move({ frame: [0.7, 0.84] });
      await d.wait(700);
    },
  },
  'chevron-morph': {
    rest: { frame: [0.72, 0.84] },
    async play(d) {
      await d.wait(350);
      await d.move({ selector: '.morph-button', nth: 0, x: 0.55, y: 0.6 });
      await d.wait(800);
      await d.move({ selector: '.morph-button', nth: 1, x: 0.55, y: 0.6 });
      await d.wait(800);
      await d.move({ frame: [0.72, 0.84] });
      await d.wait(500);
    },
  },
  'hold-confirm': {
    rest: { frame: [0.72, 0.84] },
    async play(d) {
      await d.wait(350);
      // A short press retracts, then a full hold confirms and the button resets on its own.
      await d.move({ selector: '.hold-button', x: 0.58, y: 0.6 });
      await d.down();
      await d.wait(500);
      await d.up();
      await d.wait(550);
      await d.down();
      await d.wait(1300);
      await d.up();
      await d.wait(250);
      await d.move({ frame: [0.72, 0.84] });
      await d.wait(900);
    },
  },
  'plucked-underline': {
    rest: { frame: [0.62, 0.84] },
    async play(d) {
      await d.wait(350);
      // Resting on a few links lets each string ring; the longest rings longest.
      await d.move(link(1));
      await d.wait(550);
      await d.move(link(3), 420);
      await d.wait(550);
      await d.move(link(5), 480);
      await d.wait(900);
      await d.move({ frame: [0.62, 0.84] });
      await d.wait(700);
    },
  },
  'gooey-radio-group': {
    rest: { frame: [0.74, 0.84] },
    async play(d) {
      await d.wait(350);
      await d.click(option(1));
      await d.wait(550);
      await d.click(option(3));
      await d.wait(600);
      await d.click(option(0));
      await d.wait(600);
      await d.move({ frame: [0.74, 0.84] });
      await d.wait(300);
    },
  },
  'edge-aware-tooltip': {
    rest: { frame: [0.7, 0.86] },
    async play(d) {
      await d.wait(350);
      // The thumb sits at 50, so pressing its center leaves the value alone.
      await d.move(volume(0.5));
      await d.wait(150);
      await d.down();
      await d.wait(80);
      await d.move(volume(1), 750);
      await d.wait(450);
      await d.move(volume(0), 1100);
      await d.wait(450);
      await d.move(volume(0.5), 650);
      await d.wait(80);
      await d.up();
      await d.wait(300);
      await d.move({ frame: [0.7, 0.86] });
      await d.wait(300);
    },
  },
  'drag-select': {
    // The table is taller than the other demos; a wider frame gives it room below the hint.
    width: 840,
    rest: { frame: [0.84, 0.84] },
    async play(d) {
      await d.wait(350);
      await d.move(box(0));
      await d.drag(box(3), 650);
      await d.wait(550);
      // Starting on a checked box clears the run on the way back up.
      await d.drag(box(0), 650);
      await d.wait(450);
      await d.move({ frame: [0.84, 0.84] });
      await d.wait(300);
    },
  },
  'resize-handle': {
    rest: { frame: [0.8, 0.84] },
    async play(d) {
      await d.wait(350);
      // The divider at rest, as a point: the handle itself moves with the drag, and the drag has to end where it began.
      const handle: Target = { frame: [0.307, 0.53] };
      await d.move(handle);
      await d.wait(250);
      // Wider, past half the minimum to collapse, then back to where the drag began, which reopens it at its first width.
      await d.down();
      await d.wait(80);
      await d.move({ frame: [0.62, 0.5] }, 600);
      await d.wait(250);
      await d.move({ frame: [0.12, 0.5] }, 800);
      await d.wait(400);
      await d.move(handle, 700);
      await d.wait(80);
      await d.up();
      await d.wait(300);
      await d.move({ frame: [0.8, 0.84] });
      await d.wait(300);
    },
  },
  'worm-dots': {
    rest: { frame: [0.74, 0.86] },
    async play(d) {
      await d.wait(350);
      await d.click(dot(2));
      await d.wait(450);
      await d.drag(dot(5), 650);
      await d.wait(500);
      await d.click(dot(0));
      await d.wait(550);
      await d.move({ frame: [0.74, 0.86] });
      await d.wait(300);
    },
  },
  'tab-indicator': {
    rest: { frame: [0.72, 0.84] },
    async play(d) {
      await d.wait(350);
      await d.click(tab(2));
      await d.wait(500);
      await d.click(tab(3));
      await d.wait(500);
      await d.click(tab(1));
      await d.wait(450);
      await d.click(tab(0));
      await d.wait(450);
      await d.move({ frame: [0.72, 0.84] });
      await d.wait(300);
    },
  },
};
