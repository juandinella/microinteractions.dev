---
name: Microinteractions Gallery
description: A restrained lab bench for tactile UI behavior studies.
colors:
  bg: "oklch(0.995 0.002 258.74)"
  surface: "oklch(0.972 0.002 258.74)"
  surface-strong: "oklch(0.925 0.004 258.74)"
  text: "oklch(0.23 0.012 258.74)"
  muted: "oklch(0.44 0.014 258.74)"
  quiet: "oklch(0.55 0.012 258.74)"
  meta: "oklch(0.39 0.014 258.74)"
  line: "oklch(0.9 0.003 258.74)"
  line-strong: "oklch(0.79 0.006 258.74)"
  ink: "oklch(0.24 0.016 258.74)"
  ink-text: "oklch(0.93 0.012 250)"
  ink-muted: "oklch(0.73 0.02 250)"
  accent: "oklch(0.55 0.17 256)"
  brand: "oklch(0.40828 0.15418 258.74)"
typography:
  display:
    fontFamily: "Martian Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(24px, 2.6vw, 32px)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Martian Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "-0.01em"
rounded:
  sm: "12px"
  md: "14px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "24px"
  xl: "28px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  specimen-stage:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "32px 20px"
  trace-strip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    height: "44px"
  code-panel:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.sm}"
    padding: "24px"
---

# Design System: Microinteractions Gallery

## 1. Overview

**Creative North Star: "The Motion Specimen Tray"**

The interface should feel like a quiet tray of interaction specimens: precise, evenly lit, and tactile. The surrounding UI stays deliberately plain so the visitor's attention goes to the control state, the curve, the press, the label shift, and the copyable CSS.

This is a brand surface, but it should avoid marketing theater. The brand earns character through precision: tinted neutrals, measured type, mono metadata, modest borders, and motion that feels engineered rather than performed.

**Key Characteristics:**
- System-following light and dark themes with tinted neutrals. Portfolio blue marks the shell; each study's motion and control accent follows its category tint.
- Sparse copy, visible previews, direct access to code.
- Physical state changes through transform, opacity, color, and shadow only.
- A lab-bench rhythm: generous intro space, dense metadata, quiet surfaces.
- A compact index and grouped sidebar lead to one specimen per page, with a calibrated stage, live trace, technical metadata, and a short author note.

## 2. Colors

The palette pairs a near-white background with graphite text and controls. The blue ink of juandinella.com accents the logo and current navigation. Preview fills, secondary controls, and borders stay almost-neutral grays. A category section and its study mix 3% of that category's tint into the specimen surface, which is enough to tell the trays apart and not enough to color the bench. Code panels use dark graphite. Motion uses the local accent: Trace Blue at the root, and the category tint inside a section or study.

### Primary
The theme follows `prefers-color-scheme` without a manual toggle. Light mode uses the palette above; dark overrides live in `src/styles/tokens.css`. Dark mode uses graphite surfaces, pale text, and lighter blue/category accents. Raised surfaces get lighter, while code and tooltip surfaces remain dark with their own light text. Component-specific success colors follow the same system preference. Exported examples use light values only; theme support belongs to the gallery, not the minimal snippet.

- **Instrument Ink**: The darkest UI role. Use for primary buttons, active switch states, modal panels, and decisive focus moments.
- **Trace Blue** (`--accent`): Draws motion in progress: the trace strip fill, the easing glyph's dot, and the inspector thumb. At the root it is the blue below. On a category section and on a study page it is that category's tint, so the trace matches the study. Demo color knobs fall back through it, then to Instrument Ink, which is what a copied snippet uses when the host sets neither the knob nor `--accent`. Never use it for shell buttons, the logo, or article links.
- **Portfolio Ink** (`--brand`): The portfolio's `#02449b`, converted to OKLCH. Use for the logo, current navigation text, and article links.

### Neutral
- **Bench Porcelain**: A visually white page background with a minimal blue tint. Never pure white.
- **Specimen Surface**: Card and preview backgrounds. Use when an interaction needs a defined stage without visual noise.
- **Pressed Surface**: Secondary fills, inactive switches, and quiet depth changes.
- **Graphite Text**: Primary reading color and the main action color.
- **Quiet Graphite**: Supporting descriptions and low-priority copy.
- **Calibration Line**: Borders and dividers. Prefer thin full outlines over decorative accents.

