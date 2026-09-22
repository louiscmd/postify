# Postify

Postify is a web tool for making Instagram carousel posts (4:5, 1080×1350), with a dark, soft-red interface in Polish.

It has two modes:

- **Tryb AI (AI mode):** write a prompt such as *„Zrób mi post o…”*. Claude looks at the photos in your gallery, picks one for each slide, writes the copy in your chosen style preset and places the text on the calmest part of each photo. You can then edit everything, or ask for changes in the same chat (*„krótsze teksty”*, *„zamień slajd 3 na listę”*).
- **Tryb ręczny (manual mode):** drag photos from the gallery onto slides and add layouts or text in the preset style. The *Wskazówki* (tips) panel shows where text reads best on the photo (heatmap plus a suggested zone), checks the contrast and busyness behind each block, and offers one-click fixes. **Zapytaj AI** asks Claude for a critique of the current slide's layout.

Export gives you a ZIP of numbered PNGs at 1080×1350, ready to upload.

## Style presets

Three presets built from the reference posts. The full breakdown is in [STYLES.md](STYLES.md) and in *Presety* inside the app.

| Preset | Look |
|---|---|
| **Editorial Serif** | A huge heavy serif (DM Serif Display), an uppercase grotesk lockup, soft sans body text, script numbering (“01.”), hand-drawn arrows and inset photos |
| **Story Highlight** | Arial/Helvetica (Arimo) with a hard shadow, purple ==highlight== boxes, grey chips and a dark bottom gradient |
| **Split Screen** | Two photos stacked 50/50, with one Montserrat Bold line centred in each half |

Each text block references a style slot (title, subtitle, body, list, CTA…). Switching the preset restyles the whole carousel, and **Duplikuj i edytuj** (duplicate and edit) creates your own variant with different fonts, sizes, colours and shadows.

There are 15 layout templates (*Układy*), and every one works with every preset.

### Text markup

| Markup | Effect |
|---|---|
| `**word**` | bold |
| `==phrase==` | coloured highlight box |
| `- item` | bullet |
| blank line | new paragraph |
| `left \|\| right` | splits one line to both edges, e.g. around a head |

## Privacy and the API key

- Photos, projects and presets stay in your browser (IndexedDB). There is no backend and no account.
- The AI features use **your own Anthropic API key**. Paste it under ⚙ *Ustawienia* (settings). It is stored only in this browser's `localStorage`, and requests go straight from the browser to `api.anthropic.com`.
- The default model is Claude Opus 5, with server-side refusal fallback enabled. Sonnet 5 and Haiku 4.5 can be picked in settings if you want lower cost.

## Development

```bash
npm install
npm run dev      # http://localhost:5173/postify/
npm run build    # outputs to dist/
```

The stack is React 19, Vite, TypeScript and Zustand, plus html-to-image and JSZip for export, `@anthropic-ai/sdk` for Claude and `@fontsource/*` for the fonts. The fonts are bundled locally so that PNG export embeds them, and Polish diacritics are included.

For dev-only visual QA, open `/postify/?render=<templateId>&img=<n>&zone=top|middle|bottom&tone=light|dark`. It renders one template on photo *n* from your gallery.

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**. The app will then be served at `https://louiscmd.github.io/postify/`.
