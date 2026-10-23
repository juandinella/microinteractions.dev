// `stops` are the evenly spaced points of a CSS linear() easing, for curves a cubic-bezier can't draw.
export type Easing =
  | [number, number, number, number]
  | 'linear'
  | { stops: number[] };
export type SpecimenId =
  | 'text-swap'
  | 'chevron-morph'
  | 'hold-confirm'
  | 'edge-aware-tooltip'
  | 'plucked-underline'
  | 'gooey-radio-group'
  | 'drag-select'
  | 'resize-handle'
  | 'tab-indicator'
  | 'worm-dots';

export const categories = [
  'Actions',
  'Navigation',
  'Toggles & choices',
  'Values',
  'Input',
  'Disclosure',
  'Feedback',
  'Direct manipulation',
] as const;

export type Category = (typeof categories)[number];

export const categorySlug = (category: Category) =>
  category.toLowerCase().replace(/[^a-z]+/g, '-');

// Studies not built yet. The nav lists them as unavailable under their category.
export const planned: Record<Category, string[]> = {
  Actions: ['Copy to clipboard', 'Like', 'Submit states'],
  Navigation: ['Hover highlight', 'Scroll progress'],
  'Toggles & choices': [
    'Switch',
    'Checkbox',
    'Segmented control',
    'Rating',
  ],
  Values: ['Range', 'Stepper', 'Number scrub', 'Dial'],
  Input: [
    'Inline validation',
    'Password strength',
    'One-time code',
    'Tag input',
    'Search',
  ],
  Disclosure: [
    'Tooltip',
    'Popover',
    'Dropdown',
    'Accordion',
    'Hover card',
    'Dialog',
    'Sheet',
  ],
  Feedback: [
    'Loader',
    'Progress',
    'Skeleton',
    'Saving to saved',
    'Upload',
    'Sync',
    'Toast',
    'Badge',
    'Undo',
  ],
  'Direct manipulation': [
    'Drag to reorder',
    'Swipe',
    'Pull to refresh',
    'Drag to dismiss',
  ],
};

export interface Specimen {
  id: SpecimenId;
  // The day the study went live, as YYYY-MM-DD.
  published: string;
  title: string;
  category: Category;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  trigger: 'hover' | 'hold' | 'drag' | 'select';
  triggerLabel: string;
  hint: string;
  touchHint?: string;
  duration: number;
  // Set when the duration varies per element; `duration` is then the longest.
  minDuration?: number;
  durationNote?: string;
  confirmationDuration?: number;
  release?: number;
  easing: Easing;
  easingName: string;
  easingNote?: string;
  props: string[];
  positioningNote?: string;
  // Shown in place of the easing cell when the curve isn't what the study is about.
  // `why` completes the note's "Why …" title when the value doesn't read as one.
  detail?: { label: string; value: string; note?: string; why?: string };
}

export const easingCss = (easing: Easing) =>
  easing === 'linear'
    ? 'linear'
    : Array.isArray(easing)
      ? `cubic-bezier(${easing.join(', ')})`
      : `linear(${easing.stops.join(', ')})`;

// The points the curve glyph and its trace read: four cubic-bezier values, or linear() stops scaled to peak at 1.
export function curvePoints(easing: Easing) {
  if (easing === 'linear') return [0, 0, 1, 1];
  if (Array.isArray(easing)) return easing;
  const peak = Math.max(...easing.stops);
  return easing.stops.map((stop) => Number((stop / peak).toFixed(4)));
}

// A study is labeled new for two weeks after it goes live.
const newForDays = 14;

export const newUntil = (specimen: Specimen) =>
  Date.parse(specimen.published) + newForDays * 86_400_000;

export const durationLabel = (specimen: Specimen) =>
  specimen.minDuration
    ? `${specimen.minDuration}–${specimen.duration}ms`
    : `${specimen.duration}ms`;

