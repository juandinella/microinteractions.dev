import { Popover } from '@base-ui/react/popover';
import { Info } from 'lucide-react';
import styles from './SpecNote.module.css';

interface Props {
  label: string;
  value: string;
  note: string;
}

export default function SpecNote({ label, value, note }: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={styles.trigger}
        aria-label={`Why this ${label.toLowerCase()}?`}
      >
        <Info size={12} strokeWidth={1.5} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className={styles.positioner}
          side="top"
          sideOffset={8}
          collisionPadding={16}
        >
          <Popover.Popup className={styles.popup}>
            <Popover.Arrow className={styles.arrow}>
              <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
                <path d="M0 8 7.3.7a1 1 0 0 1 1.4 0L16 8" />
              </svg>
            </Popover.Arrow>
            <Popover.Title className={styles.title}>Why {value}</Popover.Title>
            <Popover.Description className={styles.description}>
              {note}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
