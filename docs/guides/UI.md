# shadcn/ui — technical guide for AI models

## Applicability and interoperability — revision 1.1 (2026-09-13)

This guide is independently usable. Companion guides are optional references: apply only the ones actually present and relevant to the task. A missing companion never requires installing the whole set, inventing its contents, or stopping work covered by this guide. Paths and project names in examples are templates, not facts about the current repository.

Honor the agent runtime's permissions and higher-priority instructions. Within project guidance, follow the explicit task, then applicable repository instructions and established conventions, then documentation for the installed version, then this guide's defaults. Existing insecure behavior is not a convention to preserve: fix it when in scope and report other findings. New-project defaults never authorize a dependency upgrade, migration, or restructuring of an existing project.

When guides are combined, topic ownership is: `COMMITS.md` for commit messages and Git actions; `CONTEXT.md` for `AGENTS.md`, `CLAUDE.md`, and project learning; `STRUCTURE.md` for file placement and build wiring; `JAVA.md` for backend implementation; `UI.md` for shadcn composition and APIs; `RESPONSIVENESS.md` for shared responsive/accessibility/PWA criteria. Product requirements decide whether PWA/offline is needed. Each guide retains the essentials needed when its companions are absent.

Mandatory rules apply within the requested scope. Validate changed behavior and concrete risks; use a full application audit only for a new application, a cross-cutting change, or an explicitly requested audit. Stop when the applicable acceptance criteria pass, or report a concrete environment blocker and the pending checks. Never claim an unexecuted check passed.

Deliver one report: outcome, relevant verification, and material limitations. Include a tree only for structural work and a suggested commit message when useful or requested; neither must be the last line. If the project learning workflow is active, put its short `LEARNING:` status last. Writing a suggested message never authorizes a commit or push.

---

> Reusable reference for building frontends with shadcn/ui. Read section 1 before doing any implementation. Consult the other sections as the task requires. Never invent components, props, commands, or paths: when in doubt, read the file installed in the project and the component's documentation.

## Identification sheet for this version of the guide

| Item | Verified value |
| --- | --- |
| Research date | 2026-09-09 |
| Local repository consulted | local clone of `shadcn-ui/ui`, commit `3ba91b1cc83e1bbe4ab35a422ff2a694849c5048` (2026-09-08) |
| `shadcn` CLI | 4.21.0 in the local repository, on npm (`latest`), and on GitHub Releases. Requires Node >= 20.18.1 |
| Default primitives base | Base UI (`@base-ui/react`) since 2026-07-02. Radix UI and React Aria are still supported |
| Visual styles | `vega`, `nova`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea` |
| Documented components | 65 pages on the Base UI base, plus `sonner` (Radix and React Aria). `menubar` and `navigation-menu` do not exist on the React Aria base |
| Official blocks | 27 (`dashboard-01`, `login-01` through `login-05`, `signup-01` through `signup-05`, `sidebar-01` through `sidebar-16`) |
| Official charts | 70 installable items (area, bar, line, pie, radar, radial, tooltip) |
| Community registries | 294 in the public index `https://ui.shadcn.com/r/registries.json` |
| Latest official changelog entry | September 2026: components now import `cn` from the `cn` package |

Dependency versions: see §3.4. Discrepancies between sources and unconfirmed items: see §12.

## Table of contents

