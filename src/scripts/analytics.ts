import { track } from './track';

// Cookieless analytics. Only the production host reports, so local builds, branch previews,
// and tests never send anything.
function load(src: string, data: Record<string, string>) {
  const script = document.createElement('script');
  script.src = src;
  Object.assign(script.dataset, data);
  document.body.append(script);
}

// Opening any page with ?analytics=off keeps this browser out of the numbers, and ?analytics=on brings it back.
// The parameter leaves the address bar so it isn't shared or counted. Umami reads the same storage key.
function optedOut() {
  const url = new URL(location.href);
  const choice = url.searchParams.get('analytics');
  try {
    if (choice === 'off') localStorage.setItem('umami.disabled', '1');
    if (choice === 'on') localStorage.removeItem('umami.disabled');
    if (choice === 'off' || choice === 'on') {
      url.searchParams.delete('analytics');
      history.replaceState(history.state, '', url);
    }
    return localStorage.getItem('umami.disabled') !== null;
  } catch {
    // Storage is blocked: the choice can't be remembered, but this visit still honors it.
    return choice === 'off';
  }
}

if (location.hostname === 'microinteractions.dev' && !optedOut()) {
  load('https://static.cloudflareinsights.com/beacon.min.js', {
    cfBeacon: JSON.stringify({ token: '7f9e682e6f164047839a98afccc35c7b' }),
  });
  // Heading links add hashes, which Umami would count as separate pages. Query strings stay: they carry the UTM tags.
  load('https://cloud.umami.is/script.js', {
    websiteId: '9df4379f-e6e7-4121-a0d8-0a6932f04ced',
    excludeHash: 'true',
  });

  // The export is a plain form that works without JavaScript, so nothing in its island handles the submit.
  document.addEventListener('submit', ({ target }) => {
    const form = target as HTMLFormElement;
    if (!form.action.startsWith('https://codepen.io/')) return;
    track('open_codepen', { format: form.closest<HTMLElement>('[data-source-variant]')?.dataset.sourceVariant ?? '' });
  });
}
