---
name: Academic Escalation Referee System
colors:
  surface: '#fff8f7'
  surface-dim: '#ffced3'
  surface-bright: '#fff8f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff0f1'
  surface-container: '#ffe9ea'
  surface-container-high: '#ffe1e3'
  surface-container-highest: '#ffd9dd'
  on-surface: '#400012'
  on-surface-variant: '#5b4041'
  inverse-surface: '#5e1425'
  inverse-on-surface: '#ffeced'
  outline: '#8f6f70'
  outline-variant: '#e3bdbf'
  surface-tint: '#bb0f3a'
  primary: '#95002a'
  on-primary: '#ffffff'
  primary-container: '#be123c'
  on-primary-container: '#ffd0d2'
  inverse-primary: '#ffb2b7'
  secondary: '#b90538'
  on-secondary: '#ffffff'
  secondary-container: '#dc2c4f'
  on-secondary-container: '#fffbff'
  tertiary: '#8b1b34'
  on-tertiary: '#ffffff'
  tertiary-container: '#ab354b'
  on-tertiary-container: '#ffd0d3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdadb'
  primary-fixed-dim: '#ffb2b7'
  on-primary-fixed: '#40000d'
  on-primary-fixed-variant: '#920029'
  secondary-fixed: '#ffdadb'
  secondary-fixed-dim: '#ffb2b7'
  on-secondary-fixed: '#40000d'
  on-secondary-fixed-variant: '#92002a'
  tertiary-fixed: '#ffdadc'
  tertiary-fixed-dim: '#ffb2b9'
  on-tertiary-fixed: '#400010'
  on-tertiary-fixed-variant: '#891933'
  background: '#fff8f7'
  on-background: '#400012'
  surface-variant: '#ffd9dd'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
  stat-counter:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies an authoritative yet empathetic academic mediation environment powered by advanced machine intelligence. It balances high-stakes institutional precision with an approachable, humane interface designed to de-escalate academic friction, clarify course syllabus disputes, and arbitrate student requests with absolute transparency.

### Design Movement & Aesthetic
The interface adopts an **Architectural Bento-Grid & Modern Tactile Glass** aesthetic:
- **Modular Bento Architecture:** Content is structured into weighted, asymmetric card clusters that map out multifaceted triage flows: real-time AI syllabus cross-referencing, multi-stage appeal tracking, and confidence scoring.
- **Warm Institutional High-Tech:** Moving away from cold clinical grays or sterile enterprise blues, the interface leverages an intentional chromatic palette of mineral peach, coral, and deep ruby. It projects warmth, equity, and judicial seriousness.
- **Precision Micro-Details:** Delicate hairline boundaries (1px subtle borders with warm translucent alpha), controlled surface blurs, and soft radial depth elevate the platform beyond conventional education dashboards.

## Colors

The color system relies on high deliberate contrast between warm, luminous background planes and deep, authoritative ruby foregrounds, ensuring WCAG AAA legibility across academic documents, telemetry cards, and multi-tier escalation stages.

### Surface System
- **Canvas Base (`#FFF8F9`):** A soft rose-blush off-white that minimizes screen glare during prolonged review sessions while feeling tactile and inviting.
- **Card Base (`#FFFFFF`):** High-clarity white surfaces paired with subtle tinted stroke outlines (`rgba(190, 18, 60, 0.08)`) to maintain component separation on dense bento boards.
- **Muted Structural Tint (`#FFE4E6`):** Soft rose quartz used for secondary module backdrops, badge foundations, and contextual callout panels.

### Semantic & State Tints
- **Primary Ruby (`#BE123C`):** Used for decisive institutional actions, critical status indicators, active tabs, and primary button triggers.
- **Vibrant Coral (`#F43F5E`):** Represents algorithmic actions, AI recommendation prompts, and highlighted escalation paths.
- **Rose Accent (`#FB7185`):** Reserved for trend indicators, data visualization highlights, and intermediate tags.
- **Deep Velvet Maroon (`#4C0519`):** Primary text and structural line work, providing readable contrast against blush surfaces.
- **Success (`#047857`):** Resolution confirmed, syllabus guideline compliant.
- **Warning (`#B45309`):** Deadline approaching, manual referee review required.
- **Informational / Neutral Outline (`rgba(76, 5, 25, 0.12)`):** Precision borders across inactive bento modules.

## Typography

The dual-type strategy pairs the technical, engineered geometry of **Space Grotesk** with the balanced, humanist clarity of **Plus Jakarta Sans**. 

- **Space Grotesk** handles high-impact anchor points: metric counters, arbitration status headlines, confidence scores, and section identifiers. Its engineered proportions provide an algorithmic edge that emphasizes system rigor.
- **Plus Jakarta Sans** grounds long-form case narratives, student statements, clause comparisons, and fine metadata. It remains effortlessly legible in dense legal and course policy citations.
- **Numeric & Metric Display:** Metric panels utilize tabular lining numerals alongside tight tracking (`-0.03em`) to anchor dashboard scanning.

## Layout & Spacing

The architecture operates on an adaptive 12-column Bento Grid structure. Cards are calculated in deliberate span clusters (e.g., 8-col analysis terminal paired with 4-col evidence audit; 4-4-4 triage metric spread).

