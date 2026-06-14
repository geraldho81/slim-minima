<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Slim Minima - agent guide

Guidance for AI agents (Claude Code, Codex, etc.) building on Slim Minima.

## What this is

Slim Minima is a minimal, self-owned CMS: **a CMS built for marketers, by
marketers.** Block-based pages, a blog, a media library, contact forms, menus,
settings and users - all stored in **Neon Postgres**, media in the user's own
**Cloudinary**, edited in a visual admin at `/admin`. The public site renders
straight from the database and is SEO and GEO ready out of the box.

You are expected to build sites ON TOP of this foundation: add blocks, retheme,
and create content. Keep it minimal - that is the brand.

## This is a template, not your project repo

Slim Minima is a starter you build a site ON. When you are building a site, the
cloned repo is **not** the site's repo and its git remote is **not** the user's
repo - `origin` points at the Slim Minima framework. **Do not commit a site's
content or push to that remote.** Treat this like a template you copied from.

Before any git work, run `git remote -v`. If `origin` still contains
`slim-minima`, detach first: have the user create their own repository and
either `git remote set-url origin <their-repo>` or re-init git
(`rm -rf .git && git init`). Only commit and push the site once `origin` is the
user's own repo. If you are not sure which repo you are on, do not push - ask.

## Vercel deployments - DO NOT

**Never deploy to Vercel unless the user explicitly says "deploy to Vercel" or "run vercel deploy."**
Do not use Vercel MCP tools or the Vercel CLI to trigger a deployment proactively.
`vercel.json` existing in this repo does not mean you should deploy - it only configures cron jobs.
The deployment decision always belongs to the user. This applies in all contexts: building a site,
developing the framework, or anything else. Even if the build is clean. Even if you have the tools.

## Stack

- Next.js (App Router) + TypeScript + Tailwind v4, deploys to Vercel
- Neon Postgres via Drizzle ORM (`src/db/schema.ts`)
- Auth.js v5 credentials auth, roles `admin` / `editor`
- Tiptap rich text, dnd-kit drag and drop, zod validation
- Cloudinary for media (signed uploads server-side)
- Resend for optional contact-form email notifications

## Services the user must provide (their own accounts)

