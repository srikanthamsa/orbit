# Make semantic callout tints follow the active theme

Written against: `c73ec5a` (working tree dirty only in `README.md`, `docs/development.md`, `wxt.config.ts`, `.commandcode/`, `.github/workflows/release.yml`, `docs/install.md` — none of which this plan touches; every file below is unmodified).

## Evidence chain

- Surface: the ORBIT Chrome side panel, task loop — the `Workspace` approval state, the `Workspace` result state, the `Workspace` error state, the `Home` restricted-tab notice, and the panel-level error toast rendered by `App`.
- Problem: semantic callout edges and fills are written as `rgba()` literals whose RGB channels are byte-identical to the **dark** theme tokens (`#ffc861`, `#46d39a`, `#ff6b6b`, `#5a9bff`), while the same callouts read their icon and label colors from the theme token. With the light theme active, the panel therefore paints a dark-palette edge on a light page: the callout's boundary stops carrying the semantic color, and its tint no longer belongs to the palette its own text uses.
- Design evidence: `src/entrypoints/sidepanel/style.css` is the color owner. It defines a per-theme value for every semantic color — dark `--success #46d39a` / `--warn #ffc861` / `--danger #ff6b6b` (19-21), light `#1c9c6d` / `#b57d10` / `#d94b4b` (39-41) — and sets `color-scheme` per block. Tinted surfaces are expressed as theme-scoped tokens (`--accent-soft`, 18/38). The existing idiom for deriving an alpha tint from a semantic token is `color-mix` in `src/components/ui.tsx:221`. The theme reaches the document at `src/stores/agent.ts:140` and `:149` (`document.documentElement.dataset.theme`), driven by Settings → Appearance (`src/screens/Settings.tsx:361-368`).
- Owner: `src/entrypoints/sidepanel/style.css` (color tokens) and `src/components/ui.tsx` (shared primitives). The offending literals live at the consumer sites listed under **Changes**.
- Scope and affected surfaces: 8 sites across `src/screens/Workspace.tsx`, `src/screens/Home.tsx`, `src/App.tsx`, `src/components/ui.tsx`, `src/entrypoints/sidepanel/style.css`.
- Uncertainty: none about the colors — the literals are exactly the dark token values, so substituting the token cannot change dark rendering. The one mechanism assumption is that Tailwind compiles arbitrary `color-mix()` values here; this was verified against this repository's Tailwind 3.4.17, which emits e.g. `color-mix(in srgb,var(--warn) 32%,transparent)` for `border-[color-mix(in_srgb,var(--warn)_32%,transparent)]`. The application itself was not built or rendered while writing this plan.

## Design decision

Semantic tints must be derived from the semantic token at the point of use, so that both theme blocks drive them. Keep every site's current alpha and swap only the color source: `rgba(<dark palette>, α)` becomes `color-mix(in srgb, var(--<role>) α%, transparent)`.

This resolves the root problem — the tint is no longer pinned to one palette — without touching layout, copy, alpha values or the dark appearance. In dark mode the resolved color is provably identical (same channels, same alpha), so the change is visually inert there and only repairs light mode.

Do not add `--warn-soft` / `--success-soft` / `--danger-soft` tokens for this. The system already expresses an alpha tint at the point of use (`ui.tsx:221`), and `--accent-soft` exists because that tint is shared through a CSS-variable class by several components, which is not the case here. One correction, one mechanism.

## Reuse

- Tokens: `--warn`, `--success`, `--danger`, `--accent` from `src/entrypoints/sidepanel/style.css` (both blocks).
- Tokens kept as-is at the call sites: `--bg-elev` (toast body), `text-[var(--warn)]` / `text-[var(--danger)]` / `text-[var(--success)]` (icons and labels), `--panel`, `--border`.
- Exemplar: `src/components/ui.tsx:221` (`StepMark`) derives both a border and a fill from a semantic token with `color-mix` (35% / 10%).
- Syntax note, verified in this repo: inside a Tailwind arbitrary value, spaces are written as `_`; `hover:` variants accept the same form; `[box-shadow:0_6px_20px_color-mix(...)]` (arbitrary **property**) compiles correctly while `shadow-[0_6px_20px_color-mix(...)]` is silently dropped by this Tailwind version. Use the arbitrary-property form for the shadow.

