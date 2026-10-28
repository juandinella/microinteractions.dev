import { Tabs } from '@base-ui/react/tabs';
import { useEffect, useRef, useState } from 'react';
import styles from './InstallCommand.module.css';

const managers = [
  { id: 'npm', runner: 'npx' },
  { id: 'pnpm', runner: 'pnpm dlx' },
  { id: 'yarn', runner: 'yarn' },
  { id: 'bun', runner: 'bunx --bun' },
] as const;

type Manager = (typeof managers)[number]['id'];

// A per-viewer convenience: the choice follows the reader to the next study.
const STORAGE = 'microinteractions:package-manager';

export default function InstallCommand({ url }: { url: string }) {
  const [manager, setManager] = useState<Manager>('npm');
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState({ message: '', version: 0 });
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);
  const command = (id: Manager) =>
    `${managers.find((item) => item.id === id)!.runner} shadcn@latest add ${url}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (managers.some(({ id }) => id === saved)) setManager(saved as Manager);
    } catch {}
    setHydrated(true);
    return () => clearTimeout(reset.current);
  }, []);

  const clear = () => {
    clearTimeout(reset.current);
    setCopied(false);
    setStatus((current) => ({ ...current, message: '' }));
  };

  async function copy() {
    clearTimeout(reset.current);
    try {
      await navigator.clipboard.writeText(command(manager));
      setCopied(true);
      setStatus((current) => ({ message: 'Install command copied to clipboard.', version: current.version + 1 }));
      reset.current = setTimeout(clear, 1800);
    } catch {
      setStatus((current) => ({ message: 'Clipboard unavailable. Select the command to copy it.', version: current.version + 1 }));
    }
  }

  return (
    <div>
      <Tabs.Root
        className={styles.frame}
        value={manager}
        onValueChange={(value: Manager) => {
          clear();
          setManager(value);
          try {
            localStorage.setItem(STORAGE, value);
          } catch {}
        }}
      >
        <Tabs.List className={styles.tabs} activateOnFocus aria-label="Package manager">
          {managers.map(({ id }) => (
            <Tabs.Tab key={id} className={styles.tab} value={id}>
              {id}
            </Tabs.Tab>
          ))}
          <Tabs.Indicator className={styles.indicator} />
        </Tabs.List>
        {/* One copy button for every panel, so switching managers never shows two at once. */}
        <div className={styles.row}>
          <div className={styles.panels}>
            {managers.map(({ id }) => (
              <Tabs.Panel key={id} className={styles.panel} value={id}>
                <code className={styles.command}>
                  <span className={styles.prompt} aria-hidden="true">$ </span>
                  {command(id)}
                </code>
              </Tabs.Panel>
            ))}
          </div>
          <button
            type="button"
            className={styles.copy}
            aria-label="Copy install command"
            onClick={copy}
            disabled={!hydrated}
            style={!hydrated ? { visibility: 'hidden' } : undefined}
            data-copied={copied || undefined}
          >
            <svg className={styles.copyIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V4H4v12h4" />
            </svg>
            <svg className={styles.checkIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </button>
        </div>
      </Tabs.Root>
      <p className="sr-only" role="status" aria-atomic="true">
        <span key={status.version}>{status.message}</span>
      </p>
    </div>
  );
}
