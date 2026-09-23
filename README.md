# Postify

Postify is a web tool for making Instagram carousel posts (4:5, 1080×1350) and stories (9:16, 1080×1920), with a dark, soft-red interface in Polish. It works on a phone as well as a desktop: on narrow screens the panels become bottom sheets with a tab bar, text fields don't trigger iOS zoom, and photos are dragged with a finger and pinched to zoom.

**Nowy** (or *Nowy projekt* in the Projekty modal, and the first time you open the app) asks which frame you are making before anything else: **Post — karuzela 4:5** or **Relacja — story 9:16**, each shown at its real proportions. The frame decides the layouts, the safe areas and how the AI writes, so it is chosen once per project rather than hidden in a dropdown. Picking a story then lists the seven weekly types — create the sequence, or create it and go straight to the AI. Every project in the list carries its 4:5 or 9:16 badge.

It has two modes:

- **Tryb AI (AI mode):** write a prompt such as *„Zrób mi post o…”*. Claude looks at the photos in your gallery, picks one for each slide, writes the copy in your chosen style preset and places the text on the calmest part of each photo. You can then edit everything, or ask for changes in the same chat (*„krótsze teksty”*, *„zamień slajd 3 na listę”*).
- **Tryb ręczny (manual mode):** drag photos from the gallery onto slides and add layouts or text in the preset style. The *Wskazówki* (tips) panel shows where text reads best on the photo (heatmap plus a suggested zone), checks the contrast and busyness behind each block, and offers one-click fixes. **Zapytaj AI** asks Claude for a critique of the current slide's layout.

Photos can be any size, shape or file: JPG, PNG, WEBP, AVIF, GIF, BMP and **HEIC from an iPhone** (converted in the browser). The real format is read from the file's bytes, so a HEIC or TIFF named `.jpg` is handled correctly, and anything unreadable says exactly why. Very large photos are scaled down to fit the editor; a panorama or a very tall shot starts fitted whole inside the frame, everything else fills it. The 4:5 frame is fixed, but the photo slides freely behind it: drag it anywhere, use the wheel to zoom from a tight crop down to the whole photo inside the frame, and the empty edges are filled with a blurred copy of it (or the slide colour). **Wypełnij kadr / Zmieść całość / Skala 1:1 / Wyśrodkuj** are one click away in the right panel.

Export opens a sheet that renders every slide to a full-size PNG and shows them. On a phone, **Zapisz w galerii** hands them to the system share sheet, where "Save N Images" puts them straight in the camera roll; on a desktop you download them individually or as a ZIP. Each PNG is composited in two passes: photos, blurred fills and the darkening gradients are drawn on a canvas, and the text is rasterised on top with a transparent background. No photo goes through the SVG path, because iOS Safari does not reliably rasterise images inside a foreignObject — that is what produced exports with text but no background.

## Stories (Relacje)

Postify also makes Instagram stories (9:16, 1080×1920), built around the seven-type weekly system:

| Type | Cadence | Technique it builds |
|---|---|---|
| **Wartość** | 1–2×/week | annotated screenshot: black callouts around the shot, then the steps to copy |
| **Dowód** | 2–3×/week | raw DM / result screenshot, one line of context, a wins list |
| **Q&A** | 1×/week | white question sticker + answer over a photo, bucketed by topic |
| **Dzień z życia** | 1–2×/month | timestamped frames ending on a quantified result |
| **Rozkład na części** | 1×/week | the real system on screen with black callouts naming each part |
| **Lifestyle** | 1–2×/week | photos only, no text at all |
| **CTA** | < 1×/month | pain frames → personal transition → offer with a reply keyword |

Open **Relacje** in the left panel (or the tab bar on a phone), pick a type and you get its whole frame sequence with the right structures. The AI mode knows each type's purpose and technique and writes the frames for it. The layout engine keeps text clear of Instagram's avatar bar (top 230 px) and reply bar (bottom 260 px), which are drawn as guides on the canvas, and story type runs ~20 % larger since a story is read full-screen.

## Style presets

