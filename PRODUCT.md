# Product

## Register

brand

## Users

Frontend engineers, design engineers, and product designers use this site as a compact reference gallery for small UI behaviors. They are likely browsing during implementation or critique, looking for motion and interaction patterns that feel tactile without needing a full component library or tutorial.

## Product Purpose

Microinteractions Gallery is a browsable library of sensory UI behavior studies. It exists to show how small states, timing curves, and UI controls can make otherwise ordinary interface elements feel more precise, responsive, and memorable. Success means visitors can find a relevant study, understand its behavior, inspect its timing, and take its implementation into a project.

## Site Structure

- The home page is a single column of bench rows. Each row pairs the actual interactive component with a short spec sheet: title, summary, trigger, duration, and easing, plus an explicit "Open study" link. Controls behave as they do on the study page, and the easing glyph traces the demo as it runs. Categories based on what the person is doing (Actions, Navigation, Values…), plus Feedback for what the interface answers with, organize the sidebar. The index and previous/next links follow category order, so keep `specimens` grouped by category.
- Every study has a stable root-level slug, such as `/text-swap`, and reads as a short interactive article. A shared opening provides the title, summary, live preview, relevant inspector, and a direct link to the implementation. Each study composes its own body from prose, figures, comparisons, code, and interactive examples. Keep the complete implementation close to the first explanation by default; the article chooses its position. An optional sentence below the demo points out something worth trying. Explain keyboard behavior, reduced motion, and integration advice beside the mechanism they affect. References and credits appear at the end when supplied.
- A shared sidebar exposes the collection and marks the current page. On narrow screens it becomes an inline, expandable index.
- Previous/next links connect studies in collection order. Each page also links back to the index.
- Navigation lists published studies, plus planned studies and empty categories as unavailable rows marked "soon". Adding a study updates the index, sidebar, and route generation from shared data.
- Article bodies live in one MDX file per study. Collection metadata stays in `src/data/specimens.ts`; live components, source, and inspection modes stay in `src/data/previews.ts`. Shared article tools provide consistent presentation without prescribing every study’s headings or length.

## Brand Personality

Precise, restrained, tactile. The voice should feel like a design engineer's bench notebook: quiet enough to keep focus on the interaction, specific enough to teach taste, and confident enough to avoid generic UI decoration.

## Writing the Studies

Each study teaches a reusable microinteraction. Demo labels, values, and scenarios give the behavior something concrete to work with; they do not define its use case. Describe the moving parts by their role, such as the current label, next label, or confirmation state. Quote sample copy only when its wording or dimensions explain a decision.

Keep integration advice focused on adapting the behavior. Do not turn incidental labels into tutorials for downloads, bookings, or other product flows. Explain semantic HTML, keyboard behavior, touch, and reduced motion where they affect the interaction. Distinguish gallery-only preview controls from the behavior someone should ship, and keep essential information available without hover or animation.

## Anti-references

Avoid SaaS landing-page spectacle, dense filterable gallery grids, neon-on-black motion demos, glassmorphism, gradient text, gamified bounce effects, and heavyweight documentation sites that bury the actual interaction. Avoid treating code as secondary decoration; the craft lives in the behavior and the snippet together.

## Design Principles

1. Let the interaction lead. The preview should be the primary object, with metadata and chrome receding until needed.
2. Teach through restraint. Use short labels, the actual implementation, and brief author notes that explain the decisions behind visible state changes.
3. Make motion feel physical, not playful. Easing should be decisive and tactile, never bouncy or elastic.
4. Preserve the lab bench. Surfaces should feel clean, quiet, and durable so each microinteraction can be compared fairly.
5. Keep code close to behavior. Each study exposes minimal HTML, CSS, and JavaScript only when the effect needs it, derived from the live component. Include the necessary styles with direct values; omit gallery setup, themes, imports, and inspector code. Copy acts on the selected tab. Keep the code region scrollable and its chrome limited to language tabs, Edit on CodePen, and Copy. Edit on CodePen opens a new editor with all the implementation sections and a link back to the study. A study can also offer a Prompt format: the same decisions written for an AI coding assistant to rebuild the behavior in another stack. It complements the code and never replaces it.

## Accessibility & Inclusion

Respect reduced-motion preferences, keep controls keyboard-accessible, and maintain clear focus states. Contrast should meet WCAG AA for body text and interactive labels. Demo interactions should remain understandable without hover, animation, or color alone.
