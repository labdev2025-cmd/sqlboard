# Responsive, Accessible Web Applications — Conditional PWA Guide

## Applicability and interoperability — revision 1.1 (2026-09-13)

This guide is independently usable. Companion guides are optional references: apply only the ones actually present and relevant to the task. A missing companion never requires installing the whole set, inventing its contents, or stopping work covered by this guide. Paths and project names in examples are templates, not facts about the current repository.

Honor the agent runtime's permissions and higher-priority instructions. Within project guidance, follow the explicit task, then applicable repository instructions and established conventions, then documentation for the installed version, then this guide's defaults. Existing insecure behavior is not a convention to preserve: fix it when in scope and report other findings. New-project defaults never authorize a dependency upgrade, migration, or restructuring of an existing project.

When guides are combined, topic ownership is: `COMMITS.md` for commit messages and Git actions; `CONTEXT.md` for `AGENTS.md`, `CLAUDE.md`, and project learning; `STRUCTURE.md` for file placement and build wiring; `JAVA.md` for backend implementation; `UI.md` for shadcn composition and APIs; `RESPONSIVENESS.md` for shared responsive/accessibility/PWA criteria. Product requirements decide whether PWA/offline is needed. Each guide retains the essentials needed when its companions are absent.

Mandatory rules apply within the requested scope. Validate changed behavior and concrete risks; use a full application audit only for a new application, a cross-cutting change, or an explicitly requested audit. Stop when the applicable acceptance criteria pass, or report a concrete environment blocker and the pending checks. Never claim an unexecuted check passed.

Deliver one report: outcome, relevant verification, and material limitations. Include a tree only for structural work and a suggested commit message when useful or requested; neither must be the last line. If the project learning workflow is active, put its short `LEARNING:` status last. Writing a suggested message never authorizes a commit or push.

---

**Version:** 1.1 — reviewed 2026-09-13

## Validation scope — choose before implementation

This guide can be used alone. Determine the requested change, the affected flows, supported browsers, and whether PWA capabilities are already present or explicitly selected for this product. Preserve working behavior outside the change. A request for a review produces findings; implementation rules apply when implementation is requested.

| Task profile | Required verification within the changed surface |
| --- | --- |
| Local fix or component adjustment | Reproduce the issue; check the affected interaction, a narrow and a wide representative width, relevant keyboard/focus behavior, and any changed breakpoint at B−1/B/B+1. Reuse existing tests; add a regression test for a meaningful recurring risk. |
| New screen or feature | Check its main flows and relevant loading/empty/error/permission states at mobile, tablet and desktop widths. Exercise changed navigation/dialogs/forms, keyboard/touch, accessibility and affected supported engines. |
| New application, shared responsive foundation, or explicit full audit | Use the broader matrix in §§60–74 on representative critical flows, with supported browsers, orientations, preferences and real devices when available. |

The width/browser/state lists are a selection menu, not a mandatory Cartesian product for every edit. Expand coverage only for a concrete remaining risk or a required project gate. Record any essential check blocked by the environment without treating it as passed; do not keep iterating indefinitely.

**PWA is conditional.** Sections 32–50, 69–70, 73–75 and 82–84, the PWA audit/implementation phase and PWA acceptance criteria apply only to capabilities the product needs or already has. Do not add installation, a manifest, service worker, push or offline writes merely because this guide is present. Select each capability separately: installation does not imply offline mutations or a service worker. An ordinary website still needs responsive interaction and clear handling of network failures. Mark unrelated PWA checks `not applicable` with the product reason.

Stop when the selected acceptance criteria pass, or deliver the implemented result with specific pending environment checks and their impact. Report outcome, relevant evidence and material limitations once; if the learning workflow is active, its short `LEARNING:` status comes last.

---

This guide complements the functional and product requirements described in the task.

Your responsibility is not just to make the application “work on a phone.” Your mission is to build or transform this project into an extremely high-quality web application: extremely responsive, adaptive, accessible, performant, and with an experience close to that of a modern app, while also maintaining an excellent experience on desktop.

The application must work very well as a conventional website and, if installation is a selected product capability, must provide a coherent standalone experience within the current limitations and standards of the Web.

Consider Android, iPhone/iOS, iPad/iPadOS, laptops, desktops, small screens, large screens, portrait/landscape orientation, resized windows, split-screen, and different input methods: touch, mouse, trackpad, and keyboard.

---

# 1. GENERAL PRINCIPLE

Do not interpret “responsive” as merely:

- adding a few `@media` rules;
- shrinking fonts;
- hiding components;
- stacking columns;
- testing at 375px and calling it done.

Responsiveness must be part of the interface architecture.

The application needs to adapt naturally to the available space, to the component's context, to the input method, to the user's preferences, and to the mode it's running in.

The goal is:

**a single web application that delivers an excellent experience on mobile, tablet, desktop, and installed PWA, without looking like a desktop site simply squeezed into a phone.**

---

# 2. MODE OF OPERATION

First determine whether you're dealing with:

### A. An existing project

Before changing anything:

1. analyze the project structure;
2. identify the framework, UI library, CSS, design system, routing, state management, and infrastructure;
3. identify the existing package manager;
4. identify shared components, layouts, and pages;
5. locate existing breakpoints, media queries, and responsive styles;
6. locate the manifest, service worker, PWA settings, and assets, if any exist;
7. locate the existing tests;
8. run the project;
9. explore the main flows visually;
10. identify problems before you start modifying them.

Preserve the existing architecture, visual identity, business rules, and patterns whenever they're good.

