interface Umami {
  track(event: string, data: Record<string, string>): unknown;
}

// Reports a reader's action on a study page. Does nothing when Umami is missing: outside production,
// behind a content blocker, or before the script loads.
export function track(event: 'copy_install' | 'copy_code' | 'open_codepen', data: Record<string, string>) {
  const { umami } = window as Window & { umami?: Umami };
  umami?.track(event, { study: location.pathname.split('/')[1], ...data });
}
