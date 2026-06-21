# New Project Setup

> Read once, when starting a new project. These are the seams this template cares about
> that scaffolding won't set up for you — framed as outcomes, not exact commands, so the
> project picks the tooling. Once done, this file is no longer relevant.

Assumed starting point: `npx create-next-app@latest` (gives you the scaffold, strict TS,
lint, and a dev server). The checklist below covers what it does *not*.

- [x] `create-next-app` scaffold in place; strict TypeScript on
- [x] Lint, typecheck, and tests runnable locally
- [x] CI runs typecheck + lint + tests on pull requests
- [ ] Env vars validated via Zod at startup (see `code-standards.md`)
- [ ] System boundaries created — `app` / `frontend` / `modules` / `infrastructure` / `shared` (see `architecture-context.md`)
- [ ] Capability composition-roots stubbed for the capabilities this project actually uses (see Wiring in `architecture-context.md`)
- [ ] Tenancy and auth strategy decided and recorded in `project-overview.md` — these are expensive to reverse (see Cost to Reverse in `architecture-context.md`)