| Service | Purpose | Required |
| --- | --- | --- |
| [Neon](https://console.neon.tech) | Postgres database (`DATABASE_URL`, pooled) | Yes |
| [Cloudinary](https://cloudinary.com) | Media storage/delivery (cloud name + API key + secret) | Yes for media |
| [Resend](https://resend.com) | Email contact-form submissions to the owner | Optional |

**Cloudinary gotcha:** Cloudinary blocks delivery of PDF and ZIP files by
default. To allow them: Cloudinary console -> Settings -> Security ->
"PDF and ZIP files delivery" -> tick "Allow delivery of PDF and ZIP files".
This note is also shown to the user on the admin media page.

## FIRST STEP: environment setup (do this before anything else)

The app will not run until the environment is configured. Before building
pages, blocks, or running any command:

1. **Copy the example file:** `cp .env.example .env.local`. Never edit
   `.env.example` itself and never put real keys in it - it is committed to git.
   All real credentials go in `.env.local`, which is gitignored.
2. **Ask the user for their own API credentials and fill them into
   `.env.local`.** These are the user's own accounts; you cannot create them.
   Explicitly request:
   - **`DATABASE_URL`** (required) - their Neon Postgres pooled connection string.
   - **`AUTH_SECRET`** (required) - generate it for them: `openssl rand -base64 32`.
   - **`CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`**
     (required for media) - from their Cloudinary dashboard.
   - **`RESEND_API_KEY` / `EMAIL_FROM` / `EMAIL_TO`** (optional) - only if they
     want contact-form submissions emailed.
   - **`CRON_SECRET`** (set before deploying) - any long random string.
   `.env.example` contains step-by-step "where to find it" instructions for each.
3. **Do not invent, guess, or commit credentials.** If the user has not
   provided a required key yet, stop and ask for it rather than proceeding with
   placeholders.
4. Once `.env.local` is filled: `npm run db:migrate` (create tables) ->
   `npm run seed` (first admin + sample content) -> `npm run dev`.

## Commands

```bash
npm run dev          # start dev server (http://localhost:3000)
npm run build        # production build - run before pushing
npm run typecheck    # tsc --noEmit
npm run db:generate  # generate SQL migration after editing src/db/schema.ts
npm run db:migrate   # apply migrations to Neon
npm run db:push      # push schema directly (dev convenience)
npm run seed         # first admin + sample home/about/blog
npm run cms -- <cmd> # content CLI, see below
```

Always run `npm run typecheck` and `npm run build` before committing. There is
no test suite - typecheck + build + manual verification is the path.

## Architecture (how the pieces connect)

**Public rendering pipeline:** `app/(site)/[[...slug]]/page.tsx` (catch-all;
slug `home` = `/`) loads the page via cached queries in `src/lib/queries.ts`,
checks `isLive()` (status + publishAt at request time), falls back to the
`redirects` table before 404ing, then hands `page.blocks` to
`src/blocks/BlockRenderer.tsx`. The renderer looks each block up in the
registry, validates props against its zod schema (merging `defaults` so old
content survives new fields), awaits `getData` if present, recursively renders
`zones`, and calls the block's `Render`. Blog routes (`(site)/blog/`) are
explicit routes that win over the catch-all.

**One Render, two trees:** every block's `Render` runs in the server tree
(public site) AND inside the client editor canvas
(`src/components/admin/editor/Canvas.tsx`). So `Render` must be a pure
synchronous component; server-data blocks need `getData` (server only) plus a
`Preview` for the canvas.

**Caching and invalidation:** public reads go through `unstable_cache` with
tags (`CACHE_TAGS` in `src/lib/queries.ts`) and a 60s `revalidate` fallback.
Admin server actions (`src/app/admin/actions.ts`) and the REST API
(`src/lib/api-revalidate.ts`) call `revalidateTag` on every write, so admin/API
edits are live instantly; direct DB writes (CLI) rely on the 60s fallback. New
public query -> give it a tag and bump that tag from every write path.

**Editor state flow:** `PageEditor.tsx` owns the page as React state, debounces
800ms into the `savePage` server action, which validates blocks, snapshots a
revision (max every 5 min, keeps 20), and bumps caches. Block tree mutations
are immutable helpers in `src/components/admin/editor/blockTree.ts`. Settings
forms are generated from each block's `fields` spec by `AutoFields.tsx`.

**Auth:** Auth.js v5 (JWT) in `src/lib/auth.ts`. `app/admin/layout.tsx` calls
`requireUser()`; every server action ALSO calls `requireUser()`/`requireAdmin()`
(defense in depth). The REST API uses separate API-key auth
(`src/lib/api-auth.ts`, SHA-256 hashes). Media uploads go browser ->
Cloudinary directly, signed by `/api/admin/upload-signature` (session-gated).

**Database:** `src/db/index.ts` exports a lazy proxy - the Neon connection is
created on first query, never at import time (imports stay safe during builds
without DATABASE_URL). Schema in `src/db/schema.ts`; migrations in `drizzle/`.

## Environment (.env.local)

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string (required) |
| `AUTH_SECRET` | Auth.js JWT secret (`openssl rand -base64 32`) |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | media uploads (required for media) |
| `CLOUDINARY_FOLDER` | upload folder (default `slim-minima`) |
| `MEDIA_TRASH_TTL_DAYS` | days a trashed item waits before permanent deletion (default `30`) |
| `CRON_SECRET` | bearer token that protects `/api/cron/empty-trash` |
| `NEXT_PUBLIC_SITE_URL` | canonical URL for sitemap/RSS/OG |
| `RESEND_API_KEY` | optional - contact-form email notifications |
| `EMAIL_FROM` / `EMAIL_TO` | fallback notification sender/recipient |

Only `DATABASE_URL` and `AUTH_SECRET` must be env vars. Cloudinary credentials,
the upload folder, the trash retention, and Resend email can also be set in the
CMS (Admin -> Settings) and resolve env-first, then settings - so a site can go
live with just the two required vars and be connected later without a redeploy.
`CRON_SECRET` and `NEXT_PUBLIC_SITE_URL` stay env-only. Resolver helpers:
`src/lib/cloudinary-config.ts` and `src/lib/integration-config.ts`.

`.env.example` covers only the essentials and explains where to get each value.
The seed admin is created with defaults (email `admin@example.com`, a generated
password printed once); override with `SEED_ADMIN_EMAIL/PASSWORD/NAME` in
`.env.local` before `npm run seed`, or use `npm run cms -- create-admin`.

## Content model

- **pages** - slug, title, `blocks` (jsonb block tree), status (`draft|published|scheduled` + `publishAt`), SEO fields (`metaTitle`, `metaDescription`, `ogImage`, `noindex`), `deletedAt` (soft trash). Slug `home` serves `/`.
- **posts** - blog articles. `body` is HTML. One category, free `tags` text[], hero image, author, SEO + `noindex`, same status model, `deletedAt`.
- **categories** / **tags** - managed taxonomy and flat per-post tags.
- **redirects** - `fromPath` -> `toPath` (301/302), checked before 404.
- **media** - the library reads live from Cloudinary; the `media` table records uploads.
- **media_trash** - soft-deleted media. The Cloudinary asset stays put until the daily cron purges rows older than `MEDIA_TRASH_TTL_DAYS`, then deletes from Cloudinary. See "Media trash bin".
- **menus** - `header` and `footer`, items `{label, href}`.
- **settings** - key/value: `siteName`, `tagline`, `logoUrl`, `defaultOgImage`, `footerText`, `social`, `gtmId`, plus `contactForms` (array of reusable contact form definitions - see "Contact forms"). `gtmId` injects the Google Tag Manager snippet on public pages (never in /admin). Put GA4/Pixel/etc inside GTM, not the CMS.
- **users** - email/password (bcrypt), role `admin`/`editor`.
- **contact_submissions** - `formName`, mirrored `name`/`email`/`message`, and `data` (jsonb: every submitted field). Written by `/api/contact`.
- **page_revisions** - automatic snapshots (max every 5 min, last 20), restorable.

Scheduled content goes live when `publishAt` passes (checked at request time).

## SEO and GEO checklist (preserve these when building)

Slim Minima ships search-engine and generative-engine optimizations. When you
add features, do not break them:

- Canonical URLs on every page, post, and the blog index.
- JSON-LD: `WebSite` + `Organization` on home, `BlogPosting` + `BreadcrumbList` on posts (`src/lib/jsonld.tsx`).
- `FAQPage` JSON-LD auto-emitted on any page containing `faq-accordion` blocks.
- Per-page and per-post `noindex` toggle (SEO panel in both editors).
- `sitemap.xml`, `robots.txt`, RSS, OG tags with settings fallbacks.
- Image alt text on media items and every image-bearing block.
- **GEO / LLM-native formats:** `/llms.txt` (index), `/llms-full.txt` (whole
  site as markdown), and a markdown version of every page/post at `/<slug>.md`
  and `/blog/<slug>.md` (rewrites in `next.config.ts` -> `src/app/md/[[...slug]]`).
  Block-to-markdown lives in `src/lib/block-text.ts` - when you add a block type
  with text content, add an emitter there too (the fallback extractor covers
  the rest).
- IndexNow pings on publish (`src/lib/indexnow.ts`).

## The block engine (the core contract)

A page's `blocks` column is a `Block[]`:

```ts
{ id: string, type: string, props: Record<string, unknown>, zones?: Block[][] }
```

`zones` is for container blocks (the `columns` block puts children in each column).

Built-in types: `hero`, `heading`, `richtext`, `image`, `gallery`, `columns`,
`cta`, `feature-grid`, `testimonial`, `faq-accordion`, `pricing-table`,
`video-embed`, `html-embed`, `posts-list`, `spacer`, `logos-strip`,
`contact-form`.

### How to add a block type

1. Create `src/blocks/my-block/index.tsx`:

```tsx
import { z } from "zod";
import { defineBlock } from "@/blocks/types";

const schema = z.object({ heading: z.string() });
type Props = z.infer<typeof schema>;

export default defineBlock<Props>({
  type: "my-block",
  label: "My block",
  description: "What it does (shown in the palette)",
  icon: "★",
  schema,
  defaults: { heading: "Hello" },
  fields: [{ kind: "text", name: "heading", label: "Heading" }],
  Render: (p) => (
    <section className="cms-container cms-block">
      <h2>{p.heading}</h2>
    </section>
  ),
});
```

2. Import and add it to the list in `src/blocks/registry.ts`. The palette,
   settings form, validation, REST API, and renderer pick it up automatically.

Field kinds: `text`, `textarea`, `number`, `toggle`, `select` (with options),
`image` (media picker), `page` (picker of the site's own pages, stores the
public path), `richtext` (Tiptap), `list` (repeatable group).

Rules for `Render`:
- Pure synchronous component - no hooks, no async.
- Server data? Add `getData: async (props) => ...` (use `await import("@/lib/queries")` inside) and read `p.ctx?.data`; provide a `Preview`.
- Container? Add `zoneCount: (props) => n` and render `p.ctx?.zones[i]`.
- Style with `cms-*` classes and CSS variables from `src/app/globals.css`.
- Never put a `border` or `outline` on card-style elements - cards are defined by background alone.

## Contact forms

Marketers build **reusable forms** in the Contacts admin area
(`/admin/contacts`) and drop them on any page by picking one from the
`contact-form` block's **Form** dropdown - define a form once, reuse it
everywhere, edit it in one place and every page updates. A form owns its fields
(label, key, type text/email/tel/textarea/dropdown, required, full width), the
**receiver email**, the submit label, and what happens after submit (**inline
thank-you message** or **redirect to a thank-you page**). The block itself only
carries the surrounding presentation copy (eyebrow, heading, intro text).

Forms are stored as an array under the `contactForms` **settings key** - there
is no dedicated table, so this needs no migration and works on any install with
zero setup. The block loads the chosen form server-side via `getData`
(`getContactFormById` in `src/lib/queries.ts`) and signs the receiver; the
editor canvas can't run `getData`, so it loads the form client-side for preview
(`ContactFormBlockPreview`). Older `contact-form` blocks that configured fields
inline (no `formId`) still render from their own props - the block falls back to
them, so nothing breaks.

Submissions POST to `/api/contact`, are stored in `contact_submissions`
(always, even with no email configured), and emailed via Resend if
`RESEND_API_KEY` is set (to the form's receiver, falling back to `EMAIL_TO`). A
honeypot field blocks bots. Read collected leads in the Contacts submissions
inbox (`/admin/contacts/submissions`), grouped and filterable by form
(matched on the form's submissions label = `contact_submissions.form_name`).

## Media trash bin

Deleting media in the library moves it to a soft trash (`media_trash`); the
Cloudinary asset is NOT touched yet, so URLs survive the grace period. The trash
view (`/admin/media/trash`) shows each item with a "days left" countdown and
offers Restore (forget it was trashed) or Delete now (remove from Cloudinary +
drop the row). A daily Vercel Cron (`vercel.json` -> `/api/cron/empty-trash`)
permanently deletes anything older than `MEDIA_TRASH_TTL_DAYS` (default 30):
media is removed from Cloudinary, and soft-trashed pages/posts past the cutoff
are hard-deleted too. Set `CRON_SECRET` in production so only Vercel can call it.

## Retheming (keep it minimal)

All public styling flows from CSS custom properties at the top of
`src/app/globals.css` (`--bg`, `--surface`, `--text`, `--accent`, `--radius`,
`--container`, ...) plus the `cms-*` component classes below them. The default
theme is light, quiet, and minimal with a quiet-indigo accent (`#4338ca`). To
restyle: change the variables first, then adjust `cms-*` classes. The font is
set in `src/app/layout.tsx` (next/font). Admin styles use separate `--ad-*`
variables - do not mix the two. Brand assets: `src/app/icon.svg` (favicon),
`public/slim-minima-logo.svg` (header lockup), `public/slim-minima-mark.svg`
(monogram).

## Immersive add-on (optional, off by default)

The default public site ships with **no animation libraries** so the initial
bundle stays tiny. Teams that want an immersive, animated site (WebGL hero,
scroll reveals, smooth scrolling, custom cursor) opt in via `extras/immersive/`.
Those files live outside `src/` and are excluded from `tsconfig.json` and
ESLint, so they are never typechecked, bundled, or deployed until wired in, and
`three`/`gsap`/`lenis` are not installed by default. Both components load their
libraries with dynamic `import()` inside the effect, so even when enabled the JS
loads as async chunks after hydration, never on the critical path. Do not add
three/gsap/lenis to the default build. See `extras/immersive/README.md` for the
enable steps and the `data-ax-*` markup hooks.

## Creating content as an agent

### CLI (inside the repo, needs DATABASE_URL)

```bash
npm run cms -- list-blocks
npm run cms -- list-pages
npm run cms -- get-page home
npm run cms -- create-page --title "Pricing" --blocks-file blocks.json --publish
npm run cms -- update-page pricing --blocks-file blocks.json
npm run cms -- create-post --file post.md --publish   # markdown + frontmatter
npm run cms -- create-category --name "Guides"
npm run cms -- set-redirect --from /old-page --to /new-page
npm run cms -- set-setting siteName '"Acme"'
npm run cms -- set-menu header --file menu.json
npm run cms -- create-admin --email a@b.c --password secret123
npm run cms -- create-api-key --name my-agent
```

`blocks.json` is a `Block[]` - run `get-page home` after seeding for a real
example. Block props are validated against each block's zod schema.

Post markdown frontmatter: `title` (required), `slug`, `excerpt`, `category`,
`tags`, `heroImageUrl`, `heroImageAlt`, `status`, `publishAt`, `metaTitle`,
`metaDescription`.

### REST API (remote, needs an API key)

All under `/api/v1` with `Authorization: Bearer <key>`:

```
GET    /api/v1/blocks          block catalog: types, fields, defaults
GET/POST /api/v1/pages         list / create
GET/PUT/DELETE /api/v1/pages/:slug
GET/POST /api/v1/posts         same shape for posts (body = HTML)
GET/PUT/DELETE /api/v1/posts/:slug
GET/POST /api/v1/categories    list with counts / create
GET    /api/v1/media
GET/PUT /api/v1/settings       {settings: {...}, menus: {header, footer}}
```

## Key files

```
src/db/schema.ts                          all tables
src/blocks/registry.ts                    block registry (add new blocks here)
src/blocks/types.ts                       Block, BlockDef, FieldSpec
src/blocks/BlockRenderer.tsx              public renderer
src/lib/queries.ts                        cached public queries + cache tags
src/lib/cloudinary.ts                     Cloudinary Admin API client
src/lib/auth.ts                           Auth.js setup
src/lib/block-text.ts                     block -> markdown (GEO)
src/app/(site)/[[...slug]]/page.tsx       public page route
src/app/(site)/blog/                      blog index + post page
src/app/admin/actions.ts                  all admin server actions (incl. media trash)
src/app/admin/media/trash/page.tsx        media trash view
src/app/admin/contacts/                    reusable forms admin + submissions inbox
src/blocks/contact-form/index.tsx         contact-form block (form picker + legacy fallback)
src/app/api/contact/route.ts              contact form handler
src/app/api/cron/empty-trash/route.ts     daily trash purge
scripts/cms.ts                            agent CLI
scripts/seed.ts                           seed
```

## Gotchas

- Draft preview: `/<slug>?preview=1` (or `/blog/<slug>?preview=1`) needs a signed-in session.
- Explicit routes (`blog`, `admin`, `login`, `api`, `md`) win over the catch-all - do not create pages with those slugs.
- CLI writes bypass Next's cache; the public site catches up within 60s. Admin UI and REST API revalidate instantly.
- After editing `src/db/schema.ts`: `npm run db:generate` then `npm run db:migrate`, and commit the `drizzle/` output. Generating in a non-interactive shell fails when a change is ambiguous (renamed vs dropped column) - run it in a real terminal.
- `posts.body` is HTML, not Tiptap JSON and not markdown.
- Writing style for all content and copy: no em dashes or en dashes; no AI vocabulary (delve, vibrant, tapestry, crucial, showcase, foster, ...). Plain language.
