# Dough Bunny

Website for Dough Bunny, a Florida home bakery making homemade cookies & treats — mixed, shaped, and baked by hand, with love and clean, honest ingredients.

## Structure

- `index.html` — single-page site, laid out like pages of a bakery scrapbook: hero collage + "Build Your Box" CTA, Why Dough Bunny?, What's Baking (spotlight + Batch No. ticket), the cookie jar (Step 1 box size → Step 2 flavors, recipe-card tiles), Made by Hand (recipe card, sticky note, polaroids), Our Kitchen (letter + love-notes placeholder), How to Order + order form (01 Your information · 02 Your cookie box · 03 Delivery) and confirmation, FAQ, footer. A hidden SVG sprite at the top holds the hand-drawn doodles and the "Baked with love · Est. 2026" stamp.
- `css/style.css` — design tokens (cream / deep purple / lavender / pink / butter / cookie brown), Fraunces + Caveat + Nunito Sans, paper grain, torn page edges, gingham, washi tape, paper shadows. Paper objects tilt via `--tilt` (the `rotate` property) so reveals (`translate`) never fight with it.
- `js/cookies.js` — draws the illustrated SVG cookie for each flavor (`data-cookie="choc|strawberry|cutout|snicker|banana|brownie|smores"`).
- `js/box.js` — the Build Your Box model, pricing, and box UI. **All business values live here**: `PRICES` (per large cookie, cents, tax included), `BOX_SIZES` (4, 6, 12 — the total must be exactly one of these; 12 is the per-order max), `DELIVERY_PER_MILE` ($1), `MAX_DELIVERY_MILES` (20). The page never hard-codes them: card prices use `data-price-for="<flavor id>"`, and copy uses `data-db="max-miles | per-mile | box-sizes"`, which `box.js` fills in. `validate()` is the single rule (reuse it server-side). The chosen box size (`setTarget`) only guides the UI — size picker, the little box meter, "add N more" copy. Saved in localStorage (`doughbunny.box.v1`: items + chosen size) and shared by the card steppers, the form's builder, the floating box sticker, and the box summary. Flavor ids keep the full names (e.g. "Strawberry Shortcake Cookies"); `DoughBox.label()` shows the short name on screen.
- `js/main.js` — header, mobile nav, scroll reveal, hero parallax, delivery distance/fee display, order submit + confirmation.
- `assets/images/` — `logo.jpg` (round brand mark), `logo-wordmark.webp` (full logo, upscaled), favicon / touch icon / og image; `original/` keeps the source logo.
- `assets/graphics/` — illustration library (see its README for the upscaling pipeline).

## Hooks for services that aren't connected yet

**Delivery distance (maps service).** The form looks up the distance whenever the address changes, and again on submit:

```js
DoughBox.setDistanceProvider(async (address) => {
  const res = await fetch('/api/delivery-distance?address=' + encodeURIComponent(address));
  if (!res.ok) throw new Error('lookup failed');
  return (await res.json()).miles;   // driving miles from the kitchen
});
```

Run the actual maps call on a server/serverless function that holds the kitchen address and API key — anything in the site's HTML/JS is visible to visitors. Over 20 miles is refused automatically; a failed lookup still lets the order through with the fee confirmed by reply. Until a provider is set, the site only says the fee will be confirmed — it never claims to calculate it.

**Sending orders (form service / email / backend).** Nothing is sent yet. Register a handler and the confirmation switches to "we got your order request":

```js
DoughOrders.setSubmitHandler(async (order) => {
  const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
  if (!res.ok) throw new Error('send failed');   // throwing shows a "please try again" message
});
```

`order` contains the customer info, `box` (`[{ flavor, qty, price, lineTotal }]`, cents), `boxSize`, `cookiesTotal`, `delivery` (`address`, `instructions`, `miles`, `fee`), and `total`. Re-check the box size and recompute the totals from `PRICES` on the server — the browser check can't stop a hand-crafted request. Until a handler is registered, the confirmation clearly says the request was **not** sent and offers a pre-written email to the bakery plus the phone number.

## Business info on the site (from the website information form)

- Contact: (786) 759-6369 · doughbunnybakery@gmail.com · Instagram @dough_bunny (no Facebook).
- Menu: Chocolate Chip, Strawberry Shortcake, Frosted Butter, Natilla Snickerdoodle, Crackly-Top Brownie, S'mores. Banana Pudding (and Matcha / Vanilla Matcha / Spice) must not be added.
- Allergens per flavor live in `ALLERGENS` in `js/box.js` (the cards, the order form summary, and the order all read from it).
- Approved claims: made from scratch, made in small batches. "Baked fresh to order" was not approved — don't add it back.
- Policies (cancellation, refund, failed delivery, unavailable at delivery, same-day "only if available") are shown verbatim in the Order Policies section and FAQ.
- Florida cottage food: F.S. 500.80; the required sentence appears in the menu notice, policies, and footer. The kitchen address must never appear on the site.
- Reviews stay empty until real, approved reviews are provided.

## Before launch

See the launch checklist given with this update (hosting, order sending, payment, sales tax, labels, privacy policy). Still open on the site itself:
- How customers pay (add to Order Policies + FAQ once decided).
- A privacy policy page (the form collects name, email, phone, and address).
- Real reviews, once approved.

## Running locally

This is a static site — no build step required. Serve the directory with any static server, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
