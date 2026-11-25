import * as React from 'react';
import { AlignedSelect } from '@/components/aligned-select';
import { ChevronMorphButton } from '@/components/chevron-morph';
import { DragReorder } from '@/components/drag-reorder';
import { DragSelectTable } from '@/components/drag-select';
import { EdgeAwareSlider } from '@/components/edge-aware-tooltip';
import { FaqPanel } from '@/components/faq-panel';
import { GooeyRadioGroup } from '@/components/gooey-radio-group';
import { HoldConfirmButton } from '@/components/hold-confirm';
import { PluckedLink } from '@/components/plucked-underline';
import { ResizableSidebar } from '@/components/resize-handle';
import { TabIndicator } from '@/components/tab-indicator';
import { TextSwapButton } from '@/components/text-swap';
import { TickRail } from '@/components/tick-rail';
import { WormDots } from '@/components/worm-dots';
import { fixtures, main, pick, sidebar, type Mode } from './fixtures';

// One entry per registry item, keyed by its name: tests/worst-case.spec.ts fails for an item without one.
// Each renders the component with the data of a mode; a mode that doesn't apply falls back to the demo data.
export const studies: Record<string, (mode: Mode) => React.ReactNode> = {
  'text-swap': (mode) => (
    <div className="flex flex-wrap gap-3">
      {(mode === 'demo' ? fixtures.textSwap.demo : fixtures.textSwap.worst).map((props) => (
        <TextSwapButton key={props.label} {...props} />
      ))}
    </div>
  ),

  'chevron-morph': () => (
    <div className="flex gap-2.5">
      <ChevronMorphButton direction="previous" />
      <ChevronMorphButton direction="next" />
    </div>
  ),

  'hold-confirm': (mode) => (
    <div className="flex flex-wrap gap-3">
      {(mode === 'demo' ? fixtures.hold.demo : fixtures.hold.worst).map((props) => (
        <HoldConfirmButton key={props.label} {...props} />
      ))}
    </div>
  ),

  'edge-aware-tooltip': (mode) =>
    (mode === 'demo' ? fixtures.slider.demo : fixtures.slider.worst).map((props) => <EdgeAwareSlider key={props.label} {...props} />),

  'plucked-underline': (mode) => (
    <nav className="flex flex-wrap gap-1" aria-label="Links">
      {(mode === 'demo' ? fixtures.links.demo : fixtures.links.worst).map((text) => (
        <PluckedLink key={text} href="#" onClick={(event) => event.preventDefault()}>
          {text}
        </PluckedLink>
      ))}
    </nav>
  ),

  'gooey-radio-group': (mode) => (
    <GooeyRadioGroup
      legend={mode === 'demo' ? 'Delivery' : 'Delivery method for order #9f8e7d6c-5b4a-4c3d'}
      options={pick(fixtures.options, mode, []).map((label, index) => ({ value: String(index), label }))}
    />
  ),

  'tab-indicator': (mode) => (
    <TabIndicator
      aria-label="Categories"
      tabs={pick(fixtures.tabs, mode, []).map(([label, badge], index) => ({
        value: String(index),
        label,
        badge,
        content: <p className="p-2 text-sm">{mode === 'demo' ? `Panel ${label}` : `${label}: ${'Last edited 12 days ago. '.repeat(3)}`}</p>,
      }))}
    />
  ),

  'drag-select': (mode) => (
    <DragSelectTable
      title={mode === 'demo' ? fixtures.table.demoTitle : fixtures.table.worstTitle}
      headers={mode === 'demo' ? { label: 'Study', detail: 'Category' } : { label: 'Member', detail: 'Email' }}
      rows={pick(fixtures.table, mode, [])}
    />
  ),

  'resize-handle': (mode) => <ResizableSidebar sidebar={sidebar(mode)}>{main(mode)}</ResizableSidebar>,

  'drag-reorder': (mode) => (
    <DragReorder aria-label="Tasks" items={pick(fixtures.reorder, mode, []).map((label, index) => ({ id: String(index), label }))} />
  ),

  'faq-panel': (mode) => (
    <FaqPanel
      items={pick(fixtures.faq, mode, []).map(({ question, answer }, index) => ({ value: String(index), question, answer: <p>{answer}</p> }))}
    />
  ),

  'tick-rail': (mode) => {
    const sections = pick(fixtures.rail, mode, []);
    return (
      <TickRail items={sections.map((section, index) => ({ id: `s${index}`, ...section }))} className="h-80">
        {sections.map((section, index) => (
          <section key={index} id={`s${index}`} className="py-6">
            <h3 className="font-medium">{section.label}</h3>
            <p className="text-sm text-muted-foreground">{section.description ?? 'No description.'}</p>
          </section>
        ))}
      </TickRail>
    );
  },

  'aligned-select': (mode) => (
    <ul className="grid w-[min(100%,400px)] grid-cols-[minmax(0,1fr)] rounded-xl border border-border bg-card px-4 py-1 text-sm">
      {pick(fixtures.select, mode, []).map((options, index) => (
        <li key={index} className="flex min-h-12 items-center justify-between gap-4 not-first:border-t">
          <span id={`als-${mode}-${index}`} className="min-w-0 truncate">
            Setting {index + 1}
          </span>
          <AlignedSelect aria-labelledby={`als-${mode}-${index}`} options={options} defaultValue={options[Math.min(1, options.length - 1)]} className="max-w-[60%]" />
        </li>
      ))}
    </ul>
  ),

  'worm-dots': (mode) => (
    <WormDots
      aria-label="Slides"
      slides={Array.from({ length: fixtures.slides[mode] }, (_, index) => (
        <span className="block p-3 text-sm">
          {mode !== 'demo' && index === 0
            ? 'Konstantin Oberhauser-Wettstein: Q3 Board Deck — FINAL (revised) v12 [approved by legal].pdf'
            : String(index + 1).padStart(2, '0')}
        </span>
      ))}
    />
  ),
};
