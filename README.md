# Slim Minima

**A CMS built for marketers, by marketers.**

The content layer without the bloat. Slim Minima gives you pages, posts, and a
media library that are SEO and GEO ready out of the box, then gets out of your
way so you can build the rest of your site with a coding agent like Claude Code
or Codex. Everything lives in your own Neon Postgres database and your own
Cloudinary account. Nothing is hosted by us.

Built on Next.js (App Router), Drizzle ORM, Auth.js, and Tailwind. Deploys to
Vercel.

## What you get

- **Visual page builder** - a palette of blocks, drag to reorder, autosave, revisions, scheduling, draft preview.
- **Block engine** - typed blocks you can extend with one file. The editor form, validation, REST API, and renderer all pick new blocks up automatically.
- **Blog** - article-first editor, categories, tags, hero images, RSS.
- **Media library** - Cloudinary-backed uploads with alt text and a 30-day trash bin that syncs deletions to Cloudinary.
- **Contact forms** - a configurable block: define your own fields, set the receiver email, reply inline or redirect to a thank-you page.
- **Menus, settings, users** - header/footer nav, site identity, admin/editor roles.
- **SEO and GEO** - canonical URLs, JSON-LD, sitemap, robots, RSS, plus LLM-native `/llms.txt`, `/llms-full.txt`, and a markdown view of every page (`/<slug>.md`).
- **Agent access** - a content CLI (`npm run cms`) and an API-key REST API (`/api/v1`) so agents can build and edit content.

## What you'll need (free tiers are fine)

| Service | Why | Required |
| --- | --- | --- |
| [Neon](https://console.neon.tech) | Postgres database | Yes |
| [Cloudinary](https://cloudinary.com) | Media storage and delivery | Yes (for media) |
| [Resend](https://resend.com) | Email contact-form submissions to you | Optional |

Each is your own account. See `.env.example` for every variable and where to find it.

**Only `DATABASE_URL` and `AUTH_SECRET` must be set as environment variables.**
Everything else - Cloudinary, Resend email, the upload folder, the trash
retention - can be added later **directly in the CMS** (Admin -> Settings),
with no redeploy. So you can ship the site live first and connect the rest from
the dashboard. Environment variables always take precedence when both are set.
(The only env-only optionals are `CRON_SECRET` and `NEXT_PUBLIC_SITE_URL`.)

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL (Neon) + AUTH_SECRET + Cloudinary
npm run db:migrate           # create tables in Neon
npm run seed                 # first admin + sample home/about/blog
npm run dev
```

`npm run seed` creates the first admin and prints its email and a generated
password once - copy them. (To choose your own, set `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_NAME` in `.env.local` before seeding, or
run `npm run cms -- create-admin --email you@example.com --password yourpass`.)

Open http://localhost:3000 (site) and http://localhost:3000/admin (sign in).

> **Cloudinary note:** Cloudinary blocks delivery of PDF and ZIP files by
> default. To allow them, open your Cloudinary console and go to
> **Settings -> Security -> "PDF and ZIP files delivery"** and tick
> **"Allow delivery of PDF and ZIP files"**.

## Build your site on top of Slim Minima (for AI coding agents)

This repo is the foundation. Open it in Claude Code, Codex, or Cursor and tell
the agent to build your site. Paste the prompt below to start.

> Prompt to give your agent:
> "Read `AGENTS.md` first, then `CLAUDE.md`. You are building a marketing site
> on top of Slim Minima. Do not change the CMS internals unless I ask. Build my
> pages by adding/editing blocks, add new block types when needed, and retheme
> by editing the CSS variables. Run `npm run typecheck` and `npm run build`
> before telling me you're done."

**What an agent should know (the short version):**

1. **Read `AGENTS.md` before writing any code.** It is the contract: content
   model, the block engine, CLI/REST reference, the SEO/GEO checklist, the
   contact form, the media trash bin, and the retheming guide.
2. **Set up the environment first - the app will not run without it.** Run
   `cp .env.example .env.local`, then ask the site owner for their own API
   credentials and fill them into `.env.local`: `DATABASE_URL` (Neon),
   `AUTH_SECRET` (`openssl rand -base64 32`), and the three `CLOUDINARY_*` keys
   are required; Resend is optional. Never edit `.env.example` or commit real
   keys. Then run `npm run db:migrate && npm run seed && npm run dev`. If a
   required key is missing, stop and ask the owner - do not use placeholders.
3. **To build pages,** either use the visual admin, or create them as code with
   the CLI: `npm run cms -- create-page --title "Pricing" --blocks-file blocks.json --publish`.
   A page is an array of blocks; run `npm run cms -- get-page home` after seeding
   to see a real example.
4. **To add a new section type,** create one file in `src/blocks/<name>/index.tsx`
   and register it in `src/blocks/registry.ts`. The palette, settings form,
   validation, REST API, and renderer pick it up automatically. See the
   walkthrough in `AGENTS.md`.
5. **To restyle,** edit the CSS variables at the top of `src/app/globals.css`
   first (`--bg`, `--text`, `--accent`, `--radius`, ...), then the `cms-*`
   classes. The font is in `src/app/layout.tsx`. Admin uses separate `--ad-*`
   variables - do not touch those.
6. **Always verify:** `npm run typecheck && npm run build`. There is no test
   suite; a green build plus a manual check is the bar.

**Rules an agent must follow:**

- Keep the SEO/GEO features working (sitemap, JSON-LD, `llms.txt`, the per-page
  `.md` view). When you add a block with text, add an emitter in
  `src/lib/block-text.ts` so it appears in the markdown/LLM output.
- Keep it minimal - that is the brand.
- In all generated copy and UI: **no em dashes or en dashes**, and **no AI
  vocabulary** (delve, vibrant, tapestry, crucial, showcase, foster, ...).
- **Never** put a `border` or `outline` on card-style elements; cards are
  defined by their background alone.
- **Do not** add `three`, `gsap`, or `lenis` to the default build. Animation is
  the opt-in `extras/immersive/` module only.

## Want an immersive, animated site?

The default front end ships with zero animation libraries to keep it fast. An
opt-in module in `extras/immersive/` adds a WebGL hero (three.js) and a GSAP +
Lenis animation layer, loaded lazily so they never bloat the initial bundle.
They are excluded from the build until you wire them in. See
`extras/immersive/README.md`.

## Deploying to Vercel

Push to a Git repo, import it in Vercel, and set the environment variables from
`.env.example`. The media trash bin's 30-day purge runs from a daily cron
already declared in `vercel.json` (`/api/cron/empty-trash`); set `CRON_SECRET`
so only Vercel can trigger it.
