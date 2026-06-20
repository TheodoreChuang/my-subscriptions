# Code Standards

## General

- Keep modules small and focused.
- Prefer simple solutions over clever solutions.
- Fix root causes rather than layering workarounds.
- Follow existing patterns before introducing new ones.
- Minimize the scope of changes.

---

## TypeScript

- Use strict typing.
- Avoid `any`.
- Prefer explicit interfaces for object contracts.
- Validate unknown input before use.

### Prefer

```ts
interface CreateTaskRequest {
  title: string;
}
```

### Avoid

```ts
const data: any = response;
```

---

## Next.js

- Default to React Server Components.
- Add `"use client"` only when required.
- Keep route handlers thin.
- Prefer Server Actions for simple mutations.

---

## Validation

Use Zod for external inputs.

Examples:

- Forms
- API requests
- Webhooks
- Environment variables
- AI outputs

---

## Error Handling

Use structured application errors where appropriate.

### Prefer

```ts
throw new ValidationError("Invalid title");
```

### Avoid

```ts
throw new Error("Something went wrong");
```

---

## Components

- Components should focus on presentation and interaction.
- Keep business logic outside UI components.
- Prefer composition over customization.

---

## Styling

- Use TailwindCSS and shadcn/ui.
- Use theme tokens instead of hardcoded colors.
- Reuse existing UI patterns where possible.

---

## Testing

Prioritize:

1. Business logic
2. Validation
3. Critical workflows

Prefer a small number of meaningful tests over large amounts of shallow coverage.

---

## When Making Changes

- Prefer modifying existing patterns over introducing new ones.
- Keep implementations consistent with the surrounding code.
- Explain significant architectural decisions in comments or documentation.