## Changes

1. `src/screens/Workspace.tsx:156` — approval callout
   - Change: `border-[rgba(255,200,97,0.32)] bg-[rgba(255,200,97,0.07)]` → `border-[color-mix(in_srgb,var(--warn)_32%,transparent)] bg-[color-mix(in_srgb,var(--warn)_7%,transparent)]`.
   - Preserve: `rounded-[14px]`, `p-3.5`, `mt-3`, `animate-rise`, the `ShieldAlert` icon's `text-[var(--warn)]`, the `approvalRef` and its scroll-into-view effect at `Workspace.tsx:51-54`, the Approve/Deny buttons.
   - Verify: dark theme paints the same pixels; light theme resolves the edge through `#b57d10`.
2. `src/screens/Workspace.tsx:241` — result callout
   - Change: `border-[rgba(70,211,154,0.25)] bg-[rgba(70,211,154,0.06)]` → `border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-[color-mix(in_srgb,var(--success)_6%,transparent)]`.
   - Preserve: the `Result` eyebrow (`text-[var(--success)]`), the Copy/Copied control, `whitespace-pre-wrap` body, `rounded-[14px]`, `animate-rise`.
   - Verify: edge and fill track `--success` in both themes.
3. `src/screens/Workspace.tsx:259` — error callout
   - Change: `border-[rgba(255,107,107,0.28)] bg-[rgba(255,107,107,0.07)]` → `border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,transparent)]`.
   - Preserve: `ShieldAlert` icon color, `text-[12px]` body, the `error` gate.
   - Verify: edge and fill track `--danger` in both themes.
4. `src/screens/Home.tsx:143` — restricted-tab notice
   - Change: `border-[rgba(255,200,97,0.28)] bg-[rgba(255,200,97,0.06)]` → `border-[color-mix(in_srgb,var(--warn)_28%,transparent)] bg-[color-mix(in_srgb,var(--warn)_6%,transparent)]`.
   - Preserve: `AlertTriangle` icon color, the `tabRestricted` condition, the copy.
   - Verify: the notice's edge is visible in light mode instead of compositing to ~1.1:1 against the page.
5. `src/App.tsx:37` — panel error toast
   - Change: `border-[rgba(255,107,107,0.3)]` → `border-[color-mix(in_srgb,var(--danger)_30%,transparent)]`; keep `bg-[var(--bg-elev)]`.
   - Preserve: positioning, `animate-rise`, the dismiss button, the `error && route !== 'task'` gate.
   - Verify: the toast edge tracks `--danger`; it still only appears off the task route.
6. `src/components/ui.tsx:42` — `Button` variant `danger`
   - Change: `bg-[rgba(255,107,107,0.12)] … border border-[rgba(255,107,107,0.22)] hover:bg-[rgba(255,107,107,0.18)]` → `bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] … border border-[color-mix(in_srgb,var(--danger)_22%,transparent)] hover:bg-[color-mix(in_srgb,var(--danger)_18%,transparent)]`. Keep `text-[var(--danger)]`.
   - Preserve: size/variant class structure, the disabled and active-scale behavior from the shared `base` string.
   - Verify: the Stop button and Settings → "Delete keys" keep an identical dark appearance and a theme-correct light one; hover still shifts.
7. `src/components/ui.tsx:39` — `Button` variant `primary` glow
   - Change: `shadow-[0_6px_20px_rgba(90,155,255,0.25)]` → `[box-shadow:0_6px_20px_color-mix(in_srgb,var(--accent)_25%,transparent)]`.
   - Preserve: `bg-[var(--accent)]`, `text-white`, `hover:bg-[var(--accent-strong)]`.
   - Verify: the glow follows `--accent`; confirm the class survives the build (this is the one site where the `shadow-[…]` form would be silently dropped).
