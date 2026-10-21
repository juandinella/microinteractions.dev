export const securityHeaders = {
  'Content-Security-Policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://codepen.io",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