DO NOT arbitrarily rewrite the project, DO NOT swap frameworks, and DO NOT introduce a new UI library just because you prefer a different technology.

Refactor what needs refactoring, but minimize changes that provide no real benefit.

### B. A new project

If the project is still being created:

build all of these requirements into the architecture from the start, rather than creating a desktop version first and then “adapting it to mobile.”

Use the stack requested in the main prompt.

---

# 3. AUTONOMY AND RESPONSIBILITY

For an implementation task, apply and validate the requested improvements. For an audit/review task, deliver evidence-based findings without making unrequested changes.

You must:

- analyze;
- implement;
- run;
- view;
- test;
- identify problems;
- fix;
- run again;
- repeat while a selected acceptance criterion fails for a concrete, in-scope reason; stop when the criteria pass.

Whenever you have access to an automated browser, Playwright, browser tools, DevTools, screenshots, or equivalent tooling, USE THEM.

Don't assume a change is correct just because the code “looks right.”

See the application running.

Test the application running.

Interact with it.

Resize.

Click.

Tap.

Navigate by keyboard.

Test empty states.

Test loading.

Test errors.

Test offline where applicable.

Test mobile.

Test desktop.

Fix based on actual behavior.

---

# 4. MODERN RESPONSIVE STRATEGY

Adopt a modern responsive architecture.

## Mobile-first

The compact experience must be a complete, first-class experience.

Start with the essential styles that work in tight spaces and add complexity as the available space grows.

That said, “mobile-first” does not mean sacrificing desktop.

Desktop also needs to make proper use of the extra space.

---

# 5. BREAKPOINTS SHOULD BE CONTENT-BASED

Avoid structuring the entire project around fixed breakpoints like:

`mobile / tablet / desktop`.

Don't design for specific device models.

Breakpoints should mainly emerge where the content or the layout starts to break.

Use the minimum number of global breakpoints necessary.

Whenever possible:

- let Grid and Flexbox work out the layout naturally;
- use intrinsic layouts;
- use `minmax()`;
- use `auto-fit`;
- use `auto-fill`;
- use `min()`;
- use `max()`;
- use `clamp()`.

Don't create dozens of media queries to patch the symptoms of a rigid structure.

---

# 6. CONTAINER QUERIES

Use CSS Container Queries when the adaptation depends on the space available to a component rather than on the entire viewport.

This is especially important for:

- cards;
- widgets;
- dashboards;
- forms;
- panels;
- lists;
- tables;
- reusable components;
- sidebars;
- grids;
- components that can appear in different parts of the application.

Prefer:

`@container`

when the component should respond to the size of its own container.

Use `@media` when the change genuinely depends on the viewport or on the device's global capabilities/preferences.

Don't blindly replace media queries with container queries.

Use each tool to express the design intent correctly.

---

# 7. FLUID SIZING AND SPACING

Avoid interfaces built with an excess of fixed pixel dimensions.

Prefer:

- `rem`;
- `%`;
- `fr`;
- `minmax()`;
- `clamp()`;
- `min()`;
- `max()`;
- `ch`;
- container query units where appropriate.

Use fluid scales for:

- typography;
- padding;
- gaps;
- margins;
- max width;
- component dimensions.

Conceptual example:

`clamp(minimum, fluid-value, maximum)`

Don't let typography get too small on mobile or absurdly large on big monitors.

---

# 8. MODERN MOBILE VIEWPORT

Don't blindly rely on `100vh` for full-height interfaces on mobile devices.

Consider modern units:

- `dvh`;
- `svh`;
- `lvh`.

Choose the unit according to the behavior you need.

For shells that should track the area that's actually visible as the browser UI changes, `dvh` is usually more appropriate than the old `vh`.

Always provide a fallback when needed for the browsers the project supports.

---

# 9. SAFE AREAS, NOTCHES, AND EDGE-TO-EDGE

The interface needs to work correctly on devices with:

- a notch;
- a Dynamic Island;
- rounded corners;
- a Home Indicator;
- different system-reserved areas.

When you use an edge-to-edge/full-bleed experience, configure the viewport correctly and respect:

- `env(safe-area-inset-top)`;
- `env(safe-area-inset-right)`;
- `env(safe-area-inset-bottom)`;
- `env(safe-area-inset-left)`.

Use patterns like:

`max(padding-normal, env(safe-area-inset-bottom))`

where appropriate.

This is especially important for:

- bottom navigation;
- fixed headers;
- toolbars;
- FABs;
- dialogs;
- bottom sheets;
- sticky elements;
- tappable areas near the edges.

Never let a button end up behind the Home Indicator, the notch, or system controls.

---

# 10. VIEWPORT META

Use a proper viewport configuration.

DO NOT disable user zoom.

Don't use techniques like:

`user-scalable=no`

or equivalent restrictions without an exceptional accessibility justification.

Pinch-to-zoom must remain available.

---

# 11. COMPONENT RESPONSIVENESS

Review component by component.

Don't just audit complete pages.

For each important component, validate:

- the smallest acceptable width;
- the largest width;
- short text;
- long text;
- long names;
- large values;
- empty content;
- extreme content;
- loading;
- error;
- touch;
- mouse;
- keyboard.

Avoid components that depend on the specific dimensions of the page where they were originally created.

---

# 12. OVERFLOW

The application must not have accidental horizontal scrolling.

At any supported viewport:

`document.documentElement.scrollWidth`

must not significantly exceed:

`window.innerWidth`

except in elements where horizontal scrolling is intentional and necessary, such as certain tables, timelines, charts, or carousels.

Investigate the actual cause of the overflow.