8. `src/entrypoints/sidepanel/style.css:87` — text selection (the `::selection` rule opens at :86)
   - Change: `background: rgba(90, 155, 255, 0.32);` → `background: color-mix(in srgb, var(--accent) 32%, transparent);`.
   - Preserve: the `::selection` rule's position and the absence of a `color` declaration.
   - Verify: selecting text in the panel uses the active accent in both themes.

## Scope

- Inherit: every consumer of the shared `Button` variants receives the corrected `danger` fill and `primary` glow — `Workspace` Stop (danger), Approve/Resume (primary), `Home` start (primary), `Settings` "Delete keys" (danger) and "Connect a model" (primary), `ProviderForm` Save (primary). This is intended: they are the same token.
- Verify: `src/screens/Settings.tsx` and `src/components/ProviderForm.tsx` consume `--accent-soft` and contain no palette literals; they should render unchanged. The `--accent-soft` consumers (`Home.tsx:172`, `Workspace.tsx:135`, `Settings.tsx:34`, `ProviderForm.tsx:130`) are untouched.
- Exclude: `.orb-mark` (`style.css:133`) — brand artwork, not a semantic surface; the ambient `body::before` gradients (`style.css:76-84`), already theme-scoped; typography, spacing, radii, layout, copy, and any Settings redesign. No new tokens, no new components.

## Validation

- Product: with the light theme active, the approval callout, result callout, error callout, restricted-tab notice, error toast, danger button and primary glow all render their semantic color from the light palette.
- Interface: `npm run preview` → `http://localhost:5199`.
  - `?demo=approval` (warning callout + approval card), `?demo=done` (success callout), `?demo=workspace`, `?demo=home`, `?demo=settings`, and `?demo=light` (Home seeded in the light theme).
  - Toggle the theme without leaving the state: `document.documentElement.dataset.theme = 'light'` in devtools (or Settings → Appearance → Light). Each callout's edge must visibly change with the theme; in dark it must look unchanged from before the edit.
  - Check the `danger` button hover and the `primary` button glow in both themes; check text selection in both.
  - Error toast: only reachable when `error` is set and the route is not `task` — trigger by starting a task with no model configured, or temporarily set the store's `error` in devtools.
- System: no new tokens or components were introduced; each tint resolves from `--warn` / `--success` / `--danger` / `--accent`. After the change, `grep -n "rgba(" src/screens src/App.tsx src/components/ui.tsx` must return nothing. Remaining literals elsewhere are out of scope and must stay: the token blocks and ambient gradients in `style.css` (`--panel`, `--border`, `--shadow`, `body::before`), the `.orb-mark` artwork (137-141), and `src/browser/control.ts`, which is the in-page overlay stylesheet — a separate surface from this panel.
- Repository: `npm run check` (`tsc --noEmit` + `vitest run`) → exit 0, compile clean, existing suite unchanged. No test asserts styling, so any failure indicates an unrelated regression. This command was not run while writing the plan.

## Stop conditions

- Stop if a site's alpha has to change to look right — that is a design decision, out of this fix's scope.
- Stop if the built CSS for an arbitrary `color-mix()` class is missing; the mechanism assumption (Tailwind arbitrary-value support) has then failed and the value must move into `style.css` instead.
- Stop if `--faint`/`--muted` or another token is discovered driving these tints; the owner has changed and the evidence must be re-traced.
- Stop if a change requires editing a file outside those listed under **Changes**.

## Design documentation

- None. No design documentation exists in this repository to update; the rule is expressed by the code and the token block. If a `DESIGN.md` is introduced later, record there: "Semantic tints are derived at the point of use with `color-mix` on the semantic token (`--warn`, `--success`, `--danger`, `--accent`); palette literals are not used for surfaces."
