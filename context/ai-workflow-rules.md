# AI Workflow Rules

## Spec-Driven Development

Implementation follows defined specs, never ad-hoc interpretation of requirements:

- product context defines *what* (`project-overview.md`)
- architecture context defines *how* (`architecture-context.md`)
- code standards define the *rules of implementation* (`code-standards.md`)

Read the relevant spec before implementing; if it does not answer the question, resolve
the gap (see Requirements below) rather than guessing.

---

## Development Approach

Build incrementally.

- Prefer small, verifiable changes.
- Complete one feature or subsystem at a time.
- Avoid combining unrelated concerns in a single change.

---

## Scope Control

Split work when a change affects multiple areas:

- UI and backend logic
- Business logic and infrastructure
- Multiple unrelated features
- Large refactors and new functionality

If a change cannot be verified quickly, the scope is too large.

---

## Requirements

- Implement against documented requirements.
- Do not invent behavior that is not defined.
- If requirements are ambiguous, clarify before implementing.
- If requirements are missing, document the gap before proceeding.

---

## Follow Existing Patterns

- Prefer existing project patterns over introducing new ones.
- Reuse established abstractions and components.
- Keep architectural consistency across the codebase.

---

## Foundation Components

Do not modify third-party or generated components. If required, clarify the approach first.

Examples:

```txt
shadcn/ui
generated ORM files
generated API clients
```

---

## Keep Documentation Current

Update documentation when changing:

- Architecture
- System boundaries
- Feature scope
- Development conventions

Documentation should reflect the current implementation.

---

## Before Completing Work

Verify:

1. The feature works end-to-end.
2. Architecture invariants are respected.
3. Relevant tests pass.
4. Documentation remains accurate.