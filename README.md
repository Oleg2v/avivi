# Avivi Kitchens · design concept

**אביבי מטבחים. מעצבים מטבחים. מעצבים חוויות.**

A complete concept for a new avivi.com: Hebrew first, with English, Russian and French. It was made as an unsolicited proposal and is **not the official Avivi Kitchens website**. Every page says so in the footer, and every response carries `noindex` (HTTP header, robots meta and `robots.txt`).

Company facts come only from the brief (1969, Yitzhak Avivi, family company, ~14,000 kitchens a year, 550+ people, Karmiel and Bnei Darom factories, six showrooms, the planned automated factory as announced plans). Anything not known is shown as labelled example data or “to confirm”.

- **What the demo shows, in sales language:** [DEMO_FEATURES.md](DEMO_FEATURES.md) (Hebrew and English)
- **What is mocked and how to connect the real systems:** [CONNECT_REAL_SYSTEMS.md](CONNECT_REAL_SYSTEMS.md)

---

## Run it

Node.js 20.9 or newer.

```bash
npm install && npm run dev
```

Open http://localhost:3000. Hebrew is served at `/`, English at `/en`, Russian at `/ru`, French at `/fr`.

Production build:

```bash
npm run build && npm start
```

No keys are needed. Without them the site runs in **demo mode**: the AI visualiser shows pre-rendered rooms for every collection, Avivi Designer answers from 21 grounded scripted topics in four languages, leads are kept in memory and on the device, and the inbox shows an example pipeline. Copy `.env.example` to `.env.local` to go live piece by piece.

## A five-minute tour

| Where | What to try |
|---|---|
| `/` | The hero: one oak board on a workbench is cut, joined and assembled into a kitchen as workshop light becomes home light (WebGL, with a line-drawing fallback). Then *Feel the material*: drag the light across live-shaded veneer, lacquer, marble and brass. |
| `/smart-kitchen` | SMART KITCHEN, opened: scroll and the kitchen opens in 3D; click a module to see the principle it carries. |
| `/collections/dark` | Each collection is art-directed. Drag the day-to-night slider. |
| `/visualiser` | Upload a photo (or use the camera, or an example room), choose a collection, compare before/after, save it, send it on WhatsApp or attach it to a visit. |
| `/style-finder` | Eight visual questions, a recommended collection and a design brief. |
| `/planner` | Room dimensions, five shapes, windows and doors, a 3D layout, the work triangle, storage, counter length and an example price range. Share or attach the plan. |
| `/designer` | Avivi Designer. Ask in Hebrew, English, Russian or French, or speak. It never invents prices, lead times, warranty terms or specifications, and hands over to a person at any moment. |
| `/book` | Map, day, example slots, project type, attachments, confirmation with `.ics`, Google Calendar and a WhatsApp reminder. |
| `/professionals` | Material library with downloadable example swatches, a technical sheet (PDF) and CAD blocks (DXF); project registration and contractor inquiry. |
| `/inbox` | The showroom inbox (password **avivi-demo** in demo mode): KPIs, visits per showroom, collections chosen, every lead with its attachments, CSV export. Leads you send from the site on the same device appear here. |

Also: `/new-apartment`, `/products`, `/story`, `/magazine` (three demo articles), `/app`, `/service`, `/contact`, `/my-design`, `/accessibility`, `/privacy`, `/cookies`.

## Deploy

The site is a standard Next.js app (App Router). Pages are statically generated per locale; only `/api/*` runs on the server.

### Vercel (recommended)

1. Push this repository to GitHub and choose **Add New → Project** in Vercel, then import it.
2. Framework preset: Next.js (detected). No build settings to change.
3. Add the environment variables you want from `.env.example` (all optional).
4. Deploy. Every push creates a preview URL.

Or from the terminal:

```bash
npx vercel
```

```bash
npx vercel --prod
```

For the inbox to keep leads between requests, add Vercel KV (or Upstash Redis) from the Vercel marketplace; its `KV_REST_API_URL` and `KV_REST_API_TOKEN` are picked up automatically.

### Netlify

`netlify.toml` is included. Create a new site from the repository; the Next.js runtime is detected. Add the environment variables under *Site configuration → Environment variables*.

### Cloudflare

Use the OpenNext adapter for Cloudflare Workers:

```bash
npm install --save-dev @opennextjs/cloudflare wrangler
```

```bash
npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy
```

Set the variables with `npx wrangler secret put NAME` (server keys) and in the dashboard (public `NEXT_PUBLIC_*` values, before building).

## Environment variables

All are documented in [`.env.example`](.env.example). The important ones:

| Variable | Turns on |
|---|---|
| `ANTHROPIC_API_KEY` | Avivi Designer on Claude (`claude-opus-5-5` by default, official `@anthropic-ai/sdk`, JSON-schema output, server-side refusal fallbacks enabled) |
| `OPENAI_API_KEY` | Avivi Designer on OpenAI when no Anthropic key is set; also the default image key |
| `IMAGE_API_KEY` | Live AI visualisations (OpenAI-compatible `images/edits`) |
| `LEAD_WEBHOOK_URL` | Every lead forwarded to the CRM / automation webhook |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Durable lead store for the inbox |
| `INBOX_PASSWORD`, `INBOX_SECRET` | Real inbox password (demo password disabled, live leads shown) |
| `NEXT_PUBLIC_*` | Real phone numbers, WhatsApp, emails, store links, products site, GA4 |

Keys stay on the server. Photos sent to the visualiser are processed in memory and never stored. Every AI and lead endpoint answers with usable JSON: on any failure the visitor gets a demo answer or a friendly message, never a raw error.

