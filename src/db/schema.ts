import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  uuid,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import type { Block } from "@/blocks/types";

export const roleEnum = pgEnum("role", ["admin", "editor"]);
export const statusEnum = pgEnum("status", ["draft", "published", "scheduled"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  image: text("image"),
  role: roleEnum("role").notNull().default("editor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  blocks: jsonb("blocks").$type<Block[]>().notNull().default([]),
  status: statusEnum("status").notNull().default("draft"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  ogImage: text("og_image"),
  noindex: boolean("noindex").notNull().default(false),
  customSchema: text("custom_schema"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  // Trash: non-null = trashed (status is preserved so restore is exact)
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const pageRevisions = pgTable("page_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  blocks: jsonb("blocks").$type<Block[]>().notNull(),
  versionName: text("version_name"),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  savedBy: uuid("saved_by").references(() => users.id, { onDelete: "set null" }),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  // HTML produced by the post editor (Tiptap getHTML) or by the CLI markdown importer.
  body: text("body").notNull().default(""),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  tags: text("tags").array().notNull().default([]),
  heroImageUrl: text("hero_image_url"),
  heroImageAlt: text("hero_image_alt"),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  status: statusEnum("status").notNull().default("draft"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  noindex: boolean("noindex").notNull().default(false),
  customSchema: text("custom_schema"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const postRevisions = pgTable("post_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  heroImageUrl: text("hero_image_url"),
  heroImageAlt: text("hero_image_alt"),
  versionName: text("version_name"),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  savedBy: uuid("saved_by").references(() => users.id, { onDelete: "set null" }),
});

export const redirects = pgTable("redirects", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  permanent: boolean("permanent").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size"),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MenuItem = {
  label: string;
  href: string;
  children?: MenuItem[];
};

export const menus = pgTable("menus", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  items: jsonb("items").$type<MenuItem[]>().notNull().default([]),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

// A single field in a reusable contact form. Same shape ContactForm.tsx renders.
export type ContactField = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select";
  required: boolean;
  options: string;
  fullWidth: boolean;
};

// A reusable contact form: built once under /admin/contacts, dropped on any page
// by picking from a dropdown. Stored as an array in the existing `settings` table
// (key "contactForms"), so adding this feature needs no migration on any install.
// The form owns the fields, where submissions go, and what happens after submit;
// the block owns the surrounding presentation copy.
export type ContactForm = {
  id: string;
  name: string;
  fields: ContactField[];
  submitLabel: string;
  receiverEmail: string;
  // Labels submissions in contact_submissions (matched by form_name).
  formName: string;
  successMode: "inline" | "redirect";
  successMessage: string;
  successPath: string;
};

export const contactSubmissions = pgTable("contact_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Which contact-form block produced this (for grouping submissions per form).
  formName: text("form_name"),
  // Best-effort columns surfaced in the dashboard; mirrored from `data`.
  name: text("name"),
  email: text("email"),
  message: text("message"),
  // Every submitted field, keyed by field name. The source of truth.
  data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Soft-deleted media. The Cloudinary asset stays in place until a daily cron
// purges rows older than MEDIA_TRASH_TTL_DAYS (then deletes from Cloudinary).
export const mediaTrash = pgTable("media_trash", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicId: text("public_id").notNull().unique(),
  resourceType: text("resource_type").notNull().default("image"),
  url: text("url").notNull(),
  name: text("name").notNull(),
  mimeType: text("mime_type"),
  size: integer("size"),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt"),
  trashedAt: timestamp("trashed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Media = typeof media.$inferSelect;
export type MediaTrash = typeof mediaTrash.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type PostRevision = typeof postRevisions.$inferSelect;