- [0. How to use this guide](#0-how-to-use-this-guide)
- [1. Essential rules and workflow](#1-essential-rules-and-workflow)
- [2. How shadcn/ui works](#2-how-shadcnui-works)
- [3. Identifying the stack, versions, base, and configuration](#3-identifying-the-stack-versions-base-and-configuration)
- [4. Installation, CLI, file structure, and updating](#4-installation-cli-file-structure-and-updating)
- [5. Design tokens, themes, typography, icons, spacing, and variants](#5-design-tokens-themes-typography-icons-spacing-and-variants)
- [6. Catalog of official components](#6-catalog-of-official-components)
- [7. Blocks, charts, Typeset, Create, Directory, and registries](#7-blocks-charts-typeset-create-directory-and-registries)
- [8. Composition recipes](#8-composition-recipes)
- [9. Responsiveness, mobile experience, accessibility, and PWA](#9-responsiveness-mobile-experience-accessibility-and-pwa)
- [10. Animations, visual effects, performance, and browser verification](#10-animations-visual-effects-performance-and-browser-verification)
- [11. Common mistakes, patterns to avoid, and completion criteria](#11-common-mistakes-patterns-to-avoid-and-completion-criteria)
- [12. Sources, known limitations, and the procedure for updating this guide](#12-sources-known-limitations-and-the-procedure-for-updating-this-guide)

---

## 0. How to use this guide

### 0.1 Rule classification

- **[REQUIRED]**: cannot be violated. If an exception is unavoidable, record the justification in the final report.
- **[RECOMMENDED]**: the preferred standard. It may be swapped for another solution when there is a concrete reason, which must be explained.
- **[CONDITIONAL]**: applies only when the stated condition holds (for example, the Base UI base, a project with a PWA, a table with many columns).

### 0.2 Where the statements come from

Every statement in this guide comes from one of these sources. Where it matters, the origin is indicated in parentheses:

- **(official)**: documentation, registry code, or changelog at `ui.shadcn.com` and in the `shadcn-ui/ui` repository.
- **(skill)**: the official skill for agents, in `skills/shadcn` of the repository, installable with `npx skills add shadcn/ui`.
- **(dependency)**: documentation of the underlying library (Base UI, Radix UI, React Aria, Recharts, TanStack Table, react-day-picker, cmdk, Embla, input-otp, sonner).
- **(community)**: third-party registries listed in the Directory.
- **(guide)**: this document's own recommendation, derived from project rules that must be preserved.

Order of precedence in case of conflict: code installed in the project > component documentation for the installed version > official skill > this guide.

### 0.3 Minimum vocabulary

- **Base**: the library of accessible primitives the components are built on. Values: `base` (Base UI), `radix` (Radix UI), `aria` (React Aria).
- **Style**: a set of visual decisions (geometry, density, spacing) applied to the components' code. In `components.json` it appears as `base-nova`, `radix-lyra`, `aria-vega`, and so on.
- **Preset**: a short code (e.g., `b27GcrRo`) that bundles base, style, base color, theme, icons, fonts, radius, and menu options. Generated at `ui.shadcn.com/create`.
- **Registry**: a JSON catalog of installable items (components, blocks, hooks, utilities, files). The `@shadcn` registry is the official one; there are 294 community registries.
- **Semantic token**: a CSS variable with meaning (`--primary`, `--muted-foreground`) mapped to Tailwind utilities (`bg-primary`, `text-muted-foreground`).

---

## 1. Essential rules and workflow

### 1.1 Required workflow before implementing a screen

1. **Understand the request.** List screens, flows, data entities, main actions, and states (loading, empty, error, success, unavailable, offline where applicable).
2. **Identify the project.** In an existing project, run `npx shadcn@latest info --json` (or the project's runner, see §4.1) and read `components.json`. Note: `base`, `style`, `tailwindVersion`, `tailwindCssFile`, `aliases`, `iconLibrary`, `rsc`, `packageManager`, and installed components. In a new project, set these values with `init` or with a preset (§4.2). Never assume the base.
3. **Take inventory.** List the components already installed in the directory pointed to by `resolvedPaths.ui`, the project's shared components, the layouts, and the tokens defined in the global CSS.
4. **Map each interface need in this order** [REQUIRED]: a component that already exists in the project → an official shadcn/ui component → a composition of official components → an official block → a community registry item → a reusable custom component. Record the decision and the reason whenever you move further down the list.
5. **Read the documentation for whatever you're going to use.** Run `npx shadcn@latest docs <component>` and read the URLs it returns, or open the installed file. Confirm the base-specific API (§2.4). Do not write code from the model's memory.
6. **Install what's missing.** `npx shadcn@latest add <items>`. Before updating something that is already installed, use `--dry-run` and `--diff` (§4.6).
7. **Design the screen.** Mobile-first, visual hierarchy, appropriate density, states, and interactions via touch, mouse, and keyboard (§5.9 and §9).
8. **Implement** using `FieldGroup`/`Field` in forms, semantic tokens, existing variants, `data-icon` on icons, and `cn()` for conditional classes.
9. **Run and verify in the browser.** Viewport matrix, keyboard, states, automated and manual accessibility, animations (§10).
10. **Report with evidence.** What was tested, how, at which sizes, and what could not be validated.

### 1.2 Required rules (summary)

Structure and component selection

1. [REQUIRED] shadcn/ui is the foundation of the visual system. Look for an existing component, an official one, or a composition before creating your own solution.
2. [REQUIRED] Compose, don't reinvent: a settings page = `Tabs` + `Card` + form controls; a dashboard = `Sidebar` + `Card` + `Chart` + `Table`. (skill)
3. [REQUIRED] Use the appropriate components for buttons, fields, selectors, menus, messages, and dialogs. Do not use `window.alert`, `window.confirm`, or `window.prompt` as a normal application interface. Use `AlertDialog` for confirmation, `Dialog` for tasks, and `toast` or `Alert` for messages.
4. [REQUIRED] Items always inside their group: `SelectItem` in `SelectGroup`, `DropdownMenuItem` in `DropdownMenuGroup`, `CommandItem` in `CommandGroup`, `TabsTrigger` in `TabsList`. (skill)
5. [REQUIRED] `Dialog`, `Sheet`, and `Drawer` always with a title (`DialogTitle`, `SheetTitle`, `DrawerTitle`); use `className="sr-only"` if the title shouldn't be visible. (skill)
6. [REQUIRED] `Avatar` always with `AvatarFallback`. (skill)
7. [REQUIRED] Forms with `FieldGroup` + `Field` + `FieldLabel` (+ `FieldDescription`, `FieldError`). Never a `div` with `space-y-*` as the form layout. Invalid state: `data-invalid` on the `Field` and `aria-invalid` on the control. (skill)
8. [REQUIRED] `InputGroup` uses `InputGroupInput`/`InputGroupTextarea`, never a raw `Input`/`Textarea` inside it. A button inside a field = `InputGroup` + `InputGroupAddon`. (skill)
9. [REQUIRED] A set of 2 to 7 mutually exclusive or combinable options = `ToggleGroup`, not a loop of `Button`s with manual state. (skill)
10. [REQUIRED] Callout = `Alert`; empty state = `Empty`; divider = `Separator`; loading placeholder = `Skeleton`; status label = `Badge`. Don't recreate these with a styled `div`. (skill)
11. [REQUIRED] Transient notifications follow the base: `toast` from `@/components/ui/toast` in Base UI projects; `toast()` from `sonner` in Radix and React Aria projects. (skill)

Style

12. [REQUIRED] Semantic colors: `bg-primary`, `text-muted-foreground`, `text-destructive`. Never `bg-blue-500`, `text-gray-600`, or `text-emerald-600` for states. (skill)
13. [REQUIRED] No manual `dark:` for colors; the tokens already cover both modes. (skill)
14. [REQUIRED] `className` at the point of use is for layout (width, margin, grid), not for overriding a component's color or typography. To change the appearance, use an existing variant, a token, or edit the component's file (you own the code). (skill)
15. [REQUIRED] Spacing with `flex`/`grid` + `gap-*`; never `space-x-*`/`space-y-*`. Equal dimensions with `size-*`. Truncation with `truncate`. (skill)
16. [REQUIRED] Conditional classes with `cn()` (imported from `cn`, or from `@/lib/utils` in older projects). (skill)
17. [REQUIRED] No manual `z-index` on `Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `DropdownMenu`, `Popover`, `Tooltip`, `HoverCard`. (skill)
18. [REQUIRED] Icons: import from the library configured in `iconLibrary`; in `Button` use `data-icon="inline-start"` or `data-icon="inline-end"`; don't put size classes on icons inside components; pass icons as components (`icon={CheckIcon}`), not as a string key. (skill)

Primitives base

19. [REQUIRED] Check the base before writing a composition: Base UI uses `render={<Button />}`; Radix uses `asChild`; React Aria has its own compositions (§2.4). Never mix APIs from different bases.
20. [REQUIRED] On Base UI and React Aria, don't use `Button` as a link. Use `buttonVariants()` on an `<a>` (or on the framework's `Link`). (official)

Process and verification

21. [REQUIRED] Don't decode presets manually; use `preset decode`, `preset resolve`, `apply`. Don't fetch raw files from GitHub to update components; use `add --dry-run/--diff`. (skill)
22. [REQUIRED] Review the diff before `add --overwrite`. Existing task authorization is sufficient for the reviewed update, but it does not authorize discarding unrelated customizations. Preserve/merge local changes; ask only if a remaining destructive choice is not already authorized. (project policy)
23. [REQUIRED] When installing items from community registries, read the added files, fix imports to match the project's aliases, and swap the icon library when it differs. (skill)
24. [REQUIRED] Mobile-first. Every screen works at 320 px wide with no accidental horizontal scrolling, and with touch, mouse, and keyboard.
25. [REQUIRED] Every interactive element has an accessible name, a visible focus state, and a comfortable touch target (reference: 44 × 44 CSS px for frequent actions).
26. [REQUIRED] No essential functionality depends on hover or a gesture alone.
27. [REQUIRED] Every action communicates its result: pressed, loading, disabled, success, error. Avoid double submission.
28. [REQUIRED] Don't claim something was tested without having run the check and recorded the evidence. Distinguish between automated tests, visual inspection, emulation, and a real device.
29. [REQUIRED] An animation only counts as verified when the real interaction was triggered in the browser and the transition was observed (§10.3). Code, CSS classes, or a screenshot of the final state do not prove animation.
30. [REQUIRED] `prefers-reduced-motion` is respected; the application remains fully usable with reduced motion.

### 1.3 What this guide does not mandate

- `Drawer`, `Sheet`, bottom navigation, and a fixed header are available patterns, not requirements. Choose based on the content and the flow (§9.4).
- PWA, service worker, and offline support are conditional on the product (§9.8).
- Animations and effects are optional and must have a purpose (§10.1).
- How many blocks and registries to explore depends on the project; explore when there's a real gain for the product's purpose and identity.

### 1.4 Custom appearance and native platform features

General rule [REQUIRED]: avoid controls with the browser's default appearance when a suitable alternative exists in the visual system. This preference does not prohibit semantic HTML or essential platform behaviors.

| Need | Use | Don't use | Note |
| --- | --- | --- | --- |
| Button, link that looks like a button | `Button`; `buttonVariants()` on an `<a>` | `<button>` without styling; `<div onClick>` | An `<a>` is still an `<a>` (link semantics) |
| Text, email, phone, number, URL, or code field | `Input` with the correct `type`, `inputMode`, `autoComplete`, `enterKeyHint` | a raw `<input>` | `Input` passes native attributes through; the right virtual keyboard depends on them |
| Single selection with a custom menu | `Select` | a raw `<select>` | A menu with the visual system's appearance, with keyboard and screen reader covered |
| Selection with search, many items, or multiple selection | `Combobox` | `Select` with dozens of items | Base UI and Radix use Base UI's Combobox; React Aria uses react-aria-components |
| Selection where the phone's native behavior is preferable (short list, simple form, performance) | `NativeSelect` | | The only case where the menu's appearance is the operating system's; the box itself is styled |
| Date | `Calendar` inside a `Popover` (Date Picker) | `<input type="date">` as the default | In very simple mobile flows, an `<input type="date">` styled like an `Input` is acceptable when the native picker is clearly better for the user; record the decision |
| Confirmation, alert, prompt | `AlertDialog`, `Dialog`, `toast`/`Alert` | `window.alert/confirm/prompt` | |
| Action menu | `DropdownMenu`, `ContextMenu`, `Menubar` | `<select>` used as a menu | |
| Tooltip | `Tooltip` | `title=""` as the only mechanism | `title` may exist as a supplement, never as the only way to convey information |
| Checkbox, radio, toggle | `Checkbox`, `RadioGroup`, `Switch` | unstyled native inputs | `Questionnaire` uses native radios and checkboxes styled internally |
| File upload | `<input type="file">` (hidden or not) triggered by a `Button`, or a drag-and-drop area | a custom "file explorer" | The file picker is controlled by the operating system |
| Permissions (camera, location, notifications) | Call the browser API after an explicit user action | Simulating a permission dialog | The permission dialog belongs to the browser; the application only controls the timing and the explanation beforehand |
| Scroll, text selection, zoom | Native behavior | global `user-select: none`; `user-scalable=no` | `ScrollArea` styles the bar without replacing native scrolling |

Always preserve: keyboard navigation, focus, zoom (pinch and Ctrl +), text selection in content, autofill (`autoComplete`), the appropriate virtual keyboard, `<form>` with submission via Enter, and `<label>` associated with the control.

---

## 2. How shadcn/ui works

### 2.1 What it is (and what it isn't)

shadcn/ui is not a library installed as a package. It's a set of components whose **source code is copied into your project** by a CLI, plus a distribution system (the registry) and a configuration schema (`components.json`). Official principles: Open Code, Composition, Distribution, Beautiful Defaults, AI-Ready. (official)

Practical consequences:

- You own the code in `components/ui/*`. Customize it by editing the file, adding variants, or composing wrappers. There is no library "override."
- Behavior fixes arrive through the primitive dependencies (`@base-ui/react`, `radix-ui`, `react-aria-components`, `input-otp`, etc.). Visual fixes arrive through the registry and require `add --diff` to merge with your changes.
- Every component follows a predictable composed interface: `Root` + parts (`Trigger`, `Content`, `Header`, `Title`, `Description`, `Footer`, `Item`, `Group`...). This also applies to compatible third-party components.

### 2.2 Anatomy of an installed component

An installed file (e.g., `components/ui/button.tsx`) contains:

- imports of the base primitive (e.g., `import { Button as ButtonPrimitive } from "@base-ui/react/button"`);
- `cva` (`class-variance-authority`) defining `variants` and `defaultVariants`;
- `cn` from the `cn` package (projects created before September 2026 import it from `@/lib/utils`, which now re-exports `cn`);
- a `data-slot="<name>"` attribute on each part, useful for styling by selector (`*:data-[slot=card-footer]:...`);
- explicit Tailwind classes for the chosen style. In the official monorepo, components use `cn-*` hooks (e.g., `cn-button-variant-default`) that the build replaces with each style's real classes; the file that arrives in your project already contains the expanded classes. Open the installed file to see the real classes before changing anything.

A real example of the `Button` signature on the Base UI base (official, from the commit consulted):

```tsx
function Button({ className, variant = "default", size = "default", ...props }:
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
export { Button, buttonVariants }
```

### 2.3 Composition and customization: order of preference

[REQUIRED] When adjusting a component's appearance or behavior, follow this order (skill, customization.md):

1. **An existing variant or prop**: `variant="outline"`, `size="sm"`, `orientation="horizontal"`.
2. **Layout classes via `className`**: `max-w-md`, `mx-auto`, `mt-4`, `w-full`.
3. **A semantic token or a new CSS token** in the global file (§5.3): `bg-warning text-warning-foreground`.
4. **A new variant in the component file's `cva`**: for example `warning: "bg-warning text-warning-foreground hover:bg-warning/90"` in `button.tsx`.
5. **A composition wrapper** in `components/` (outside `ui/`): `ConfirmDialog`, `PageHeader`, `DataTablePagination`. Wrappers preserve the composed API and centralize product rules.
6. **Editing the component directly** for structural changes (adding a part, changing an animation). Document the change in a short comment at the top of the file to make future `add --diff` runs easier.

Golden rule: visual identity changes live in tokens, the style (preset), and files in `ui/`; layout changes live at the point of use; business rules live in wrappers and pages.

### 2.4 Primitive bases: Base UI, Radix UI, and React Aria

Each project uses **one** base, recorded in the `style` prefix in `components.json` (`base-nova`, `radix-nova`, `aria-nova`). Styles without a prefix (`new-york`, `default`) are legacy styles built on Radix (§3.2). The components' public API is the same across all three bases wherever possible (`Dialog`, `DialogContent`, `DialogTrigger`...), but there are differences that will break your code if ignored.

| Topic | Base UI (`base`) | Radix (`radix`) | React Aria (`aria`) |
| --- | --- | --- | --- |
| Swapping the element rendered by a trigger/close control | `render={<Button />}`; content as the trigger's children | `asChild` with the element as the child | Its own composition: the trigger wraps the button and the content (e.g., `DialogTrigger > Button + Dialog`) |
| A trigger that isn't a native button (`<a>`, `<span>`) | `render={<a />}` + `nativeButton={false}` | `asChild` with an `<a>` | Check the component's docs |
| `Button` as a link | Don't use `Button`; use `<a className={buttonVariants({ variant })}>` (Button applies `role="button"`) | `<Button asChild><a href/></Button>` works | Same as Base UI: `buttonVariants` on an `<a>` |
| `Select` | `items` is required on the root; `<SelectValue placeholder="...">` (docs) or an item `{ value: null }` (skill); `alignItemWithTrigger` on `SelectContent`; supports `multiple`, object values with `itemToStringValue`, and a function child in `SelectValue` | No `items`; `<SelectValue placeholder>`; `position="popper"`; a single string value | `placeholder` on the `Select` root; `SelectItem id="..."` instead of `value` |
| `ToggleGroup` | Single selection with no prop; `multiple` for multiple selection; `defaultValue`/`value` always an array; `spacing` (default 2 since 2026-05-17; `spacing={0}` for flush items) | `type="single"` or `type="multiple"`; a string value for single selection | `selectionMode="single"` or `"multiple"` |
| `Slider` | `defaultValue={50}` for a single thumb; an array for a range | Always an array (`[50]`) | Check the docs |
| `Accordion` | No `type`; `multiple` for several open at once; `defaultValue` as an array | `type="single" collapsible defaultValue="item-1"` or `type="multiple"` | Check the docs |
| State attributes for CSS | `data-open`, `data-closed`, `data-starting-style`, `data-ending-style`, `data-popup-open` | `data-[state=open]`, `data-[state=closed]` | React Aria attributes (`data-selected`, `data-pressed`, `data-focus-visible`...) |
| Enter/exit animations | CSS transitions with `data-starting-style:`/`data-ending-style:` | `data-[state=open]:animate-in` / `animate-out` (tw-animate-css) | Transitions/animations per the docs |
| `Tabs` | Manual activation by default (focus doesn't change the tab) | Automatic activation by default | Check the docs |
| `Drawer` | `@base-ui/react/drawer`: `swipeDirection` (`up`, `right`, `down`, `left`), `showSwipeHandle`, `snapPoints`, `modal`, `disablePointerDismissal` | `vaul`: `direction` (`top`, `right`, `bottom`, `left`), `asChild` | Check the docs |
| Toast | `toast.add({...})` from `@/components/ui/toast` + `<Toaster />` (Base UI Toast) | `sonner` (`toast()` + `<Toaster />` from `@/components/ui/sonner`); the registry's `toast` is deprecated | `sonner` |
| `Combobox` | `@base-ui/react` Combobox | Also the `@base-ui/react` Combobox (the Radix project receives `@base-ui/react` as a dependency) | `react-aria-components` |
| `HoverCard` | Base UI's Preview Card primitive (the public name is still `HoverCard*`) | Radix Hover Card | Check the docs |
| `Menubar`, `NavigationMenu` | Available | Available | Do not exist |
| Close icon, spinner, and internal icons | The registry's `IconPlaceholder` is resolved to the project's `iconLibrary` at install time | Same | Same |

[REQUIRED] rules:

- Determine the base with `npx shadcn@latest info` (the `base` field) or from the `style` prefix. In legacy projects (`new-york`, `default`), the base is Radix.
- Use `npx shadcn@latest docs <component>` to get the documentation URL matching the project's base (`/docs/components/base/...`, `/docs/components/radix/...`, `/docs/components/aria/...`). Don't read another base's documentation.
- Don't install primitives from another base "just for one component." The official exception is `Combobox` in Radix projects, which already brings in `@base-ui/react` as a dependency declared in the registry.
- Radix → Base UI migration exists as an official skill (`skills/migrate-radix-to-base`, triggered by "migrate accordion to base-ui" after running `npx skills add shadcn/ui`). It's incremental, one component at a time, and generates reports in `.migration/`. Don't migrate on your own without an explicit request. (official)

### 2.5 Styles, presets, and the visual layer

Eight styles change geometry, spacing, and density, not just colors (official, changelog Dec 2025 through May 2026):

| Style | Official description | When to choose it (guide) |
| --- | --- | --- |
| `vega` | The classic shadcn/ui look; clean, neutral, and familiar | Products that want the recognizable "shadcn default" |
| `nova` | Reduced padding and margins; compact layouts (the `init` default) | Work applications with a lot of content per screen |
| `maia` | Soft and rounded, generous spacing | Friendly, consumer-facing products, onboarding |
| `lyra` | Square and crisp; pairs well with mono fonts | Technical tools, dev tools, data |
| `mira` | Compact, built for dense interfaces | Admin panels, large tables |
| `luma` | Rounded geometry, soft elevation, airy layouts (inspired by macOS Tahoe) | Premium products, a focus on visual comfort |
| `sera` | Minimal, editorial, typographic; underlined controls, uppercase headings, serif headings | Editorial content, brands with a typographic personality |
| `rhea` | Compact Luma: less spacing, denser surfaces | Focused product interfaces with more information without losing softness |

A **preset** combines: base, style, `baseColor` (7 options), `theme` (24 color themes), `chartColor`, `iconLibrary` (5 options), `font` (26 fonts) and `fontHeading`, `radius` (default, none, small, medium, large), `menuAccent` (subtle, bold), `menuColor` (default, inverted, default-translucent, inverted-translucent), `rtl`, `pointer`, and `template`. The preset code does **not** encode the base; the CLI preserves the project's current base when applying it (official, cli.md).

### 2.6 Registry and distribution

- Items have `name`, `type` (`registry:ui`, `registry:block`, `registry:component`, `registry:hook`, `registry:lib`, `registry:page`, `registry:file`, `registry:theme`, `registry:style`, `registry:base`, `registry:font`, `registry:item`), `files`, `dependencies` (npm), `registryDependencies` (other items), `cssVars`, `css`, and `docs`.
- Addresses accepted by `add`, `view`, and `search`: `button` (official), `@acme/button` (a configured namespace or one from the Directory), `owner/repo/item[#ref]` (public GitHub, or private with `gh` credentials), `https://.../button.json` (a URL), `./button.json` (a local file).
- Directory registries work with no configuration: `npx shadcn@latest add @magicui/shimmer-button`.

---

## 3. Identifying the stack, versions, base, and configuration

### 3.1 Discovery command

[REQUIRED] In any project with a `components.json`, start with:

```bash
npx shadcn@latest info --json
```

Fields that change the code you'll write (skill, cli.md):

| Field | Effect |
| --- | --- |
| `base` | The components' API (`render` vs. `asChild`, `items`, `multiple`...) |
| `style` | Density and geometry; the name used by the registry (`base-nova`) |
| `tailwindVersion` | `v4`: tokens in `@theme inline`; `v3`: `tailwind.config.js` and `hsl(var(--x))` |
| `tailwindCssFile` | Where `:root`, `.dark`, and `@theme inline` live. New tokens go here, never in a new file |
| `aliases` and `resolvedPaths` | The real import prefix (`@/`, `~/`, `#components`, `@workspace/ui`) and the physical directories |
| `iconLibrary` | The icon package: `lucide-react`, `@tabler/icons-react`, `@hugeicons/react` + `@hugeicons/core-free-icons`, `@phosphor-icons/react`, `@remixicon/react` |
| `rsc` / `isRSC` | If `true`, components with state, effects, handlers, or browser APIs need `"use client"` |
| `tsx` | `false` generates `.jsx` |
| `framework`, `frameworkVersion` | Routing and file conventions (Next.js App Router, Vite SPA, React Router, TanStack Start, Astro, Laravel) |
| `packageManager` | The correct runner for extra dependencies (`pnpm add`, `npm install`, `bun add`, `yarn add`) |
| `rtl` | If `true`, the CLI converts physical classes to logical ones at install time |
| `components` | The installed list: don't reinstall, and don't import what doesn't exist |
| `registries` | Namespaces configured in `components.json` and `package.json` |
| `preset` | The resolved code of the current preset (`preset resolve --json`) |

Without a `components.json`, the project either doesn't use the CLI (manual copying) or hasn't been initialized yet. Check `package.json` (`shadcn`, `@base-ui/react`, `radix-ui`, `react-aria-components`, `tailwindcss`) and whether `components/ui` exists.

### 3.2 Legacy styles and older projects

| Signal | Meaning | Action |
| --- | --- | --- |
| `style: "new-york"` or `"default"` | A legacy style on top of Radix. `default` is deprecated | Keep using Radix; `npx shadcn@latest migrate radix` consolidates imports into `radix-ui`. There is no `base-new-york`; switching to a new style changes the app's appearance |
| Separate `@radix-ui/react-*` imports | A project predating February 2026 | `migrate radix` |
| A populated `tailwind.config.js` and `hsl(var(--x))` colors | Tailwind v3 | Docs at `https://v3.shadcn.com`; the new styles require Tailwind v4 and React 19 |
| `lib/utils.ts` with `clsx` + `twMerge` | Predates September 2026 | It works. `migrate cn` switches to the `cn` package (Tailwind v4 only) |
| `tailwindcss-animate` in the CSS | Predates March 2025 | Replace it with `tw-animate-css` (`@import "tw-animate-css"`) |
| No `@import "shadcn/tailwind.css"` | A project predating Base UI support (December 2025) or ejected with `eject` | The `data-open:` variants and the `no-scrollbar`, `scroll-fade`, and `shimmer` utilities may be missing; install `shadcn` and import it, or copy it via `eject` |

### 3.3 Where each setting lives

- `components.json`: `$schema`, `style`, `rsc`, `tsx`, `tailwind.{config,css,baseColor,cssVariables,prefix}`, `iconLibrary`, `aliases`, `registries`, `rtl`. The `style`, `baseColor`, and `cssVariables` fields should not be edited by hand after `init`; use `apply`, `init --preset --force`, or `migrate base-color`.
- Global CSS (`tailwindCssFile`): `@import "tailwindcss"`, `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, `@custom-variant dark (&:is(.dark *))`, `@theme inline { ... }`, `:root { ... }`, `.dark { ... }`, `@layer base { ... }`.
- Aliases: `tsconfig.json`/`jsconfig.json` `paths` **or** `package.json#imports` (`#components/*`, `#lib/*`, `#hooks/*`) with `moduleResolution: "bundler"` and `resolvePackageJsonImports: true`.
- Monorepo: a `components.json` in each workspace; `ui` and `utils` point to `@workspace/ui/...`; `style`, `iconLibrary`, and `baseColor` are identical in both files; with Tailwind v4, the `tailwind.config` field is left empty.

### 3.4 Reference versions

Distinguish three things: the **CLI** version (`shadcn`), the versions of the project's **dependencies**, and the **version of the components' code**, which has no number: it's the contents of the registry on the date you ran `add`. To find out whether an installed component is behind the registry, use `npx shadcn@latest add <name> --diff`.

Versions observed on 2026-09-09 (official, `apps/v4/package.json` and the registry; npm checked the same day only for the packages with a value in the third column; empty cells were not checked):

| Package | Used by the official site/registry | Latest on npm | Note |
| --- | --- | --- | --- |
| `shadcn` (CLI) | 4.21.0 | 4.21.0 | They match |
| `@base-ui/react` | 1.6.0 | 1.8.0 | The registry declares the dependency without pinning a version; new projects get the latest one. Test the components after installing; check the Base UI changelog if something differs |
| `radix-ui` | ^1.4.3 | 1.6.7 | Not pinned in the registry |
| `react-aria-components` | 1.20.0 | 1.21.1 | Same |
| `tailwindcss` | ^4.3.0 | 4.3.3 | The new styles require v4 |
| `react` / `react-dom` | 19.2.x | | Templates use 19.2 |
| `recharts` | 3.8.0 (pinned in the `chart` item) | 3.10.1 | The `chart` item installs `recharts@3.8.0` |
| `cn` | ^0.2.2 | 0.2.6 | Replaces `clsx` + `tailwind-merge` (Tailwind v4) |
| `class-variance-authority` | ^0.7.1 | | |
| `@tanstack/react-table` | ^9.0.0 | | The Data Table guide uses the v9 API (`tableFeatures`, `useTable`) |
| `react-day-picker` | ^9.7 (registry: `@latest`) + `date-fns` ^4 | | Calendar |
| `cmdk` | ^1.1.1 | | Command |
| `input-otp` | ^1.4.2 | | InputOTP |
| `embla-carousel-react` | 8.5.2 | | Carousel |
| `react-resizable-panels` | ^4 | | Resizable |
| `sonner` | ^2.0.0 + `next-themes` | | Toast on Radix/Aria |
| `lucide-react` | 0.474.0 | | The default icon library |
| `@shadcn/react` | 0.3.1 | | Headless MessageScroller and Questionnaire |
| `@shadcn/helpers` | 0.2.0 | | Chat mocks for the AI SDK and TanStack AI |
| `react-hook-form` / `@hookform/resolvers` / `zod` | ^7.62 / ^3.10 / ^3.25 (zod 4 accepted) | | Forms |
| `next-themes` | 0.4.6 | | Dark mode in Next.js |

Node: the CLI requires `>= 20.18.1`.

---

## 4. Installation, CLI, file structure, and updating

### 4.1 The correct runner

[REQUIRED] Run the CLI with the runner for the project's package manager (the `packageManager` field from `info`, or the lockfile): `npx shadcn@latest ...`, `pnpm dlx shadcn@latest ...`, `bunx --bun shadcn@latest ...`, `yarn dlx shadcn@latest ...`. The examples below use `npx`. There is no `--package-manager` flag; the CLI detects it from the lockfile. Use only documented flags; don't invent flags.

### 4.2 A new project

Three official paths:

1. **shadcn/create** (`https://ui.shadcn.com/create`): build the preset visually and copy the generated command, for example `npx shadcn@latest init --preset [CODE] --template next`. The page is rendered on the client; the available options are listed in §2.5.
2. **Interactive CLI**: `npx shadcn@latest init -t next` (or `vite`, `start`, `react-router`, `astro`, `laravel`), with `--monorepo` for Next, Vite, Start, React Router, and Astro. `npx shadcn@latest create` is an alias for `init`.
3. **An existing project**: install Tailwind v4 and the `@/*` alias, then run `npx shadcn@latest init`.

Examples (official):

```bash
npx shadcn@latest init --name my-app --preset base-nova
npx shadcn@latest init --name my-app --preset a2r6bw --template vite
npx shadcn@latest init --name my-app --preset base-nova --template next --monorepo
npx shadcn@latest init -b radix          # forces Radix instead of the Base UI default
npx shadcn@latest init --base aria       # React Aria
npx shadcn@latest init --defaults        # next template + nova preset (Base UI)
npx shadcn@latest init --rtl --pointer   # project options that aren't part of the preset
```

Named presets accepted by `--preset`: `nova`, `vega`, `maia`, `lyra`, `mira`, `luma` (skill), along with the codes and URLs from `/create`. `rhea` and `sera` are available via a preset code from `/create`. The Laravel template does not support monorepos.

Manual installation (no CLI): the dependencies `shadcn class-variance-authority cn lucide-react tw-animate-css`, the alias, global CSS with tokens (§5.1), `lib/utils.ts` with `export { cn } from "cn"`, and a `components.json`. Only use this when the CLI isn't viable.

### 4.3 CLI 4.21.0 commands

| Command | Use | Main flags |
| --- | --- | --- |
| `init` / `create` | Initializes or creates a project | `-t/--template`, `-b/--base` (`base`, `radix`, `aria`), `-p/--preset`, `-d/--defaults`, `-f/--force`, `-n/--name`, `-c/--cwd`, `--css-variables`/`--no-css-variables`, `--monorepo`/`--no-monorepo`, `--rtl`/`--no-rtl`, `--pointer`/`--no-pointer`, `--reinstall`/`--no-reinstall`, `-y`, `-s` |
| `add [items...]` | Adds components, blocks, registry items, URLs, local files | `-o/--overwrite`, `-a/--all`, `-p/--path`, `-c/--cwd`, `--dry-run`, `--diff [file]`, `--view [file]`, `-y`, `-s` |
| `apply [preset]` | Applies a preset to an existing project (reinstalls detected components, fonts, and variables) | `--preset`, `--only theme`, `--only font`, `--only theme,font`, `-c`, `-y`, `-s` |
| `preset decode <code>` | Shows the contents of a code | `--json` |
| `preset resolve` / `preset info` | Resolves the current project's preset | `-c`, `--json` |
| `preset url <code>` / `preset open <code>` | The `/create` URL for the code; opens it in the browser | |
| `search [registries...]` / `list` | Fuzzy search across registries (`@shadcn`, `@acme`, `owner/repo`, URL). With no argument, all configured ones | `-q/--query`, `-t/--type` (`ui`, `block`, `hook`...), `-l/--limit`, `-o/--offset`, `--json` |
| `view <items...>` | Details and contents of items that aren't installed | `-c` |
| `docs <components...>` | Documentation, example, and API URLs for the project's base | `-b/--base`, `--json` |
| `info` | Project context | `--json`, `-c` |
| `build [registry.json]` | Generates the JSON for your own registry in `public/r` | `-o/--output`, `-c` |
| `registry validate [target]` | Validates a local `registry.json`, an `owner/repo`, or a URL before publishing | |
| `migrate <cn\|icons\|base-color\|rtl\|radix> [path]` | Automated migrations | `-l/--list`, `-f/--from`, `-t/--to`, `-y` |
| `eject` | Inlines `shadcn/tailwind.css` into the global CSS and removes the `shadcn` dependency (irreversible) | `-c`, `-y`, `-s` |
| `mcp` / `mcp init --client <claude\|cursor\|vscode\|codex\|opencode>` | MCP server and editor configuration | |
| `diff` | Deprecated; use `add <item> --diff` | |

### 4.4 Typical file structure

Next.js (App Router), `@/` aliases:

```txt
app/
  globals.css          # tokens, @theme inline, :root, .dark, @layer base
  layout.tsx           # fonts (next/font), ThemeProvider, Toaster, TooltipProvider
components/
  ui/                  # files installed by the CLI (don't put business components here)
  app-sidebar.tsx      # product compositions
  login-form.tsx
hooks/
  use-mobile.ts        # installed by the sidebar item (breakpoint 768)
lib/
  utils.ts             # export { cn } from "cn"
components.json
```

Vite: `src/index.css`, `src/components/ui`, `src/lib/utils.ts`, and the `@` alias pointing to `./src` in `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts`.

Official monorepo: `apps/web` (the app, `components.json`, product components) and `packages/ui` (`src/components`, `src/hooks`, `src/lib`, `src/styles/globals.css`, `components.json`); imports like `@workspace/ui/components/button`. Run `add` inside `apps/web` or with `-c apps/web`.

[RECOMMENDED] rules:

- `components/ui/` receives registry items only (official or third-party). Product compositions go in `components/` or in folders organized by domain.
- An installed block (`login-03`) puts the page in `app/login/page.tsx` (or the equivalent target) and the components in `components/`. Rename and move them to match the project's architecture, keeping the imports intact.
- Don't create a second CSS file for tokens; edit `tailwindCssFile`.

### 4.5 Installing components and items

```bash
npx shadcn@latest add button card dialog        # official ones
npx shadcn@latest add login-03 dashboard-01      # blocks
npx shadcn@latest add chart-area-interactive     # a chart from the charts library
npx shadcn@latest add @magicui/shimmer-button    # community registry (Directory)
npx shadcn@latest add acme/toolkit/auth-kit      # GitHub registry (owner/repo/item)
npx shadcn@latest add https://acme.com/r/x.json  # URL
npx shadcn@latest add --all                      # all official ones (rarely desirable)
```

Before installing [REQUIRED]: check the `components` list from `info`; the CLI resolves `registryDependencies` automatically (e.g., `sidebar` brings in `button`, `input`, `separator`, `sheet`, `skeleton`, `tooltip`, `use-mobile`). After installing third-party items, read the files, fix imports (`@/components/ui/...` may not exist with `@workspace/ui` or `#components` aliases), and swap the icons for the project's `iconLibrary`.

### 4.6 Updating while preserving customizations

Official procedure (skill, "Updating Components"):

1. `npx shadcn@latest add <component> --dry-run` shows every affected file without writing anything.
2. `npx shadcn@latest add <component> --diff <file>` shows the difference between the registry and the local file (`--diff globals.css` for CSS).
3. Decide file by file: no local changes → you can overwrite; local changes → apply the registry's differences manually while preserving what's yours; "update everything" → inspect the full diff and preserve customizations; use `--overwrite` only for replacements covered by the existing authorization.
4. Never download raw files from GitHub to update; the CLI applies transformations for style, base, icons, aliases, and RTL.

Adding a comment at the top of the file describing what was customized ("// custom: warning variant; CardHeader padding") reduces the cost of that merge [RECOMMENDED].

### 4.7 Presets in existing projects

| Goal | Command |
| --- | --- |
| Inspect the current preset | `npx shadcn@latest preset resolve` (`--json` for structured output) |
| Inspect a code you received | `npx shadcn@latest preset decode <code>` |
| Change everything (overwrites detected components, fonts, variables) | `npx shadcn@latest apply <code>` |
| Theme only or fonts only, keeping components | `npx shadcn@latest apply <code> --only theme` / `--only font` / `--only theme,font` |
| Merge with customized components | `npx shadcn@latest init --preset <code> --force --no-reinstall`, then `add --dry-run/--diff` component by component |
| Configuration and CSS only, without touching components | `npx shadcn@latest init --preset <code> --force --no-reinstall` |

`apply` only works in a project with a `components.json`, and it preserves the project's `base` and `rtl`. `--only icon` does not exist: swapping icons requires `migrate icons` or a reinstall. Before switching presets, inspect customizations and apply the strategy already authorized. Prefer a merge that preserves unrelated changes; ask a precise question only when an unresolved destructive choice materially changes the result [REQUIRED].

### 4.8 Available migrations

| Migration | What it does |
| --- | --- |
| `migrate cn` | Swaps `clsx`, `tailwind-merge`, and `cnfast` for the `cn` package; rewrites `lib/utils.ts` to `export { cn } from "cn"`; removes unused packages. Doesn't require a `components.json`; Tailwind v4 only |
| `migrate icons --from lucide --to phosphor` | Rewrites icon imports and JSX in `ui/`, installs the library, and updates `iconLibrary`. Icons with no equivalent are listed at the end |
| `migrate base-color --to zinc` | Rewrites the theme variables in the CSS and updates `baseColor` |
| `migrate rtl [path]` | Converts physical classes to logical ones and sets `rtl: true` |
| `migrate radix` | `@radix-ui/react-*` → `radix-ui` |

### 4.9 Skill and MCP for agents

- `npx skills add shadcn/ui` installs the official skill; it injects `shadcn info --json` into the context and loads rules for composition, the CLI, themes, registries, and MCP. If the project has the skill installed, follow it; this guide is compatible with it.
- `npx shadcn@latest mcp init --client claude` writes a `.mcp.json` with `{"mcpServers":{"shadcn":{"command":"npx","args":["shadcn@latest","mcp"]}}}`. MCP tools: `get_project_registries`, `list_items_in_registries`, `search_items_in_registries`, `view_items_in_registries`, `get_item_examples_from_registries`, `get_add_command_for_items`, `get_audit_checklist`. MCP does not replace `info` for project configuration.
- The `AGENTS.md` in the Next.js templates warns that the Next version may differ from the model's knowledge: read `node_modules/next/dist/docs/` before writing framework-specific code.

---

## 5. Design tokens, themes, typography, icons, spacing, and variants

### 5.1 Semantic tokens (Tailwind v4)

Convention: the base token is the surface; `-foreground` is the text/icon on top of it (`bg-primary text-primary-foreground`). Defined in `:root` (light) and `.dark` (dark) in the global CSS, and exposed to Tailwind in `@theme inline` (`--color-primary: var(--primary)`). Values in OKLCH. (official, theming)

| Token | Controls | Used by |
| --- | --- | --- |
| `background` / `foreground` | The app's default background and text | Page shell, sections, text |
| `card` / `card-foreground` | Elevated surfaces | `Card`, panels |
| `popover` / `popover-foreground` | Floating surfaces | `Popover`, menus, `Toast` |
| `primary` / `primary-foreground` | High-emphasis and brand actions | The default `Button`, selection, badges |
| `secondary` / `secondary-foreground` | Low-emphasis filled actions | Secondary buttons and badges |
| `muted` / `muted-foreground` | Subtle surfaces and lower-emphasis text | Descriptions, placeholders, empty states |
| `accent` / `accent-foreground` | Hover, focus, and active | Ghost buttons, menu items, selected rows |
| `destructive` | Destructive actions and errors | Destructive buttons, invalid state |
| `border`, `input`, `ring` | Borders, field borders, focus ring | Cards, menus, tables, controls |
| `chart-1` through `chart-5` | Chart palette | `Chart` |
| `sidebar`, `sidebar-foreground`, `sidebar-primary(-foreground)`, `sidebar-accent(-foreground)`, `sidebar-border`, `sidebar-ring` | Sidebar | `Sidebar` |
| `radius` | Base radius | The `radius-sm` (×0.6), `radius-md` (×0.8), `radius-lg` (×1), `radius-xl` (×1.4), `radius-2xl` (×1.8), `radius-3xl` (×2.2), `radius-4xl` (×2.6) scale |
| `surface` / `surface-foreground` | Secondary surface | Present in some styles/blocks (skill); confirm it in the project's CSS before using it |

Default `--radius`: `0.625rem`. Preset options: none (0), small (0.45rem), medium (0.625rem), large (0.875rem).

Base colors (`baseColor`, which defines the neutral scale): `neutral`, `stone`, `zinc`, `mauve`, `olive`, `mist`, `taupe`. Color themes (`theme`, which defines `primary` and its derivatives; also used as `chartColor`): `amber`, `blue`, `cyan`, `emerald`, `fuchsia`, `green`, `indigo`, `lime`, `orange`, `pink`, `purple`, `red`, `rose`, `sky`, `teal`, `violet`, `yellow`, plus the base colors themselves. `menuAccent: bold` makes `accent` = `primary` (menu items highlighted in the brand color).

`init --no-css-variables` generates components with inline color utilities (`bg-zinc-950 dark:bg-white`). It's an install-time decision; changing it requires reinstalling components. [RECOMMENDED] Keep `cssVariables: true`.

### 5.2 Dark mode and system preferences

- Mechanism: the `.dark` class on `<html>` + `@custom-variant dark (&:is(.dark *))`.
- Next.js: `next-themes` with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` and `suppressHydrationWarning` on `<html>`. The official template includes a `d` keyboard shortcut to toggle it (it ignores text fields). It avoids a flash of the wrong theme because it injects a script before hydration.
- Vite: a custom provider using `localStorage` and `matchMedia("(prefers-color-scheme: dark)")` (official code in docs/dark-mode/vite).
- [RECOMMENDED] Declare `color-scheme` so that native controls, scrollbars, and the file picker follow the theme: `:root { color-scheme: light } .dark { color-scheme: dark }`.
- [RECOMMENDED] A `theme-color` in the `<head>` (Next.js: `viewport.themeColor` with `media` for light/dark) consistent with `--background`.
- High contrast / `forced-colors`: the OKLCH tokens don't cover `forced-colors: active`. Check focus and borders in that mode when the product requires it (§9.6).

### 5.3 Adding tokens (e.g., `success`, `warning`, `info`)

The system doesn't ship `success`/`warning`. [RECOMMENDED] When the product needs semantics beyond `destructive`, create tokens in `tailwindCssFile` (official, theming):

```css
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
  --success: oklch(0.72 0.19 150);
  --success-foreground: oklch(0.98 0.02 150);
}
.dark {
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
  --success: oklch(0.45 0.14 150);
  --success-foreground: oklch(0.98 0.02 150);
}
@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}
```

Then add variants (`Badge`, `Alert`, `Button`) to the `cva` in the corresponding files. Validate contrast (§9.6). On Tailwind v3, register them in `tailwind.config.js` (`theme.extend.colors`).

### 5.4 Typography and fonts

- The components don't impose global typography. The documentation's `typography` page is an example of utility classes (`scroll-m-20 text-4xl font-extrabold tracking-tight`...), not an installable component with global styles.
- Fonts: presets install `registry:font` items (`font-inter`, `font-heading-playfair-display`...) that configure `--font-sans`, `--font-mono`, and `--font-heading`. Next.js uses `next/font/google` in `layout.tsx` (`Geist`, `Geist_Mono` in the template). 26 fonts are available: `geist`, `inter`, `noto-sans`, `nunito-sans`, `figtree`, `roboto`, `raleway`, `dm-sans`, `public-sans`, `outfit`, `oxanium`, `manrope`, `space-grotesk`, `montserrat`, `ibm-plex-sans`, `source-sans-3`, `instrument-sans`, `jetbrains-mono`, `geist-mono`, `noto-serif`, `roboto-slab`, `merriweather`, `lora`, `playfair-display`, `eb-garamond`, `instrument-serif`.
- [RECOMMENDED] Use `font-heading` (the `--font-heading` variable) for headings when the preset defines a heading font; otherwise `--font-heading` inherits the body font.
- Fluid scale [RECOMMENDED]: for page titles use `text-2xl sm:text-3xl lg:text-4xl` or `clamp()` in CSS; never let the size get too small on mobile or gigantic on large screens.

### 5.5 Typeset (rendered content: markdown, CMS HTML, chat)

shadcn/typeset is a `typeset.css` file generated at `https://ui.shadcn.com/typeset`, copied into the project and imported after Tailwind. It styles everything inside a `.typeset` container with three controls: `--typeset-size` (base size; `1em` follows the container), `--typeset-leading` (line height), and `--typeset-flow` (space between blocks). (official)

```css
@import "tailwindcss";
@import "./typeset.css";

.typeset-docs { --typeset-size: 15px; --typeset-leading: 1.75; --typeset-flow: 1.5em; }
.typeset-chat { --typeset-flow: 1em; --typeset-leading: 1.6; }
```

```tsx
<article className="typeset typeset-docs">{html}</article>
<div className="typeset typeset-chat">{message}</div>
```

Rules:

- [CONDITIONAL] Use Typeset whenever you render third-party markdown/HTML (docs, blog, chat, email). Don't use `@tailwindcss/typography` (`prose`) and Typeset together.
- `not-typeset` (or `data-not-typeset`) isolates components inside the container. `typeset-scroll` wraps wide tables with horizontal scrolling.
- Typeset doesn't set a max width; the layout does (`max-w-prose`, `max-w-3xl`).
- Built for streaming: new blocks don't restyle earlier ones (it uses only `margin-block-start`, with no `:last-child`/`:has()`).
- Dark mode follows the tokens; adjust `.dark .typeset { --typeset-leading: 1.9 }` if the text looks cramped.

### 5.6 Icons

Libraries supported by `iconLibrary`: `lucide` (`lucide-react`), `tabler` (`@tabler/icons-react`), `hugeicons` (`@hugeicons/react` + `@hugeicons/core-free-icons`, used as `<HugeiconsIcon icon={ICON} strokeWidth={2} />`), `phosphor` (`@phosphor-icons/react`), `remixicon` (`@remixicon/react`). `radix` exists only as a legacy source in `migrate icons`.

Rules (skill, icons.md) [REQUIRED]:

- Import from the configured library; never assume `lucide-react`.
- In `Button`, `Badge`, `InputGroupAddon`, menu items, `Alert`, and `Sidebar*`, the components size the icon; don't add `size-4`/`w-4 h-4`.
- In `Button` use `data-icon="inline-start"` (before the text) or `data-icon="inline-end"` (after). `Spinner` follows the same rule.
- Icon-only button: `size="icon"` (or `icon-xs`, `icon-sm`, `icon-lg`) plus accessible text (`aria-label` or `<span className="sr-only">`).
- Decorative icons next to text: `aria-hidden="true"` (the components already do this for their internal icons).
- In RTL, directional arrows get `rtl:rotate-180`.

### 5.7 Spacing, density, and layout

- Tailwind's spacing scale (`gap-2`, `p-4`, `gap-6`). The chosen style already sets the components' density; don't change `--spacing` to "compact" things (that changes the meaning of every utility; it's the reason `rhea` exists as a separate style). For a different density, switch styles.
- [REQUIRED] `flex flex-col gap-*` for stacks, `grid gap-*` for grids; never `space-y-*`.
- Widths: `max-w-sm` (forms), `max-w-md`/`max-w-lg` (dialogs), `max-w-prose`/`max-w-3xl` (reading), `container`/`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` (pages).
- Container queries: `FieldGroup` is already `@container/field-group`; `Field orientation="responsive"` becomes horizontal starting at `@md`. Use `@container` in cards, widgets, and reusable lists when the adaptation depends on the component's own space rather than the viewport.
- `Card size="sm"`, `AlertDialogContent size="sm"`, `Avatar size="sm|lg"`, `Item size="sm|xs"`, and `Button size="xs|sm|lg"` adjust local density without new CSS.

### 5.8 Variants and `cva`

- The existing variants for each component are in the catalog (§6). Check the installed file: the `cva`'s `variants` object is the source of truth.
- A new variant: add the key to the `cva`, and if the type is constrained by `VariantProps`, it will be accepted automatically.
- `buttonVariants`, `badgeVariants`, `toggleVariants`, `tabsListVariants`, `buttonGroupVariants`, and `markerVariants` are exported so you can apply their classes to other elements (`<a className={buttonVariants({ variant: "outline" })}>`).
- Don't create variants that only change layout; use `className`.

### 5.9 Concrete guidelines for modern, attractive interfaces with personality (guide)

Translate "attractive and pleasant" into verifiable decisions:

Hierarchy

- One primary action per screen or per action block; the rest in `outline`, `secondary`, or `ghost`.
- Page title > section title > labels > body > helper text. Use `text-muted-foreground` for helper text; don't go below `text-xs` for content that has to be read.
- A page header with a title, a short description, and actions on the right (on mobile, actions below or in a `DropdownMenu`).

Typography

- Two families at most (body and headings); mono only for code, IDs, and tabular numbers (`tabular-nums`).
- A larger line height for running text (`leading-relaxed`), a smaller one for headings (`leading-tight`), and `tracking-tight` on large headings.

Color

- `primary` for the brand and the main action; neutral surfaces (`background`, `card`, `muted`) dominate. Saturated color in small areas: badges, indicators, status icons.
- States via tokens: `destructive` for errors and irreversible actions; create `success`/`warning` if the product needs them.
- Dark mode actually tested, not just "it works because it uses tokens": check borders (`--border` is translucent in dark mode), light images, and charts.

Spacing and density

- Choose the style based on the nature of the product (§2.5) and stick with it. Extra density in tables via `size="sm"` and `text-sm`, not via negative padding.
- Breathing room between sections (`gap-8`/`gap-10` on pages), tighter inside cards (`gap-4`).

Feedback and microinteractions

- Every submit button shows a `Spinner` + `disabled` during the request; a short success toast; errors near the field (`FieldError`) and, if global, an `Alert variant="destructive"`.
- Empty states with `Empty` explaining what to do, plus an action.
- Short transitions (100 to 200 ms) on surfaces; `shimmer` for "thinking…"; `scroll-fade` on scrollable lists; `Skeleton` with the same dimensions as the final content.

Personality (when appropriate)

- The choice of style (`sera` editorial, `lyra` technical, `luma` soft), heading font, `radius`, and a translucent `menuColor` give identity with no extra code.
- Special effects (gradients, glass, particles, animated text) only in marketing areas or key moments, never in tools people work in continuously. Registries like `@magicui`, `@aceternity`, `@animate-ui`, and `@motion-primitives` offer these pieces (§7.5); evaluate their weight and accessibility.

Consistency

- The same control height within a row (`Button`, `Input`, and `Select` share the style's height).
- Align dialog actions with `DialogFooter`; align card actions with `CardFooter` or `CardAction`.
- Icons from the same library with the same stroke throughout the application.

---

## 6. Catalog of official components

Catalog compiled on 2026-09-09 from `apps/v4/content/docs/components/{base,radix,aria}` and `apps/v4/registry/bases/*/ui`. Installation: `npx shadcn@latest add <item>`. Documentation: `https://ui.shadcn.com/docs/components/<base>/<item>`, where `<base>` is `base`, `radix`, or `aria` depending on the project (use `npx shadcn@latest docs <item>` for the right URL). The npm dependencies listed are the ones declared in the registry beyond the base primitive; "—" means none.

### 6.1 Summary table

Forms and input

| Item | Purpose | Main exports | Dependencies | Notes by base |
| --- | --- | --- | --- | --- |
| `field` | Label, control, description, and error composed together | `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldSeparator`, `FieldContent`, `FieldTitle` | registry: `label`, `separator` | The same on all three bases |
| `button` | Actions | `Button`, `buttonVariants` | — | Base/Aria: don't use as a link (§2.4) |
| `button-group` | Group buttons, inputs, and text | `ButtonGroup`, `ButtonGroupSeparator`, `ButtonGroupText`, `buttonGroupVariants` | registry: `separator` | `orientation` horizontal/vertical |
| `input` | Text field | `Input` | — | Base uses `@base-ui/react/input`; accepts all native attributes |
| `input-group` | Addons, buttons, text, and icons in fields | `InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupText`, `InputGroupInput`, `InputGroupTextarea` | registry: `button`, `input`, `textarea` | The addon comes after the input in the DOM; `align` positions it |
| `input-otp` | Verification code | `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator` | `input-otp` | The same on all three bases |
| `textarea` | Multi-line text | `Textarea` | — | |
| `checkbox` | Checkbox | `Checkbox` | — | `checked`, `onCheckedChange`; the indeterminate state differs by base |
| `radio-group` | Single choice | `RadioGroup`, `RadioGroupItem` | — | |
| `select` | Option list with a custom menu | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectGroup`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton` | — | The API differs by base (§2.4) |
| `native-select` | A styled native `<select>` | `NativeSelect`, `NativeSelectOption`, `NativeSelectOptGroup` | — | The system's menu; better for short lists on phones |
| `switch` | Boolean toggle | `Switch` | — | |
| `slider` | A numeric value or range | `Slider` | — | Base: a number; Radix: an array |
| `calendar` | Calendar (react-day-picker v9) | `Calendar`, `CalendarDayButton` | `react-day-picker`, `date-fns`; registry: `button` | The same on all three bases |
| `date-picker` | Date selection in a popover | (a composition of `popover` + `calendar`) | | There is no `DatePicker` component; see its entry |
| `combobox` | Autocomplete, search, multi-selection with chips | `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem`, `ComboboxGroup`, `ComboboxLabel`, `ComboboxCollection`, `ComboboxEmpty`, `ComboboxSeparator`, `ComboboxChips`, `ComboboxChip`, `ComboboxChipsInput`, `ComboboxTrigger`, `ComboboxValue`, `useComboboxAnchor` | `@base-ui/react` (Base and Radix); registry: `button`, `input-group` | Aria uses react-aria-components |
| `label` | Label | `Label` | — | Base: a native `<label>` |

Layout and navigation

| Item | Purpose | Main exports | Dependencies | Notes by base |
| --- | --- | --- | --- | --- |
| `accordion` | Expandable sections | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | — | The root's props differ (§2.4) |
| `breadcrumb` | Navigation trail | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis` | — | `BreadcrumbLink` accepts `render`/`asChild` for the framework's `Link` |
| `navigation-menu` | Site menu with panels | `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuTrigger`, `NavigationMenuContent`, `NavigationMenuLink`, `NavigationMenuIndicator`, `navigationMenuTriggerStyle`, `NavigationMenuPositioner` (Base) | — | Doesn't exist on the Aria base; a desktop pattern |
| `sidebar` | Application sidebar | `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`, `SidebarMenuSkeleton`, `SidebarInput`, `SidebarInset`, `SidebarRail`, `SidebarSeparator`, `SidebarTrigger`, `useSidebar` | registry: `button`, `input`, `separator`, `sheet`, `skeleton`, `tooltip`, `use-mobile` | Turns into a `Sheet` below 768 px |
| `tabs` | Alternating panels | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `tabsListVariants` | — | `TabsList variant="line"`; Base: manual activation |
| `separator` | Divider | `Separator` | — | `orientation` |
| `scroll-area` | Scrolling with a styled bar | `ScrollArea`, `ScrollBar` | — | Native scrolling is preserved |
| `resizable` | Resizable panels | `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` | `react-resizable-panels` v4 | Stack them on small screens |

Overlays

| Item | Purpose | Main exports | Dependencies | Notes by base |
| --- | --- | --- | --- | --- |
| `dialog` | Task modal | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `DialogOverlay`, `DialogPortal` | registry: `button` | `showCloseButton` on `DialogContent` (default true) and `DialogFooter` (default false) |
| `alert-dialog` | Interrupting confirmation | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogMedia`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`, `AlertDialogOverlay`, `AlertDialogPortal` | registry: `button` | `AlertDialogContent size="sm"` |
| `sheet` | Side panel (a dialog at the edges) | `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` | registry: `button` | `side` on `SheetContent` |
| `drawer` | Draggable drawer (bottom sheet) | `Drawer`, `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerFooter`, `DrawerClose`, `DrawerPortal`, `DrawerOverlay`, `DrawerSwipeHandle` (Base) | Base: `@base-ui/react`; Radix: `vaul` | Different APIs (§2.4) |
| `popover` | Rich anchored content, on click | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription` (Base) | — | `side`, `align`, `sideOffset` |
| `tooltip` | A short hint, on hover/focus | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | — | `TooltipProvider` at the root; doesn't open on touch |
| `hover-card` | Preview on mouse hover | `HoverCard`, `HoverCardTrigger`, `HoverCardContent` | — | Hover only; provide a touch alternative |
| `context-menu` | Right-click menu | `ContextMenu*` (Trigger, Content, Item, CheckboxItem, RadioItem, RadioGroup, Label, Separator, Shortcut, Group, Sub, SubTrigger, SubContent, Portal) | — | Offer the same action in a visible button |
| `dropdown-menu` | Action menu from a button | `DropdownMenu*` (the same parts as ContextMenu) | — | Base: the Menu primitive |
| `menubar` | A desktop-style menu bar | `Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarContent`, and the same parts as the menu | registry: `dropdown-menu` | Doesn't exist on the Aria base |
| `command` | Command palette and search (cmdk) | `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator` | `cmdk`; registry: `dialog`, `input-group` | |

Feedback and status

| Item | Purpose | Main exports | Dependencies | Notes by base |
| --- | --- | --- | --- | --- |
| `alert` | Inline callout | `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction` | — | `variant` default/destructive; the icon goes as the first child |
| `toast` | Transient notification (Base UI Toast) | `Toaster`, `toast`, `Toast*`, `createToastManager`, `useToastManager` | `@base-ui/react`; registry: `button` | Base only; on Radix/Aria the page says "deprecated, use sonner" |
| `sonner` | Transient notification (Sonner) | `Toaster` | `sonner`, `next-themes` | Radix and Aria; the file also exists on the Base base |
| `progress` | Progress bar | `Progress`, `ProgressTrack`, `ProgressIndicator`, `ProgressLabel`, `ProgressValue` | — | |
| `spinner` | Loading indicator | `Spinner` | — | Inside a `Button` with `data-icon` |
| `skeleton` | Loading placeholder | `Skeleton` | — | Size it with `h-*`/`w-*` |
| `badge` | Short label | `Badge`, `badgeVariants` | — | default/secondary/destructive/outline/ghost/link; `render`/`asChild` |
| `empty` | Empty state | `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` | — | |

Display and media

| Item | Purpose | Main exports | Dependencies | Notes by base |
| --- | --- | --- | --- | --- |
| `avatar` | User image with a fallback | `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` | — | `size` default/sm/lg |
| `card` | A surface with a header, content, and footer | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | — | `size` default/sm |
| `table` | Semantic table with a scroll container | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption` | — | |
| `data-table` | A guide for tables with TanStack Table v9 | (uses `table` + `@tanstack/react-table`) | `@tanstack/react-table` ^9 | Not an installable component; it's a guide |
| `chart` | Charts with Recharts | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`, and the `ChartConfig` type | `recharts@3.8.0`; registry: `card` | |
| `carousel` | Swipeable carousel (Embla) | `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext`, `useCarousel`, and the `CarouselApi` type | `embla-carousel-react`; registry: `button` | Plugins such as `embla-carousel-autoplay` |
| `aspect-ratio` | Fixed aspect ratio | `AspectRatio` | — | `ratio` is required |
| `typography` | Example classes for text | (no exports) | — | Doesn't install global styles; see Typeset |
| `item` | A row with media, title, description, and actions | `Item`, `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, `ItemHeader`, `ItemFooter`, `ItemGroup`, `ItemSeparator` | registry: `separator` | `variant` default/outline/muted; `size` default/sm/xs |
| `kbd` | A key | `Kbd`, `KbdGroup` | — | |

Chat and conversation (June 2026)

| Item | Purpose | Main exports | Dependencies | Notes |
| --- | --- | --- | --- | --- |
| `message-scroller` | Conversation scroll container | `MessageScrollerProvider`, `MessageScroller`, `MessageScrollerViewport`, `MessageScrollerContent`, `MessageScrollerItem`, `MessageScrollerButton`, and the `useMessageScroller`, `useMessageScrollerScrollable`, and `useMessageScrollerVisibility` hooks | `@shadcn/react`; registry: `button` | The parts have a fixed order |
| `message` | Message row | `Message`, `MessageGroup`, `MessageAvatar`, `MessageContent`, `MessageHeader`, `MessageFooter` | — | `align` start/end |
| `bubble` | Message bubble | `Bubble`, `BubbleGroup`, `BubbleContent`, `BubbleReactions` | — | 7 variants |
| `attachment` | Attachment with upload state | `Attachment`, `AttachmentGroup`, `AttachmentMedia`, `AttachmentContent`, `AttachmentTitle`, `AttachmentDescription`, `AttachmentActions`, `AttachmentAction`, `AttachmentTrigger` | registry: `button` | `state` idle/uploading/processing/error/done |
| `marker` | System note, divider with a label | `Marker`, `MarkerIcon`, `MarkerContent`, `markerVariants` | — | `variant` default/border/separator |

Others

| Item | Purpose | Main exports | Dependencies | Notes |
| --- | --- | --- | --- | --- |
| `collapsible` | Show/hide | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | — | |
| `toggle` | Two-state button | `Toggle`, `toggleVariants` | — | |
| `toggle-group` | A set of toggles | `ToggleGroup`, `ToggleGroupItem` | registry: `toggle` | The API differs by base (§2.4) |
| `pagination` | Pagination | `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis` | registry: `button` | Links; `isActive` |
| `direction` | Text direction provider | `DirectionProvider`, `useDirection` | Base: `@base-ui/react` | RTL |
| `questionnaire` | A stepped question flow (August 2026) | `Questionnaire`, `QuestionnaireProgress`, `QuestionnaireItem`, `QuestionnaireTitle`, `QuestionnaireDescription`, `QuestionnaireChoices`, `QuestionnaireChoice`, `QuestionnaireChoiceDescription`, `QuestionnaireInput`, `QuestionnaireError`, `QuestionnaireActions`, `QuestionnairePrevious`, `QuestionnaireSkip`, `QuestionnaireNext`, `QuestionnaireSubmit` | `@shadcn/react`; registry: `button` | Native form serialization |
| `form` | A legacy name in the registry with no file of its own | — | — | Use `field` and the form guides (§8.2) |

CSS utilities (not components; they ship in `shadcn/tailwind.css`): `no-scrollbar`, `scroll-fade` (`-x`, `-y`, `-t`, `-b`, `-l`, `-r`, `-s`, `-e`, `-<n>`, `-none`), `shimmer` (`-once`, `-reverse`, `-none`, `-color-*`, `-duration-*`, `-spread-*`, `-angle-*`), the `data-open:`/`data-closed:` variants, and the accordion animation. The `use-mobile` hook (`useIsMobile`, breakpoint 768).

### 6.2 Entries for components that require care

Format: purpose and when to choose something else; composition and essential props; states; responsiveness and accessibility; frequent mistakes; a minimal example where useful. The examples are written for the Base UI base unless noted otherwise; swap `render` for `asChild` on Radix.

#### Button

- Variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`.
- No `isLoading`: compose it as `<Button disabled><Spinner data-icon="inline-start" />Saving…</Button>`.
- A link that looks like a button: `<a className={buttonVariants({ variant: "outline" })} href="/docs">`. In Next.js, `<Link className={buttonVariants()}>`.
- Cursor: Tailwind v4 uses `cursor: default` on buttons; `init --pointer` or the rule `@layer base { button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer } }` restores the pointer. Decide per project and apply it globally.
- Mobile: `size="lg"` or `h-11` for primary actions; for `icon-xs`/`icon-sm`, expand the touch area with `after:absolute after:-inset-2` (the pattern used in the registry itself in `ToastClose` and `SidebarMenuAction`) plus `relative`.
- Mistakes: an icon with `mr-2 size-4` instead of `data-icon`; using `Button` as a link on Base/Aria; a destructive button without an `AlertDialog` for irreversible actions.

#### Field, FieldGroup, FieldSet

- `Field` (`role="group"`) wraps the label, control, description, and error. `orientation`: `vertical` (the default), `horizontal` (label to the side; use it with `FieldContent` to align the description), `responsive` (vertical, becoming horizontal starting at `@md/field-group`).
- `FieldGroup` stacks fields and acts as a container-query container. `FieldSet` + `FieldLegend` (`variant="legend"|"label"`) group checkboxes, radios, and switches. `FieldSeparator` divides sections ("Or continue with").
- Error: `data-invalid` on the `Field` + `aria-invalid` on the control + `<FieldError errors={[fieldState.error]} />` (it accepts an array of `{ message }` from React Hook Form or `issues` from Standard Schema validators such as Zod, Valibot, and ArkType). Disabled: `data-disabled` on the `Field` + `disabled` on the control.
- Selectable card: a `FieldLabel` wrapping a `Field` with a `RadioGroupItem`, `Checkbox`, or `Switch` (the "choice card" pattern).
- Mistakes: a `div className="space-y-4"` as the form; a label without `htmlFor`; a description outside the `Field`; `FieldError` always rendered (render it only when invalid, or pass an empty `errors`).

```tsx
"use client"

import { Controller, useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

type Values = { email: string }

export function NewsletterForm({ onSubmit }: { onSubmit: (values: Values) => void }) {
  const form = useForm<Values>({ defaultValues: { email: "" } })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          rules={{ required: "Enter your email." }}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input {...field} id={field.name} type="email" inputMode="email" autoComplete="email" aria-invalid={fieldState.invalid} />
              <FieldDescription>We'll use it to send you the receipt.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Field orientation="horizontal">
          <Switch id="news" />
          <FieldLabel htmlFor="news">Receive updates</FieldLabel>
        </Field>
      </FieldGroup>
      <Button type="submit" className="mt-6">Continue</Button>
    </form>
  )
}
```

With Zod, swap `rules` for `resolver: zodResolver(schema)` in `useForm` (the official forms guide).

#### Input, Textarea, Input Group

- `Input` passes native attributes through: use `type`, `inputMode`, `autoComplete`, `enterKeyHint`, `pattern`, `maxLength`. Base UI's `Input` and Radix's `<input>` behave identically on this point.
- `InputGroup`: `InputGroupInput`/`InputGroupTextarea` + `InputGroupAddon align="inline-start|inline-end|block-start|block-end"` (inline for an input, block for a textarea) + `InputGroupButton size="xs|icon-xs|sm|icon-sm" variant="ghost|..."` + `InputGroupText`. The addon always comes after the control in the DOM (for correct focus). Custom control: `data-slot="input-group-control"`.
- Mistakes: a `Button` positioned with `absolute` on top of an `Input`; a raw `Input` inside an `InputGroup`; a placeholder as the only label.

#### Select and Native Select

- Base UI: `<Select items={items} value onValueChange>`; `<SelectTrigger><SelectValue placeholder="Theme" /></SelectTrigger>`; `<SelectContent alignItemWithTrigger={false} side="bottom">` to open below instead of aligning the selected item with the trigger; `multiple` and object values with `itemToStringValue`. The official skill uses an item `{ label, value: null }` for the placeholder; the component's documentation uses `placeholder` on `SelectValue`. Use the documentation's approach and validate it in the browser.
- Radix: no `items`; `position="popper"` for a menu below; a string value.
- React Aria: `placeholder` on the root; `SelectItem id`.
- Invalid: `data-invalid` on the `Field`, `aria-invalid` on the `SelectTrigger`. Groups: `SelectGroup` + `SelectLabel` + `SelectSeparator`.
- Choosing: a short list in a simple form on a phone → `NativeSelect`; a menu with visual identity, icons, and groups → `Select`; search, many items, or multiple selection → `Combobox`.
- Mobile: the `Select` menu is a positioned popup; test it with the virtual keyboard open and at 320 px (the `SelectContent` width follows `--anchor-width`).
- Mistakes: a `SelectItem` outside a `SelectGroup`; `position="popper"` on Base UI; using `type`/`items` from the wrong base.

#### Combobox

- Base UI (also in Radix projects): `<Combobox items={list} value onValueChange multiple itemToStringValue showClear autoHighlight>`; `ComboboxInput` (or `ComboboxChips` + `ComboboxValue` + `ComboboxChip` + `ComboboxChipsInput` for multiple selection); `ComboboxContent` > `ComboboxEmpty` + `ComboboxList` with a function child `{(item) => <ComboboxItem value={item}>...}`; groups with `ComboboxGroup` + `ComboboxLabel` + `ComboboxCollection`.
- A popup from a button: `render` on the trigger and `ComboboxInput` inside `ComboboxContent`.
- Mobile: when it opens, the virtual keyboard reduces the available height; check `--available-height` and positioning; for long selection flows, consider a `Drawer` with `Command` inside.
- Accessibility: `aria-invalid` for errors; a label via `FieldLabel htmlFor` on the input.

#### Checkbox, Radio Group, Switch, Slider, Toggle Group

- `Checkbox checked onCheckedChange`; indeterminate: Base UI uses the `indeterminate` prop; Radix uses `checked="indeterminate"`. In selection lists, `FieldGroup data-slot="checkbox-group"` (the official forms guide) handles spacing.
- `RadioGroup value onValueChange` + `RadioGroupItem value id`; errors on `RadioGroupItem aria-invalid`.
- `Switch` for preferences that apply immediately; `Checkbox` for forms that get submitted.
- `Slider`: Base takes a plain number, Radix an array; always with a visible label or `aria-label`; arrow-key support comes from the primitive.
- `ToggleGroup`: 2 to 7 options; `spacing={0}` for a segmented look; `aria-labelledby` pointing to the `FieldTitle`.

#### Calendar and Date Picker

- `Calendar mode="single|range|multiple" selected onSelect captionLayout="dropdown" numberOfMonths disabled showWeekNumber timeZone locale buttonVariant`. Localization: `import { ptBR } from "react-day-picker/locale"` and `locale={ptBR}` [REQUIRED in Portuguese-language products].
- Cell size: `className="[--cell-size:--spacing(11)] md:[--cell-size:--spacing(12)]"`; on phones, keep it at least `2.75rem`.
- Date Picker = `Popover` + `PopoverTrigger render={<Button variant="outline" />}` + `PopoverContent className="w-auto p-0"` + `Calendar`. Documented variations: range, date of birth (`captionLayout="dropdown"`), with an input, with a time (`<Input type="time">`), and natural language (`chrono-node`).
- Time zone: detect `Intl.DateTimeFormat().resolvedOptions().timeZone` in a `useEffect` and pass it in `timeZone` to avoid an off-by-one-day shift.
- Mobile: instead of a `Popover`, use a `Drawer` for the calendar when the popover doesn't fit; a native `<input type="date">` is acceptable in simple forms (record the decision).

#### Input OTP

- `<InputOTP maxLength={6}>` with `InputOTPGroup` > `InputOTPSlot index={n}` and `InputOTPSeparator`. Attributes for autofill: `autoComplete="one-time-code"`, `inputMode="numeric"`; `pattern` with `REGEXP_ONLY_DIGITS` from `input-otp` when it's digits only.

#### Dialog, Alert Dialog, Sheet, Drawer: which one to use

| Situation | Component |
| --- | --- |
| A focused task that requires input | `Dialog` |
| Confirming a destructive or irreversible action | `AlertDialog` |
| A side panel with details, filters, or navigation | `Sheet` |
| A bottom panel on mobile, with dragging | `Drawer` |
| Quick information on mouse hover | `HoverCard` (with a touch alternative) |
| Small contextual content on click | `Popover` |

- `Dialog`: `DialogContent showCloseButton`, `DialogHeader` > `DialogTitle` + `DialogDescription`, `DialogFooter showCloseButton` (adds a close button in the footer). Long content: a scrollable inner area and a fixed footer (the official "Sticky Footer" and "Scrollable Content" examples). Mobile: nearly full width (the style already handles this), a max height with internal scrolling, and reachable buttons.
- `AlertDialog`: `AlertDialogCancel` and `AlertDialogAction` (on Base UI, `AlertDialogAction` is a regular `Button`); `AlertDialogMedia` for an icon; `size="sm"`.
- `Sheet`: `SheetContent side="right|left|top|bottom" showCloseButton`. For mobile navigation, `side="left"`; for filters, `side="right"` or `bottom`.
- `Drawer` (Base UI): `<Drawer swipeDirection="down" showSwipeHandle snapPoints={[0.5, 1]} modal disablePointerDismissal onOpenChangeComplete>`; `DrawerContent className="data-[swipe-axis=y]:max-h-[50vh]"`; the scrollable region as a flex item (`flex-1 overflow-y-auto`), never `h-full`. Add `body { position: relative }` to the global CSS for iOS 26 Safari [CONDITIONAL]. Radix: `vaul` with `direction`.
- All of them: a title is required; initial focus and focus return come from the primitive; `Escape` closes; the background is inert. Don't stack dialogs unnecessarily; a nested `Drawer` is supported.
- A responsive dialog (Dialog on desktop, Drawer on mobile): recipe in §8.9.

#### Popover, Tooltip, Hover Card

- `TooltipProvider` once at the root [REQUIRED]. `TooltipContent side`. A tooltip on a disabled button: wrap the button in a `span`.
- Tooltips don't open on touch: icon-only buttons need an accessible name independent of the tooltip; on mobile, show a visible label or use a `Popover`.
- `HoverCard` is an enhancement; the essential information must be reachable by click (a link to the page) or via a `Popover`.
- `Popover`: `PopoverContent side align sideOffset`; in RTL, pass `dir="rtl"` on portal content (a known bug in `tw-animate-css`).

#### Dropdown Menu, Context Menu, Menubar

- Structure: `Trigger` > `Content` > `Group` > (`Label`, `Item`, `CheckboxItem checked onCheckedChange`, `RadioGroup value onValueChange` > `RadioItem`), `Separator`, `Sub` > `SubTrigger` + `SubContent`, `Shortcut`.
- A trigger as a `Button`: Base `DropdownMenuTrigger render={<Button variant="outline" />}`; Radix `asChild`.
- Destructive item: `DropdownMenuItem variant="destructive"` (values `default` and `destructive`; the same applies to `ContextMenuItem` and `MenubarItem` — check the installed file).
- A `ContextMenu` is never the only path to an action (there's no right-click on touch). `Menubar` is a desktop pattern; on mobile, collapse it into a `DropdownMenu` or a `Sheet`.
- Targets: items already get the style's height; in `mira`/`rhea` (dense styles), verify 44 px on mobile and, if necessary, increase it with `className="min-h-11"` on small screens only.

#### Command

- Inline: `Command` > `CommandInput` + `CommandList` > `CommandEmpty`, `CommandGroup heading` > `CommandItem onSelect`, `CommandSeparator`, `CommandShortcut`.
- Palette: `CommandDialog open onOpenChange title description showCloseButton` (the title and description are visually hidden and feed the screen reader) plus a keyboard shortcut (`⌘K`/`Ctrl K`) registered in a `useEffect`. On mobile, offer a visible search button; the palette takes up nearly the whole screen and the virtual keyboard shrinks the list: cap the `CommandList` height with `max-h-[60dvh]`.

#### Sidebar

- `SidebarProvider defaultOpen open onOpenChange` wraps the layout; `Sidebar side="left|right" variant="sidebar|floating|inset" collapsible="offcanvas|icon|none"`; with `inset`, wrap the content in `SidebarInset`. `SidebarTrigger` toggles it; the shortcut is `Ctrl/Cmd + B`; the state is persisted in a `sidebar_state` cookie; widths are `SIDEBAR_WIDTH = 16rem`, `SIDEBAR_WIDTH_MOBILE = 18rem`, `SIDEBAR_WIDTH_ICON = 3rem` (or the `--sidebar-width` and `--sidebar-width-mobile` variables in the provider's `style`).
- Below 768 px (`useIsMobile`) the sidebar becomes a `Sheet`; `useSidebar()` exposes `state`, `open`, `setOpen`, `openMobile`, `setOpenMobile`, `isMobile`, and `toggleSidebar`.
- Menu: `SidebarMenu` > `SidebarMenuItem` > `SidebarMenuButton isActive render={<Link href />}` (+ `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSub`). A collapsible group: a `Collapsible` wrapping a `SidebarGroup` with `SidebarGroupLabel render={<CollapsibleTrigger />}`.
- Its own `--sidebar-*` tokens (§5.1). The `sidebar-01` through `sidebar-16` blocks cover the variations (icons, inset, floating, right-side, dual, with a calendar, in a dialog, with a fixed header).
- Mistakes: page components outside `SidebarInset` with `variant="inset"`; forgetting `SidebarProvider`; a `SidebarMenuButton` without `isActive`; an icon-only menu without a `tooltip`: `SidebarMenuButton tooltip="Home"` (a string or `TooltipContent` props) shows the label when the sidebar is collapsed to icons.

#### Tabs

- `Tabs defaultValue` > `TabsList variant="default|line"` > `TabsTrigger value`; `TabsContent value`. `orientation="vertical"`.
- Base UI: manual activation by default (arrows move focus, Enter/Space activates); Radix activates on focus. Don't "fix" this difference without being asked.
- Mobile: many tabs → `TabsList className="overflow-x-auto"` with `scroll-fade-x`, or swap in a section `Select`/`NativeSelect` on narrow screens while keeping the same state.

#### Navigation Menu, Breadcrumb, Pagination

- `NavigationMenu` is a desktop header pattern; on small screens use a `Sheet` with a list of links. On Base UI, `NavigationMenuLink render={<Link href />}`; on Radix, `asChild`.
- `Breadcrumb`: on mobile, collapse the intermediate items with `BreadcrumbEllipsis` inside a `DropdownMenu`.
- `Pagination`: `PaginationLink isActive`; for tables, prefer "previous/next" controls + a page-size selector (the reusable component from the Tasks example).

#### Table and Data Table

- `Table` renders a `<table>` inside a `data-slot="table-container"` container with `relative w-full overflow-x-auto`; use `TableCaption` to describe the table.
- Data Table (official guide, TanStack Table v9): `features = tableFeatures({ columnFilteringFeature, columnVisibilityFeature, rowPaginationFeature, rowSelectionFeature, rowSortingFeature, filteredRowModel: createFilteredRowModel(), paginatedRowModel: createPaginatedRowModel(), sortedRowModel: createSortedRowModel(), filterFns, sortFns })`; `createColumnHelper<Features, T>()` + `columnHelper.columns([...])`; `useTable({ features, data, columns, state, onSortingChange, ... })`; `<table.FlexRender header={header} />` and `<table.FlexRender cell={cell} />`. Per-row actions in a `DropdownMenu`; selection with `Checkbox` (`indeterminate`).
- Mobile [REQUIRED to decide per table]: (a) deliberate horizontal scrolling with a fixed first column and `scroll-fade-x`; (b) priority columns (hide secondary ones with `columnVisibility` by breakpoint); (c) per-row detail expansion; (d) transformation into an `ItemGroup`/cards when the relationship between columns isn't lost. Never let the table overflow the page.
- States: a "No results" row (a compact `Empty`), a `Skeleton` per row while loading, a count of selected rows, and pagination with `aria-label`.

#### Chart

- `ChartContainer config={chartConfig} className="min-h-[200px] w-full">` wraps Recharts components (`BarChart`, `AreaChart`, `LineChart`, `PieChart`, `RadarChart`, `RadialBarChart`). A minimum height or `aspect-*` is required for the `ResponsiveContainer` to measure.
- `chartConfig` (`satisfies ChartConfig`) defines `label`, `icon`, `color` (`var(--chart-1)`, hex, hsl, oklch) or `theme: { light, dark }`. Colors on the elements via `var(--color-<key>)` (`fill="var(--color-desktop)"`, `className="fill-(--color-desktop)"`).
- `ChartTooltip content={<ChartTooltipContent labelKey nameKey indicator="dot|line|dashed" hideLabel hideIndicator />}`; `ChartLegend content={<ChartLegendContent nameKey />}`; `accessibilityLayer` on the chart for keyboard and screen reader support [RECOMMENDED].
- Recharts v3: `var(--chart-1)` instead of `hsl(var(--chart-1))`; `ChartTooltip.defaultIndex` only for the initial state; no `layout` on `<Bar>` when the `BarChart` already defines it.
- Mobile: fewer ticks (`tickFormatter`, `interval`), the legend below, a height between 180 and 260 px, tooltips on touch (Recharts opens them on tap), avoid charts with dozens of series; consider a `Select`/`ToggleGroup` for switching the time period.
- 70 installable examples (`chart-area-interactive`, `chart-bar-horizontal`, `chart-pie-donut-text`, `chart-radar-default`, `chart-radial-stacked`, `chart-tooltip-formatter`...), all of them `registry:block` with a dependency on `card` and `chart`.

#### Card, Item, Empty

- A complete `Card`: `CardHeader` > `CardTitle` + `CardDescription` + `CardAction`; `CardContent`; `CardFooter`. `size="sm"` for dense panels. An image as the first or last child gets rounded corners.
- `Item` for list rows with media/actions (`ItemMedia variant="icon|image"`, `ItemActions`), `ItemGroup` + `ItemSeparator` for lists; `render={<a href />}` for a clickable item. Use `Field` when there's a form control; use `Item` when it's content only.
- `Empty`: `EmptyHeader` > `EmptyMedia variant="icon"` + `EmptyTitle` + `EmptyDescription`; `EmptyContent` with an action (`Button`, `InputGroup`). An outline with `border`, a background with `bg-*`.

#### Toast, Sonner, Alert

- Base UI Toast: `<Toaster />` once in the layout; `toast.add({ title, description, type: "success"|"info"|"warning"|"error"|"loading", actionProps: { children: "Undo", onClick } })`; `toast.close(id)`; `toast.promise(promise, { loading, success, error })`. Stacking, swiping, and limits come from the manager; the viewport is fixed at the bottom (full width on mobile, bottom-right corner at `sm+`).
- Sonner: `<Toaster />` from `@/components/ui/sonner` (it uses `next-themes` for the theme) and `toast("...")`, `toast.success/error/promise`, `position`, `richColors`.
- `Alert variant="default|destructive"` with an icon as the first child, `AlertTitle`, `AlertDescription`, and `AlertAction` (top-right corner).
- Rule: a toast for transient, non-critical confirmation; `Alert` for a persistent error or contextual information; `AlertDialog` for a decision. Never rely on a toast for information the user needs to re-read.
- Mobile: the toast viewport must respect `env(safe-area-inset-bottom)` and must not cover a fixed footer (adjust `ToastViewport`/`Toaster` with `className` or `offset`).

#### Avatar, Badge, Skeleton, Spinner, Progress

- `Avatar size` + `AvatarImage` + `AvatarFallback` (required) + `AvatarBadge`; `AvatarGroup` > `Avatar`... + `AvatarGroupCount`.
- `Badge variant`; as a link: `render={<a href />}` (Base) or `asChild` (Radix).
- `Skeleton className="h-4 w-3/4"` with the real content's dimensions to avoid layout shift.
- A standalone `Spinner` can take `className="size-6"`; inside a `Button`, use `data-icon`.
- `Progress value` plus the optional `ProgressLabel` and `ProgressValue`; for indeterminate tasks use `Spinner` or `shimmer`.

#### Carousel, Resizable, Scroll Area, Accordion, Collapsible

- `Carousel opts={{ align: "start", loop: true }} orientation setApi plugins={[Autoplay({ delay: 4000 })]}` > `CarouselContent` > `CarouselItem className="basis-full sm:basis-1/2 lg:basis-1/3"`; `CarouselPrevious`/`CarouselNext` (positioned outside the content; on mobile, keep them visible inside the area or add indicators). Swiping comes from Embla; keyboard support via the arrow keys; autoplay must pause with `prefers-reduced-motion` and on hover/focus.
- `Resizable`: panels with a handle and keyboard support; on small screens, stack the panels (vertical `orientation` or an alternative layout). The wrapper passes the v4 primitive's props through: use `orientation="horizontal"` or `"vertical"` (v3's old `direction` no longer exists).
- `ScrollArea className="h-72"` + `ScrollBar orientation="horizontal"`; combine it with `scroll-fade` on the viewport.
- `Accordion`/`Collapsible`: the height animation is already configured (`accordion-down/up` in `shadcn/tailwind.css`); on Base UI, `Accordion multiple defaultValue={["a"]}`.

#### Questionnaire

- `<Questionnaire items={items} onSubmit>` > `QuestionnaireProgress`, `QuestionnaireItem name required multiple` > `QuestionnaireTitle` (legend), `QuestionnaireDescription`, `QuestionnaireChoices` > `QuestionnaireChoice value` + `QuestionnaireInput aria-label`, `QuestionnaireError`; `QuestionnaireActions` > `QuestionnairePrevious`, `QuestionnaireSkip`, `QuestionnaireNext`, `QuestionnaireSubmit`. Answers come via `FormData` on submit. Letter/number shortcuts (`shortcuts`), controlled navigation, resuming, conditional items, and composition with `Card` or `Dialog`.
- Use it for onboarding, surveys, screening, and agent questions; not for long data forms (use `Field`).

#### Chat: Message Scroller, Message, Bubble, Attachment, Marker

- Fixed order: `MessageScrollerProvider autoScroll defaultScrollPosition` > `MessageScroller` > `MessageScrollerViewport` > `MessageScrollerContent` > `MessageScrollerItem messageId scrollAnchor` (one per row) ... + `MessageScrollerButton` after the viewport. Don't write `useStickToBottom`, a `ResizeObserver`, or manual `scrollTop` handling.
- `Message align="start|end"` > `MessageAvatar` + `MessageContent` > `MessageHeader`, `Bubble variant align` > `BubbleContent` + `BubbleReactions side align`, `MessageFooter`; `MessageGroup` for a sequence from the same sender.
- `Attachment state size orientation` with `AttachmentMedia variant="icon|image"` and `AttachmentTrigger` (a clickable overlay that keeps the actions separate). `Marker variant="separator"` for "Today"; `Marker role="status"` + `MarkerContent className="shimmer"` for "Thinking…".
- Mobile: the message viewport must use `dvh`, respect the virtual keyboard (the message input goes outside the scroller, with a safe area), and use `scroll-fade` at the edges.
- `@shadcn/helpers` (`createChat` for the AI SDK and TanStack AI) lets you develop and test the interface without a backend.

#### Direction (RTL)

- `DirectionProvider direction="rtl"` (+ `dir="rtl"` on `<html>`); `useDirection()`. Projects with `rtl: true` get logical classes at install time; `migrate rtl` converts existing components; `Calendar`, `Pagination`, and `Sidebar` require documented manual steps; directional icons use `rtl:rotate-180`; portal content uses `dir`.

---

## 7. Blocks, charts, Typeset, Create, Directory, and registries

### 7.1 Official blocks

Blocks are ready-made compositions (pages or sections) installable by name, available for all three bases in the repository (the February 2026 documentation mentions Radix and Base UI; the `bases/aria/blocks` directory also contains all of them).

| Category | Items | Contents |
| --- | --- | --- |
| Dashboard | `dashboard-01` | Sidebar, header, metric cards, an interactive area chart, and a data table with drag-and-drop. Dependencies: `@dnd-kit/*`, `@tanstack/react-table`, `zod`; registry: `sidebar`, `breadcrumb`, `separator`, `label`, `chart`, `card`, `select`, `tabs`, `table`, `toggle-group`, `badge`, `button`, `checkbox`, `dropdown-menu`, `drawer`, `input`, `avatar`, `sheet`, `sonner` |
| Login | `login-01` (simple), `login-02` (two columns with an image), `login-03` (muted background), `login-04` (form and image), `login-05` (email only) | A page at `app/login/page.tsx` + `components/login-form.tsx` |
| Signup | `signup-01` through `signup-05` (05 with social providers) | Same |
| Sidebar | `sidebar-01` (groups), `02` (collapsible sections), `03` (submenus), `04` (floating), `05` (collapsible submenus), `06` (submenus in a dropdown), `07` (collapses to icons), `08` (inset with secondary navigation), `09` (nested), `10` (in a popover), `11` (file tree), `12` (with a calendar), `13` (in a dialog), `14` (on the right), `15` (left and right), `16` (fixed header) | Application layouts |

Usage [RECOMMENDED]: install the block closest to the flow, rename the page to the real route, extract the form into the project's domain, and wire up validation and the API. Blocks are a starting point, not untouchable pieces. Blocks use `sonner` even in Base UI projects (`dashboard-01`); in Base projects, you can switch to `toast` to keep a single notification system.

Installing in a monorepo: `npx shadcn@latest add login-01 -c apps/web` installs `button`, `label`, `input`, and `card` in `packages/ui`, and `login-form` in `apps/web/components`.

### 7.2 Chart library

`https://ui.shadcn.com/charts/<type>` with `area`, `bar`, `line`, `pie`, `radar`, `radial`, and `tooltip`. 70 items, named `chart-<type>-<variation>`: `chart-area-default|linear|step|stacked|stacked-expand|gradient|axes|legend|icons|interactive`, `chart-bar-default|horizontal|multiple|stacked|label|label-custom|mixed|active|negative|interactive`, `chart-line-default|linear|step|multiple|dots|dots-custom|dots-colors|label|label-custom|interactive`, `chart-pie-simple|separator-none|label|label-custom|label-list|legend|donut|donut-active|donut-text|stacked|interactive`, `chart-radar-default|dots|multiple|lines-only|label-custom|radius|grid-custom|grid-none|grid-circle|grid-circle-no-lines|grid-circle-fill|grid-fill|legend|icons`, `chart-radial-simple|label|grid|text|shape|stacked`, `chart-tooltip-default|indicator-line|indicator-none|label-custom|label-formatter|label-none|formatter|icons|advanced`.

Usage: `npx shadcn@latest add chart-bar-interactive` installs a ready-made `Card` + chart component in `components/`. Adapt `chartData`, `chartConfig`, titles, and formatting (`Intl.NumberFormat("pt-BR")`, dates with `date-fns` and `ptBR`). Before creating a chart from scratch, look for the closest variation.

Choosing a type (guide): a trend over time → area/line; a comparison across categories → bar (horizontal when the labels are long); composition → pie/donut only with few slices, otherwise stacked bars; multiple dimensions → radar; progress/target → radial. Always with a visible label, unit, and period.

### 7.3 Typeset

See §5.5. The builder is at `https://ui.shadcn.com/typeset` (rendered on the client; it generates `typeset.css`, the font configuration per framework, the preset class, and the wrapper).

### 7.4 shadcn/create and presets

`https://ui.shadcn.com/create` builds the preset with a preview using real components and generates the creation command. Parameters supported via URL (e.g., `/create?base=aria`, `/create?template=vite`, `/create?preset=b27GcrRo`). Recommended flow for a new project: define the identity (style, color, font, radius) in Create → copy the command → `init` → record the preset code in the project's README so any agent can reproduce it (`preset resolve` also retrieves it).

### 7.5 Directory and community registries

The Directory (`https://ui.shadcn.com/docs/directory`, with its index at `/r/registries.json`) lists 294 registries with `name`, `homepage`, `url`, `description`, and a `health` object (status `healthy`, `degraded`, `unavailable`, `observing`; availability over 7 and 30 days; scores for reliability, correctness, installability, and hygiene). All of them work with `npx shadcn@latest add @<registry>/<item>` with no configuration. Official warning: they're maintained by third parties; review the installed code.

Discovery [RECOMMENDED]:

```bash
npx shadcn@latest search @shadcn -q "sidebar"          # official
npx shadcn@latest search @magicui -q "text"            # a single registry
npx shadcn@latest search -q "hero"                     # all configured ones
npx shadcn@latest search @tailark -q "stats" -t block  # by type
npx shadcn@latest view @kibo-ui/kanban                  # inspect before installing
npx shadcn@latest add @aceternity/spotlight --dry-run   # see the files and dependencies
```

[REQUIRED] selection criteria for third-party items:

1. Compatibility with the project's base (many registries are Radix-only or Base-only; read the description and the code with `--view`).
2. The dependencies the item brings in (`motion`, `gsap`, `three`, `@react-three/fiber`, `maplibre-gl`...): weight, license, and maintenance. Record the package and its purpose in the report.
3. The registry's `health` and the date of the last check.
4. Adherence to the tokens: items that use fixed colors (`bg-blue-500`) need to be adapted to tokens before entering the project.
5. Accessibility: visual effects must respect `prefers-reduced-motion` and must not hide essential content; test after installing.
6. Imports: fix `@/components/ui/...` to match the project's aliases; swap the icons for the `iconLibrary`.
7. Use the registry already selected by the task or project. If none is selected, use official components first. Introduce a community registry only for a concrete product need after reviewing its files, license and dependencies; ask when an unresolved choice materially changes scope or trust. (project policy)

Registries mentioned in official sources or observed in the index on 2026-09-09 (community; verify before using): animations and effects `@magicui`, `@aceternity`, `@animate-ui`, `@motion-primitives`, `@kokonutui`, `@eldoraui`, `@cult-ui`, `@amicro`, `@beui`; component kits `@kibo-ui`, `@diceui`, `@bundui`, `@hextaui`, `@hirael`, `@ilinxa`, `@blocks-so`, `@tailark` (marketing blocks), `@launchui`, `@initium`; Base UI `@basecn`, `@coss`, `@lumiui`, `@blode`; React Aria `@intentui`, `@kanpeki`, `@baselayer`; AI and chat `@ai-elements`, `@assistant-ui`, `@elevenlabs-ui`, `@gaia`, `@delta`; forms and authentication `@formcn`, `@better-auth-ui`, `@clerk`, `@auth0`; charts and maps `@evilcharts`, `@bklit`, `@gpt-vis`, `@mapcn`, `@flightcn`; animated icons `@lucide-animated`, `@hugeicons-animated`, `@icons-animated`, `@heroicons-animated`; utilities `@loading-ui`, `@fonttrio`, `@flagcn`, `@better-upload`, `@billingsdk`. This guide doesn't promise to catalog them all; use `search`.

### 7.6 Your own registry (when the project distributes components)

A `registry.json` at the root (`name`, `homepage`, `items` or `include`), `npx shadcn@latest registry validate`, and `npx shadcn@latest build` generates `public/r/*.json`; a public GitHub repo works with no build (`owner/repo/item`); a private one works with `gh auth login` or `GH_TOKEN`. Items can distribute components, hooks, themes, fonts, pages, configuration files, agent rules (`AGENTS.md`, `.cursor/rules`), and workflows. Optional dynamic search via the query `?q=&limit=&offset=` with `pagination`.

---

## 8. Composition recipes

Each recipe lists components, structure, states, and mobile considerations. Adapt `render`/`asChild` to your base.

### 8.1 Authentication

- Base: the `login-03` or `login-04` block (`signup-0x` for registration). Structure: `Card` > `CardHeader` (title, description) > `CardContent` > `form` > `FieldGroup` > `Field`(email) + `Field`(password with a "Forgot password" link) + `Button type="submit" className="w-full"` + `FieldSeparator`("Or continue with") + provider buttons with `variant="outline"` + `FieldDescription` with a signup link.
- Attributes: email `type="email" inputMode="email" autoComplete="email"`; password `type="password" autoComplete="current-password"` (signup: `new-password`); code `InputOTP autoComplete="one-time-code"`.
- States: submission with a `Spinner` and `disabled`; a credential error in an `Alert variant="destructive"` above the form (not in a toast); success redirects.
- Mobile: `min-h-svh` with `flex items-center justify-center p-6` and safe areas; fields with a comfortable height; the primary button visible without scrolling when the keyboard opens (test at 375×667 with the keyboard up).

### 8.2 Forms

- Layout: `FieldGroup` > `Field` (vertical) for signup; `Field orientation="responsive"` with `FieldContent` for settings; `FieldSet` + `FieldLegend` for checkbox/radio groups.
- Library: React Hook Form + Zod (`zodResolver`) with `Controller`; TanStack Form (`form.Field` with `field.state.meta`); Formisch. All of them use `Field`/`FieldError`. Server Actions with `useActionState` is marked as "coming soon" in the documentation.
- Validation: `mode: "onTouched"` or `"onBlur"` so it doesn't yell too early; errors via `FieldError`; focus on the first invalid field after submit.
- Action bar: in long forms, a fixed footer (`sticky bottom-0`) with `pb-[max(1rem,env(safe-area-inset-bottom))]` and `bg-background/95 backdrop-blur`; make sure it doesn't cover the last field (bottom padding on the form equal to the bar's height).
- Data loss: warn before leaving with unsaved changes (`AlertDialog`), and preserve state when the screen rotates (state in React, not in the DOM).

### 8.3 Navigation and application shell

- An application with a sidebar: `SidebarProvider` > `AppSidebar` (`Sidebar collapsible="icon"`) + `SidebarInset` > `header` (`SidebarTrigger`, `Separator orientation="vertical"`, `Breadcrumb`, actions) + `main`. The `sidebar-07` block or `dashboard-01` as a base.
- Site/marketing: a header with `NavigationMenu` at `md+` and a `Sheet side="left"` with a list of links on smaller screens; the same route array for both.
- Bottom navigation (3 to 5 main destinations, on small screens only, when most of the user's actions live in those destinations): a fixed `nav` with `grid grid-cols-N`, `Button variant="ghost"` buttons with an icon + a short label, `aria-current="page"`, `pb-[env(safe-area-inset-bottom)]`, hidden at `md+` when there's a sidebar. Don't use it alongside a sidebar in mobile mode without good reason (two navigation systems competing).
- Profile/user: a `DropdownMenu` with an `Avatar` as the trigger; items with icons; "Sign out" set apart.

### 8.4 Dashboards

- Metrics: a grid of `Card size="sm"` with `CardHeader` (description, a numeric `CardTitle` with `tabular-nums`, `CardAction` with a change `Badge`) and a `CardFooter` with context. A container-query grid like the one in the `dashboard-01` block (`@container/main` and `@xl/main:grid-cols-2 @5xl/main:grid-cols-4`), so the same widget works with and without a sidebar.
- Main chart: `chart-area-interactive` (with a `ToggleGroup` for the period at `md+` and a `Select` on small screens, as in the official example).
- Recent list/table: a data table with priority columns.
- Mobile: stack the cards in a single column, keep the main metric at the top, reduce the chart's height, and move filters into a `Drawer`.
- States: a `Skeleton` in the shape of the cards, an `Empty` in the chart when there's no data, an `Alert` for a partial failure of one source without taking down the page.

### 8.5 Data tables

- Structure: a toolbar (search `InputGroup`, filters, a columns `DropdownMenu`) + `Table` + pagination. Reusable components from the Tasks example: `DataTableColumnHeader`, `DataTablePagination`, `DataTableViewOptions`.
- Row: actions in a `DropdownMenu` (a `Button variant="ghost" size="icon-sm"` trigger with `sr-only` text), selection with `Checkbox`, status with `Badge`.
- The mobile strategy is decided per table (§6.2 Table).
- Large volumes: server-side pagination (`manualPagination`) or virtualization (an external library such as `@tanstack/react-virtual`, which isn't part of shadcn/ui); never render thousands of rows.

### 8.6 Filters

- Toolbar: an `InputGroup` with a search icon and a clear button; facets with `Select` (few options), `Combobox multiple` (many), `ToggleGroup` (2 to 5 shortcuts), `Popover` + `Calendar mode="range"` (a period); active filters as `Badge variant="secondary"` with a remove button.
- State in the URL (query string) for deep linking and browser back; `nuqs` is the library used by the official site (external).
- Mobile: a "Filters" button with a count `Badge` opening a `Sheet side="right"` or a `Drawer` with the same controls and "Clear" and "Apply" buttons in the footer.

### 8.7 Settings

- `Tabs` (or secondary navigation in the sidebar) by area: Profile, Account, Notifications, Appearance, Billing.
- Each area: `Card` > `CardHeader` > `CardContent` > `FieldGroup` with `Field orientation="responsive"` (label and description on the left, control on the right on wide screens; stacked on narrow screens), `Switch` for immediate preferences (they save on toggle, with a toast), and forms with a "Save" button in the `CardFooter`.
- Appearance: a light/dark/system `ToggleGroup` wired to `next-themes`' `useTheme`.
- Danger zone: a `Card` with a `border-destructive/50` border and a `Button variant="destructive"` that opens an `AlertDialog` requiring the user to type a confirmation when the action is irreversible.

### 8.8 Feedback states (required in every important area)

| State | Pattern |
| --- | --- |
| Loading | `Skeleton` with the final dimensions; `Spinner` in buttons; never a full-page spinner with no context |
| Empty | `Empty` with an icon, title, explanation, and a primary action |
| Error | `Alert variant="destructive"` with a title, the cause in plain language, and a "Try again" `Button`; field errors in `FieldError` |
| Partial error | Valid content stays; an `Alert` or `Marker variant="border"` in the affected section |
| Success | A short `toast`; in long flows, a success screen with next steps |
| Offline | A persistent `Alert` at the top or a `Marker role="status"`; actions that require the network disabled with an explanation; a resend queue when the domain allows it (§9.8) |
| Reconnecting / stale data | A `Badge variant="outline"` reading "Updated X ago" + a refresh button; `shimmer` on the status text |
| No permission / not authenticated | An `Empty` with an explanation and an action (sign in, request access); never a blank screen |

### 8.9 Responsive dialog (Dialog on desktop, Drawer on mobile)

```tsx
"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"

export function EditProfile({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger render={<Button variant="outline" />}>Edit profile</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Edit profile</DrawerTitle><DrawerDescription>Make your changes and save.</DrawerDescription></DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          <DrawerFooter><DrawerClose render={<Button variant="outline" />}>Cancel</DrawerClose></DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Make your changes and save.</DialogDescription></DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
```

`useIsMobile` initially resolves to the desktop branch in this pattern. A Dialog ↔ Drawer switch preserves only state lifted above the branch, such as `open`; it remounts children and can lose uncontrolled form values, selection and focus. Keep important form data controlled in the parent (or a stable form store), and test hydration, resizing while open, unsaved data and focus restoration. Prefer CSS for critical SSR layout where possible. This recipe assumes the installed Base UI components expose `render`; with another base, read the actual generated component API instead of applying a blanket prop substitution.

### 8.10 Command palette

`CommandDialog open onOpenChange title="Search" description="Type a command"` with `CommandInput`, navigation and action groups, and `CommandShortcut`; the `Ctrl/Cmd + K` shortcut in a `useEffect`; a visible button with a `Kbd` in the header at `md+` and a search icon on small screens.

### 8.11 Reusable destructive confirmation

A `ConfirmDialog` wrapper around `AlertDialog` (the official example in customization.md): props `title`, `description`, `confirmLabel`, `onConfirm`, `destructive`; `AlertDialogAction` with `variant="destructive"` when destructive, plus a loading state during the action.

### 8.12 Chat

See §6.2 (Chat). Layout: a header, a `MessageScroller` with `flex-1 min-h-0`, and a composer fixed at the bottom (an `InputGroup` with `InputGroupTextarea` and `InputGroupAddon align="block-end"` holding the buttons), plus the safe area and `dvh`.

---

## 9. Responsiveness, mobile experience, accessibility, and PWA

This section contains standalone responsive and accessibility essentials adapted to shadcn components. If `RESPONSIVENESS.md` is present, it owns shared responsive/accessibility/PWA acceptance criteria; this guide owns shadcn APIs and composition. Product requirements determine PWA capabilities and the task determines validation scope.

### 9.1 Principles

- [REQUIRED] Mobile-first as architecture, not as a final adjustment. Start with the layout that works at 320 px and add columns, panels, and density as the space grows. Desktop should also make use of the space (don't leave giant cards in a single column at 1440 px).
- [REQUIRED] Breakpoints derive from the content. Use Tailwind's breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536) as vocabulary, but only where the layout breaks. The shadcn components have few fixed points: `Sidebar` and `useIsMobile` at 768; dialogs at `sm`; `Field responsive` at the container's `@md`. Test ±1 px at each of them.
- [RECOMMENDED] Container queries (`@container`, `@md/name:`) in reusable cards, widgets, lists, and forms; media queries for viewport decisions (navigation, global density).
- [RECOMMENDED] Fluid units: `rem`, `%`, `fr`, `minmax()`, `clamp()`, `min()`, `max()`, `ch`. Grids with `grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]` instead of fixed counts per breakpoint when the content allows it.
- [REQUIRED] Screen height: `min-h-svh`/`h-dvh` instead of `100vh` for shells and full screens (the official sidebar uses `h-svh`; the drawer uses `100dvh`).
- [REQUIRED] Safe areas: `viewport-fit=cover` in the viewport meta tag (Next.js: `viewport = { viewportFit: "cover" }`) and `padding` with `env(safe-area-inset-*)` on fixed headers, bottom navigation, toasts, drawers, FABs, and action bars: `pb-[max(1rem,env(safe-area-inset-bottom))]`.
- [REQUIRED] Zoom is never blocked (`user-scalable=no` is prohibited). Text is selectable in content; `select-none` only on controls.
- [REQUIRED] No user-agent detection for layout; use CSS, `matchMedia`, capabilities (`hover`, `pointer`), and feature detection.

### 9.2 Verifiable rules

| Rule | How to verify it |
| --- | --- |
| Reflow at 320 px with no loss of content or function | Viewport 320×568; walk through every screen; nothing cut off, no control unreachable |
| No accidental horizontal scrolling at any supported width | `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1` on the main pages; regions with intentional scrolling (tables, carousels, charts) isolated in a container with `overflow-x-auto` |
| Long content doesn't break the layout | Test long labels, long emails and URLs, big numbers, 3-line titles, and empty and huge lists; `min-w-0` on flex items with text; `truncate` only where no information is lost; `break-words` on user content |
| Portrait and landscape | Critical flows at 375×667 and 667×375, 820×1180 and 1180×820 |
| Reduced heights | 667×375 and desktop windows 600 px tall: dialogs, drawers, and forms remain usable (internal scrolling, visible footer) |
| Intermediate widths | 600, 700, 900, 1100 px: nothing disappears, no duplicated navigation, grids with no gaps |
| Virtual keyboard | At 375×667 with the keyboard up (emulate `interactive-widget=resizes-content` in the viewport meta tag or reduce the height to ~360 px): the focused field, the error message, and the submit button remain reachable; `scroll-padding-bottom` when there's a fixed bar |
| Fixed elements don't cover content | Tab focus through every control: the focused element is never behind the header, the bottom bar, or a toast; bottom padding on the content equal to the bar's height |
| State preserved when the layout changes | Resize during a flow (a filled-in form, an open dialog, an applied filter): state is kept; components that swap (Dialog↔Drawer) share the same state (§8.9) |
| Touch targets | Frequently used controls with an interaction area of at least 44×44 CSS px (measure `getBoundingClientRect` or the extended hit area); no tiny icons crammed together |
| Visible focus | Tab across the whole screen: a visible focus ring on every control (the components use `focus-visible:ring-*`; don't remove `outline-none` without a replacement) |
| Accessible names | Every button, link, field, and interactive icon has a name (`aria-label`, `sr-only`, `FieldLabel`); check with axe and with the accessibility tree |
| Contrast | Normal text ≥ 4.5:1, large text ≥ 3:1, components/icons ≥ 3:1; check in both themes (a contrast tool with computed values, not OKLCH "off the top of your head") |
| No dependence on hover or gestures | Every action available on hover (menus, row actions) is also available by click/tap and keyboard; every gesture (drawer swipe, carousel) has an equivalent button |
| Reduced motion | `prefers-reduced-motion: reduce`: decorative animations off, essential transitions kept short, the application fully usable (§10.2) |

### 9.3 shadcn components on small screens

| Component | Caution |
| --- | --- |
| `Table` | Already has a scroll container; decide the strategy per table (§6.2); indicate content beyond the edge (`scroll-fade-x`); a `sticky top-0` header with `bg-background` when the list is long |
| `Dialog` | Full width with margins on mobile (the style already handles this), `max-h-[calc(100dvh-2rem)]` with internal scrolling, a fixed footer, buttons in a column (`DialogFooter` already reverses the order on small screens) |
| `Sheet` | `side="bottom"` for short actions; `side="left"` for navigation; a max width on desktop (`sm:max-w-md`) |
| `Drawer` | Height driven by the content with `max-h`; `snapPoints` for long content; a visible handle (`showSwipeHandle`); a close button always present; the CSS `body{position:relative}` (iOS 26) |
| `Select` / `Combobox` / `DropdownMenu` / `Popover` | Check positioning when vertical space is tight (Base UI recalculates `side`); items with a comfortable height; for long lists, put them inside a `Drawer`/`Sheet` |
| `Tooltip` / `HoverCard` | They don't open on touch: make sure there's an accessible name and an alternative path |
| `Sidebar` | Becomes a `Sheet` below 768; `SidebarTrigger` visible in the mobile header; `SIDEBAR_WIDTH_MOBILE` ≤ 85% of the width at 320 px (18rem = 288 px is acceptable) |
| `Toast` / `Sonner` | Full width on mobile, respect the safe area, don't cover the bottom bar; a long enough duration; reachable actions |
| `Calendar` | `--cell-size` ≥ 2.75rem; one month at a time on narrow screens (`numberOfMonths={1}`); ranges in a `Drawer` |
| `Tabs` | A horizontally scrollable list, or swap it for a `Select` on narrow screens |
| `NavigationMenu` / `Menubar` | Desktop only; the alternative goes in a `Sheet`/`DropdownMenu` |
| `Carousel` | Visible buttons or indicators; `basis-full` on narrow screens |
| `Chart` | Reduced height, fewer ticks, legend below, tooltip on touch tested |
| `Resizable` | Stack or hide the handles on small screens |
| `Command` | Height capped with `dvh`; a visible search button |
| `InputGroup` | Addons must not squeeze the field below about 10 visible characters |
| `Breadcrumb` | Collapse with `BreadcrumbEllipsis` |
| `Sonner`/`Toast` in a standalone PWA | Top safe area when `position="top-*"` |

### 9.4 Adaptive patterns: when they help

- **Drawer (bottom sheet)**: short contextual actions, filters, option selection, confirmation with details, in place of a `Dialog` on small screens. Avoid it for long forms (the keyboard and dragging conflict) and for content that needs extensive scrolling.
- **Sheet**: mobile side navigation, a details or filters panel on desktop and mobile, a "cart" or "notifications" panel.
- **Bottom navigation**: applications with 3 to 5 frequently used destinations and parity with native apps; not on content sites, and not when there's already a well-designed mobile sidebar.
- **Fixed header**: when global actions (search, create, back) need to always be available; keep it compact (≤ 56 px) with `backdrop-blur`; only make it retract on scroll if you've measured that it helps.
- **Master-detail / simultaneous panels**: landscape tablet and desktop (`Resizable` or a two-column grid); on narrow screens it becomes two-step navigation with its own route for the detail view.
- **Navigation rail / icon sidebar**: `Sidebar collapsible="icon"` at medium widths.

Rule: the conceptual structure (which destinations exist) is the same at every width; only the presentation changes.

### 9.5 Input methods

- Don't assume mobile = touch and desktop = mouse. Use `@media (hover: hover)` (Tailwind's `hover:` is already restricted to hover-capable devices in v4) to enrich, never to hide functionality.
- Row/card actions that appear on hover must also be reachable by focus (`group-focus-within:opacity-100`) and always visible on devices without hover (`@media (hover: none)` or `[@media(hover:none)]:opacity-100`).
- Gestures: `Drawer` (swipe) and `Carousel` (drag) already have alternatives (a close button, arrows); keep them visible. Don't hijack native scrolling.
- Keyboard: complete flows via Tab, Shift+Tab, Enter, Space, Escape, and the arrow keys where the primitives use them (menus, tabs, sliders, radios, calendar). No focus traps outside modal dialogs.

### 9.6 Accessibility (WCAG 2.2 AA as the reference)

- Semantic HTML first: `header`, `nav`, `main`, `aside`, `footer`, `h1`–`h6` in order, `button` for actions, `a` for navigation, `form`/`label`/`fieldset`. ARIA only when HTML isn't enough; the primitives already apply roles and attributes (dialog, menu, listbox, tablist, progressbar, group).
- A skip link to the main content in layouts with extensive sidebars/headers [RECOMMENDED].
- Names: `FieldLabel htmlFor`; `aria-label` on icon-only buttons; `TableCaption`; `DialogTitle`; `ChartContainer` with a visible title and `accessibilityLayer`.
- Errors: `FieldError` next to the field; `aria-invalid`; focus on the first error; messages that say what to do.
- Dynamic messages: `toast` already announces them (Base UI Toast and Sonner use live regions); for inline status use `role="status"` (`Marker role="status"`).
- Contrast: the official themes have been tuned, but `ghost` variants, `muted-foreground` text on `muted`, and chart colors need checking; a translucent `menuColor` requires testing over varied backgrounds.
- Zoom and reflow: 200% zoom on desktop (equivalent to 640 px at 1280) and 400% (320 px); typography in `rem`.
- Motion: §10.2. Forced contrast (`forced-colors`): are borders and focus still visible? Test on Windows or with `emulateMedia({ forcedColors: "active" })`.
- Screen readers: when possible, walk through dialogs, menus, tabs, and forms with VoiceOver/NVDA/TalkBack; record what was checked.
- Automation: `@axe-core/playwright` on the main pages and with dialogs, menus, and sheets open; zero critical and serious violations before finishing. Automation doesn't replace manual verification of the keyboard, focus, order, and visual meaning.

### 9.7 Mobile performance

- Code splitting by route; charts (`recharts`), editors, and maps loaded on demand (`next/dynamic` or `React.lazy`) with a `Skeleton` of the same size.
- Images with declared dimensions, `srcset`/`sizes`, or `next/image`; no lazy loading on the LCP element.
- Fonts via `next/font` or `@font-face` with `font-display: swap` and subsetting; avoid more than 2 families.
- Large lists: pagination, incremental loading, or virtualization; `MessageScroller` already handles long conversations.
- Field targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75. A local Lighthouse run is lab data, not field data; don't declare "Core Web Vitals passed" based on Lighthouse.
- Layout shift: `Skeleton` with real dimensions, reserved space for banners, `aspect-ratio` on media, fonts with a metric fallback.

### 9.8 PWA: looking like an app versus implemented capabilities

For authenticated responses, default to no service-worker caching. If private offline data is explicitly required, isolate caches by identity, clear them on logout/account change, and test multiple accounts/tabs; clearing on logout alone is not an isolation policy. Never cache credentials or tokens.

shadcn/ui doesn't provide a manifest, a service worker, or an offline strategy. "Looking like an app" (adaptive navigation, safe areas, comfortable touch) is required; "being a PWA" is conditional.

Applicability criteria [CONDITIONAL]:

- Ship it as a PWA when the product is used repeatedly (a work tool, a consumer app), when there's a real gain from a home-screen icon, standalone mode, push notifications, or offline support.
- Don't build a PWA for marketing sites, simple documentation, or one-off flows. Don't create a minimal manifest just so you can call it a PWA.

When applicable:

1. **A complete manifest**: a stable `id`, `name`, `short_name`, `description`, `start_url`, `scope`, `display: standalone` (`display_override` optional), `background_color` and `theme_color` consistent with light/dark `--background`, `icons` at 192 and 512 (plus `maskable` with the content inside the safe zone), real `screenshots`, and `shortcuts` when they make sense; don't lock `orientation` without a reason. Next.js: `app/manifest.ts` (`MetadataRoute.Manifest`) and an `apple-touch-icon` in `app/`. Vite: `vite-plugin-pwa` generates the manifest and service worker (Workbox).
2. **A service worker** only when there's a real benefit (offline, resilience, push): Next.js with Serwist (`@serwist/next`) or your own service worker following Next.js's official PWA guide; Vite with `vite-plugin-pwa`. Strategies per resource type (shell and versioned assets: cache-first; navigations and APIs: network-first or stale-while-revalidate; private data: no caching, or cleared on logout). Minimal precaching. Controlled updates: detect a new SW and show a discreet notice ("A new version is available") with an `Alert`/`toast` and an "Update" action; don't use a blind `skipWaiting()` that mixes versions.
3. **Intentional offline support** with shadcn components: a persistent `Alert` or a status `Marker` when `navigator.onLine` is false and when requests fail; content already seen remains available; actions that depend on the network are disabled with an explanation; a sync queue only for idempotent, non-financial operations, with conflict resolution.
4. **Installation**: promote it only after the user understands the value, via `beforeinstallprompt` (Chromium) in a contextual button/`Drawer`; on iOS/iPadOS, "Add to Home Screen" instructions only when it isn't installed and only on the right platform; never a popup on load.
5. **Standalone mode**: `@media (display-mode: standalone)` for adjustments (a back button, hiding the install CTA, safe areas); deep links and route reloads work; no dead ends.
6. **Tests** (§10.5): a valid manifest in the DevTools Application panel, installability, the service worker in control, essential resources cached, offline mode with reload and navigation, coming back online, updating between two versions, and real iOS and Android devices when available. Don't treat "SW registered" as "offline works." Explicitly record whatever was only emulated.

---

## 10. Animations, visual effects, performance, and browser verification

### 10.1 What exists and when to use it

- Already included in the components: enter/exit for dialogs, sheets, menus, popovers, and tooltips (`tw-animate-css` on Radix; transitions with `data-starting-style`/`data-ending-style` on Base UI), the accordion's height animation, toast stacking and swiping, drawer dragging, carousel swiping, the pulsing `Skeleton`, and `Spinner`.
- Official utilities: `shimmer` (text in a live state: "Generating response…"; `shimmer-once` to reveal on completion), `scroll-fade` (edges of scrollable lists, with no JavaScript and a static fallback).
- Community: animation registries (§7.5) based on `motion`, GSAP, or shaders. Weight and accessibility must be evaluated.
- Rule [REQUIRED]: animation communicates a state change, preserves context, or improves the perception of fluidity. Don't add decorative motion to tools people use continuously. Duration: 100 to 200 ms for surfaces, up to 300 ms for large panels; the `transform` and `opacity` properties (compositor); never animate `width`/`height`/`top` in large lists.
- Recommended microinteractions (guide): a pressed state on buttons (already comes with the style), a subtle hover on clickable rows and cards, theme transitions turned off during the switch (next-themes' `disableTransitionOnChange`), `shimmer` on status text, an animated `Progress` on uploads.

### 10.2 Reduced motion

- `shimmer` turns itself off with `prefers-reduced-motion`. The other effects don't: use `motion-safe:` variants for optional animations and `motion-reduce:` for static versions (`motion-reduce:animate-none`, `motion-reduce:transition-none`).
- [CONDITIONAL] A global rule when the project has many third-party animations:

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

After applying it, verify that dialogs, drawers, and menus still open and close (Base UI's exit transitions depend on `transitionend`; at 0.01 ms the event does fire, but confirm it in the browser).

- Carousel autoplay and loops (`text-rotate`, particles) must stop with reduced motion.

### 10.3 Verification protocol for each effect [REQUIRED]

For every animation or effect implemented in future projects:

1. **Define** the trigger (click, hover, focus, opening, scroll, load) and the expected behavior (what moves, from where to where, duration, final state).
2. **Trigger the real interaction** in the browser (click, key, scroll, emulated touch), not just changing classes or state via code.
3. **Observe the transition**: capture evidence during the animation, not just of the final state. Options: a Playwright video (`recordVideo`), a trace with screenshots (`context.tracing.start({ screenshots: true, snapshots: true })`), a sequence of screenshots at intervals, or sampling computed values.
4. **Check the final state** (position, opacity, the `data-open`/`data-state` attributes, focus).
5. **Test repetition and interruption** where relevant: opening and closing quickly, double-clicking, scrolling during the animation; nothing should get stuck in an intermediate state.
6. **Repeat with reduced motion** (`page.emulateMedia({ reducedMotion: "reduce" })`) and confirm the functionality still works.
7. **Check for interference**: focus visible during and after; clicks not lost on elements that move; scrolling not blocked; no long tasks (a `longtask` `PerformanceObserver` or a trace) and no layout shift.

Acceptable evidence: a recording or trace with timestamps; a table of `{t, opacity, transform}` samples; assertions that pass at two distinct moments. Not acceptable: the existence of CSS classes, a single screenshot of the final state, "the code looks right."

Reference snippets (Playwright):

```ts
import { expect, test } from "@playwright/test"

test("dialog opens with an observable transition", async ({ page }) => {
  await page.goto("/profile")

  // Sample a Dialog's transition (Base UI uses data-starting-style/ending-style)
  await page.getByRole("button", { name: "Edit profile" }).click()
  const dialog = page.getByRole("dialog")
  const samples: Array<{ t: number; opacity: string; transform: string }> = []
  const start = Date.now()
  while (Date.now() - start < 400) {
    samples.push(
      await dialog.evaluate((el) => {
        const s = getComputedStyle(el)
        return { t: performance.now(), opacity: s.opacity, transform: s.transform }
      })
    )
    await page.waitForTimeout(16)
  }
  // Expect increasing opacity and a transform converging to "none" or matrix(1, ...)
  expect(new Set(samples.map((s) => s.opacity)).size).toBeGreaterThan(1)
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveCSS("opacity", "1")

  // Active animations on an element (should return to 0 once finished)
  const running = await dialog.evaluate((el) => el.getAnimations({ subtree: true }).length)
  expect(running).toBe(0)

  // Horizontal overflow of the page
  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  )
  expect(noOverflow).toBe(true)
})

test("dialog remains functional with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/profile")
  await page.getByRole("button", { name: "Edit profile" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
})
```

### 10.4 Performance

- Animate only `transform` and `opacity`; use `will-change` only on elements that actually animate.
- Measure with a Playwright trace or DevTools Performance: no long task > 50 ms triggered by a common interaction; target INP ≤ 200 ms.
- Avoid cascading re-renders in lists (memoize items, virtualize), and avoid a `useEffect` that measures layout on every render.
- Recharts is heavy: load it on demand and limit the number of points (aggregate on the server).
- `backdrop-blur` on translucent headers and menus (`menuColor` translucent) costs GPU on older phones; test on an entry-level device when your audience requires it.

### 10.5 Test matrix (proportional to the critical flows)

Select a validation profile before testing: **local adjustment** (affected interaction, representative narrow/wide widths and changed breakpoints); **new screen/feature** (its flows, mobile/tablet/desktop, relevant states, keyboard/touch and accessibility); or **new application/shared foundation/full audit** (the broader matrix below). `RESPONSIVENESS.md`, when present, supplies the same profiles. They also apply when this guide is used alone.

Tools: the existing browser/test setup, Playwright for substantial flows and regressions, `@axe-core/playwright`, DevTools, Lighthouse (lab), and real devices when available. A small reversible edit need not introduce a new test framework. The matrix is a menu, not a Cartesian product; broaden checks only for a concrete risk or required gate.

| Dimension | Coverage menu for the selected profile |
| --- | --- |
| Browsers | Chromium, Firefox, WebKit; the Mobile Chrome and Mobile Safari profiles (`devices["Pixel 7"]`, `devices["iPhone 14"]`) with `hasTouch` |
| Widths (px) | 320, 360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1440, 1920 |
| Change points ±1 | 639/640/641, 767/768/769 (includes `Sidebar`/`useIsMobile`), 1023/1024/1025, 1279/1280/1281, and any breakpoint specific to the project |
| Heights | 568, 667, 844 in portrait; 375 and 430 in landscape; a 600 px tall desktop window |
| Orientation | Critical flows in smartphone and tablet portrait and landscape |
| States | Loading, empty, error, success, partial, offline (where applicable), no permission |
| Interactions | Click, touch (`tap()`), keyboard (Tab, Shift+Tab, Enter, Space, Escape, arrows), dragging where it exists |
| Accessibility | axe on the pages and with dialogs/menus/sheets open; manual keyboard testing; focus; contrast; 200%/400% zoom |
| Preferences | Light, dark, `reducedMotion: "reduce"`, `forcedColors: "active"` where supported |
| Visual | `toHaveScreenshot()` for representative screens and states; differences analyzed, never updated blindly |
| Console and network | No unhandled exceptions, no `console.error`, no 404s for essential resources, no 5xx |
| PWA (conditional) | Selected installation/standalone capabilities on supported platforms; active SW, offline reload and update checks only if those capabilities are used |

Classifying evidence in the report [REQUIRED]: **automated** (a Playwright/axe test that was run, with its result), **visual inspection** (a screenshot or recorded observation), **emulation** (a device profile in Playwright/DevTools), **real device** (model and OS). Anything that couldn't be validated must appear as "Could not validate X in this environment." Never invent validation.

---

## 11. Common mistakes, patterns to avoid, and completion criteria

### 11.1 Common mistakes (with the fix)

1. Using the wrong base's API (`asChild` on Base UI; a missing `items` in a Base `Select`; `type="single"` on a Base `ToggleGroup`; a string `defaultValue` in a Base `Accordion`). Fix: `info` + the base's docs.
2. `Button render={<a />}` on Base UI/Aria for links. Fix: `buttonVariants` on an `<a>`/`Link`.
3. `SelectItem`, `DropdownMenuItem`, and `CommandItem` outside their group; `TabsTrigger` outside `TabsList`.
4. `Dialog`/`Sheet`/`Drawer` without a title; `Avatar` without a fallback.
5. A form built with `div space-y-4` and a loose `Label`; an error without `data-invalid`/`aria-invalid`.
6. A raw `Input` inside an `InputGroup`; an absolutely positioned button on top of an input.
7. An icon with `mr-2 size-4` in a button; an icon imported from `lucide-react` in a `tabler` project.
8. Fixed colors (`bg-blue-500`, `text-emerald-600`) and manual `dark:`.
9. `className` overriding the component's color/typography at the point of use instead of using a variant/token/editing the file.
10. `space-y-*`; `w-4 h-4` instead of `size-4`; a manual ternary in `className` without `cn()`.
11. Manual `z-50` on overlays.
12. A missing `TooltipProvider`; a missing or duplicated `Toaster`; a missing `SidebarProvider`.
13. A toast for an error that needs to be re-read; `window.confirm` for deletion.
14. `add --overwrite` without diff review and adequate authorization; downloading a raw file from GitHub; editing `style`/`baseColor` by hand.
15. Installing a community registry item without reading the code, without fixing imports and icons.
16. Recharts without `min-h`/`aspect` on the `ChartContainer`; `hsl(var(--chart-1))` on Recharts v3; a duplicated `layout` on `Bar`.
17. A Data Table using the TanStack v8 API (`useReactTable`, `getCoreRowModel`, `flexRender`) in a v9 project.
18. `Calendar` without `locale` in a Portuguese-language product; a day shift without `timeZone`.
19. A table overflowing the page on mobile; a global `overflow-x: hidden` to hide the problem.
20. `100vh` in shells; a fixed bar without a safe area covering the last field.
21. A context menu or hover as the only path to an action.
22. A tooltip as the only name for an icon-only button.
23. Global `user-select: none`; `user-scalable=no`.
24. `useIsMobile` deciding critical markup during SSR (flash and mismatch); state lost when switching Dialog↔Drawer.
25. An animation "verified" by a final screenshot; no test with reduced motion.
26. Declaring something "responsive" after testing only 375 px; declaring Core Web Vitals based on a local Lighthouse run; declaring it a PWA based on a minimal manifest.
27. Fonts not configured (`--font-sans` with no value) after a manual installation; a missing `@import "shadcn/tailwind.css"` and `data-open:` variants having no effect.
28. A Base UI `Drawer` without `body { position: relative }` on iOS 26 Safari; `h-full` inside `DrawerContent`.
29. A Radix project expecting `toast` from `@/components/ui/toast` (that's Base UI); a Base project using `sonner` without settling on a single system.
30. `menubar`/`navigation-menu` in a React Aria project (they don't exist).

### 11.2 Antipatterns

- Rewriting an official component "from scratch" with `div`s when a variant, a token, or editing the file would have been enough.
- Two primitive libraries in the same project for convenience.
- Business components inside `components/ui/`.
- Changing `--spacing` to "compact" things.
- Heavy visual effects on work screens.
- "Fixing" a base's default behavior (manual Tabs activation, tooltips on touch) without being asked and without recording it.
- Hiding content on small screens instead of reorganizing it.
- Detecting iPhone/Android to choose the layout.

### 11.3 Completion criteria

Apply these criteria to changed behavior under the selected §10.5 profile. Exclude unrelated criteria; report blocked applicable checks as pending. Stop when the selected criteria pass and material in-scope defects are resolved:

- [ ] The project's base, style, aliases, and icons respected (verified with `info`).
- [ ] Every component used exists and is installed; imports resolve; the build and typecheck pass.
- [ ] Composition following the official trees (groups, titles, providers).
- [ ] Forms with `Field*`, validation, accessible errors, and keyboard/autocomplete attributes.
- [ ] Semantic tokens; light and dark mode visually verified.
- [ ] Loading, empty, error, and success states (and offline/permission where applicable) implemented and seen.
- [ ] Selected widths and changed breakpoints checked (B−1/B/B+1 where relevant), without accidental horizontal overflow; reflow checked for the affected screen/layout. The full matrix is used for the full-audit profile.
- [ ] Critical flows via keyboard; visible focus; accessible names; axe with no critical/serious violations; contrast checked.
- [ ] Touch, mouse, and keyboard; nothing exclusive to hover/gestures; targets ≥ 44 px where it matters.
- [ ] New or changed animations verified using §10.3, including reduced motion; unchanged effects need not be re-audited without a risk.
- [ ] Selected PWA capabilities validated. Service worker/offline checks apply only if those capabilities exist or are being added; otherwise mark them not applicable.
- [ ] A report with the areas changed, the decisions made, external dependencies added (package and purpose), registry items used, tests run and their results, the classification of the evidence, and limitations ("Could not validate X").

---

## 12. Sources, known limitations, and the procedure for updating this guide

### 12.1 Sources consulted on 2026-09-09

Official (site):

- `https://ui.shadcn.com/` and `https://ui.shadcn.com/llms.txt` (the index for LLMs; consulted)
- `https://ui.shadcn.com/docs` (introduction), `/docs/cli`, `/docs/components-json`, `/docs/theming`, `/docs/typeset`, `/docs/skills`, `/docs/directory`, `/docs/components`, `/docs/changelog` (consulted)
- `https://ui.shadcn.com/blocks`, `/charts/area` (consulted; partial listing rendered by the client)
- `https://ui.shadcn.com/create`, `/typeset` (pages rendered on the client; the content couldn't be read by the fetch tool; options described from the local source code in `apps/v4/registry/config.ts` and `docs/typeset.mdx`)
- `https://ui.shadcn.com/r/registries.json` (294 registries; the `health` field is present)
- `https://ui.shadcn.com/docs/components/base/questionnaire` (confirmation of a new component)
- `https://github.com/shadcn-ui/ui/releases` and `https://registry.npmjs.org/shadcn/latest` (version 4.21.0)

Local repository (local clone of `shadcn-ui/ui`, commit `3ba91b1`):

- `packages/shadcn/package.json` and `CHANGELOG.md` (CLI 4.21.0, history from 4.7 to 4.21)
- `apps/v4/package.json` (versions used by the site), `apps/v4/registry/{bases,styles,themes.ts,base-colors.ts,config.ts,fonts.ts,directory.json,__blocks__.json}`, `apps/v4/lib/font-definitions.ts`, `packages/shadcn/src/icons/libraries.ts`
- `apps/v4/registry/bases/base/ui/*.tsx` (real exports and imports), `_registry.ts` (dependencies), `blocks/`, `hooks/use-mobile.ts`
- `apps/v4/registry/new-york-v4/charts/_registry.ts` (70 chart items)
- `apps/v4/content/docs/**` (root pages, components for all three bases, changelog, forms, dark-mode, installation, registry, rtl, utils)
- `skills/shadcn/**` (SKILL.md, cli.md, customization.md, registry.md, mcp.md, rules/*.md) and `skills/migrate-radix-to-base/**`
- `templates/next-app`, `templates/vite-app`

Dependencies:

- Base UI: `https://base-ui.com/react/overview/quick-start` (version 1.8.0; `isolation: isolate`; `body { position: relative }` for iOS 26)
- npm `latest` for `@base-ui/react` (1.8.0), `radix-ui` (1.6.7), `react-aria-components` (1.21.1), `tailwindcss` (4.3.3), `cn` (0.2.6), `recharts` (3.10.1)

Local structural references (not carried over as rules): `documentacao/daisyui/llms.txt`, `documentacao/prompts/agents_md/fomantic_ui_llms.md`. Incorporated document: `documentacao/WEB_APP_EXTREMAMENTE_RESPONSIVO_APP_LIKE_ACESSIVEL_E_PWA_MODERNO.md`.

### 12.2 Discrepancies and unconfirmed items

- **Base UI 1.6.0 vs. 1.8.0**: the site and the registry's components were tested with `@base-ui/react` 1.6.0, but the registry installs the latest version (1.8.0 today). No incompatibility was verified in this guide; when installing, run the components and check the Base UI changelog if anything differs.
- **`recharts@3.8.0` is pinned** in the `chart` item while npm already has 3.10.1. Don't update it manually without testing the charts.
- **The `Select` placeholder on Base UI**: the documentation uses `<SelectValue placeholder>`; the skill uses an item `{ value: null }`. Both are official; this guide recommends the documentation's approach plus validation in the browser.
- **Blocks for React Aria**: the directory exists in the repository; the public documentation mentions Radix and Base UI. Confirm with `search @shadcn -t block` in an Aria project.
- **The registry's `form` item**: it exists with no file (for compatibility); the current documentation uses `Field`.
- **The documentation's `react-19` page** is flagged by the documentation itself as possibly out of date.
- **Directory**: 294 registries as of 2026-09-09; the number changes weekly. The list of names in §7.5 was partially observed (the first ~150 in the index) and is not exhaustive.
- **No command or example in this guide was executed** while the document was being produced. Commands and examples were checked against the documentation and the source code at the indicated version; treat them as reviewed, not as tested.
- This guide doesn't cover Tailwind v3 in detail (docs at `https://v3.shadcn.com`), nor the Astro, TanStack Start, React Router, and Laravel templates beyond what the CLI documents.

### 12.3 Procedure for updating this guide

1. Record the date and get the updated repository (`git -C <local-shadcn-ui-clone> pull` or a fresh clone) and the commit (`git log -1 --format='%H %ci'`).
2. Compare versions: `packages/shadcn/package.json`, `apps/v4/package.json`, `npm view shadcn version`, `npm view @base-ui/react version`, `npm view radix-ui version`, `npm view react-aria-components version`.
3. Read the new entries in `apps/v4/content/docs/changelog/` and `packages/shadcn/CHANGELOG.md`; update §2, §3, §4, and the identification sheet.
4. Recompute the catalog: `ls apps/v4/content/docs/components/base`, `diff` it against `radix` and `aria`; extract the exports with `awk '/^export \{/,/\}/' apps/v4/registry/bases/base/ui/*.tsx` and the dependencies from `_registry.ts`; update §6.
5. Recompute the blocks (`apps/v4/registry/__blocks__.json`), charts (`apps/v4/registry/new-york-v4/charts/_registry.ts`), styles (`apps/v4/registry/styles/`), themes, fonts, and icons (`config.ts`, `themes.ts`, `font-definitions.ts`, `packages/shadcn/src/icons/libraries.ts`).
6. Re-read `skills/shadcn/SKILL.md` and `rules/*.md`; any new or changed rule goes into §1.2 with the (skill) marker.
7. Check the registry index (`curl -s https://ui.shadcn.com/r/registries.json | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"`).
8. Review §12.2: remove resolved discrepancies, add new ones.
9. Re-read the document looking for contradictions, APIs incompatible across bases, incomplete examples, and absolute rules that hurt the experience.

### 12.4 Revision 1.1 — 2026-09-13

This revision aligns standalone usage, companion ownership, conditional PWA capabilities and validation profiles. Version tables in this guide retain their dated original research context; they are not a universal upgrade policy or a claim that all CLI commands were re-run in this revision. Read installed component source and current [shadcn documentation/changelog](https://ui.shadcn.com/docs/changelog) before applying an API-specific recipe. No frontend build/browser run was executed during this document review. Report actual verification in one delivery report; active project learning status goes last.