DO NOT hide bugs globally by using:

`overflow-x: hidden`

as an automatic fix.

---

# 13. EXTREME CONTENT

Explicitly test:

- longer translations;
- large labels;
- long emails;
- long URLs;
- large numbers;
- long titles;
- empty lists;
- huge lists;
- cards with varying amounts of content.

Use the following correctly:

- `min-width: 0`;
- wrapping;
- `overflow-wrap`;
- truncation only where appropriate;
- line clamp only if no important information is lost.

---

# 14. APP-LIKE EXPERIENCE

The mobile interface should feel intentionally designed for an app.

Avoid carrying the following over to mobile verbatim:

- giant desktop headers;
- crowded horizontal menus;
- permanently open sidebars;
- tables that are impossible to use;
- tiny dropdowns;
- important actions placed out of reach;
- large wasted areas;
- typical marketing footers inside the app's functional area.

The interface should prioritize the task and the content.

---

# 15. ADAPTIVE NAVIGATION

Analyze the application's information architecture.

Where it makes sense, use adaptive patterns.

In compact space, consider:

- bottom navigation for a small number of primary destinations;
- a compact header;
- menus;
- sheets;
- drawers.

In medium or large spaces, consider:

- a navigation rail;
- a sidebar;
- top navigation;
- master-detail layouts;
- side-by-side panels.

Don't insist on keeping the exact same navigation at every width.

The conceptual structure should stay consistent, but its presentation can adapt.

A bottom navigation that works great on a phone doesn't need to sit at the bottom of a 27-inch monitor.

Likewise, a large desktop sidebar shouldn't steal half of a phone screen.

---

# 16. ROUTES AND DEEP LINKS

Every important view should have a meaningful URL whenever the architecture allows it.

Deep links must work.

Reloading directly on a route must not break the application.

Opening a URL directly should correctly rebuild the state that's needed.

In standalone PWA mode, the user won't necessarily have the browser's usual navigation controls visible.

Make sure that:

- back works;
- internal navigation works;
- screens don't become dead ends;
- external links are handled appropriately.

---

# 17. TOUCH, MOUSE, TRACKPAD, AND KEYBOARD

Don't assume that:

mobile = touch

desktop = mouse.

Hybrid devices exist.

Every essential flow must work regardless of the input method.

Don't rely on hover alone.

Hover can enrich an experience, but it can't be a requirement for discovering or performing essential functionality.

Where appropriate, use media features such as:

- `hover`;
- `any-hover`;
- `pointer`;
- `any-pointer`.

Apply hover effects mainly when there's a hover-capable pointer.

---

# 18. INTERACTIVE TARGET SIZE

Ensure comfortable touch areas.

For important, frequently used controls, aim for interactive areas of at least roughly:

**44 × 44 CSS px**

whenever the layout allows.

Never create a row of tiny icons crammed against each other.

The user should be able to tap without surgical precision.

The visible clickable state can be smaller than the hit area if necessary.

---

# 19. MOBILE FORMS

Optimize forms for real.

Use the following properly:

- `type`;
- `inputmode`;
- `autocomplete`;
- `enterkeyhint`;
- real labels;
- contextual error messages.

Make the right virtual keyboard appear for:

- email;
- phone;
- numbers;
- URLs;
- codes.

Make sure that:

- opening the keyboard doesn't hide the field;
- fixed buttons don't cover inputs;
- error messages are visible;
- focus moves correctly;
- the user doesn't lose data by rotating the screen or accidentally changing routes.

Don't use placeholders as substitutes for labels.

---

# 20. VIRTUAL KEYBOARD

Test forms on mobile viewports with reduced heights.

Account for the space the virtual keyboard takes up.

Focused fields, autocomplete, the primary CTA, and validation messages must not end up unreachable behind fixed elements.

Use `scroll-padding`, adaptive layout, or other suitable techniques where needed.

---

# 21. MODALS, DIALOGS, AND SHEETS

Modals must work on small screens.

Avoid a fixed-width desktop dialog that simply gets clipped by the viewport.

Depending on the context, on mobile consider:

- a near-fullscreen dialog;
- a fullscreen dialog;
- a bottom sheet.

Ensure:

- correct initial focus;
- a focus trap where needed;
- Escape where applicable;
- focus returning on close;
- a non-interactive background;
- correct scrolling;
- an accessible title;
- buttons that are always reachable.

---

# 22. GESTURES

Gestures can be used as an enhancement, never as the only way to perform an important function.

If there's a swipe, drag, or special gesture, also provide a conventional alternative.

Don't interfere unnecessarily with the browser's native scrolling.

Don't implement gesture hijacking without a reason.

---

# 23. TEXT SELECTION

Don't use `user-select: none` globally.

It can be reasonable to prevent accidental selection on some app-like controls, but text content should remain selectable whenever that makes sense.

---

# 24. ANIMATIONS

Animations should:

- communicate a change of state;
- preserve context;
- improve the perception of smoothness.

Don't add animation as excessive decoration.

Prioritize animations the compositor can run efficiently, such as `transform` and `opacity`.

Respect:

`prefers-reduced-motion`.

The application must remain fully usable with reduced motion.

---

# 25. THEMES AND SYSTEM PREFERENCES

Where the product allows it, properly support:

- light mode;
- dark mode;
- `prefers-color-scheme`;
- `prefers-reduced-motion`;
- forced colors/high contrast;
- relevant platform preferences.

Avoid flashes of the wrong theme during loading.

Also set `color-scheme` correctly where applicable.

---

# 26. RESPONSIVE IMAGES

Don't needlessly ship huge desktop images to phones.