Three presets built from the reference posts. They copy the **style** (fonts, weights, shadows, colours, decorations), not the positions: a layout engine places the text at random within each style's rules. It picks a calm area of the photo, then varies alignment, column width, margins, where inset photos and arrows go, and how strong the gradient is. **🎲 Losuj układ** re-rolls a slide, and **Losuj wszystkie** re-rolls the whole carousel. Text and photos stay as they are. The full breakdown is in [STYLES.md](STYLES.md) and in *Presety* inside the app.

| Preset | Look |
|---|---|
| **Editorial Serif** | A huge heavy serif (DM Serif Display), an uppercase grotesk lockup, soft sans body text, script numbering (“01.”), hand-drawn arrows and inset photos |
| **Story Highlight** | Arial/Helvetica (Arimo) with a hard shadow, purple ==highlight== boxes, grey chips and a dark bottom gradient |
| **Split Screen** | Two photos stacked 50/50, with one Montserrat Bold line centred in each half |

Each text block references a style slot (title, subtitle, body, list, CTA…). Switching the preset restyles the whole carousel, and **Duplikuj i edytuj** (duplicate and edit) creates your own variant with different fonts, sizes, colours and shadows.

The *Układy* panel lists 16 content structures (cover, content, list, accent, 50/50, CTA). None of them has fixed coordinates, so every click gives a new arrangement. Text size adapts to the amount of text, so nothing gets cut.

### Text markup

| Markup | Effect |
|---|---|
| `**word**` | bold |
| `==phrase==` | coloured highlight box |
| `- item` | bullet |
| blank line | new paragraph |
| `left \|\| right` | splits one line to both edges, e.g. around a head |

## Privacy and the API key

- Without an account, photos, projects and presets stay in your browser (IndexedDB). With an account (see below) they also sync to Supabase.
- The AI features use **your own Anthropic API key**. Paste it under ⚙ *Ustawienia* (settings). It is stored in this browser's `localStorage` (and in your account, if you use one), and requests go straight from the browser to `api.anthropic.com`.
- The default model is Claude Opus 5, with server-side refusal fallback enabled. Sonnet 5 and Haiku 4.5 can be picked in settings if you want lower cost.

## Accounts (Konta)

Accounts are optional. Without them Postify works exactly as before, storing everything in your browser. With them, each account keeps its own:

- projects
- gallery photos
- custom presets
- **Anthropic API key and model choice**

It all syncs across devices. Postify stays local-first: it works offline, and every change is also pushed to the account in the background. The avatar button in the header shows the sync status.

The first time you log in on a browser, Postify offers to **move the projects and photos made there before logging in** into your account.

### One-time setup (about 5 minutes, free tier)

1. Create a project at [supabase.com](https://supabase.com). Any name and region will do.
2. In the dashboard, open **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the tables, the private `images` bucket and the Row Level Security rules, so each user can only see their own rows and files.
3. Under **Authentication → URL Configuration**, set **Site URL** to your deployed address (e.g. your Vercel URL). Confirmation and password-reset emails will link back there.
4. Under **Project Settings → API**, copy the **Project URL** and the **anon public** key, then add them as environment variables:
   - **Vercel:** Project → Settings → Environment Variables → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → redeploy.
   - **GitHub Pages:** repo → Settings → Secrets and variables → Actions → **Variables** tab → same two names.
   - **Local dev:** copy `.env.example` to `.env.local`.
5. Open Postify, click **Zaloguj → Nowe konto**, and confirm your email.

Both values are meant to be public. Data is protected by Row Level Security, not by keeping the key secret. The API key is stored in your `profiles` row, readable only by you (and by whoever administers the Supabase project).

## Development

```bash
npm install
npm run dev      # http://localhost:5173/
npm run build    # outputs to dist/
```

The stack is React 19, Vite, TypeScript and Zustand, plus html-to-image and JSZip for export, `@anthropic-ai/sdk` for Claude and `@fontsource/*` for the fonts. The fonts are bundled locally so that PNG export embeds them, and Polish diacritics are included.

For dev-only visual QA, open `/?render=<templateId>&img=<n>&zone=top|middle|bottom&tone=light|dark`. It renders one template on photo *n* from your gallery.

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**. The app will then be served at `https://louiscmd.github.io/postify/`.

The build uses a relative base (`./`), so the same output also deploys to Vercel/Netlify at the domain root with no extra config (build command `npm run build`, output directory `dist`).
