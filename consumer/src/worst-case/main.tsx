// Dev-only page: every installed study with demo data and with the realistic worst case, at a chosen
// width and direction. Open /worst-case.html on the dev server; tests/worst-case.spec.ts runs against it.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { studies } from './studies';
import './worst-case.css';

const controls = {
  data: ['demo', 'worst', 'empty', 'one', 'many'],
  width: ['320', '400', '640'],
  dir: ['ltr', 'rtl'],
  theme: ['light', 'dark'],
} as const;

type State = { [K in keyof typeof controls]: (typeof controls)[K][number] };

function read(): State {
  const params = new URLSearchParams(location.search);
  const get = <K extends keyof State>(key: K) =>
    ((controls[key] as readonly string[]).includes(params.get(key) ?? '') ? params.get(key) : controls[key][0]) as State[K];
  return { data: get('data'), width: get('width'), dir: get('dir'), theme: get('theme') };
}

// Plain chrome, outside the design under test.
function Segmented<K extends keyof State>({ name, value, onChange }: { name: K; value: State[K]; onChange: (value: State[K]) => void }) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: '#e5e5e5' }}>
      {controls[name].map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option as State[K])}
          style={{
            font: '12px system-ui',
            padding: '4px 8px',
            border: 0,
            borderRadius: 6,
            cursor: 'pointer',
            color: '#171717',
            background: option === value ? '#fff' : 'transparent',
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function WorstCase() {
  const [state, setState] = React.useState(read);

  React.useEffect(() => {
    history.replaceState(null, '', `?${new URLSearchParams(state)}`);
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state]);

  return (
    <>
      {/* Block layout, so a study's width comes from its own CSS and not from a grid track around it. */}
      <main className="mx-auto space-y-12 pt-8 pb-32" style={{ width: `${state.width}px` }} dir={state.dir} key={state.data}>
        {Object.entries(studies).map(([name, render]) => (
          <section key={name} aria-label={name} className="space-y-3" data-study>
            <h2 className="font-mono text-[11px] text-muted-foreground" dir="ltr">
              {name}
            </h2>
            {render(state.data)}
          </section>
        ))}
      </main>
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 6,
          width: 'max-content',
          maxWidth: 'calc(100vw - 16px)',
        }}
      >
        {(Object.keys(controls) as (keyof State)[]).map((name) => (
          <Segmented key={name} name={name} value={state[name]} onChange={(value) => setState((current) => ({ ...current, [name]: value }))} />
        ))}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorstCase />
  </React.StrictMode>,
);