Use, where appropriate:

- `srcset`;
- `sizes`;
- `<picture>`;
- efficient formats supported by the pipeline;
- images at appropriate dimensions;
- lazy loading for content outside the initial viewport.

Whenever possible, declare intrinsic `width` and `height` or an appropriate `aspect-ratio` to reserve space and prevent layout shift.

DO NOT apply lazy loading to the main LCP image when doing so hurts its discovery/loading.

Use loading priority deliberately when there's an important LCP resource.

---

# 27. TABLES AND COMPLEX DATA

Don't automatically turn every table into cards if that destroys the relationship between columns.

Choose the strategy based on the type of information.

Possibilities:

- deliberate horizontal scrolling;
- priority columns;
- expandable details;
- adaptive layout;
- a compact version;
- transformation into cards when semantically appropriate.

If there's intentional horizontal scrolling, make it visually clear that there's more content.

---

# 28. DASHBOARDS

Dashboards must be adaptive.

On mobile:

- prioritize the primary information;
- stack or rearrange widgets;
- reduce density where necessary;
- keep essential actions accessible.

On desktop:

- take advantage of the extra space;
- allow multiple pieces of information at once;
- avoid simply leaving giant cards taking up 100% of the width.

Use container queries for reusable widgets where appropriate.

---

# 29. LARGE LISTS

If there are hundreds or thousands of records:

- consider pagination;
- infinite loading where appropriate;
- virtualization;
- incremental rendering.

Don't render thousands of interface elements unnecessarily.

---

# 30. APPLICATION STATES

Every important area must account for:

- loading;
- empty;
- success;
- error;
- partial error;
- offline;
- reconnecting;
- permission denied;
- unauthorized;
- stale data where applicable.

Avoid endless spinners with no context.

Use skeletons where they improve the experience, but preserve dimensions so they don't cause layout shifts.

---

# 31. INTERACTION FEEDBACK

Every action needs to communicate its outcome.

Include, as appropriate:

- pressed states;
- loading;
- disabled;
- success;
- errors;
- optimistic UI only when it's safe;
- rollback where necessary.

Prevent double-submit.

Don't leave the user wondering whether their tap registered.

---

# 32. MODERN PWA — CONDITIONAL

Apply this module when installation/offline/push capabilities are justified by the product and selected for the task. Technical feasibility alone does not authorize adding them. Preserve an existing PWA when making unrelated changes.

Don't just add a minimal manifest so you can call the project a PWA.

Build a high-quality installed experience.

---

# 33. WEB APP MANIFEST

Create or review a complete manifest.

Analyze and configure the following properly:

- `id`;
- `name`;
- `short_name`;
- `description`;
- `start_url`;
- `scope`;
- `display`;
- `display_override` where useful;
- `background_color`;
- `theme_color`;
- `icons`;
- `screenshots`;
- `shortcuts` where it makes sense;
- `categories` where it makes sense;
- `orientation` only if truly necessary.

Prefer `display: standalone` for a conventional installed application.

Don't lock orientation without a real need.

---

# 34. STABLE PWA IDENTITY

Explicitly define a stable `id` in the manifest so that future changes to `start_url` or to the manifest's location don't inadvertently change the application's perceived identity.

---

# 35. PWA ICONS

Provide appropriate assets for multiple platforms.

At a minimum, where applicable to the target platform:

- 192×192;
- 512×512;
- maskable versions;
- an appropriate Apple icon;
- an appropriate favicon.

For maximum quality, also consider a high-resolution asset for desktop contexts that can take advantage of it.

The main content of the maskable icon must stay inside the safe zone.

Don't blindly reuse a horizontal logo as a square icon.

If assets are generated automatically, validate the visual result.

---

# 36. APPLE TOUCH ICON

Provide an appropriate `apple-touch-icon` when it's needed for good integration with iOS/iPadOS.

If manifest icons and Apple-specific icons coexist, understand which one takes precedence and configure it deliberately.

---

# 37. MANIFEST SCREENSHOTS

Where supported and appropriate, add real screenshots to the manifest to improve the install experience.

Provide coherent screenshots for the relevant form factors, for example mobile and desktop.

The screenshots need to reflect the real application.

Don't use generic or misleading images.

---

# 38. THEME COLOR AND SPLASH

Set `theme_color` and `background_color` so they're coherent with the interface.

Avoid a harsh white screen during startup for an application with a dark theme.

Where support is adequate, consider `theme-color` variants for dark/light.

---

# 39. SERVICE WORKER

For this high-quality application, implement a service worker when it brings real benefits in:

- offline;
- resilience;
- caching;
- performance;
- push;
- background capabilities.

Prefer a mature solution that's compatible with the existing stack.

If the framework has official or well-established PWA integration, evaluate that first.

Workbox or an equivalent maintained solution can be used where appropriate.

Don't introduce a heavy dependency if a simple, properly tested service worker solves the problem better.

---

# 40. CACHING IS NOT “CACHE EVERYTHING”

Design strategies per resource type.

Consider these separately:

- the application shell;
- versioned JS/CSS;
- images;
- fonts;
- HTML/navigations;
- APIs;
- authenticated data;
- private data;
- third-party resources.

Deliberately use strategies such as:

- Cache First;
- Network First;
- Stale While Revalidate;
- Network Only;
- Cache Only.

Choose based on the semantics of the data.

Don't use a single strategy for everything.

---

# 41. PRECACHE

Precache only the resources that genuinely matter for starting the experience.

Avoid unnecessary precaching of:

