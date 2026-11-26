import { Popover } from '@base-ui/react/popover';
import styles from './SpecNote.module.css';

type Props = {
  value: string;
  note: string;
} & (
  | { label: string; ariaLabel?: undefined }
  | { ariaLabel: string; label?: undefined }
);

export default function SpecNote({ label, ariaLabel, value, note }: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={styles.trigger}
        aria-label={ariaLabel ?? `Why this ${label.toLowerCase()}?`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
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
