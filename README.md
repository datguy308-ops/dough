# Dough Bunny

Website for Dough Bunny, a Florida home bakery making homemade cookies & treats — mixed, shaped, and baked by hand, with love and clean, honest ingredients.

## Structure

- `index.html` — single-page site, laid out like pages of a bakery scrapbook: hero collage + "Build Your Box" CTA, Why Dough Bunny?, What's Baking (spotlight + Batch No. ticket), the cookie jar (Step 1 box size → Step 2 flavors, recipe-card tiles), Made by Hand (recipe card, sticky note, polaroids), Our Kitchen (letter + love-notes placeholder), How to Order + order form (01 Your information · 02 Your cookie box · 03 Delivery) and confirmation, FAQ, footer. A hidden SVG sprite at the top holds the hand-drawn doodles and the "Baked with love · Est. 2026" stamp.
- `css/style.css` — design tokens (cream / deep purple / lavender / pink / butter / cookie brown), Fraunces + Caveat + Nunito Sans, paper grain, torn page edges, gingham, washi tape, paper shadows. Paper objects tilt via `--tilt` (the `rotate` property) so reveals (`translate`) never fight with it.
- `js/cookies.js` — draws the illustrated SVG cookie for each flavor (`data-cookie="choc|strawberry|cutout|snicker|banana|brownie|smores"`).
- `js/box.js` — the Build Your Box model, pricing, and box UI. **All business values live here**: `PRICES` (per large cookie, cents, tax included), `BOX_SIZES` (4, 6, 12 — the total must be exactly one of these; 12 is the per-order max), `DELIVERY_RATES` (flat fee by driving distance, display only), `MAX_DELIVERY_MILES` (20). The page never hard-codes them: card prices use `data-price-for="<flavor id>"`, and copy uses `data-db="max-miles | delivery-from | delivery-range | delivery-fees | box-sizes"` (and `data-delivery-rates` for the rates list), which `box.js` fills in. `validate()` is the single rule (reuse it server-side). The chosen box size (`setTarget`) only guides the UI — size picker, the little box meter, "add N more" copy. Saved in localStorage (`doughbunny.box.v1`: items + chosen size) and shared by the card steppers, the form's builder, the floating box sticker, and the box summary. Flavor ids are the exact cookbook names (e.g. "Strawberry Shortcake"); older saved boxes are migrated via `RENAMED`.
- `privacy.html` — privacy policy (Square, Gmail, Google Fonts, marketing opt-in, local storage). Lists Netlify as the host and form service.
- `js/main.js` — header, mobile nav, scroll reveal, hero parallax, order summary (delivery fee to be confirmed), order submit + confirmation.
- `assets/images/` — `logo.jpg` (round brand mark), `logo-wordmark.webp` (full logo, upscaled), favicon / touch icon / og image; `original/` keeps the source logo.
- `assets/graphics/` — illustration library (see its README for the upscaling pipeline).

## Hooks for services that aren't connected yet

**Delivery fees (manual).** The site never calculates a distance or a fee and uses no maps service. `DELIVERY_RATES` in `js/box.js` is the flat-rate table (0–5 mi $5 · over 5–10 mi $8 · over 10–15 mi $12 · over 15–20 mi $16; over 20 mi is outside the standard area), used only to show the rates. Each order arrives with `status: "Delivery fee pending confirmation"` and `delivery.fee: null`; the owner checks the driving distance, confirms the fee, availability and full total with the customer, and only then sends the Square payment link. The form requires a ZIP code in the address so it can be checked.

**Sending orders (Netlify Forms).** The order form is a Netlify form named `order` (`data-netlify="true"`, honeypot `bot-field`). On the live site, `js/main.js` posts each request to Netlify with every field plus a readable `orderSummary` and `status: Delivery fee pending confirmation`; Netlify emails it to the bakery once a notification is set up (Netlify → Forms → Form notifications). On `localhost`/`file:` previews nothing is sent and the confirmation offers a pre-written email instead. To use a different service, register your own handler:

```js
DoughOrders.setSubmitHandler(async (order) => {
  const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
  if (!res.ok) throw new Error('send failed');   // throwing shows a "please try again" message
});
```

`order` contains the customer info, `deliveryDate`, `deliveryWindow`, `notes`, `agreedToPolicies`, `marketing` (`optIn`, the exact consent text shown, timestamp — keep this as your consent record), `allergens` / `allergensPending`, `box` (`[{ flavor, qty, price, lineTotal }]`, cents), `boxSize`, `cookiesTotal`, `delivery` (`address`, `instructions`, `fee: null`), and `status` ("Delivery fee pending confirmation"). There is no `total`: the owner confirms it. Re-check the box size and recompute the totals from `PRICES` on the server — the browser check can't stop a hand-crafted request. Until a handler is registered, the confirmation clearly says the request was **not** sent and offers a pre-written email to the bakery plus the phone number.

## Business info on the site (from the website information form)

- Contact: (786) 759-6369 · doughbunnybakery@gmail.com · Instagram @dough_bunny (no Facebook).
- Menu (exact cookbook names, no others): Chocolate Chip, Snickerdoodle, S'mores, Strawberry Shortcake, Frosted Butter Cookie (the signature, bunny-shaped), Banana Pudding, Brownie Cookie.
- Allergens per flavor live in `ALLERGENS` in `js/box.js`; Banana Pudding's are still pending and show "coming soon". Full ingredient lists go in `INGREDIENTS` (all pending); each card's "Ingredients" section fills in automatically.
- Approved claims: made from scratch, small batches, real butter, pure vanilla extract, whole eggs, real chocolate, hand-piped frosting, rolled and cut by hand. Not approved yet: "no artificial preservatives", "real fruit", "baked fresh to order", shelf-stability.
- Payment: Square payment link, full amount when the order is confirmed. Prices include any applicable sales tax.
- Policies (cancellation before delivery, refund, failed delivery, unavailable at delivery, same-day "only if available") are shown in the Order Policies section and FAQ.
- Florida cottage food: F.S. 500.80; the required sentence appears in the menu notice, policies, and footer. The kitchen address must never appear on the site.
- Reviews stay empty until real, approved reviews are provided.

## Before launch

Still open: Banana Pudding allergens; all ingredient lists; delivery days/times; confirmation response time; data retention period; Our Kitchen letter; cookie photos; real reviews.

## Running locally

This is a static site — no build step required. Serve the directory with any static server, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