- large libraries that aren't used initially;
- all responsive images;
- hundreds of pages;
- rarely visited resources;
- huge assets.

The PWA must not make the first load worse by trying to download the entire application.

---

# 42. CACHE INVALIDATION

Ensure assets update correctly.

Prefer versioned/content-hashed files.

Manage:

- cache names;
- revisions;
- expiration;
- cleanup of old caches;
- storage quotas.

Never leave users stuck indefinitely on old versions.

---

# 43. SERVICE WORKER UPDATES

Design a safe UX for new versions.

When a new version is available, if updating immediately could interrupt the user's state or work, show a discreet indication such as:

“A new version is available.”

Allow the update to happen at a safe moment.

Avoid using `skipWaiting()` indiscriminately if it could mix assets or code from different versions in an already-open session.

Test the real update process between two versions.

---

# 44. OFFLINE

Implement an intentional offline experience.

The user should never simply get:

- a generic browser error page;
- the offline dinosaur;
- a completely broken screen.

Depending on the application, offer:

- the app shell;
- previously viewed data;
- an offline fallback;
- a “No connection” state;
- retry;
- an indication that data is out of date.

Don't promise offline functionality that necessarily depends on the server.

---

# 45. OFFLINE ACTIONS

If the application's domain allows editing/creating data offline, explicitly design:

- local persistence;
- a sync queue;
- identification of pending operations;
- retry;
- conflict resolution;
- duplicate prevention.

Use Background Sync only where it's supported and appropriate, with a fallback.

Don't put financial, destructive, or non-idempotent operations into an automatic queue without careful analysis.

---

# 46. INSTALLATION

When the platform offers an appropriate API for promoting installation, use feature detection.

On Chromium, a custom experience based on `beforeinstallprompt` can be used where available.

However:

- don't show an aggressive popup the moment someone arrives;
- don't block content;
- don't ask for installation before the user has understood the application's value;
- don't rely on that API as universal.

On iOS/iPadOS, provide contextual guidance for “Add to Home Screen” when it genuinely makes sense, and only when the application isn't already installed.

Don't show Android instructions to an iOS user or vice versa.

---

# 47. INSTALLED MODE

Detect the `display-mode` when there's a reason to change behavior or presentation.

Consider:

`@media (display-mode: standalone)`

and supported equivalents.

The standalone experience may need:

- more explicit internal navigation;
- a back button;
- a different header;
- removal of the “Install” CTA;
- additional safe areas;
- its own window behavior.

Don't rely on user agent detection alone.

Prefer feature detection and real state.

---

# 48. DESKTOP PWA

The installed experience on desktop must also be excellent.

Don't treat PWA as a mobile-only feature.

Test:

- a small window;
- a medium window;
- maximized;
- ultrawide screens;
- multiple aspect ratios.

When the application genuinely benefits and support exists, evaluate advanced features such as Window Controls Overlay via `display_override`, but only as progressive enhancement.

The application must remain great without that feature.

---

# 49. ADVANCED CAPABILITIES

Evaluate, but DO NOT implement without a product need:

- Web Push;
- the Badging API;
- Share Target;
- Web Share;
- shortcuts;
- file handling;
- protocol handlers;
- clipboard;
- wake lock;
- screen orientation;
- other Web APIs.

For each capability:

1. confirm that it solves a real problem;
2. use feature detection;
3. implement a fallback;
4. request permission in the right context;
5. keep things working on platforms without support.

Don't turn the project into an API demo.

---

# 50. NOTIFICATIONS

If the product uses notifications:

- request permission only after an explicit, contextual user action;
- explain why the notification is useful;
- don't request permission during the initial load;
- handle permission denied;
- don't ask repeatedly.

For iOS/iPadOS, take into account the specific Web Push restrictions for web apps installed on the Home Screen.

Test on compatible devices/platforms whenever possible.

---

# 51. ACCESSIBILITY

Treat accessibility as part of interface engineering, not as an optional audit at the end.

Minimum target:

**WCAG 2.2 level AA**, where applicable.

Review:

- semantic HTML;
- landmarks;
- headings;
- labels;
- contrast;
- focus;
- DOM order;
- tab order;
- keyboard;
- skip links where needed;
- error states;
- dynamic messages;
- ARIA;
- touch targets;
- reflow;
- zoom;
- motion;
- high contrast;
- screen readers.

Use ARIA only when semantic HTML isn't enough.

---

# 52. REFLOW

The application must remain functional and understandable at a width of roughly 320 CSS px.

There must be no loss of information or functionality just because the content got narrow.

Two-dimensional scrolling should only exist when the nature of the information truly requires it, such as certain tables, maps, or diagrams.

---

# 53. FOCUS

Every interactive element that can be operated by keyboard needs a clearly visible focus state.

Sticky headers, banners, dialogs, and bottom navigation MUST NOT hide the focused element.

Test the application using only:

- Tab;
- Shift+Tab;
- Enter;
- Space;
- Escape;
- arrow keys where semantically appropriate.

Don't create keyboard traps.

---

# 54. ACCESSIBILITY AUTOMATION

If Playwright is available, integrate `@axe-core/playwright` or an equivalent mature alternative.

Run scans on:

- main pages;
- open dialogs;
- menus;
- forms;
- important interactive states.

Automation doesn't replace manual evaluation.

In addition to axe, manually check:

- keyboard navigation;
- focus;
- logical order;
- zoom;
- touch;
- visual meaning;
- use without hover.

---

# 55. PERFORMANCE

Performance is part of the mobile UX.

Don't accept an application that's visually responsive but slow and heavy.

Optimize:

