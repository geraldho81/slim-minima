# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in the Slim Minima repository.

Slim Minima is a minimal CMS built for marketers. The complete guide lives in
@AGENTS.md (shared with all coding agents): services to set up (Neon,
Cloudinary, Resend), commands, architecture, the block engine contract, content
model, the SEO/GEO checklist, the contact form, the media trash bin, retheming,
and CLI/REST reference. Read it before making changes.

Keep it minimal - that is the brand. No em dashes or en dashes, and no AI
vocabulary, in any generated copy, content, or UI.

## Git workflow

Commit and push by default after completing a change in this repo - no need to
ask first. Commit straight to the working branch, run `npm run typecheck` and
`npm run build` before committing, and push when the build is clean.