### Breakpoints & Adaptive Rules
- **Desktop (≥ 1280px):** 12-column dynamic bento configuration. `margin: 2rem`, `gutter: 1.5rem` or `2rem`. Complex cards span across 4, 8, or 12 units with full interactive previews side by side.
- **Tablet (768px – 1279px):** 8-column flattened grid. Secondary widgets tuck into collateral swipeable decks or stacked 4-col pairs; `margin: 1.5rem`, `gutter: 1rem`.
- **Mobile (< 768px):** Single-column stacked stream. Bento modules convert into vertically sequential cards with unified horizontal padding; `margin: 1rem`, `gutter: 1rem`.

### Internal Rhythms
All bento containers maintain minimum internal padding of `space-lg` (24px) to retain breathing room around high-density case data, status tags, and AI inference summaries.

## Elevation & Depth

Visual hierarchy is maintained through subtle ambient occlusion rather than heavy drop shadows, paired with crisp translucent hairline boundaries.

### Layer Stack Architecture
1. **Level 0 (Canvas Base):** Solid tinted background (`#FFF8F9`).
2. **Level 1 (Bento Tile Default):** Solid `#FFFFFF` fill with a tinted outer border (`1px solid rgba(190, 18, 60, 0.08)`) and an ultra-diffused blush shadow:
   `box-shadow: 0 4px 20px -2px rgba(190, 18, 60, 0.04), 0 2px 6px -1px rgba(76, 5, 25, 0.02)`.
3. **Level 2 (Active / Hover / Interactive Focus):** Elevated module state.
   `box-shadow: 0 12px 32px -4px rgba(190, 18, 60, 0.08), 0 4px 12px -2px rgba(76, 5, 25, 0.04)`. Border shifts to `rgba(190, 18, 60, 0.18)`.
4. **Level 3 (Overlays, Floating Action Referees, Dropdowns):** Translucent white with backdrop filter (`rgba(255, 255, 255, 0.88)` with `backdrop-filter: blur(16px)`), framed with `1px solid rgba(190, 18, 60, 0.14)`.
   `box-shadow: 0 20px 40px -8px rgba(76, 5, 25, 0.12)`.

## Shapes

The geometric vocabulary prioritizes soft, organic contours that counterbalance the rigorous academic nature of the platform.

### Curvature Tokens
- **Bento Modules & Master Containers:** `rounded-xl` (24px). Creates distinct modular grouping without visual harshness.
- **Nested Structural Elements & Input Controls:** `rounded-lg` (16px). Used for policy citation blocks, inner insight clusters, and rich text fields.
- **Buttons, Tags, Badges & Micro-Pills:** Fully rounded pill style (`9999px`) for quick scanning, high touch-target affordance, and distinction from the rectangular bento containers.

## Components

### Buttons
- **Primary Action (Adjudicate, Submit Ruling):** Solid Crimson Ruby (`#BE123C`), text in pure white (`#FFFFFF`), bold font (`label-lg`), pill shape (`rounded-full`), padded `12px 24px`. Subtle transition on hover with an ambient glow (`box-shadow: 0 6px 20px rgba(190, 18, 60, 0.25)`).
- **Secondary (Delegate, Request Syllabus Audit):** Muted rose quartz tint (`#FFE4E6`) with ruby foreground (`#BE123C`). Borderless or `1px solid rgba(190, 18, 60, 0.12)`.
- **Ghost Action:** Borderless, neutral maroon typography (`#4C0519`) with a soft rose background on hover (`rgba(254, 226, 226, 0.5)`).

### Bento Cards & Modular Tiles
- **Standard Module:** Background `#FFFFFF`, border `1px solid rgba(190, 18, 60, 0.08)`, radius `24px`, padding `24px`. Top banner holds uppercase category metadata (`label-caps`) and action overflow.
- **AI Synthesis Highlight Card:** Subtle radial wash gradient overlay from `rgba(251, 113, 133, 0.06)` to transparent `#FFFFFF`, accented with an internal coral badge.

### Status Pills & Classification Badges
- **Pill Geometry:** Height `26px`, padding `2px 12px`, radius `9999px`, typography `label-caps`.
- **Status Escalate Tier 1:** Grounded rose quartz background (`#FFE4E6`), text `#BE123C`.
- **Status Auto-Resolved:** Muted emerald tint (`rgba(4, 120, 87, 0.1)`), text `#047857`.
- **Status AI Flagged / Syllabus Breach:** Soft coral wash (`rgba(244, 63, 94, 0.12)`), text `#E11D48`.

### Input Fields & Search Bars
- **Case Intake Field:** Background `#FFF8F9`, border `1.5px solid rgba(190, 18, 60, 0.12)`, radius `16px`, height `48px`, font `body-md`.
- **Focus State:** Background `#FFFFFF`, outline/stroke `1.5px solid #BE123C`, subtle outer ring (`box-shadow: 0 0 0 4px rgba(190, 18, 60, 0.1)`).

### Selection Controls (Checkbox & Radios)
- **Checkboxes:** 20px box, `radius: 6px`. Inactive has a subtle border (`rgba(76, 5, 25, 0.2)`). Checked fills with `#BE123C` carrying a crisp white vector checkmark.
- **Radio Buttons:** Outer 20px circle, active state features a `#BE123C` rim with an inner 8px solid crimson nucleus.

### Specialized Academic Components
- **Clause Matching Diff Viewer:** Split-panel nested card comparing the student's submission text against the official syllabus clause, with AI-detected discrepancies highlighted in soft coral underlines and confidence percentage badges.
- **AI Confidence Gauge:** Bento-fitted progress arc or micro-counter using `stat-counter` typography paired with an annotated certainty tier (e.g., "98.4% Policy Alignment").