### Named Rules

**The No Accent Hunt Rule.** Saturated color has a defined role: the local accent shows time passing and, through an existing demo color knob, the control itself. Portfolio Ink accents the logo, current navigation, and article links. Category tints are that local accent. They are not a second decoration pass on the shell.

**The Category Tint Rule.** Each category has one tint (`--category-*` in `tokens.css`), shared by its Phosphor icon (regular weight, 16px) and by `--accent` on that category's home-page section and study page. Light-mode lightness is lowered just enough that the tint, as text or a solid stroke, keeps at least 4.5:1 on Bench Porcelain, Specimen Surface, a 3% mix of the tint into that surface, and the tab hover fill. Chroma stays at the highest in-gamut value near the previous token. Dark-mode tints already clear 4.5:1 on those surfaces and are unchanged. The tints still skip the blue range reserved for root Trace Blue. An empty category shows its icon at 45% opacity. Shell text, links, and focus rings stay graphite or Portfolio Ink.

**The Tinted Neutral Rule.** Never use pure black or pure white. Surfaces and supporting colors stay blue-tinted, following Portfolio Ink's hue at 258.74.

## 3. Typography

**Display Font:** Martian Grotesk, standard width.
**Body Font:** Martian Grotesk, standard width.
**Label/Mono Font:** Martian Mono, Narrow width (`wdth` 87.5).

**Character:** The type system is utilitarian with a technical edge. Martian Grotesk and Martian Mono (Evil Martians, SIL OFL) were drawn together, so metadata and prose share metrics and read as one system. Display text is small for a landing page, metadata is mono and compact, and the hierarchy relies on restraint rather than billboard scale.

**Setup:** `src/styles/fonts.css` loads Latin subsets of both variable fonts from `public/fonts/` (weight axis 300 to 700; width pinned at build time). Both files are preloaded in `BaseLayout.astro`. Regenerate the subsets from the official releases, not from third-party copies, and keep the OFL files beside them.

**Metrics:** Both faces are cap-centered: the space above cap height equals the space below the baseline, so a label sits optically centered in a control with one vertical padding value. Their cap height is 80% of the em, so `size-adjust: 88.1%` matches it to the 70.5% the px sizes were designed around. Change the font sizes, not the `size-adjust`, when adjusting scale.

**Tokens:** `--font-sans`, `--font-mono`, `--weight-display`, `--tracking-display`, and `--tracking-headline` live in `tokens.css`. Martian is wide, so display tracking is tighter than it was for the system font.

### Hierarchy
- **Display** (400, `clamp(24px, 2.6vw, 32px)`, 1.2, `-0.04em`): Index and study page titles. Keep the wording short.
- **Headline** (500, 16px, `-0.02em`): Study titles in the index; 14px on narrow screens.
- **Title** (520 to 560, 13px to 14px, 1.2): Component titles and compact action text.
- **Body** (400, 14px, 1.5): Short descriptions only. Cap long-form copy at 65 to 75 characters per line.
- **Label** (400, 10px to 12px): Metadata, categories, code controls, and interaction IDs. Use tabular numbers for counts and timing.

### Named Rules

**The Small Title Rule.** Do not inflate headings to manufacture drama. Let the interaction preview carry the page.

## 4. Elevation

Elevation is mostly structural, not atmospheric. Default surfaces use thin borders and tonal contrast. Shadows appear only when a state needs physical feedback, such as a button rising on hover or a code frame needing inner depth.

### Shadow Vocabulary
- **Surface Hairline** (`0 1px 2px oklch(0.2 0.006 250 / 0.04)`): A barely visible card lift at rest.
- **Tactile Hover** (`0 14px 28px oklch(0.2 0.006 260 / 0.1)`): Button hover only, paired with a transform.
- **Inset Code Edge** (`inset 0 1px 0 oklch(1 0 0 / 0.035)`): Dark code surfaces only.

### Named Rules

**The State Earns Shadow Rule.** Static decoration does not get shadow. A shadow must explain pressure, lift, or layered code space.

## 5. Components