- JavaScript;
- hydration where applicable;
- code splitting;
- route splitting;
- lazy loading;
- images;
- fonts;
- CSS;
- API waterfalls;
- long tasks;
- re-renders;
- third-party scripts.

Avoid downloading code the initial screen doesn't use.

---

# 56. CORE WEB VITALS

Use these as quality targets in field data:

- LCP ≤ 2.5 s;
- INP ≤ 200 ms;
- CLS ≤ 0.1;

at the 75th percentile, segmented by mobile and desktop.

Clearly distinguish lab metrics from real field metrics.

Don't claim Core Web Vitals “passed in production” just because a local Lighthouse run passed.

Where the infrastructure allows, consider Real User Monitoring instrumentation.

---

# 57. LAYOUT SHIFT

Avoid CLS caused by:

- images without dimensions;
- banners that appear and push content;
- fonts;
- skeletons with the wrong dimensions;
- asynchronous content;
- ads;
- toolbars that arrive late.

Reserve predictable space for asynchronous content.

---

# 58. INTERACTION RESPONSIVENESS

Avoid long tasks that make the interface “freeze” after a tap.

Break up heavy work.

Avoid running unnecessary expensive processing on the main thread.

Where appropriate, use:

- Web Workers;
- chunking;
- scheduling;
- memoization;
- virtualization.

But only where there's a measurable benefit.

---

# 59. BROWSER VALIDATION AND PLAYWRIGHT

If Playwright is already in the project, take advantage of the existing infrastructure.

For new applications or substantial new interactive flows, add Playwright when appropriate to the selected stack. A minor reversible edit need not introduce a test framework; use the available browser and existing project checks. If a required browser check cannot run, state the limitation.

Create permanent tests for meaningful behavior and regression risks. Avoid tests that merely repeat CSS classes or implementation details.

Don't write tests just to satisfy this prompt and then delete them.

---

# 60. BROWSER MATRIX

For the full-audit profile, select the supported engines and relevant emulated device profiles from:

- Chromium;
- Firefox;
- WebKit;
- Mobile Chrome;
- Mobile Safari.

Where necessary and available, also include branded browsers such as Chrome/Edge.

Don't assume a Chromium test represents Safari.

---

# 61. VIEWPORT MATRIX

Select representative dimensions for the task profile above; the list below is a coverage menu. Do not run every width against every browser/state without a concrete reason.

Include, as appropriate for the project, widths near:

- 320;
- 360;
- 375;
- 390;
- 412;
- 430;
- 768;
- 820;
- 1024;
- 1280;
- 1440;
- 1920 CSS px.

Include different heights as well.

Don't test only popular phone presets.

Test in-between sizes.

---

# 62. TESTING AROUND BREAKPOINTS

For each relevant breakpoint `B`, test at least:

- `B - 1`;
- `B`;
- `B + 1`.

Example:

if there's a 768px breakpoint, validate 767, 768, and 769.

This helps catch:

- elements disappearing;
- two navigations showing at once;
- broken layout;
- overflow;
- wrong gaps.

---

# 63. ORIENTATION

Test at least the critical flows on:

- smartphone portrait;
- smartphone landscape;
- tablet portrait;
- tablet landscape;
- desktop.

Don't assume that “mobile landscape = desktop.”

---

# 64. AUTOMATED OVERFLOW TESTING

Create assertions to detect accidental horizontal overflow.

Evaluate something equivalent to:

`scrollWidth <= clientWidth + tolerance`

on the main pages.

Ignore or handle separately any regions where horizontal overflow is deliberate.

If the test fails, fix the cause.

---

# 65. VISUAL REGRESSION

Use Playwright screenshots for representative states and screens.

Use `toHaveScreenshot()` or an equivalent mechanism.

Keep the capture environment consistent.

Version snapshots where it makes sense.

Review differences visually.

Don't blindly update snapshots just to make a test pass.

If a difference shows up, first determine whether it's:

- an expected improvement;
- an innocuous change;
- a regression.

---

# 66. TEST THE UX, NOT JUST THE DOM

Tests should reproduce real flows.

Prefer accessible locators such as:

- `getByRole`;
- `getByLabel`;
- `getByText` where appropriate.

Test:

- login;
- menus;
- navigation;
- creating;
- editing;
- deleting;
- forms;
- dialogs;
- filters;
- searches;
- pagination;
- primary actions.

Prioritize the product's critical flows.

---

# 67. TOUCH TESTING

Use projects with touch enabled for the mobile flows.

Make sure essential controls work by touch.

Don't rely on mouse hover to unlock functionality.

---

# 68. PREFERENCE TESTING

When the application supports these modes, test:

- light;
- dark;
- reduced motion;
- high contrast/forced colors where technically possible.

---

# 69. OFFLINE TESTING

For the PWA, test the following in an automated way where possible:

1. initial online load;
2. the service worker controlling the application;
3. essential resources stored;
4. switching to offline;
5. reload;
6. opening a relevant route;
7. a usable offline experience;
8. returning online.

Don't treat “service worker registered” as equivalent to “offline works.”

---

# 70. SERVICE WORKER UPDATE TEST

Where possible, simulate a version change.

Make sure that:

- the new SW is detected;
- caches are updated;
- old caches are removed;
- assets don't end up inconsistent;
- the user doesn't get stuck on an old version;
- the update doesn't destroy unsaved work.

---

# 71. CONSOLE AND NETWORK ERRORS

During automated tests, monitor:

- uncaught exceptions;
- `console.error`;
- 404s on essential resources;
- 5xx requests;
- rejected promises.

Don't silently ignore errors that indicate real regressions.

