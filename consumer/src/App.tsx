import * as React from 'react';
import { ChevronMorphButton } from '@/components/chevron-morph';
import { DragSelectTable } from '@/components/drag-select';
import { EdgeAwareSlider } from '@/components/edge-aware-tooltip';
import { GooeyRadioGroup } from '@/components/gooey-radio-group';
import { HoldConfirmButton } from '@/components/hold-confirm';
import { PluckedLink } from '@/components/plucked-underline';
import { ResizableSidebar } from '@/components/resize-handle';
import { TabIndicator } from '@/components/tab-indicator';
import { TextSwapButton } from '@/components/text-swap';
import { WormDots } from '@/components/worm-dots';

declare global {
  interface Window {
    calls?: string[];
  }
}

// Every callback lands here, so tests can tell what fired and how often.
const log = (name: string) => (value?: unknown) => {
  window.calls ??= [];
  window.calls.push(value === undefined ? name : `${name}:${JSON.stringify(value)}`);
};

const without = (list: string[], item: string) => list.filter((value) => value !== item);

// Each study, used the way a project would: inside one form, with collections and defaults that change.
export function App() {
  const [tabs, setTabs] = React.useState(['a', 'b', 'c']);
  const [rows, setRows] = React.useState(['A', 'B', 'C', 'D', 'E']);
  const [options, setOptions] = React.useState(['x', 'y', 'z']);
  const [slides, setSlides] = React.useState(3);
  const [defaults, setDefaults] = React.useState({ tab: 'b', option: 'x', volume: 50 });

  return (
    <form className="mx-auto grid max-w-lg gap-10 p-8" onSubmit={(event) => (event.preventDefault(), log('submit')())}>
      <div className="flex flex-wrap gap-2 text-sm">
        <button type="reset">Reset form</button>
        <button type="button" onClick={() => setTabs((list) => without(list, 'b'))}>Remove tab b</button>
        <button type="button" onClick={() => setTabs((list) => [...list, 'd'])}>Add tab d</button>
        <button type="button" onClick={() => setRows((list) => without(list, 'D'))}>Remove row D</button>
        <button type="button" onClick={() => setRows((list) => [...list, 'F'])}>Add row F</button>
        <button type="button" onClick={() => setOptions((list) => without(list, 'y'))}>Remove option y</button>
        <button type="button" onClick={() => setOptions((list) => without(list, 'z'))}>Remove option z</button>
        <button type="button" onClick={() => setSlides((count) => count + 1)}>Add slide</button>
        <button type="button" onClick={() => setDefaults({ tab: 'c', option: 'y', volume: 10 })}>Change defaults</button>
      </div>

      <section aria-label="Text swap">
        <TextSwapButton label="Download" nextLabel="macOS · 42 MB" aria-label="Download for macOS, 42 MB" />
      </section>

      <section aria-label="Chevron morph" className="flex gap-2.5">
        <ChevronMorphButton direction="previous" />
        <ChevronMorphButton direction="next" />
      </section>

      <fieldset aria-label="Hold to confirm" className="m-0 border-0 p-0">
        <HoldConfirmButton
          label="Delete project"
          dialog={{ label: 'Delete project', question: 'Delete this project?', cancel: 'Keep', confirm: 'Delete' }}
          onConfirm={log('hold')}
        />
      </fieldset>

      <section aria-label="Edge-aware tooltip">
        <EdgeAwareSlider label="Volume" defaultValue={defaults.volume} onValueChange={log('volume')} />
      </section>

      <section aria-label="Plucked underline">
        <nav className="flex gap-1" aria-label="Sections">
          <PluckedLink href="#bio" onClick={(event) => event.preventDefault()}>Bio</PluckedLink>
          <PluckedLink href="#contact" onClick={(event) => event.preventDefault()}>Get in touch</PluckedLink>
        </nav>
      </section>

      <GooeyRadioGroup
        legend="Delivery"
        defaultValue={defaults.option}
        onValueChange={log('option')}
        options={options.map((value) => ({ value, label: `Option ${value}` }))}
      />

      <TabIndicator
        aria-label="Categories"
        defaultValue={defaults.tab}
        onValueChange={log('tab')}
        tabs={tabs.map((value) => ({ value, label: `Tab ${value}`, badge: value.charCodeAt(0) - 96, content: <p className="p-2">Panel {value}</p> }))}
      />

      <DragSelectTable
        title="Planned studies"
        headers={{ label: 'Study', detail: 'Category' }}
        rows={rows.map((id) => ({ id, label: `Row ${id}`, detail: 'Category' }))}
        onSelectionChange={log('rows')}
      />

      <ResizableSidebar sidebar={<p className="p-3">Sidebar</p>}>
        <p className="p-4">Main</p>
      </ResizableSidebar>

      <WormDots
        aria-label="Slides"
        slides={Array.from({ length: slides }, (_, index) => (
          <span className="block p-3 font-mono text-sm">{String(index + 1).padStart(2, '0')}</span>
        ))}
      />
    </form>
  );
}
