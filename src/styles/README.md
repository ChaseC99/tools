# Tools design system

The design system is a CSS-first interface contract shared by Astro, React, Svelte, and Vue. Use native elements, compose the framework-neutral `ui-*` classes, and keep tool behavior inside the tool that owns it.

## Foundations

- `tokens.css` defines semantic light and dark themes, typography, spacing, radii, shadows, content widths, motion, and stacking levels.
- `base.css` provides the reset, page defaults, focus treatment, reduced-motion behavior, and visually hidden helper.
- `components.css` contains shared layout, controls, surfaces, feedback, data display, overlay, and file-action classes.
- `PageLayout.astro` owns the shared page width and responsive spacing. Its `fullBleed` option is reserved for viewport-filling tools.
- Set `data-theme="light"` or `data-theme="dark"` on the document or a container to apply a theme. The site theme control stores the visitor’s preference and otherwise follows the operating-system preference.

## Usage

Prefer semantic HTML and compose classes:

```html
<label class="ui-field">
  <span class="ui-label">Name</span>
  <input class="ui-input" type="text" />
  <span class="ui-hint">Supporting text</span>
</label>

<button class="ui-button" data-variant="secondary" data-size="sm">
  Action
</button>
```

Button variants are primary (no attribute), `secondary`, `ghost`, and `danger`. Sizes are `sm`, default, and `lg`. Layout primitives include `ui-stack`, `ui-inline`, `ui-grid`, `ui-workspace`, and `ui-action-bar`.

Form primitives include fields, inputs, textareas, selects, choices, switches, ranges, segmented controls, color fields, and disclosures. Apply `ui-select` to native selects: supporting fine-pointer desktop browsers receive the styled picker while touch devices retain the native picker.

Surface and result primitives include cards, panels, result/stat cards, alerts, progress, badges, empty states, data lists, tables, selectable cards, code panels, floating toolbars, and modal surfaces.

Use the shared React `ImageInput` for the compact image picker. Pass `formats` and `maxFileSize` for its short support line; place workflow instructions and privacy explanations in the surrounding page content.

Use semantic tokens for interface chrome. Hard-coded colors are reserved for generated content and specialized visuals such as canvases, images, QR output, charts, palettes, color spectra, coins, and spinner wheels.

## Accessibility

- Keep visible labels associated with form controls.
- Use native `disabled` and `aria-*` state attributes; shared CSS reads those states directly.
- Icon-only buttons require accessible labels.
- Disclosures use a button with `aria-expanded` and `aria-controls`.
- Segmented controls and selectable cards expose their selection with `aria-pressed` and support keyboard operation.
- Modals use a labelled dialog, move focus inside on open, close on Escape, and restore focus to the trigger.
- Announce transient copy, loading, validation, and completion states with `aria-live`, `role="status"`, or `role="alert"`.
- Keep the shared focus indicator. Motion automatically collapses for `prefers-reduced-motion`.

## Rollout status

The shared shell, homepage, 404 page, and every current tool page now use the design-system layout and semantic interface primitives. The rollout covers:

1. Forms and calculators: BMI, investment, shapes, case conversion, timer setup, and spinner.
2. Text workspaces: JSON formatter, text counter, and text diff.
3. Image workspaces: converter, filter, blur, background removal, palette, JPG compressor, QR code, and party emoji.
4. Timers and fullscreen tools: stopwatch, timer, chess clock, coin flip, and teleprompter.
5. Canvas and color tools: whiteboard and color picker.

Compatibility exports remain available from `@tools/shared/*` for the shared React image input, drop zone, download button, error message, spinner, and disclosure.

The `/design-system` gallery is development-only and omitted from production output. Future tools should start with these primitives; add a new shared primitive only when the same interface pattern is useful in more than one tool.
