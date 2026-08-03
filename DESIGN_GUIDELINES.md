# Provider+ Design Guidelines

Source of truth: brand tokens extracted directly from the production CSS at
[providerplus.com.au](https://www.providerplus.com.au/) (Webflow site,
verified 2026-08-03). This document translates those tokens into rules for
anything built in this project, and says how to use the two design skills
installed here (`frontend-design`, `ui-ux-pro-max`) without drifting off-brand.

## Brand in one sentence

Provider+ helps NDIS disability service providers with registration,
compliance, and audits — professional and expert, but warm and human, never
cold-corporate or jargon-heavy. Visually: a **warm neutral (not white) base**,
a confident **navy + sky-blue** system, and a **light-weight serif** for
headings that keeps things feeling considered rather than "SaaS template."

## Color system

All values are the brand's actual hex codes. Use the **semantic name** in
code (it maps to the raw token in parentheses) so intent stays legible.

### Surfaces
| Semantic role | Hex | Raw token | Usage |
|---|---|---|---|
| `background-primary` | `#EFECE9` | `brand--beige` | Default page background. **Not white.** |
| `background-secondary` | `#F6F4F2` | `brand--beige-light` | Secondary panels, alternating sections |
| `background-white` | `#FFFFFF` | — | Cards/forms that need to pop off the beige base |
| `background-alternate` | `#0E2439` | `brand--dark-cyan-blue` | Dark sections (footer, contrast band, quote sections) |
| `background-light` | `#CAEDF1` | `brand--light-grayish-cyan` | Soft highlight blocks |
| `beige-darkest` | `#DED9D2` | — | Borders/dividers on beige surfaces |

### Action / brand blue
| Semantic role | Hex | Raw token | Usage |
|---|---|---|---|
| `background-tertiary` (primary CTA fill) | `#3D7DCA` | `brand--blue` | Primary buttons, links, active states |
| `cyan-blue-hover` | `#276DD4` | — | Button hover |
| `cyan-blue-press` | `#185FC6` | — | Button active/pressed, also the button's 1px border |
| `dark-cyan-blue-hover` | `#28435C` | — | Hover state on dark-navy buttons |
| `dark-cyan-blue-press` | `#405C77` | — | Pressed state on dark-navy buttons |

### Accent
| Semantic role | Hex | Raw token | Usage |
|---|---|---|---|
| `background-quaternary` / `text-secondary` | `#FFAA62` (bg) / `#F08021` (text) | `brand--orange` | Sparingly — highlight chips, stat callouts, secondary emphasis text |
| `brand--pink` | `#F38E8B` | — | Rare accent, illustrative/decorative only |
| `brand--bronze` | `#D6B59F` | — | Rare accent, warm decorative fill |

### Text
| Semantic role | Hex | Usage |
|---|---|---|
| `text-primary` | `#0E2439` (dark navy) | Body copy and headings — **never pure black** |
| `text-secondary` | `#F08021` (orange) | Emphasis words, kickers, small labels |
| `text-tertiary` | `#3D7DCA` (blue) | Links inline in body text |
| `text-alternate` | `#FFFFFF` | Text on the dark-navy `background-alternate` surface |

### System (functional, use only for real states)
| Role | Hex |
|---|---|
| Success | `#027A48` on `#ECFDF3` |
| Error | `#B42318` on `#FEF3F2` |

### Rules
- Default surface is **warm beige (`#EFECE9`)**, not white. This is the single most identity-carrying color decision on the real site — don't default to `#FFFFFF` page backgrounds.
- Body/heading text is **dark navy (`#0E2439`)**, not black (`#000`/`#111`).
- Reserve orange for small, deliberate emphasis — it's a seasoning, not a base color. If more than ~10% of a screen is orange, pull it back.
- Maintain WCAG AA contrast: navy text on beige and white passes easily; white text only on the dark-navy surface or the blue button fill, never on beige or orange directly for body copy.

## Typography

The live site uses two **licensed, paid fonts** you likely don't have a
license for. Match the *character* of each with a free equivalent rather than
substituting something generic like system-ui.