## Project structure

```
app/
  [locale]/                 one route tree for he, en, ru, fr (SSG); Hebrew is served at / by proxy.ts
    page.tsx                home: hero, facts, collections, material wall, SMART KITCHEN, tools, showrooms
    collections/            index + [slug] for the five collections (day-to-night scene)
    smart-kitchen/          SMART KITCHEN, opened (3D)
    visualiser/ style-finder/ planner/ designer/      the tools
    book/ showrooms/        booking flow, map and the six showrooms
    professionals/ new-apartment/ products/ story/ magazine/[slug]/ app/
    service/ contact/ my-design/ inbox/ accessibility/ privacy/ cookies/
    layout.tsx not-found.tsx [...rest]/               shell, localized 404
  api/
    designer/route.ts       Avivi Designer (Claude / OpenAI / demo)
    visualise/route.ts      AI visualiser (image API / demo)
    lead/route.ts           every form: webhook + store
    inbox/                  inbox data, login, logout (HMAC cookie)
  globals.css               design tokens, type, RTL-safe logical CSS, motion, a11y modes
  fonts.css                 self-hosted font faces with metric-adjusted fallbacks
  robots.ts icon.svg
components/
  home/ hero/               hero scene (three.js), drawings fallback, material wall shader, sections
  collections/ smart/ planner/                        day-to-night, SMART KITCHEN 3D, planner UI + 3D
  visualiser/ style/ designer/ book/ showrooms/ pro/ products/ story/ magazine/ app/ service/ inbox/ pages/
  layout/                   header, mobile menu, language switcher, accessibility panel, cookie banner, footer
  motion/                   smooth scroll (Lenis), reveals, brass ring cursor, wood-grain page transition
  ui/                       Icon, PhotoSlot, BeforeAfter, IsraelMap, PageHead
content/                    he.ts (native), en.ts (complete, defines the Dict type), ru.ts, fr.ts (machine-assisted, labelled)
lib/
  three/                    renderer budget, GPU texture generation, geometry, materials, kitchen builder
  planner/engine.ts         layout engine: shapes, openings, modules, work triangle, storage, example price
  designer/                 grounding facts, system prompt, JSON schema, sanitizer; demo intents
  server/                   designer, visualise, leads, inbox auth (server-only)
  data/                     branches, collections, coastline, render manifest
  inbox/seed.ts             example pipeline for the inbox
  i18n.ts site.ts store.ts leads.ts ics.ts consent.ts analytics.ts meta.ts ...
public/
  fonts/                    Frank Ruhl Libre, Heebo, Fraunces, Inter Tight, Literata (woff2 subsets)
  renders/                  concept renders (WebP), all labelled “Concept render” in the UI
  downloads/                example swatches, technical sheet PDF, DXF blocks
scripts/
  render/                   Blender (Cycles) scene generator and batch for the concept renders
  optimise-renders.mjs      PNG → WebP + blur placeholders
  downloads/                swatch, PDF and DXF generators
  geo/coast.mjs             coastline path for the drafting-style map
proxy.ts                    locale routing (Hebrew unprefixed, /he → /)
next.config.ts              noindex and security headers, image formats
DEMO_FEATURES.md  CONNECT_REAL_SYSTEMS.md  .env.example  netlify.toml
```

## Content and languages

- All copy lives in `content/*.ts`. `en.ts` defines the shape; TypeScript keeps the other languages complete.
- Hebrew is the native voice and uses plural address (אתם). Russian and French are machine-assisted and say so at the top of every page.
- Layout is mirrored with logical CSS properties (`inline-start`, `block-end`), so RTL and LTR share one stylesheet. Sliders, drag directions, arrows and reading order flip with the language.

## Imagery

There is no stock photography. Kitchen imagery is a set of **concept renders** made for this proposal in Blender (Cycles) from `scripts/render/scenes.py`, and every one is labelled “Concept render” with its art-direction note, so Avivi’s own photography can replace it one slot at a time (`lib/renders.ts` maps the slots). Portraits and showroom photos are **photography slots** with art-direction notes. Product images are drafted line drawings.

To re-render: install Blender’s `bpy` in a Python environment, then

```bash
PY=/path/to/python-with-bpy OUT=renders-raw npm run assets:renders
```

```bash
RAW_DIR=renders-raw npm run assets:images
```

## Quality notes

- Next.js 16, React 19, TypeScript, static generation for every locale (`npm run build` lists each page as SSG).
- three.js with a performance budget: device-tier DPR caps, render on demand, scenes pause off-screen, code loaded on idle, a still or drawn fallback without WebGL and with reduced motion.
- Accessibility to IS 5568 / WCAG 2.2 AA as the design target: keyboard paths with visible focus, skip link, labelled forms with clear errors, text alternatives for 3D scenes, an accessibility panel (text size, contrast, motion, link underlines), `prefers-reduced-motion` respected everywhere.
- Self-hosted fonts (SIL OFL), each language preloads only its own files so the first paint already uses the right faces; images via `next/image` with blur placeholders and fixed aspect ratios. Measured layout shift is 0 on the pages tested.
- Lead forms validate on the client and the server, and offer a WhatsApp handoff.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run assets:images` | Optimise raw renders into `public/renders` |
| `npm run assets:downloads` | Regenerate the professionals’ example files |
| `npm run assets:renders` | Re-render the concept images (needs Blender `bpy`) |
| `npm run assets:map` | Regenerate the coastline for the map |