export const specimens: Specimen[] = [
  {
    id: 'text-swap',
    published: '2026-09-29',
    title: 'Text swap button',
    category: 'Actions',
    summary: 'Swap labels without changing the button width.',
    seoTitle: 'CSS button text swap without resizing',
    seoDescription:
      'Swap button labels with CSS Grid while keeping the button width stable. Try the CSS demo with keyboard focus and reduced-motion support.',
    trigger: 'hover',
    triggerLabel: 'Hover, focus, tap',
    hint: 'Hover or focus the button',
    duration: 220,
    durationNote:
      'Keeps the swap quick, while leaving time to follow the label change.',
    easing: [0.23, 1, 0.32, 1],
    easingName: 'ease-out-quint',
    easingNote:
      'Responds quickly to hover, then slows so the new label settles into place.',
    props: ['transform', 'opacity', 'filter'],
  },
  {
    id: 'hold-confirm',
    published: '2026-09-29',
    title: 'Hold to confirm button',
    category: 'Actions',
    summary: 'Deliberate confirmation, with a quick way back.',
    seoTitle: 'JavaScript hold-to-confirm button',
    seoDescription:
      'Build a hold-to-confirm button with a cancelable timer, keyboard support, and status feedback. Try the demo and learn how to connect a real action.',
    trigger: 'hold',
    triggerLabel: 'Press and hold',
    hint: 'Press and hold',
    duration: 1200,
    durationNote:
      'A pointer hold confirms after 1,200ms; its label settles in another 160ms (1,360ms total). Releasing early retracts the fill in 180ms. Keyboard input and reduced motion keep the wait but skip confirmation and release transitions.',
    confirmationDuration: 160,
    release: 180,
    easing: 'linear',
    easingName: 'linear',
    easingNote:
      'The fill measures elapsed time linearly. Pointer release and confirmation use cubic-bezier(0.23, 1, 0.32, 1). Keyboard input and reduced motion skip those transitions.',
    props: ['clip-path', 'transform', 'opacity'],
  },
  {
    id: 'chevron-morph',
    published: '2026-09-29',
    title: 'Chevron morph buttons',
    category: 'Navigation',
    summary: 'Extend a chevron into an arrow on hover.',
    seoTitle: 'CSS chevron-to-arrow button animation',
    seoDescription:
      'Turn a chevron into an arrow with SVG transforms and opacity. Try the 190ms demo and copy the CSS or Tailwind version, with keyboard and reduced-motion support.',
    trigger: 'hover',
    triggerLabel: 'Hover, focus, tap',
    hint: 'Hover or focus either button',
    duration: 190,
    durationNote:
      'Keeps the morph short for repeated navigation. Press feedback uses a separate 160ms transition.',
    easing: [0.19, 1, 0.22, 1],
    easingName: 'ease-out-expo',
    easingNote:
      'Responds quickly to hover, then slows as the stem reaches full length.',
    props: ['transform', 'opacity'],
  },
  {
    id: 'plucked-underline',
    published: '2026-10-06',
    title: 'Plucked underline',
    category: 'Navigation',
    summary: 'Pluck a link underline like a string tuned by its length.',
    seoTitle: 'CSS plucked string link underline animation',
    seoDescription:
      'Animate a nav underline like a plucked string, with a CSS linear() spring whose ring time scales with each link’s width. Works with keyboard and touch.',
    trigger: 'hover',
    triggerLabel: 'Hover, tap',
    hint: 'Hover across the links',
    touchHint: 'Tap a link',
    duration: 1200,
    minDuration: 400,
    durationNote:
      'Each string rings for 13ms per pixel of width, from 400ms to 1,200ms, so short links settle first. The underline opens from the pluck point in 140ms and closes back into it in 110ms while the string rings on.',
    release: 110,
    easing: {
      stops: [
        0, 0.157, 0.424, 0.741, 1.051, 1.304, 1.471, 1.536, 1.506, 1.401, 1.247,
        1.078, 0.923, 0.804, 0.734, 0.718, 0.749, 0.815, 0.9, 0.989, 1.065,
        1.119, 1.146, 1.146, 1.122, 1.083, 1.036, 0.991, 0.954, 0.931, 0.922,
        0.926, 0.942, 0.965, 0.989, 1.012, 1,
      ],
    },
    easingName: 'linear() · damped',
    easingNote:
      'A damped oscillation sampled into linear() stops: the string swings past flat, back, and settles over about two and a half cycles. Stretching the duration lowers the pitch without changing the shape.',
    props: ['transform', 'clip-path'],
  },
  {
    id: 'gooey-radio-group',
    published: '2026-10-06',
    title: 'Gooey radio group',
    category: 'Toggles & choices',
    summary: 'Pour the selection from one option to the next.',
    seoTitle: 'Gooey radio button animation with an SVG filter',
    seoDescription:
      'Pour a radio group’s selection into the next option as a liquid drop, using an SVG goo filter, native radios, and the Web Animations API.',
    trigger: 'select',
    triggerLabel: 'Click, tap, arrow keys',
    hint: 'Pick another option',
    duration: 480,
    durationNote:
      'The head of the drop reaches the new ring in 420ms and the tail follows 60ms behind, so the drop lands at 480ms. Arrow keys move the selection without the drop.',
    easing: [0.65, 0, 0.35, 1],
    easingName: 'ease-in-out-cubic',
    easingNote:
      'Head and tail share the curve, offset by 60ms; the gap between them is the drop. The slow start lets it pull away from the old ring before it travels. A choice made mid-pour switches to cubic-bezier(0.23, 1, 0.32, 1), which starts at speed, so the drop never stalls.',
    props: ['transform'],
  },
  {
    id: 'edge-aware-tooltip',
    published: '2026-09-29',
    title: 'Edge-aware tooltip',
    category: 'Values',
    summary: "Keep a slider's value label inside its container.",
    seoTitle: 'Range slider tooltip positioning',
    seoDescription:
      'Keep a range slider’s value label inside its container with CSS anchor positioning and a clamped fallback. Try the demo and copy the implementation.',
    trigger: 'drag',
    triggerLabel: 'Drag, tap, arrow keys',
    hint: 'Drag to either edge',
    duration: 0,
    durationNote:
      'The arrow follows the thumb 1:1. A transition would make the label lag behind a drag or key press.',
    easing: 'linear',
    easingName: 'linear · 1:1',
    props: ['anchor()', 'anchor-center'],
    positioningNote:
      'anchor-center keeps the label inside the slider while anchor(center) aligns the arrow with the thumb. A clamp() calculation handles browsers that lack the required anchor features.',
  },
  {
    id: 'drag-select',
    published: '2026-10-13',
    title: 'Drag to select',
    category: 'Direct manipulation',
    summary: 'Check a run of table rows in one drag down the boxes.',
    seoTitle: 'Drag to select checkboxes in a table',
    seoDescription:
      'Select table rows by dragging down their checkboxes, with a band that previews the result, autoscroll, Escape to cancel, and keyboard support.',
    trigger: 'select',
    triggerLabel: 'Drag, click, Shift+arrows',
    hint: 'Drag down the boxes',
    duration: 160,
    minDuration: 90,
    durationNote:
      'The band follows the pointer from row to row in 90ms; each check draws in 160ms. Unchecking, and the rows a drag backs off, clear at once.',
    easing: [0.23, 1, 0.32, 1],
    easingName: 'ease-out-quint',
    easingNote:
      'Starts at speed, so the band keeps up with a fast drag and lands softly on the row under the pointer.',
    props: ['transform', 'stroke-dashoffset', 'opacity'],
    detail: {
      label: 'Selection',
      value: 'Range from the first row',
      why: 'a range',
      note: 'Rows between the first box and the pointer take the first box’s new state. Rows the drag backs off return to how they were.',
    },
  },
  {
    id: 'resize-handle',
    published: '2026-10-19',
    title: 'Resize handle',
    category: 'Direct manipulation',
    summary: 'Show the grip where the pointer meets the divider.',
    seoTitle: 'Resizable sidebar handle that follows the pointer',
    seoDescription:
      'Resize a sidebar from a divider whose grip appears where the pointer meets it, with collapse, Escape to cancel, and window splitter keyboard support.',
    trigger: 'drag',
    triggerLabel: 'Drag, arrow keys, Enter',
    hint: 'Drag the divider',
    duration: 240,
    minDuration: 100,
    durationNote:
      'After a 60ms hover delay the grip appears in 120ms; it leaves in 100ms and widens in 100ms on press. Collapsing and reopening settle in 240ms, and the width follows the pointer 1:1.',
    easing: [0.23, 1, 0.32, 1],
    easingName: 'ease-out-quint',
    props: ['translate', 'scale', 'grid-template-columns'],
    positioningNote:
      'The grip and the handle move with translate, and the grip grows in with scale. Only the sidebar width, on grid-template-columns, changes layout.',
    detail: {
      label: 'Grip',
      value: 'Follows the pointer',
      why: 'follow the pointer',
      note: 'The hit area is 12px wide and the line 1px. The grip appears where the pointer meets the line and follows it along the edge, marking where a press will land. Keyboard focus shows it at the middle.',
    },
  },
  {
    id: 'tab-indicator',
    published: '2026-10-22',
    title: 'Tab indicator',
    category: 'Navigation',
    summary: 'Slide the underline to the chosen tab without moving the labels.',
    seoTitle: 'Tab underline and bold labels, no layout shift',
    seoDescription:
      'Slide a tab underline to the chosen tab with one transform that turns mid-move, and bold the selected label without layout shift.',
    trigger: 'select',
    triggerLabel: 'Click, tap, arrow keys',
    hint: 'Pick another tab',
    duration: 250,
    durationNote:
      'The line reaches the chosen tab in 250ms, and the label turns bold at the click. A tab chosen mid-move takes over from wherever the line is. Hover fills a tab in 120ms, and the arrow keys move the line without animating.',
    easing: [0.23, 1, 0.32, 1],
    easingName: 'ease-out-quint',
    easingNote:
      'Starts at full speed, so the line leaves the old tab as the click lands, then slows into the new one.',
    props: ['transform'],
    positioningNote:
      'The line is 1px wide. translateX moves it to the tab’s measured position and scaleX stretches it to the tab’s width, so every move is a single transform.',
  },
  {
    id: 'worm-dots',
    published: '2026-10-23',
    title: 'Worm dots',
    category: 'Navigation',
    summary: 'Drag along the dots to scrub the slides, with a worm that follows the scroll.',
    seoTitle: 'Draggable carousel dots with a worm indicator',
    seoDescription:
      'Carousel dots you can drag to scrub through the slides, with a worm indicator that stretches between dots in step with the scroll. Includes keyboard, touch, and reduced-motion support.',
    trigger: 'drag',
    triggerLabel: 'Drag, swipe, tap, arrow keys',
    hint: 'Drag along the dots',
    touchHint: 'Drag along the dots or swipe the slides',
    duration: 440,
    minDuration: 80,
    durationNote:
      'The worm has no duration of its own: it follows the scroll. A release snaps to the nearest dot in 180ms, a tap travels in 280ms plus 40ms for each extra dot it crosses, and the hover ring glides in 80ms. The arrow keys jump without animating.',
    easing: [0.23, 1, 0.32, 1],
    easingName: 'ease-out-quint',
    easingNote:
      'Starts at speed, so a release or a tap moves at once, then slows into the slide.',
    props: ['transform', 'width'],
    positioningNote:
      'The worm is a box with the dots’ radius. translateX moves its trailing edge and width sets its length, both computed from the scroll position on every frame.',
    detail: {
      label: 'Indicator',
      value: 'Follows the scroll',
      why: 'follow the scroll',
      note: 'Halfway through a swipe the worm spans both dots; let go there and it stays there. Its leading edge reaches the next dot first, then the trailing edge follows.',
    },
  },
];