| Role | Brand font | Character | Free substitute |
|---|---|---|---|
| Headings | **Ivy Presto** (Colophon Foundry) | Light-weight (300), high-contrast serif, elegant and airy, never bold-heavy | **Fraunces** (light/optical size "soft"), or **Canela**-alike **"Petrona"** / **Playfair Display** at weight 300 |
| Body | **Acronym** (Colophon Foundry) | Clean geometric/grotesk sans, warm not clinical | **Inter**, **General Sans**, or **Switzer** |

### Scale (as shipped, rem-based, `line-height: 1.2`)
- H1: `4rem`–`4.125rem`, weight **300**
- H2: `3.5rem` desktop / `2.75rem` compact, weight **300**
- H3: `2.5rem`, weight **300**

Keep headings light-weight even at large sizes — this is deliberate on the
real site and is what keeps a navy-and-blue palette from reading corporate.
Body copy weight is regular (400); use 600 only for buttons/labels.

## Spacing & layout

- Page gutter: `2.5rem` (`padding-global`)
- Content container max-width: `82rem`, centered
- Section vertical rhythm: small sections `3rem` top/bottom, standard sections `4rem`, hero/feature sections up to `6rem`
- Generous whitespace between sections is a brand trait — don't compress density to fit more above the fold.

## Shape & elevation

- Border radius scale: `xxsmall .25rem` · `xsmall .5rem` · `small .75rem` · `regular 1rem` · `xlarge 1rem–2.5rem` for hero/feature cards
- Buttons use `xsmall (.5rem)` radius — soft but not pill-shaped
- Button shadow: `0 4px 8px rgba(14,36,57,0.16)` (navy at 16% opacity) — shadows are tinted navy, not neutral gray
- Buttons also carry a subtle `text-shadow` for legibility on the blue fill — a nice-to-replicate detail, not mandatory

## Components

**Primary button**: solid `background-tertiary` (#3D7DCA) fill, 1px border in `cyan-blue-press` (#185FC6), white text, weight 600, `.75rem–1rem` vertical / `1.25rem–1.5rem` horizontal padding, `.5rem` radius, navy-tinted shadow, `background-color` transition `.32s ease-out` on hover to `#276DD4`.

**Secondary action**: text link in `text-tertiary` blue, no button chrome.

**Cards**: white or `background-secondary` beige-light fill on the beige page background, `regular`–`xlarge` radius, minimal/no border — separation comes from the background-color contrast against the page, not from heavy borders.

**Dark sections**: full-bleed `background-alternate` navy band with `text-alternate` white text — used for contrast breaks (testimonials, closing CTA, footer), not as the default.

## Imagery & iconography

- Photography: real people, warm and human — team headshots with names/titles, not stock-corporate handshake photos
- Icons: minimal SVG line icons (checkmarks, shields, speech bubbles, hands) — no emoji as icons, no skeuomorphism
- Trust signals matter to this brand (ratings, provider counts, audit success rates) — treat stat callouts as first-class content, not an afterthought

## Voice

Professional and expert without jargon. Reassuring, not salesy. Language
leans on trust ("market leaders," "decades of experience"), support ("we take
the headache out"), and community. Avoid AI-generic phrasing (no purple
gradients, no "unlock/leverage/seamless" copywriting clichés) — this pairs
directly with `frontend-design`'s instruction to avoid templated defaults.

## How to use this with the installed skills

- **`frontend-design`**: use it for aesthetic judgment calls — hero composition, taking one deliberate risk — but every color/type/spacing decision it proposes must resolve to a token in this file. If it suggests something outside this palette (e.g. a purple gradient, pure-black text, pure-white background), override it with the Provider+ equivalent above.
- **`ui-ux-pro-max`**: use its style/palette/font-pairing database and stack-specific component guidance for implementation (React/Next/Vue/etc.), but seed it with *this* palette and font pairing rather than letting it pick its own — treat this file as the constraint layer, ui-ux-pro-max as the execution layer.
- When in doubt: warm beige over white, navy over black, light-weight serif headings, blue as the one confident action color, orange used sparingly.
