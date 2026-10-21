import { Tabs } from '@base-ui/react/tabs';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './SourceTabs.module.css';

interface View {
  id: string;
  label: string;
}

// Each view's highlighted source arrives as a named slot matching its id.
type Props = {
  views: View[];
  actions?: ReactNode;
} & Record<string, unknown>;

export default function SourceTabs({ views, actions, ...panels }: Props) {
  const [tab, setTab] = useState(views[0].id);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState({ message: '', version: 0 });
  const languageId = useId();
  const root = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);
  const label = views.find((view) => view.id === tab)!.label;

  const clear = () => {
    clearTimeout(reset.current);
    setCopied(false);
    setStatus((current) => ({ ...current, message: '' }));
  };

  const announce = (message: string) =>
    setStatus((current) => ({ message, version: current.version + 1 }));

  // The CSS/Tailwind switch lives outside this island; switching formats drops stale copy feedback.
  useEffect(() => {
    const selected =
      root.current!.querySelector<HTMLInputElement>('input:checked');
    if (selected) setTab(selected.value);
    restoreFocus.current =
      root.current!.contains(document.activeElement) &&
      document.activeElement instanceof HTMLInputElement;
    setHydrated(true);
    const source = root.current!.closest('[data-source]');
    source?.addEventListener('change', clear);
    return () => {
      source?.removeEventListener('change', clear);
      clearTimeout(reset.current);
    };
  }, []);

  useEffect(() => {
    if (hydrated && restoreFocus.current) {
      root
        .current!.querySelector<HTMLElement>(
          '[role="tab"][aria-selected="true"]',
        )
        ?.focus();
      restoreFocus.current = false;
    }
  }, [hydrated]);

  async function copy() {
    const panel = root.current!.querySelector<HTMLElement>(
      '[role="tabpanel"]:not([hidden])',
    )!;
    const code = panel.querySelector('code')!;
    const stillShown = () =>
      panel.isConnected && panel.getClientRects().length > 0;
    clearTimeout(reset.current);
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      if (!stillShown()) return;
      setCopied(true);
      announce(`${label} copied to clipboard.`);
      reset.current = setTimeout(clear, 1800);
    } catch {
      if (!stillShown()) return;
      panel.focus();
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      announce(
        'Clipboard unavailable. Code selected; use your device’s Copy command, or press ⌘C or Ctrl+C.',
      );
    }
  }

  const content = (
    <>
      <div className={styles.header}>
        {hydrated ? (
          <Tabs.List
            className={styles.tabs}
            activateOnFocus
            aria-label="Source code sections"
          >
            {views.map((view) => (
              <Tabs.Tab key={view.id} className={styles.tab} value={view.id}>
                {view.label}
              </Tabs.Tab>
            ))}
            <Tabs.Indicator className={styles.indicator} />
          </Tabs.List>
        ) : (
          <fieldset className={styles.tabs}>
            <legend className="sr-only">Source code sections</legend>
            {views.map((view, index) => (
              <label
                key={view.id}
                className={`${styles.tab} ${styles.staticTab}`}
              >
                <input
                  type="radio"
                  name={languageId}
                  value={view.id}
                  defaultChecked={index === 0}
                  aria-controls={`${languageId}-${view.id}`}
                />
                <span>{view.label}</span>
              </label>
            ))}
          </fieldset>
        )}
        <div className={styles.actions}>
          {actions}
          <button
            type="button"
            className={`${styles.action} ${styles.copy}`}
            aria-label={`Copy ${label}`}
            onClick={copy}
            disabled={!hydrated}
            style={!hydrated ? { visibility: 'hidden' } : undefined}
          >
            <span>{copied ? 'Copied' : 'Copy'}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V4H4v12h4" />
            </svg>
          </button>
        </div>
      </div>
      {views.map((view) =>
        hydrated ? (
          <Tabs.Panel
            key={view.id}
            className={styles.panel}
            value={view.id}
            keepMounted
          >
            {panels[view.id] as ReactNode}
          </Tabs.Panel>
        ) : (
          <div
            key={view.id}
            id={`${languageId}-${view.id}`}
            className={styles.panel}
            data-source-panel={view.id}
            role="region"
            aria-label={`${view.label} source`}
            tabIndex={0}
          >
            {panels[view.id] as ReactNode}
          </div>
        ),
      )}
    </>
  );

  return (
    <div ref={root} data-static-source={!hydrated ? '' : undefined}>
      {hydrated ? (
        <Tabs.Root
          className={`code-frame ${styles.frame}`}
          value={tab}
          onValueChange={(value: string) => {
            clear();
            setTab(value);
          }}
        >
          {content}
        </Tabs.Root>
      ) : (
        <div className={`code-frame ${styles.frame}`}>{content}</div>
      )}
      <p className={styles.status} role="status" aria-atomic="true">
        <span key={status.version}>{status.message}</span>
      </p>
    </div>
  );
}
