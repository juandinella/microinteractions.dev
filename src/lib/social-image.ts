interface SocialConfig {
  titleSize: number;
  margin: number;
  copyTop: number;
  gap: number;
  logoSize: number;
}

// A study cover keeps the shared composition and swaps in the study's own copy.
export interface SocialStudy {
  id: string;
  title: string;
  summary: string;
  category: string;
}

// Study titles run longer than the site name, so they set smaller to stay inside the margins.
const studyTitleSize = 64;

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export const socialImageAlt = (study?: SocialStudy) => study
  ? `${study.title} — ${study.summary} A Microinteractions study by Juan Di Nella.`
  : 'Microinteractions — A collection of small UI experiments. By Juan Di Nella.';

export function renderSocialImage(config: SocialConfig, study?: SocialStudy) {
  const { margin, copyTop, gap, logoSize } = config;
  const titleSize = study ? studyTitleSize : config.titleSize;
  const logoHeight = logoSize * 383 / 814;
  const title = study ? escape(study.title) : 'Microinteractions';
  const description = study ? escape(study.summary) : 'A collection of small UI experiments.';
  const domain = study ? `microinteractions.dev/${study.id}` : 'microinteractions.dev';
  return `<div data-social-image role="img" aria-label="${escape(socialImageAlt(study))}" style="position:relative;width:1200px;height:630px;overflow:hidden;background:oklch(0.995 0.002 258.74)">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" aria-hidden="true" class="social-type-image">
      <style>
        .social-type-image { font-family: 'Martian Grotesk', sans-serif; -webkit-font-smoothing: antialiased; }
        .social-type-image .signature { font-family: 'Martian Mono', monospace; }
      </style>
      <defs><mask id="social-logo" style="mask-type:alpha"><image href="/logo.svg" x="${margin}" y="${margin}" width="${logoSize}" height="${logoHeight}" /></mask></defs>
      <rect x="${margin}" y="${margin}" width="${logoSize}" height="${logoHeight}" fill="oklch(0.40828 0.15418 258.74)" mask="url(#social-logo)" />
      ${study ? `<text class="signature" x="${margin}" y="${copyTop - 44}" dominant-baseline="hanging" font-size="14" fill="oklch(0.44 0.014 258.74)">${escape(study.category)}</text>` : ''}
      <text x="${margin - 4}" y="${copyTop}" dominant-baseline="hanging" font-size="${titleSize}" font-weight="400" letter-spacing="${-4 * titleSize / config.titleSize}" fill="oklch(0.23 0.012 258.74)">${title}</text>
      <text x="${margin}" y="${copyTop + titleSize + gap}" dominant-baseline="hanging" font-size="24" fill="oklch(0.44 0.014 258.74)">${description}</text>
      <text class="signature" x="${margin}" y="${630 - margin}" font-size="14" fill="oklch(0.44 0.014 258.74)">By Juan Di Nella</text>
      <text class="signature" x="${1200 - margin}" y="${630 - margin}" font-size="14" text-anchor="end" fill="oklch(0.40828 0.15418 258.74)">${domain}</text>
    </svg>
  </div>`;
}