---

# 72. TESTING ON REAL DEVICES

Emulation is extremely useful, but it doesn't perfectly reproduce every behavior of a physical device.

When you have access to:

- real devices;
- a device farm;
- BrowserStack;
- Sauce Labs;
- equivalent tools;

validate at least the critical flows on the relevant real devices, especially Safari/iOS and Chrome/Android.

If the agent's environment doesn't allow that, don't make up that the testing was done.

Clearly record what was validated through emulation and what still requires a real device.

---

# 73. PWA ON IOS

Validate specifically:

- Add to Home Screen;
- icon;
- name;
- standalone;
- safe areas;
- rotation;
- keyboard;
- deep links;
- opening externally;
- updating;
- offline;
- scrolling;
- status bar/theme;
- persistence;
- push, if used.

Don't assume Chromium behavior will be the same as WebKit/iOS.

---

# 74. PWA ON ANDROID

Validate:

- installability;
- manifest;
- maskable icon;
- standalone;
- splash;
- offline;
- updating;
- navigation;
- back behavior;
- keyboard;
- orientation;
- push, if used.

---

# 75. PWA ON DESKTOP

Validate installation and the standalone experience on supported browsers/platforms.

Test aggressive resizing of the installed window.

A desktop PWA must remain responsive even when the user turns a large window into a narrow one.

---

# 76. LIGHTHOUSE

Use Lighthouse to help evaluate:

- Performance;
- Accessibility;
- Best Practices;
- SEO where relevant.

DO NOT use an old “PWA Lighthouse score” as the definition of a modern PWA.

Lighthouse's old PWA audits have been deprecated.

Validate the PWA through:

- the manifest;
- Application/Manifest tooling;
- the service worker;
- installability;
- offline;
- installed behavior;
- real tests.

---

# 77. CHROME DEVTOOLS / APPLICATION

Where available, also validate the manifest and service worker using the browser's appropriate tools.

Check:

- manifest errors;
- icon loading;
- the maskable safe area;
- screenshots;
- shortcuts;
- the service worker lifecycle;
- caches;
- storage;
- installability.

---

# 78. PROGRESSIVE ENHANCEMENT

The core of the application must work with widely supported technologies.

More advanced functionality should be added as progressive enhancement.

Never make an essential flow depend on an experimental API without a fallback.

Prioritize feature detection over browser sniffing.

---

# 79. DON'T DO UA SNIFFING FOR LAYOUT

Don't write logic like:

`if iPhone => layout X`

`if Android => layout Y`

to control normal responsiveness.

Use:

- CSS;
- available space;
- container queries;
- media queries;
- input capabilities;
- feature detection.

Platform detection should only show up when a real platform difference requires specific behavior, such as installation instructions.

---

# 80. DESIGN SYSTEM

If the project doesn't yet have a consistent foundation, create or consolidate tokens for:

- spacing;
- radius;
- typography;
- elevation;
- colors;
- z-index;
- layout widths;
- motion;
- touch target sizes.

Avoid magic values repeated throughout the code.

The tokens should support responsiveness, not create rigidity.

---

# 81. DENSITY

Mobile and desktop don't necessarily need to have exactly the same density.

Mobile should favor:

- touch;
- legibility;
- focus;
- hierarchy.

Desktop can take advantage of:

- the mouse;
- the keyboard;
- space;
- viewing more data at once.

Adapt without creating two completely different products.

---

# 82. SERVICE WORKER PERFORMANCE

A service worker should be, in the worst case, performance-neutral.

Don't do heavy precaching during the critical phase of the first load.

Don't intercept requests unnecessarily.

Use Navigation Preload where supported and where it makes sense.

Measure.

---

# 83. CACHE SECURITY AND PRIVACY

Don't blindly store responses containing private or sensitive data in Cache Storage.

Analyze:

- authentication;
- multi-user scenarios;
- logout;
- account switching;
- personal data;
- shared caches.

Clear the appropriate data on logout where necessary.

Don't let one user's data reappear for another user on the same device.

---

# 84. INSTALLATION AND HTTPS

In production, the PWA must work in a secure HTTPS context.

Don't build solutions that depend on behavior available only on localhost.

---

# 85. CODE QUALITY

All improvements must remain:

- readable;
- typed where the stack offers typing;
- testable;
- reusable;
- consistent;
- simple;
- documented where necessary.

Don't turn responsiveness into hundreds of CSS hacks.

Prefer fixing the layout architecture.

---

# 86. AVOID OVERENGINEERING

“State of the art” doesn't mean using every new API that exists.

Use modern technologies when they:

- solve a problem;
- simplify code;
- improve UX;
- have sufficient support;
- have a reasonable fallback.

Don't introduce complexity without a clear gain.

---

# 87. EXECUTION PROCESS

Follow roughly this order:

## Phase 1 — Audit

Inspect the project and the application.

Map:

- pages;
- components;
- flows;
- breakpoints;
- overflow problems;
- navigation;
- forms;
- dialogs;
- tables;
- charts;
- PWA;
- accessibility;
- performance.

## Phase 2 — Baseline

Before making major changes, where possible create protective tests for the main existing flows.

## Phase 3 — Responsive foundation

Fix:

- viewport;
- app shell;
- containers;
- grids;
- sizing;
- typography;
- spacing;
- overflow;
- safe areas;
- navigation.

## Phase 4 — Components

Go component by component, improving adaptation and UX.

## Phase 5 — Mobile UX

Test the entire application on mobile as a real user.

Fix the friction points.

## Phase 6 — Tablet and in-between windows

