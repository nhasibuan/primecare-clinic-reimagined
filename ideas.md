# Reference-Led Design Specification

## Ground-truth reference

The visual and structural reference is `https://primecareclinic.co.id/`. The implementation will echo its clean, white, family-clinic character: a narrow white header with a teal appointment control, a broad photographic campaign hero, a rounded teal reassurance ribbon, a service-led editorial section, image-forward care cards, a teal testimonial-style section, a three-column health-journal row, and a full-width teal location footer. This website will be built from fresh React and CSS source and will use original, paraphrased copy; it will not reproduce the reference site’s text, testimonials, or business claims.

## Chosen approach: Calm Clinical Editorial

### Design Movement

Reference-faithful healthcare editorial design with the generous whitespace, asymmetric image blocks, light turquoise accents, and composed card rhythm of contemporary private-clinic websites.

### Core Principles

1. **Reassuring precision:** clinical information is easy to scan, while the visual language remains warm and human.
2. **Soft coastal clarity:** white space, sea-glass teal, warm ivory, and quiet shadows keep the page airy rather than corporate.
3. **Image-led care paths:** each major service is communicated with a photograph, a concise premise, and an unambiguous next action.
4. **Responsive calm:** the desktop site uses editorial columns and ribbons; the mobile site becomes a simple, touch-friendly care journey.

### Color Philosophy

The signature color is a clear **clinic teal** (`#039CB7`), used as an action color rather than as wall-to-wall decoration. Bright white establishes hygiene and clarity, while mist blue and warm sand prevent the interface from becoming sterile. Dark blue-grey typography carries clinical authority without the severity of black.

### Layout Paradigm

The home page is a linear care journey rather than a centralized card grid. It progresses from immediate help, to service choice, to care environments, to trust and learning, and finally to local access. The top appointment bar and benefit ribbon act as connective tissue between large editorial blocks.

### Signature Elements

1. A pill-shaped turquoise reassurance strip with four icon-led care promises.
2. Thin turquoise rule accents beneath navigation and editorial headlines.
3. Soft-bordered image panels that overlap against bright, open space.

### Interaction Philosophy

Navigation scrolls the visitor to care sections, appointment buttons open a short confirmation toast, and service cards reveal a compact directional cue on hover. Interactions should feel immediate and restrained, never decorative for their own sake.

### Animation

Use short `transform` and `opacity` transitions only: image cards lift slightly on hover, buttons compress subtly on press, and sections rise into view with a small, staggered fade when motion is permitted. Honor reduced-motion preferences.

### Typography System

Use **DM Sans** for practical body copy and controls, paired with **Lora** for soft, editorial section headlines. The hierarchy favors compact uppercase labels, confident 48–60px display titles on desktop, and a calm 16–18px reading size.

### Brand Essence

An approachable family-care destination for people who want expert guidance without an intimidating clinical experience. Personality: **assured, attentive, calm**.

### Brand Voice

Headlines are clear, gently optimistic, and centered on the care journey rather than medical superlatives. CTAs use specific invitations rather than generic promotional language.

Example lines: “A clearer route to everyday health.” and “Choose the care that fits your family today.”

### Wordmark & Logo

Use the publicly available Primecare logo asset specified by the user in the header and footer, with an independently generated abstract teal care-mark used only as a favicon and visual motif. The mark is a small orbiting-leaf symbol that suggests connection and continuity without duplicating the source mark.

### Signature Brand Color

**Clinic teal — #039CB7.**

## Content and integrity constraints

- All visible marketing copy will be paraphrased and newly written in English.
- Do not reproduce or fabricate patient testimonials, star ratings, reviews, medical outcomes, named doctors, operating hours, pricing, or licensed-services claims.
- Publicly available imagery may be used as requested, but the hero will use an original generated image so the lead visual is not a direct copied campaign graphic.

## Style Decisions

- **Image direction:** All imagery will remain warm, daylight-led, human, and editorial. Cold blue technical imagery is excluded from key layouts so the page sustains a family-clinic atmosphere.
- **Teal discipline:** Clinic teal is restricted to primary actions, reassurance systems, thin editorial rules, and major brand bands. White, mist blue, warm ivory, and navy carry the everyday page atmosphere.
- **Brand motif:** The orbiting-leaf care mark, slim teal rules, and rounded reassurance geometry recur subtly across hero, editorial, and footer treatments to form an ownable visual system.
