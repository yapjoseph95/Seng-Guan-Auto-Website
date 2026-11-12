# Vehicle Discount Pricing Design

## Intent and goals

Let staff maintain an original price and optional discounted price for each vehicle. Show the discounted amount prominently on public vehicle listings, the original amount crossed out, and a computed `-x% Price drop!` badge when the discounted price is valid. Match the supplied screenshots for the admin compact row and its click-to-edit area.

## Constraints and non-goals

- Preserve the existing `price` field as the original price and add a nullable `discount_price` field.
- Only show discount styling when both prices are present and the discounted price is lower than the original; compute and round the percentage from the stored amounts.
- Add an admin control for both prices in the full vehicle editor and direct-edit controls in card and compact list views. Save inline edits through the existing authenticated vehicle API.
- Keep the vehicle information area in compact rows as an edit entry point, excluding interactive controls from its click behavior.
- The supplied images are visual references. The screenshot copy `-x% Below Market` is replaced by the requested `-x% Price drop!`.
- No global discount policy, promotion scheduling, or discount-price filtering is in scope.

## Approaches

1. Store a per-vehicle optional discounted amount alongside the existing original price. This follows the screenshots and the current per-vehicle API model; selected as the implementation approach.
2. Configure a site-wide discount rule and derive discounted values for every vehicle. This does not fit listings whose prices need independent updates.

## Implementation calls

- Persist `discount_price` with a database migration and pass it through admin and public vehicle API responses and writes.
- Use a shared pricing helper for validity and percentage calculation so public cards and details show the same result.
- Make original and discounted amounts directly editable in both admin list layouts, with saves handled by the existing API.
- Rework the compact row to align selection, photo, vehicle details, price inputs, featured flag, availability, edit, and delete controls as in the supplied reference. Keep it responsive on narrow screens.

## Open to the builder

- Whether inline price changes save on blur or with a small adjacent save action, following the existing admin interaction patterns.
- Exact responsive breakpoints and input widths, following the current admin styling.