Don't jump straight from phone to desktop.

## Phase 7 — Desktop

Ensure excellent use of screen space and productivity.

## Phase 8 — PWA [CONDITIONAL: selected capabilities only]

Implement/review:

- manifest;
- icons;
- screenshots;
- service worker;
- offline;
- installation;
- standalone;
- update lifecycle.

## Phase 9 — Accessibility

Run automated tests and a manual review.

## Phase 10 — Performance

Measure and eliminate significant bottlenecks.

## Phase 11 — Run the selected validation profile

Run the browsers, widths, states and flows selected for this task; use the broader matrix for a new application, shared foundation or explicit full audit.

## Phase 12 — Visual refinement

Use screenshots and visual inspection to find details that assertions don't catch.

Repeat only to resolve a concrete failed acceptance criterion or material visual defect in scope.

---

# 88. ACCEPTANCE CRITERIA

Use the following as acceptance criteria for the selected scope and profile. A criterion that does not apply is excluded explicitly; an applicable criterion blocked by the environment remains pending, never passed. The broad list is for a full audit, not every component fix:

### Responsiveness

- no accidental horizontal overflow at 320 CSS px or above;
- the interface stays functional at any in-between width;
- mobile portrait works;
- mobile landscape works;
- tablet works;
- desktop works;
- a narrow desktop window works;
- large screens are used well;
- long content doesn't break the interface;
- the virtual keyboard doesn't make fields unreachable;
- safe areas are correct.

### UX

- primary actions are easy to find;
- navigation suits the available space;
- touch targets are comfortable;
- no essential functionality depends on hover alone;
- loading/error/empty/offline have proper states;
- forms are comfortable on a phone;
- dialogs are usable on small screens.

### Accessibility

- important flows work with the keyboard alone;
- focus is clearly visible;
- adequate contrast;
- correct labels;
- zoom/reflow preserve functionality;
- an automated accessibility scan with no known critical violations;
- WCAG 2.2 AA used as the reference.

### Performance

- no major regressions were introduced;
- images and bundles are appropriate to the context;
- layout shift is under control;
- interaction stays fast;
- Core Web Vitals targets are used as the reference.

### PWA — only the selected product capabilities

- valid manifest;
- defined identity;
- correct icons;
- valid maskable icon;
- standalone experience;
- installation working on the supported platforms;
- iOS handled properly;
- Android handled properly;
- desktop handled properly;
- a meaningful offline experience if offline is a selected capability; otherwise clear network-failure handling;
- controlled updates if a service worker is used;
- a documented and appropriate cache strategy if caching is used.

### Tests — full-audit selection menu

- Chromium;
- Firefox;
- WebKit;
- Mobile Chrome profile;
- Mobile Safari profile;
- multiple viewports;
- breakpoints ±1px;
- orientation;
- functional tests;
- visual regression;
- accessibility;
- offline where applicable.

---

# 89. DON'T DECLARE SUCCESS WITHOUT TESTING

Don't simply reply:

“The project is now fully responsive.”

Show evidence.

When you finish, report:

- which areas were changed;
- the main technical decisions;
- problems found;
- problems fixed;
- browsers/profiles tested;
- viewports tested;
- tests run;
- test results;
- PWA checks performed for selected capabilities, or why they are not applicable;
- accessibility results;
- performance results where available;
- any remaining limitations.

If something couldn't be tested because the environment doesn't provide a real device or a particular tool, say so explicitly:

**“X could not be validated in this environment.”**

Never invent validation.

---

# 90. THE VISUAL ITERATION PRINCIPLE

After every meaningful round of changes:

1. run the application;
2. open the main pages;
3. capture or observe visually;
4. check mobile;
5. check desktop;
6. test interaction;
7. find new problems;
8. fix;
9. repeat only for a concrete remaining in-scope defect.

Don't stop at the first implementation that compiles.

---

# 91. THE FIXING PRINCIPLE

When you find a responsive problem, ask yourself internally:

“What is the architectural cause of this problem?”

Before adding yet another breakpoint.

Prefer:

a flexible layout

over:

a specific hack.

Prefer:

a container query

over:

detecting which page the component is on.

Prefer:

adaptable content

over:

arbitrarily hiding information.

Prefer:

progressive enhancement

over:

blocking browsers.

Prefer:

feature detection

over:

user-agent detection.

Prefer:

native semantics

over:

recreating complex controls with divs.

---

# 92. FINAL RULE

The goal isn't to produce an application that technically opens on a phone.

The goal is to produce an application that makes the user think:

**“This was really designed for my device.”**

On a smartphone, it should feel like an excellent mobile app.

On a tablet, it should use the space naturally.

On desktop, it should feel like a professional, productive web application.

When installed, it should behave like a modern, reliable, well-integrated PWA.

All of this must be achieved without compromising:

- accessibility;
- performance;
- maintainability;
- compatibility;
- security;
- consistency;
- business rules.

Finish when the agreed in-scope criteria are satisfied. Report unresolved defects or blocked checks with their impact. Further polish, new capabilities and unrelated refactoring require a new scope, not an endless audit loop.

## Maintenance and evidence

Use the repository's installed versions and supported browser policy. Standards and capabilities evolve; verify affected details against primary documentation when applying this reference. Sources for the applicable criteria include [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Playwright emulation](https://playwright.dev/docs/emulation), and the [Web App Manifest specification](https://www.w3.org/TR/appmanifest/). Browser/device emulation does not establish real iOS/Android installation or keyboard behavior. Revision 1.1 revised scope and interoperability; no application/browser run was performed as part of this document-only review.