### Buttons
- **Shape:** Study-specific: `12px` corners on the text swap, `48px`-high pills for hold-to-confirm, and circular chevron controls. All have at least a `44px` target.
- **Primary:** Instrument Ink on Bench Porcelain, used for demo controls and decisive actions.
- **Hover / Focus:** Preserve each demo's documented behavior. Shell navigation uses immediate surface feedback and visible focus; it does not inherit demo motion. Exceptions: the brand mark, and the arrows on the index's "Open study" and the study previous/next links, which reuse the chevron morph study (`MorphArrow.astro`).
- **Text Actions:** Underlined mono labels for Copy and reference links. Navigation uses real anchors. Previous/next links live only at the end of each study.

### Stages
- **Corner Style:** Soft but not plush (`14px`).
- **Background:** Study stages use Paper (Bench Porcelain mixed with 3% of the study's accent) with a full one-pixel Calibration Line border, subtle 10px dots, and top/left rulers from `SpecimenPaper.astro`. Index previews use Specimen Surface with the same 3% mix. Dots and 10/50/100px ticks use the same origin at (40.5, 24.5) CSS pixels; labels every 100px appear only when they fit completely. Rulers are decorative, hidden from assistive technology, and never intercept input. No inner frame or figure caption. The inspector strip uses the same Specimen Surface mix.
- **Shadow Strategy:** None at rest. The stage is a surface, not a card.
- **Size:** `360px` minimum canvas height on desktop, `260px` on narrow screens.
- **Centering:** on desktop the canvas padding (`44px 20px 20px 60px`) centers the demo inside the rulers rather than in the whole canvas, so wide demos don't read as sitting up and to the left. Narrow screens have no side ruler and keep their own padding.

### Inputs / Fields
- **Style:** Minimal underline field with transparent background.
- **Focus:** Border color shifts to Graphite Text. Floating label moves upward and becomes mono.
- **Error / Disabled:** Not yet implemented. Add clear text and border state before adding color-only cues.

### Library Shell (`src/layouts/BaseLayout.astro`)

- **Desktop:** a full-width shell with no top header and a `224px` sidebar anchored to the viewport's left edge, sticky at `20px` with height `calc(100dvh - 44px)`. The brand stays at the top of the sidebar, outside the independently scrolling navigation, with a `36px` mark and `13px` name. Navigation text and the brand sit `20px` from the left edge. The column gap is `48px`; main content starts `44px` from the page top, is centered in the remaining space, and is capped at `900px`. Below `1100px`, the sidebar is `204px` and the column gap is `36px`.
- **Mobile:** at `780px` and below, a `56px` header holds the brand and Studies button. The desktop sidebar is hidden, and the button expands an inline index above the page.
- **Navigation:** `SpecimenNav.astro` groups published studies by category, with `44px` link targets. Planned studies from `planned` in `specimens.ts` follow as compact, non-interactive rows in `--quiet` with a "soon" label; a category with nothing published dims its heading. Studies carry no visible numbers. A study published in the last 14 days (`published` in `specimens.ts`) shows a mono "new" label in Graphite Text where "soon" would sit; `NewLabel.astro` removes an expired label on load, since pages are prebuilt. The desktop sidebar hides its scrollbar and uses a scroll-driven mask: the fade appears only at an edge with more content beyond it. The current link uses `aria-current="page"`, a quiet surface, and ink text, with no side marker.
- **Accessibility:** a skip link leads to the focusable main region. Keep navigation immediate and keyboard-operable.
- **Brand mark (`src/components/Logo.astro`):** the one shell exception to "no demo motion". On pointer hover or keyboard focus of the brand link, the "m" redraws over a `0.12` opacity ghost of itself along its path (`700ms`, `cubic-bezier(0.65, 0, 0.35, 1)`), and the arrowhead slides in `56` viewBox units along the tail at 82% of the draw (`180ms`, `cubic-bezier(0.23, 1, 0.32, 1)`). It plays once per entry and never restarts mid-draw. No motion on touch or with reduced motion. Rejected in exploration: a 3px arrow nudge (too faint to register), and an accent-colored segment running along the curve (spends the motion accent on shell chrome and reads like a loader).

### Collection Index (`src/pages/index.astro`)

A short intro (title, description, byline), then one section per category. Each section opens with a mono heading (category icon and name) over a single Calibration Line; that is the only horizontal rule on the page. Rows inside a section are separated by space alone (`24px` padding each, so `48px` between stages), and sections sit `80px` apart, so a category change reads as a larger break than a row change. The spec sheet has no internal divider: the mono, smaller `dl` already sets the metadata apart from the title and summary. Each row (`SpecimenRow.astro`) puts a stage (Specimen Surface mixed with 3% of the category accent, one-pixel border, `14px` corners, `260px` minimum height) beside a spec sheet at a `1.5fr / 1fr` split with a `32px` gap; below `780px` the sheet stacks under the stage. The sheet's title also links to the study as a pointer shortcut (`tabindex="-1"`, so keyboard users get one stop per row on "Open study"); hovering it shows a faint underline and previews "Open study"'s hover, arrow included. A new study shows the same mono "new" label in `--meta` after its title, outside the heading so the row's accessible name stays the title. Order stays by category, never by date. The sidebar links to each category section.

The stage renders the same component from `previews.ts` used on the study page, at its native size, with the study's input hint in mono at its top left ("Tap…" replaces "Hover…" on touch). Interact with the actual control: hover/focus or tap for label and chevron changes, press and hold to confirm, drag the slider to move the tooltip. No scripted demo playback or duplicate illustrations. The edge-aware tooltip uses the same slider card on both pages: `360px` maximum width, the same padding, border, and positioning logic, shrinking only to fit the available space.

The sheet holds the title (16px, 500), summary, and a mono spec list: Trigger, Duration/Response (with release), and Easing with its curve glyph. `SpecimenDuration.astro` renders the same duration values on the index and study page, including a second line for the confirmation phase when present. The glyph's accent dot follows the demo exactly as on the study page: along the curve over the real duration on hover/focus, linearly while held and back in the release time, 1:1 with the slider. Reduced motion jumps to the end state. `src/scripts/ease.ts` is shared by both.

The only link is "Open study", a text action: a 12px mono label, always underlined in Calibration Line Strong, with a `44px` target. On hover/focus the underline turns Graphite Text immediately, and the trailing chevron slides `2px` while a stem draws out of it to make an arrow, borrowed from the chevron morph study. The icon sits on a 16-unit grid at 16px so the slide lands on whole pixels; the stem moves with the chevron and is revealed with `clip-path` rather than scaled or faded, so its caps keep their shape and nothing peeks past the tip on exit. Enter `180ms`, exit `140ms`, both `cubic-bezier(0.23, 1, 0.32, 1)`. The title is not a link, so each row has one exit.

### Study Page (`src/pages/[slug].astro`)

Each study has a stable root-level URL from its ID. The shared opening is breadcrumb, title and summary, then the demo. A quiet mono toolbar labels the live preview and provides a 44px “Prompt and code” text anchor to `#implementation`, without an arrow. The label names both formats the block offers. The stage contains its applicable inspector, an optional observation, and technical metadata. The article body follows, then references when supplied and previous/next links. Their chevrons morph into arrows on hover/focus like "Open study"; the previous link's glyph is mirrored. The first and last studies link back to the index in the footer.

Write the study as a short article, with left-aligned prose capped at `65ch`, `16px` headings, `14px/1.75` body text, and `16px` between paragraphs. The body starts `48px` after the demo (`36px` on mobile); new sections, figures, and code use `36px` spacing. The demo, figures, and code keep the full content width. Markdown `##` headings render through `StudyHeading.astro`, with a focusable anchor target and a quiet permalink revealed on hover or keyboard focus. Omit heading rails, editorial cards, and repeated accessibility callouts. Explain focus beside hover, reduced motion beside transitions, and practical constraints beside the mechanism they affect.

Content lives in `src/content/studies/{id}.mdx`, validated by `src/content.config.ts`. Frontmatter accepts an optional `observe` sentence and a `references` array of `title`, `url`, and optional `author`. Do not duplicate collection titles, summaries, or timings in the article. The route provides two MDX components:

- `Implementation` renders the complete, copyable source for the current study. Include `<Implementation specimen={props.specimenId} />` exactly once. Put it after the first explanation by default, and move it within the body when the explanation needs another order. Do not paste a separately maintained implementation into the article. Explanatory fenced snippets can accompany the relevant paragraph.
- `Figure` (`StudyFigure.astro`) groups a diagram or secondary demo with a required `caption`. Use `layout="single"` (the default) for one example; use `layout="comparison"` for two examples that demonstrate one decision. Comparison columns stack below `600px`. Import the actual example components into MDX and put them inside the figure. A paragraph is enough when a visual would add no evidence.

Each article chooses its own headings and can interleave prose, figures, imported components, and implementation. References render outside the body in the shared footer, including attribution that previously appeared inside a demo. Keep short articles free of a separate table of contents.

Follow the editorial guidance in `PRODUCT.md`: explain the reusable microinteraction using the roles of its parts. Demo copy is illustrative. Include semantic and accessibility guidance needed to adapt the pattern, without building a product-flow tutorial around an incidental label.

### Signature Component: Specimen Stage (`src/components/SpecimenStage.astro`)

- **Stage:** the live specimen on the calibrated canvas with an input-specific hint.
- **Trace strip:** a labeled range control with a visible thumb and frame ticks, a 2px accent progress track, and a tabular-nums readout. Hover/focus follows the documented timing; hold runs linearly and releases fast. Drag studies expose direct position instead of elapsed time. Reduced motion jumps to the resulting state.
- **Inspection:** dragging the range or pressing arrow keys pauses and seeks the demo's actual CSS transitions. Escape or moving focus away leaves inspection. A short keyboard instruction sits below the stage.
- **Inspection modes:** `inspection` in `previews.ts` is explicitly `timeline`, `position`, or `none`. Choose `timeline` for a seekable transition, `position` for a native range-driven example, and `none` when neither tool explains the behavior. The last mode renders the live demo and metadata without the strip or its instructions. Do not infer the inspector from the trigger.
- **Metadata:** Trigger, Duration/Response, Easing with its live curve glyph, and Animates/Positioning form a four-column row, becoming two columns below `1100px`.
- **Metadata notes:** `SpecNote` uses a Base UI popover beside a label when a choice needs explanation. It opens by click, keyboard, or tap. For the edge-aware tooltip, Response explains the immediate 1:1 updates and Positioning explains anchor alignment and its `clamp()` fallback. Trigger is already explicit, and a separate Easing note would repeat Response.

`src/data/specimens.ts` owns IDs, categories, summaries, and timing. Values must match the demo's CSS. `src/content/studies/` owns the MDX articles. `src/data/previews.ts` maps IDs to demo components, raw source, and inspection modes; the index, sidebar, and routes consume this shared collection. A published specimen without a matching article fails the build.

### Component Source (`src/components/SpecimenCode.astro`)

`SpecimenCode` is exposed to MDX as `Implementation`. It takes the specimen ID and resolves `source`, `filename`, and `includeScript` from the preview registry; never maintain a separate demo snippet. Its heading owns `#implementation`, with a format label below. `src/data/source.ts` derives minimal HTML, CSS, and (when the effect requires it) JavaScript from the live component. The build-time `interaction-source` Vite plugin converts TypeScript inside raw component imports to browser JavaScript. Show only component markup, without stylesheet or script imports. CSS uses direct light-theme values and scoped base rules; keep focus and reduced-motion support, but omit dark-mode setup. Text swap and Chevron morph export HTML/CSS only: their JavaScript simulates hover on touch in the gallery. Exclude inspector selectors and gallery presentation; the edge-aware tooltip renders and exports `EdgeAwareSlider.astro` directly. Use system typography so snippets need no gallery assets.

Use build-time syntax highlighting with tinted OKLCH colors on the dark code surface. `src/styles/code-theme.ts` maps grammar scopes to `--code-*` roles (tag, attribute, string, function, keyword, number, plus text and muted neutrals). `src/styles/code.css` defines those roles for both the implementation frame and MDX code excerpts. The frame has `12px` corners, `24px` code padding, and a scrollable region capped at `380px`. Language tabs, Edit on CodePen, and Copy share one bar; the actions wrap together on narrow screens. Omit Wrap, Expand, filenames, and line counts. Tabs support arrow keys, Home, and End; Copy copies only the active section, gives stable-width feedback, and announces each result, including repeated copies. If clipboard access fails, select that section’s code and explain the device Copy command and keyboard shortcut. Edit on CodePen submits all source sections through a native form to the prefill API, with the study title and canonical URL, and opens a new tab. Before hydration, native radios select every source section through CSS, and CodePen remains usable. Copy reserves its space but stays hidden until it works. Base UI enhances the language selector after hydration, preserving an existing selection and focus. Integration advice belongs in the article beside the code, without a separate panel footer. Framework variants should be complete, verified implementations before they appear as options.

`reducedMotion` in the preview registry controls the exported fallback: `instant` adds a scoped transition reset; `component` keeps the component's own reduced-motion rules. Text swap uses `component` for an opacity-only fade, with immediate keyboard focus and no press scale. Its label layers are excluded from the gallery's blanket transition reset. Hold-to-confirm also uses `component`: reduced motion preserves the linear fill as a time indicator and removes press scaling, confirmation transitions, and animated reset. Edge-aware tooltip uses `component` because `transition-property: none` keeps input tracking immediate for every motion preference, without an additional exported reset. Prefix local snippet variables with the component name, such as `--swap-bg`, so they do not collide with global tokens during export.

Optional Tailwind variants live as complete components in `src/components/tailwind/` and are registered as raw `tailwindSource` in `previews.ts`. Put shared colors and easing curves in an `@theme` block inside `<style is:global>`; `tailwindSourceFiles` exposes markup and theme as HTML and CSS tabs, plus the CSS implementation's script when the study has one; keep the variant's data hooks identical so that script drives both. Verify their behavior against the CSS implementation before exposing them. Tailwind HTML wraps to the code panel's width; avoid standalone lines for attribute quotes and short label elements. Copy preserves the source rather than its visual wrapping. A compact pill-shaped CSS / Tailwind toggle beside Implementation uses native radios with 44px targets and visible keyboard focus. Its ink thumb slides on pointer selection (180ms, `cubic-bezier(0.23, 1, 0.32, 1)`); keyboard selection and reduced motion skip the transition. Source panels always switch immediately. Each format retains its own language tabs, Copy, and CodePen form. CodePen includes the browser runtime and wraps the theme in `<style type="text/tailwindcss">`, while copied code assumes Tailwind CSS v4 is installed. The native format selector works without JavaScript and sets the same layout before and after hydration; implementations do not collapse after first paint.

A study with a `prompt` in its MDX frontmatter shows Prompt as the first, default format, before CSS and Tailwind. `src/data/prompt.ts` writes the Timing section from `specimens.ts` so it matches the demo; task, behavior, accessibility, and avoid items come from the frontmatter. A study with several phases, such as hold, confirmation, and release, writes its own `timing` lines instead; the build fails if they omit any duration from `specimens.ts`. Write them as decisions with exact values, using role names rather than demo copy. The prompt renders as wrapped plain text with Copy only, without CodePen.

## 6. Do's and Don'ts

### Do:
- **Do** use OKLCH values for all new colors and keep neutrals tinted toward Portfolio Ink's hue at 258.74.
- **Do** add every new interaction to the shared metadata and preview registry, with accurate timing and its own study page. Verify the same live component fits its index row.
- **Do** animate transform and opacity for motion. Keep timing tactile with `cubic-bezier(0.19, 1, 0.22, 1)`.
- **Do** keep copy short enough that the preview remains the object of attention.
- **Do** use full borders, tonal backgrounds, and spacing to separate surfaces.
- **Do** preserve keyboard and reduced-motion behavior for every demo.

### Don't:
- **Don't** use SaaS landing-page spectacle, dense gallery grids with filter chips, neon-on-black motion demos, glassmorphism, or gradient text. The index is a list of rows, not a grid.
- **Don't** add decorative side-stripe borders, oversized metric blocks, or repeated icon-heading-text cards.
- **Don't** use bounce or elastic easing. This gallery is tactile, not toy-like.
- **Don't** hide code behind decorative chrome. Code is part of the artifact.
- **Don't** add pure black or pure white, including in icons, backgrounds, and code surfaces.
