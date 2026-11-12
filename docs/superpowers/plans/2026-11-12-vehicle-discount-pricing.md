# Vehicle Discount Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store per-vehicle original and discounted prices, show a computed price-drop badge publicly, and let administrators edit both prices in the card and compact layouts.

**Architecture:** Add a nullable D1 column and carry it through the existing vehicle API. Keep discount validity and percentage calculation in a shared helper, then use it on the public inventory card and vehicle details. Add inline price controls to both admin layouts and reshape compact rows around the screenshot while preserving the existing full editor and row click-to-edit behavior.

**Tech Stack:** React 19, TypeScript, Cloudflare Pages Functions, D1 SQL, CSS.

**Spec:** `docs/superpowers/specs/2026-11-12-vehicle-discount-pricing-design.md`

## Global Constraints

- Keep the existing `price` field as the original price and add a nullable `discount_price` field.
- Only show discount styling when both prices are present and the discounted price is lower than the original; compute and round the percentage from the stored amounts.
- Use the exact requested badge copy `-x% Price drop!`.
- Allow editing of both amounts in the full vehicle editor and in card and compact list layouts.
- Keep the vehicle information area in compact rows as an edit entry point; interactive controls must not trigger row editing.
- Do not add or run tests unless requested by the user.

## Review Focus

- Missing, zero, equal, or greater discounted amounts must not produce a discount badge.
- Price edits must preserve the other vehicle fields and saved status.
- Clicking or typing in a price control must not open the compact row editor.
- Compact row controls must remain usable at narrow viewport widths.
- Existing vehicles with no discount must continue to show only their original price.

---

### Task 1: Persist and expose discounted prices

**Files:**
- Create: `prototype/migrations/0015_vehicle_discount_price.sql`
- Modify: `prototype/functions/api/[[path]].ts`

**Interfaces:**
- The public and admin vehicle response gains nullable `discount_price`.
- Admin vehicle create, full update, and inline price update accept a nullable `discount_price` integer.

- [x] Add the migration with `ALTER TABLE vehicles ADD COLUMN discount_price INTEGER;`.
- [x] Include `discount_price` in public and admin vehicle selects.
- [x] Validate `discount_price` with the existing bounded integer price parser and persist it through create and full vehicle updates.
- [x] Add a price-only `PATCH /api/admin/vehicles/:id` branch accepting only `price` and/or `discount_price`, validating each as nullable, updating timestamps, and returning the refreshed vehicle without altering other fields.

### Task 2: Share discount math and render public pricing

**Files:**
- Create: `prototype/shared/vehicle-pricing.ts`
- Modify: `prototype/src/data.ts`
- Modify: `prototype/src/App.tsx`
- Modify: `prototype/src/VehicleDetails.tsx`
- Modify: `prototype/src/App.css`
- Modify: `prototype/src/translations.ts`

**Interfaces:**
- `getVehicleDiscount(price: number | null | undefined, discountPrice: number | null | undefined): { percent: number } | null` returns null unless both are positive safe integers and the discount is below the original.
- `Vehicle` gains optional nullable `discount_price`.

- [x] Implement the helper using rounded percentage `(price - discountPrice) / price * 100`.
- [x] Render discounted price prominently, original price with strike-through, and `-{percent}% Price drop!` beside the price on public inventory cards and the details dialog.
- [x] Keep the existing original-price-only output when the helper returns null.
- [x] Add translations for the new price labels and `Price drop!` in supported locales.

### Task 3: Add admin price editing and update compact rows

**Files:**
- Modify: `prototype/src/Admin.tsx`
- Modify: `prototype/src/Admin.css`
- Modify: `prototype/src/translations.ts`

**Interfaces:**
- `ManagedVehicle` gains `discount_price: number | null`.
- A shared admin price-save callback PATCHes only the supplied price fields and reconciles the returned vehicle into list state.

- [x] Add `discount_price` to the empty vehicle and full editor, with labels `Original Price (RM)` and `Discounted Price (RM)`.
- [x] Add direct-edit inputs for original and discounted prices to card and compact list modes; save the changed amount through the price-only API branch.
- [x] Reshape compact rows to align selection, photo, vehicle information, two labeled price inputs, featured control, availability control, edit button, and delete button per the screenshot.
- [x] Preserve the vehicle details button as a broad edit target while preventing checkbox, input, select, and action button events from reaching it.
- [x] Add responsive compact-row styles that keep all controls reachable at narrow widths.

### Task 4: Review the completed change

**Files:** all files above.

- [x] Inspect the final diff for schema/API/UI consistency and confirm the screenshot copy, badge behavior, inline-edit coverage, and compact-row navigation requirements are all represented.
- [x] Do not run tests unless the user asks for verification.

Review found and fixed two issues: concurrent price saves now track each vehicle independently, and compact rows switch to a stacked layout at tablet widths to prevent horizontal overflow. API and SQL bind counts, migration trigger coverage, and compact edit entry points were also reviewed.
