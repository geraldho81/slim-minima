# Automated Security Updates — Plan

> This document is a **plan only**. Nothing here is wired up yet; it describes the
> approach for automating security scanning and patching for Slim Minima.

## Goal

A hands-off, cloud-run process that, on a weekly schedule, finds critical security
issues (in dependencies *and* the wider CVE landscape relevant to this stack),
patches them, opens a PR for a human to merge, and — because this repo is the
upstream Slim Minima product — publishes a security release so downstream CMS
sites are notified. No need to be at a computer.

## How updates already reach users (context)

- `src/lib/updates.ts` `getUpdateStatus()` polls this repo's **GitHub Releases** and
  keeps only ones whose notes contain a `Type: security` marker, showing them as
  "pending" in the CMS admin panel. **A commit or merged PR alone shows users nothing —
  only a published, tagged `Type: security` release lights up the panel.**
- `dispatchSecurityUpdate()` is the *downstream* apply path: a site's admin clicks
  "apply", which runs `.github/workflows/slim-minima-security-update.yml` to pull the
  security-layer files from a release. Its doc states: *"Never deploys directly — a
  human merges the resulting PR."*
- `.github/security-paths.txt` defines the "security layer" — the only files that flow
  through that channel.

## Confirmed decisions

- **Cadence:** weekly.
- **Approval gate:** the human merges. The agent opens a PR and **never merges its own**.
- **Downstream notification:** after merge, publish a tagged `Type: security` release.

## Layer 1 — GitHub-native baseline

- **CodeQL** (`.github/workflows/codeql.yml`): static analysis of our own code on push
  to `main`, on PRs, and weekly.
- **Dependency audit gate** (`.github/workflows/security-audit.yml`): `npm audit
  --audit-level=high` on PRs and weekly; add an `"audit"` script to `package.json`.
- **Dependabot security updates:** enable in repo Settings → Code security (one-time
  toggle) so GitHub auto-opens targeted PRs when a dependency CVE is published.

## Layer 2 — Scheduled Claude agent

- **Runbook** (`.github/security-sweep.md`): a version-controlled procedure the
  scheduled session reads. It: branches from `main`; runs `npm audit` and web-searches
  the week's critical/high CVEs for the real dependency list (`next`, `next-auth`,
  `react`/`react-dom`, `drizzle-orm`, `@neondatabase/serverless`, `sanitize-html`,
  `bcryptjs`, `marked`, `@tiptap/*`, `zod`, `gray-matter`); patches affected files
  and/or bumps dependencies; bumps the version and writes release notes carrying the
  `Type: security` marker; validates (`npm ci && typecheck && build && audit`); and
  opens a labelled PR. It never merges — a human does.
- **Weekly cron Routine:** a scheduled trigger runs a fresh Claude session in the cloud
  that reads the runbook and executes it end-to-end, delivering a PR and a push
  notification.
- **Release-on-merge** (`.github/workflows/release.yml`): when `package.json` version
  changes on `main`, publish a GitHub Release tagged `v<version>` whose body carries the
  `Type: security` marker — this is what triggers the downstream in-CMS notification.

## Flow summary

1. Weekly, a cloud agent audits + web-searches CVEs, patches, and opens a PR (pings the phone).
2. The human reviews and merges.
3. The merge triggers a `Type: security` release, so downstream sites see "update available".

## Known issue to fix separately

`src/lib/updates.ts` documents the security-update workflow as "opens a PR", but
`.github/workflows/slim-minima-security-update.yml` currently pushes straight to the
branch (no PR). This doc/behavior mismatch on the downstream button path should be
addressed as its own change.
