import { Popover } from '@base-ui/react/popover';
import InstallCommand from './InstallCommand';
import styles from './InstallPopover.module.css';

// The install command waits behind a small trigger, so the live preview stays the first thing on the page.
export default function InstallPopover({ url }: { url: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.trigger}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add with shadcn
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
