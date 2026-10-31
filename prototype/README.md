# Seng Guan Auto: 11 redesign directions

An interactive, front-end-only design comparison for the existing Seng Guan Auto website. Each direction shares the same six routes while changing the visual system, first-screen composition, and home-page content order.

This client review deployment uses a separate branch and Cloudflare project so it can be compared with the existing live site without replacing it.

## Run locally

```sh
cd prototype
pnpm install
pnpm dev
```

Open the local address printed by Vite. The selector stays fixed at the bottom of the page. Use its arrows, the select menu, or the keyboard left/right arrows to compare directions. The URL contains `variant` and `page`, so a particular option can be shared directly:

```text
?variant=lot-712&page=home
?variant=spec-ledger&page=cars
?variant=monthly-key&page=finance
```

Click **Skills & notes** in the selector to see the design rationale and which skills informed that direction. The prototype has `Home`, `Cars`, `Financing`, `About`, `FAQ`, and `Contact` pages.

## Design directions

| # | Option | Design focus | Skills applied |
|---|---|---|---|
| 01 | Lot 712 | Local showroom, address, and supplied frontage photography | taste-skill, Impeccable |
| 02 | Find Your Drive | Search-first vehicle discovery and direct actions | UI UX Pro Max, Web Design Guidelines |
| 03 | Night Shift | Dark, cinematic automotive art direction with restrained motion | Frontend Design, GSAP Core, GSAP Timeline, GSAP ScrollTrigger |
| 04 | Everyday Miles | Reassuring, practical path for daily and family buyers | Impeccable, UI UX Pro Max |
| 05 | The Collection | Quiet, image-led curation | Refero Design, Frontend Design |
| 06 | Spec Ledger | Structured vehicle information and comparison | UI UX Pro Max, Web Design Guidelines |
| 07 | Drive Journal | Local editorial and dealership story | Refero Design, Web Artifacts Builder |
| 08 | Open Lot | High-contrast, direct market board | taste-skill, UI UX Pro Max |
| 09 | Monthly Key | Finance calculator and affordability planning | Impeccable, UI UX Pro Max |
| 10 | Clear Route | Concise hierarchy and familiar navigation | Web Design Guidelines, Web Artifacts Builder |
| 11 | Showroom Redline | Vehicle-first showroom with an animated hero and direct listing paths | Impeccable, GSAP |

Skill names describe the design principles applied; they do not imply that every skill generated each part of a screen.

## Prototype boundaries

- There is no backend, server submission, account, analytics, or local persistence.
- Inventory search and the illustrative flat-rate payment estimate run in the browser. Their values are not submitted or saved.
- Vehicle names, years, and photos come from the old homepage and are sample content only. Prices, mileage, availability, and live stock details are linked to the [Seng Guan Auto Carlist listings](https://www.carlist.my/dealer/sengguanauto).
- Contact buttons open the existing telephone, email, WhatsApp, map, and Carlist destinations.
- Existing source copy contains customer, inspection, warranty, finance-rate, and approval-time claims. This prototype avoids presenting those as verified guarantees.
- The original static website has not been replaced. The chosen direction can be implemented after review.

## Local information referenced

Dealership contact details and the supplied logo/showroom/car photography come from the current repository. The current third-party listings are used only as an external destination for live stock information; listings and competitor content are not copied into this prototype.
