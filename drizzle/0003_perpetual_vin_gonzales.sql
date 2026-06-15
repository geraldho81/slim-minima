CREATE TABLE "post_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"hero_image_url" text,
	"hero_image_alt" text,
	"version_name" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"saved_by" uuid
);
--> statement-breakpoint
ALTER TABLE "page_revisions" ADD COLUMN "version_name" text;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_saved_by_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;