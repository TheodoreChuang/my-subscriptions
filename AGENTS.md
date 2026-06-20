<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Application Building Context

**Always read first**, before implementing or making any architectural decision:

1. `context/project-overview.md` — product definition, goals, core user flow, features, and scope
2. `context/architecture-context.md` — stack, architectural pillars, system boundaries, and invariants

**Read when relevant to the change:**

- `context/ui-context.md` — when building or changing UI (design goals, theme, layout, components, interaction states)
- `context/examples.md` — when writing a new vertical slice (the architectural pillars as concrete code)
- `context/project-setup.md` — read once when starting a new project (bootstrap checklist); not needed thereafter

If implementation changes the architecture, scope, or standards documented in the context files, update the relevant file before continuing.