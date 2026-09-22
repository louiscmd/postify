# Style analysis of the reference posts

All measurements are on the 1080 × 1350 canvas. These rules are encoded in [`src/presets/index.ts`](src/presets/index.ts) (text styles) and [`src/presets/templates.ts`](src/presets/templates.ts) (positions).

---

## 1. Editorial Serif

*References: "Teaching Her / PERSONAL BRANDING", "exposed", "I've shown how to:", "comment "WIFEY"", "HOW TO BUILD A… Personal Brand THAT PRINTS IN 2026", "01. Discover Your Niche", "02. Define Core Values"*

| Element | Font | Size | Details |
|---|---|---|---|
| Title | DM Serif Display (heavy high-contrast serif) | 130–170 px | line-height 0.92, tracking −0.015em. Spans ~85 % of the width on covers |
| Subtitle | Archivo 700, UPPERCASE | ~46 px | Sits directly under the title (≈ 0 gap), flush with the title's left edge, forming a tight lockup |
| Pre-/post-title | Archivo 700, UPPERCASE | ~44 px | Pre-title is left-aligned above the title. Post-title is **right-aligned to the title's right edge** |
| Script number | Sacramento | ~112 px | "01.", "02." above the section title |
| Body | Be Vietnam Pro 300, bold keywords 700 | ~38 px | line-height 1.5. Narrow column (~50 % width) on the side away from the subject. Justified in the "exposed" variant |
| List | Be Vietnam Pro 400 / 700 | ~40 px | line-height 1.6. Bullets start ~20 px right of the heading. The heading hugs the left edge (x ≈ 18) |
| CTA | Archivo 700 small lines + serif UPPERCASE keyword in quotes | 36 / 112 px | Centred stack in the top-left area |

- **Shadow:** soft and wide (blur ≈ 24 px, ~45 % black). The text looks like it glows off a dark photo, with no visible outline.
- **On bright backgrounds** (fog, sky): dark green text `#1b2a22` with no shadow.
- **Placement:** almost always the top third, with 70–100 px margins. The person occupies the lower two thirds.
- **Decorations:** a thin white hand-drawn arrow under the title pointing into the photo, a red loop arrow beside the text block, and inset photos with ~30 px rounded corners.

## 2. Story Highlight

*References: "most ppl USE AI FOR CONTENT", "It has no idea", "Jovan tried harder…", the chips slides, "If ur output sounds like AI…"*

| Element | Font | Size | Details |
|---|---|---|---|
| Kicker | Arimo (Arial/Helvetica) 400 | ~48 px | Lowercase ("most ppl") |
| Headline | Arimo 700, UPPERCASE | ~80–88 px | line-height 1.0, thin purple underline stroke beneath |
| Split sub-line | Arimo 400 | ~36 px | Split left/right so it flows around the subject's head |
| Body / bullets | Arimo 400, bold 700 keywords | ~35 px | line-height 1.32. Blocks separated by blank lines. Left margin ~75 px, top of frame |
| Highlight | purple box `#4b1a6e`, radius ~6 px | – | White text with no shadow. Used as a label ("It has no idea") and on sentence endings |
| Chips | light grey pills (92 % white), dark text | ~34 px | Centred rows with 40–50 px gaps |
| Bottom caption / CTA | Arimo 400/700, centred | 36–40 px | Over a black gradient covering the bottom ~35 % |

- **Shadow:** hard and short (2 px offset, ~5 px blur, 80 % black).
- **Extras:** a screenshot inset in the middle and a curved purple arrow.

## 3. Split Screen

*References: "hashtags? doesn't matter / posting times? also doesn't matter", "views come down to one single thing: / watch time and a good hook", "a viewer watches your whole video? / viewers scroll in 2 seconds?", "BUT your explore page… / so study the videos…", "comment "ZERO""*

- **Layout:** two photos stacked, each 1080 × 675, with no gap or border.
- **Text:** Montserrat 700 at ~46 px, white, centred, mostly lowercase with occasional CAPS emphasis ("BUT", "YOU"). One or two lines per half.
- **Position:** the optical centre of each half (y ≈ 337 and 1012). Top = claim/question, bottom = answer, read like a dialogue. "→" marks a conclusion.
- **Shadow:** barely visible (1 px / 4 px blur, 35 %).
- **CTA slide:** a single photo with a bottom gradient. Montserrat 300 with **bold** keywords, short centred paragraphs separated by blank lines in the lower third.

---

## Placement tips (manual mode)

The tips panel analyses each photo exactly as it is cropped on the slide:

1. It renders the crop at low resolution and measures **brightness** and **edge density** (busyness) on a grid.
2. It scores the top, middle and bottom bands. The calmest band is suggested for text, with a slight bias toward the top, because hooks read top-down and Instagram's UI covers the bottom.
3. For every text block it checks the contrast ratio against the pixels behind it, taking gradients and dimming into account. It also checks busyness (faces and objects) and whether the block breaks the safe margin or the 3:4 profile-grid crop.
4. It offers fixes: switch to dark or light text, add a gradient, add a shadow, move to the calm zone, or nudge the block back inside the margins.
