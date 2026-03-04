# Add a New Tool

Add a new tool to the tools website. The user will describe what tool they want built.

## Steps

### 1. Create the tool component

Create a new directory under `src/tools/<tool-id>/` with the main component file. Use **React (.tsx)** by default unless the user specifies otherwise (Svelte and Vue are also supported).

Keep all tool-specific files (components, styles, logic, tests) in this directory.

**Path aliases available:**
- `@components/*` → `src/components/*`
- `@layouts/*` → `src/layouts/*`
- `@tools/*` → `src/tools/*`

**Shared utilities** live in `src/tools/shared/` — check there before building common functionality (e.g., image inputs, download buttons, error messages, etc.)

### 2. Create the page

Create `src/pages/<tool-id>.astro`:

```astro
---
import PageLayout from "@layouts/PageLayout.astro";
import MyComponent from "@tools/<tool-id>/MyComponent.tsx";
---

<PageLayout title="Tool Name" description="A concise description of what the tool does.">
  <MyComponent client:load />
</PageLayout>
```

**Client directives:**
- `client:load` — Interactive tools that need JS immediately (most tools)
- `client:visible` — Tools that can wait until scrolled into view (heavy/chart-based tools)

### 3. Add an icon

Add an SVG icon at `public/icons/tools/<tool-id>.svg`. The icon is displayed at 2rem × 2rem on the landing page tiles. Keep it simple and recognizable.

### 4. Register in ToolsList

Add an entry to the `tools` array in `src/components/ToolsList.astro`:

```js
{ name: "Display Name", id: "<tool-id>" }
```

The `id` must match the page filename and icon filename. The entry's `id` is used to derive both the route (`/<tool-id>`) and the icon path (`/icons/tools/<tool-id>.svg`).

**Optional fields** (only needed for special cases like Image Converter aliases):
- `href` — custom link (overrides `/<id>`)
- `icon` — custom icon id (overrides using `id` for icon lookup)

### 5. Install dependencies (if needed)

If the tool requires new npm packages, install them with `npm install <package>`.

## Conventions

- All tools run entirely client-side in the browser — no server/API calls
- Each tool gets its own page at `/<tool-id>`
- The `PageLayout` provides a consistent shell (navbar, meta tags, PostHog analytics)
- Tools should be self-contained and functional without sign-up or accounts
- Prefer simple, focused tools that do one thing well
