interface Umami {
  track(event: string, data?: Record<string, string>): unknown;
}

// Reports a reader's action. Does nothing when Umami is missing: outside production,
// behind a content blocker, or before the script loads.
export function track(
  event: 'copy_install' | 'copy_code' | 'open_codepen' | 'copy_skill',
  data: Record<string, string> = {},
) {
  const { umami } = window as Window & { umami?: Umami };
  const study = location.pathname.split('/')[1];
  const payload = { ...(study ? { study } : {}), ...data };
  if (Object.keys(payload).length) {
    umami?.track(event, payload);
  } else {
    umami?.track(event);
  }
}
