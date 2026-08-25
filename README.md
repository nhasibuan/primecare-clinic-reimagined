# Klinik Berkat Insani / PrimeCare — Reimagined

This repository is a TypeScript monorepo implementation of a clinic website and admin CMS for Klinik Berkat Insani (a mother-and-baby-focused clinic in Kotabaru, Kalimantan Selatan). It combines a public, editorial landing experience with a protected admin dashboard and content management workflows. The overview and analysis below are a verified, code-grounded summary of the repository's current design and risks.

Live demo (Manus preview): https://primecare-g79kyt2a.manus.space

## One-line summary
A modern TypeScript full-stack prototype pairing a calm clinical landing site with an admin CMS and appointment/follow-up tooling, implemented with React, tRPC, Drizzle, and a small TypeScript server.

## Tech summary
- Languages: TypeScript (primary), JavaScript
- Frontend: React + Vite (Manus used for preview/hosting)
- API: tRPC (end-to-end typed RPC surface), Zod for input validation
- Persistence: Drizzle ORM (MySQL or compatible DB expected from DATABASE_URL)
- Server runtime: Node + Express-style HTTP entry (TypeScript)
- Tooling: pnpm, Vitest (tests), Vite, vite-plugin-manus-runtime

## Verified SWOT (paraphrased and grounded in repo files)

Strengths
- Strong type-safety and modern stack: end-to-end typing and schema validation are applied (tRPC + Zod + Drizzle + React). See package.json and trpc.ts for dependencies and usage.
- Role-based access control: admin-only operations use an adminProcedure middleware that rejects non-admin callers with FORBIDDEN; critical admin flows are gated. (See trpc.ts and routers.ts.)
- Privacy-by-design and data minimization: the appointment model purposefully excludes clinical notes; WhatsApp follow-up drafts store only minimal metadata (name, service, preferred date); activity history records only reference, draft length, status, actor, and timestamp. (See persistence_plan.md, db.ts, todo.md.)
- Evidence-based content practices: clinic content research and an evidence-status column prevent publishing unverified claims (phone numbers, schedules, testimonials). (See klinik_berkat_content_research.md.)
- Test coverage for critical logic: unit tests exist for role resolution, follow-up constraints, admin enforcement, and validation logic. (See userRole.test.ts, followUpActivity.test.ts.)
- Basic bot protection: public appointment form employs a honeypot field to drop automated submissions quietly. (See routers.ts and appointmentRequest.ts.)
- Managed media uploads: uploads are done via presigned S3 PUT with namespaced, hashed keys and approved stored URLs used for public content — reducing arbitrary external-link risks. (See storage.ts and persistence_plan.md.)

Weaknesses
- Empty top-level README prior to this update, so onboarding and run instructions were missing.
- Spam protection is limited to a honeypot field; there is no visible rate limiting or CAPTCHA on public endpoints, which could leave the public appointment endpoint vulnerable to targeted abuse. (See routers.ts.)
- Role bootstrap is tied to a single owner identity (ownerOpenId) with no in-app role management UI, making multi-admin operations awkward. (See db.ts role logic.)
- Silent database degradation: getDb() returns null on connection failures and some DB code returns early, which can mask outages rather than surface errors. (See db.ts.)
- Platform coupling: Manus/Forge-specific environment variables and a vite-plugin-manus-runtime are used for storage and runtime behavior, reducing portability. (See storage.ts and package.json.)
- Partially unused data model: the persistence plan defines clinician and opening_schedule entities, but the UI/content is holding off publishing these until data is confirmed, which leaves those tables underused. (See persistence_plan.md.)

Opportunities
- Publish verified clinician profiles and schedules once clinic data is confirmed — the schema already supports these entities.
- Automate WhatsApp follow-ups by integrating WhatsApp Business API while preserving activity-tracking and audit history.
- Build operational dashboards from stored follow-up metrics (status, draft length, timestamps) for staff responsiveness and KPIs.
- Consolidate and confirm contact details to eliminate conflicting public sources and present a single, trusted contact channel.

Threats
- Conflicting public source data (phone numbers, schedules) risks publishing incorrect information if guardrails are relaxed. (See klinik_berkat_content_research.md.)
- Regulatory sensitivity: appointment requests still contain personal contact data and any expansion into clinical notes or PHI would increase privacy and compliance risk. (See persistence_plan.md.)
- Single point of admin failure: admin privileges tied to one owner identity mean losing that account would block CMS admin flows. (See db.ts.)
- Upstream dependency risk: reliance on Manus/Forge storage, OAuth, and hosting plugins means external outages or API changes could break uploads or authentication. (See storage.ts.)

## Verification & review notes
- Confirmed in-repo: RBAC, Zod validation, data-minimization choices, honeypot bot protection, presigned-upload storage flow, and unit tests are present and referenced throughout server/ and shared/ files.
- Unverified: I could not inspect the live Manus preview runtime at the provided URL — only repository contents were read. Production runtime behavior (hosted env, live DB, OAuth flows) are outside the read-only repo audit.
- Index limitation: some large files or generated artifacts may not have been fully indexed in my checks; for a comprehensive operational audit (including live-site checks and a full schema walkthrough), grant filesystem/browser access or run a live audit session.

## Suggested README additions made in this file
- Project overview and one-line summary (above)
- Tech stack and verification notes
- Quickstart: run commands found in package.json scripts (dev, build, preview, test). See package.json for exact script names.
- Required environment variables to supply before running (examples):
  - DATABASE_URL
  - BUILT_IN_FORGE_API_URL
  - BUILT_IN_FORGE_API_KEY
  - OWNER_OPENID (owner OAuth identity used for role bootstrap)

## Goal
Improve onboarding and developer confidence by documenting architecture, setup steps, environment variables, and the repository's privacy/data-minimization posture so reviewers and contributors can evaluate and run the project safely.

