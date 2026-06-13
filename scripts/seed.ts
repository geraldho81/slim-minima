/**
 * Seeds the database with the first admin user, default settings, menus,
 * a sample home page built from blocks, an about page, and one blog post.
 *
 *   npm run seed
 *
 * Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD /
 * SEED_ADMIN_NAME (or .env.local). If no password is provided, a random
 * one is generated and printed once.
 *
 * The seed is idempotent: existing rows (matched by email/slug/name/key)
 * are left alone.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { randomBytes } from "crypto";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Add your Neon connection string to .env.local");
    process.exit(1);
  }

  const { db } = await import("../src/db");
  const { users, pages, posts, settings, menus } = await import("../src/db/schema");
  const { resolveCategoryId } = await import("../src/lib/categories");
  const { eq } = await import("drizzle-orm");
  const bcrypt = (await import("bcryptjs")).default;
  const { newBlockId } = await import("../src/blocks/types");

  /* ---------- Admin user ---------- */
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const name = process.env.SEED_ADMIN_NAME ?? "Admin";
  let password = process.env.SEED_ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = randomBytes(9).toString("base64url");
    generated = true;
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) {
    console.log(`Admin already exists: ${email} (password unchanged)`);
  } else {
    await db.insert(users).values({ email, name, passwordHash: await bcrypt.hash(password, 10), role: "admin" });
    console.log(`Admin created: ${email}`);
    if (generated) console.log(`Generated password (store it now): ${password}`);
  }

  /* ---------- Settings ---------- */
  const defaultSettings: Record<string, unknown> = {
    siteName: "Slim Minima",
    tagline: "A CMS built for marketers, by marketers",
    logoUrl: "/slim-minima-logo.svg",
    footerText: `© ${new Date().getFullYear()} Slim Minima. All rights reserved.`,
    social: [],
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing();
  }

  /* ---------- Menus ---------- */
  await db
    .insert(menus)
    .values({ name: "header", items: [{ label: "Home", href: "/" }, { label: "About", href: "/about" }, { label: "Blog", href: "/blog" }] })
    .onConflictDoNothing();
  await db
    .insert(menus)
    .values({ name: "footer", items: [{ label: "About", href: "/about" }, { label: "Blog", href: "/blog" }] })
    .onConflictDoNothing();

  /* ---------- Home page ---------- */
  const b = (type: string, props: Record<string, unknown>) => ({ id: newBlockId(), type, props });
  const [homeExists] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, "home")).limit(1);
  if (!homeExists) {
    await db.insert(pages).values({
      slug: "home",
      title: "Home",
      status: "published",
      publishedAt: new Date(),
      metaDescription: "Slim Minima is a minimal, SEO and GEO ready CMS built for marketers.",
      blocks: [
        b("hero", {
          eyebrow: "Slim Minima",
          heading: "A CMS built for marketers, by marketers",
          subheading: "The content layer without the bloat. Ship pages and posts that are SEO and GEO ready out of the box, and build the rest with a coding agent like Claude Code.",
          primaryLabel: "Read the blog",
          primaryHref: "/blog",
          secondaryLabel: "About",
          secondaryHref: "/about",
          imageUrl: "",
          imageAlt: "",
          align: "center",
        }),
        b("feature-grid", {
          heading: "Less CMS, more marketing",
          intro: "A small, sharp foundation you fully own.",
          columns: "3",
          items: [
            { icon: "🧱", title: "Block engine", body: "Pages are stacks of typed blocks. Reorder, restyle, and add new block types in one file." },
            { icon: "🔎", title: "SEO and GEO ready", body: "Sitemaps, JSON-LD, llms.txt, and a markdown view of every page so search and AI both read you." },
            { icon: "🤖", title: "Agent friendly", body: "A CLI and REST API let agents like Claude Code build your site on top of Slim Minima." },
          ],
        }),
        b("testimonial", {
          quote: "Simple enough to learn in an afternoon, flexible enough to run the whole site.",
          name: "A Happy Marketer",
          role: "Future you",
          avatarUrl: "",
        }),
        b("cta", {
          heading: "Make it yours",
          body: "Sign in to the admin and start editing.",
          buttonLabel: "Open the admin",
          buttonHref: "/admin",
          tone: "accent",
        }),
        b("posts-list", { heading: "From the blog", limit: 3, category: "", showExcerpt: true }),
      ],
    });
    console.log("Created home page (published)");
  }

  /* ---------- About page ---------- */
  const [aboutExists] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, "about")).limit(1);
  if (!aboutExists) {
    await db.insert(pages).values({
      slug: "about",
      title: "About",
      status: "published",
      publishedAt: new Date(),
      blocks: [
        b("heading", { text: "About this site", level: "h2", align: "left" }),
        b("richtext", {
          html: "<p>This page was created by the seed script. Replace this text with your own story: who you are, what you do, and why it matters.</p><p>Open <strong>/admin</strong>, go to Pages, and click About to edit it.</p>",
          width: "narrow",
        }),
      ],
    });
    console.log("Created about page (published)");
  }

  /* ---------- Sample post ---------- */
  const [postExists] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, "hello-world")).limit(1);
  if (!postExists) {
    const [admin] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    await db.insert(posts).values({
      slug: "hello-world",
      title: "Hello, world",
      excerpt: "The first post on this site, created by the seed script.",
      categoryId: await resolveCategoryId("News"),
      tags: ["welcome"],
      authorId: admin?.id ?? null,
      status: "published",
      publishedAt: new Date(),
      body: "<p>Welcome to your new blog. This post was created by the seed script so the blog index and the posts-list block have something to show.</p><h2>Writing posts</h2><p>Open the admin, go to Posts, and click New post. The editor is article-first: title and body up front, metadata in the sidebar.</p><p>Agents can also publish with <code>npm run cms -- create-post --file post.md --publish</code>.</p>",
    });
    console.log("Created sample post (published)");
  }

  /* ---------- MCP connector token ---------- */
  const { getOrCreateMcpToken } = await import("../src/lib/mcp/token");
  const mcpToken = await getOrCreateMcpToken();
  if (mcpToken) console.log(`MCP connector token (Admin -> Settings -> AI connector): ${mcpToken}`);

  console.log("Seed complete.");
}

main().then(() => process.exit(0));
