# Examples

The canonical vertical slice and patterns for this scaffold — the architectural
pillars (`architecture-context.md`) as concrete code.

> **Bootstrap reference.** A new project has no code yet, so this file shows the
> target shape. Once real features establish these patterns in the codebase, the
> code itself becomes the reference and this file can be trimmed or removed.

---

## Vertical Slice

Data flows one direction; each layer has one job.

```txt
frontend → server action / route → service → repository → database
```

### Validation (at the boundary)

```ts
import { z } from "zod";

export const CreateTaskSchema = z.object({
  title: z.string().min(1),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
```

### Repository interface (owned by the application)

```ts
export interface TaskRepository {
  create(input: CreateTaskInput): Promise<Task>;
  getById(id: string): Promise<Task | null>;
}
```

### Repository implementation (in infrastructure)

```ts
export class PostgresTaskRepository implements TaskRepository {
  async create(input: CreateTaskInput) {
    return db.insert(tasks).values(input);
  }

  async getById(id: string) {
    return db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  }
}
```

### Service (business rules)

```ts
export async function createTask(
  input: CreateTaskInput,
  repository: TaskRepository,
) {
  return repository.create(input);
}
```

### Server action (thin)

```ts
"use server";

export async function createTaskAction(rawInput: unknown) {
  const input = CreateTaskSchema.parse(rawInput);
  return createTask(input, taskRepository);
}
```

### Route handler (thin)

```ts
export async function POST(request: Request) {
  const input = CreateTaskSchema.parse(await request.json());
  const task = await createTask(input, taskRepository);
  return Response.json(task);
}
```

---

## Capabilities

Feature code depends on the capability, never the vendor SDK — same pattern for
logging, feature flags, analytics, storage, and AI.

```ts
logger.info("Task created", { taskId });        // not console.log
featureFlags.isEnabled("new_dashboard");
trackEvent("task_created", { taskId });
await storage.upload({ path, file });
const result = await aiClient.generate(prompt);
```

---

## Background Jobs

Delegate long-running work; never block a request handler.

```ts
await triggerDesignGeneration({ projectId });    // not: await generateDesign(projectId)
```

---

## Errors

Throw structured errors, not a bare `Error`.

```ts
throw new ValidationError("Title is required");  // not: throw new Error("Something went wrong")
```

---

## Components

Presentation and interaction only; no business logic.

```tsx
export function TaskForm() {
  return <form action={createTaskAction}>...</form>;
}
```

---

## Testing

Test services by injecting a stub repository. Prefer a few meaningful tests over
shallow coverage.

```ts
it("creates a task", async () => {
  const repository = createRepositoryStub();
  const task = await createTask(input, repository);
  expect(task.title).toBe("Test");
});
```

Capabilities stub trivially:

```ts
const logger = { info: () => {}, error: () => {} };
const featureFlags = { isEnabled: () => false };
const analytics = { trackEvent: () => {} };
```
