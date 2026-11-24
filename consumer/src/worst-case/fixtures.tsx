// Demo data, and the realistic worst case for every value the studies render: long, translated and
// unbreakable text, missing optional fields, empty and single collections, and the largest lists
// a project would pass. The sidebar and main contents stand in for what a careful project renders.
import * as React from 'react';

export type Mode = 'demo' | 'worst' | 'empty' | 'one' | 'many';

const people = [
  ['Aleksandra Wiśniewska-Kowalczyk', 'aleksandra.wisniewska-kowalczyk@northwind-industries-holdings.example.com'],
  ['Jo', 'jo@example.com'],
  ['Christopher Alexander Montgomery III', 'first.last+billing-notifications@example.com'],
  ['Đặng Thị Ngọc Hân', 'hân.đặng@example.test'],
  ['王秀英', 'wang.xiuying@example.com'],
  ['نور الهدى عبد الرحمن', 'nour@example.org'],
  ['🦊 Fox', 'a@b.test'],
  ['María José de la Cruz y Fernández', 'mj.delacruz@sub.department.region.example.test'],
];

const person = (index: number) => people[index % people.length];

export const fixtures = {
  textSwap: {
    demo: [{ label: 'Download', nextLabel: 'macOS · 42 MB' }],
    worst: [
      { label: 'Télécharger gratuitement', nextLabel: 'macOS 13+ · Apple Silicon et Intel · 1,2 Go' },
      { label: 'Go', nextLabel: 'Benachrichtigungseinstellungen' },
    ],
  },

  hold: {
    demo: [{ label: 'Delete project' }],
    worst: [
      {
        label: 'Projekt endgültig löschen',
        holdingLabel: 'Weiter gedrückt halten…',
        confirmedLabel: 'Projekt gelöscht',
        dialog: {
          label: 'Projekt löschen',
          question: 'Das Projekt „Q3 Board Deck — FINAL (revised) v12" und 1.284 Dateien werden endgültig gelöscht.',
          cancel: 'Projekt behalten',
          confirm: 'Endgültig löschen',
        },
      },
      { label: 'Delete', confirmedLabel: 'Workspace and 1,284 files deleted' },
    ],
  },

  slider: {
    demo: [{ label: 'Volume', defaultValue: 50 }],
    worst: [
      { label: 'Notification volume', defaultValue: 100 },
      { label: 'Lautstärke der Benachrichtigungen', defaultValue: 0 },
    ],
  },

  links: {
    demo: ['Bio', 'Get in touch'],
    worst: ['Términos y condiciones de uso', 'Jo', 'Read the full accessibility statement and conformance report'],
  },

  options: {
    demo: ['Option x', 'Option y', 'Option z'],
    worst: [
      'Standard (3–5 business days)',
      'Express — next business day before 10:00, additional charges apply',
      'Jo',
      'Livraison en point relais',
      'Abholung in der Filiale',
    ],
    one: ['Standard (3–5 business days)'],
    many: Array.from({ length: 14 }, (_, index) => `Pickup point ${index + 1}`),
  },

  tabs: {
    demo: [
      ['Tab a', '1'],
      ['Tab b', '2'],
      ['Tab c', '3'],
    ],
    worst: [
      ['Overview'],
      ['Benachrichtigungseinstellungen'],
      ['Members', '1,284'],
      ['Paramètres de confidentialité et de sécurité'],
      ['Jo', '0'],
      ['Billing & invoices', '12'],
    ],
    one: [['Overview']],
    many: Array.from({ length: 24 }, (_, index) => [`Section ${index + 1}`, String(index * 7)]),
  },

  table: {
    demoTitle: 'Planned studies',
    worstTitle: 'Pending invitations for the Northwind Industries Holdings workspace',
    demo: ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, label: `Row ${id}`, detail: 'Category' })),
    worst: people.map(([name, email], index) => ({ id: `p${index}`, label: name, detail: email })),
    one: [{ id: 'p0', label: person(0)[0], detail: person(0)[1] }],
    many: Array.from({ length: 1284 }, (_, index) => ({ id: `m${index}`, label: `${person(index)[0]} ${index + 1}`, detail: person(index)[1] })),
  },

  reorder: {
    demo: ['Task A', 'Task B', 'Task C'],
    worst: [
      'Migrate the billing webhooks to the new API version before the Q3 freeze',
      'Jo',
      'Review bartholomew.fitzgerald@northwind-industries-holdings.example.com access',
      '王秀英的设计评审',
      '🦊 Fox: fix the onboarding emails',
    ],
    one: ['Migrate the billing webhooks'],
    many: Array.from({ length: 120 }, (_, index) => `Task ${index + 1}`),
  },

  faq: {
    demo: ['one', 'two', 'three'].map((value) => ({ question: `Question ${value}`, answer: `Answer ${value}` })),
    worst: [
      {
        question: 'Can I share https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved with a guest?',
        answer: 'Yes. Guests see the document but not the comments.',
      },
      {
        question: 'Was passiert mit meinen Benachrichtigungseinstellungen, wenn ich das Abonnement kündige oder auf einen anderen Plan wechsle?',
        answer: 'Sie bleiben erhalten. '.repeat(40).trim(),
      },
      { question: 'Jo?', answer: 'Jo.' },
      { question: 'Why was I charged $12,345,678.90?', answer: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com approved the invoice.' },
    ],
    one: [{ question: 'How do I cancel?', answer: 'From Settings → Billing.' }],
    many: Array.from({ length: 30 }, (_, index) => ({ question: `Question ${index + 1}`, answer: `Answer ${index + 1}` })),
  },

  rail: {
    demo: ['one', 'two', 'three', 'four', 'five'].map((value) => ({ label: `Section ${value}`, description: `About ${value}` })),
    worst: [
      { label: 'Installation', description: 'Install with npm, pnpm, yarn or bun.' },
      {
        label: 'Paramètres de confidentialité et de sécurité',
        description:
          'Configure who can see the workspace, how long audit logs are kept, which domains can sign in with SSO, and what happens to the data of members who leave the organisation after the retention period ends.',
      },
      { label: 'API' },
      { label: 'Benachrichtigungseinstellungen', description: 'E-Mail, Push und Webhooks.' },
      { label: 'FAQ', description: '' },
    ],
    one: [{ label: 'Installation', description: 'Install with npm, pnpm, yarn or bun.' }],
    many: Array.from({ length: 40 }, (_, index) => ({ label: `Section ${index + 1}`, description: `About section ${index + 1}` })),
  },

  // The documented maximum: at 320px a tenth dot pushes the counter out of the carousel.
  slides: { demo: 3, worst: 7, empty: 0, one: 1, many: 9 },
};

