// Cloudflare Web Analytics: cookieless page views. Only the production host reports,
// so local builds, branch previews, and tests never send beacons.
const beaconSrc = 'https://static.cloudflareinsights.com/beacon.min.js';
const token = '7f9e682e6f164047839a98afccc35c7b';

if (location.hostname === 'microinteractions.dev') {
  const beacon = document.createElement('script');
  beacon.src = beaconSrc;
  beacon.dataset.cfBeacon = JSON.stringify({ token });
  document.body.append(beacon);
}