// Collections fall back to the demo list where a mode doesn't apply to them.
export function pick<T>(set: Partial<Record<Mode, T>> & { demo: T }, mode: Mode, empty: T): T {
  if (mode === 'empty') return empty;
  return set[mode] ?? set.demo;
}

export const sidebar = (mode: Mode) =>
  mode === 'demo' ? (
    <p className="p-3">Sidebar</p>
  ) : (
    <nav className="grid gap-0.5 p-2">
      {[
        'Inbox',
        'Konstantin Oberhauser-Wettstein',
        'Q3 Board Deck — FINAL (revised) v12 [approved by legal].pdf',
        'IMG_20250914_183022_HDR_portrait_edited_edited.HEIC',
        'Benachrichtigungseinstellungen',
        ...Array.from({ length: 10 }, (_, index) => `Project ${index + 1}`),
      ].map((item) => (
        <a key={item} href="#" title={item} className="truncate rounded-md px-2 py-1.5 hover:bg-muted">
          {item}
        </a>
      ))}
    </nav>
  );

export const main = (mode: Mode) =>
  mode === 'demo' ? (
    <p className="p-4">Main</p>
  ) : (
    <div className="p-4">
      <h3 className="font-medium wrap-break-word">Q3 Board Deck — FINAL (revised) v12 [approved by legal].pdf</h3>
      <p className="mt-2 wrap-break-word text-muted-foreground">
        Shared by bartholomew.fitzgerald@northwind-industries-holdings.example.com with 1,284 members. {'Last edited 12 days ago. '.repeat(8)}
      </p>
    </div>
  );
