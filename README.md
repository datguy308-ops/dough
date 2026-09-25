# Dough Bunny

Website for Dough Bunny, a Florida home bakery making homemade cookies & treats — mixed, shaped, and baked by hand, with love and clean, honest ingredients.

## Structure

- `index.html` — single-page site, laid out like pages of a bakery scrapbook: hero collage, What's Baking (spotlight + tags), the cookie jar (recipe-card tiles), Made by Hand (recipe card, sticky note, polaroids), Our Kitchen (letter + love notes), How to Order + order form (deep purple page), footer. A hidden SVG sprite at the top holds the hand-drawn doodles and the "Baked with love · Est. 2026" stamp.
- `css/style.css` — design tokens (cream / deep purple / lavender / pink / butter / cookie brown), Fraunces + Caveat + Nunito Sans, paper grain, torn page edges, gingham, washi tape, paper shadows. Paper objects tilt via `--tilt` (the `rotate` property) so reveals (`translate`) never fight with it.
- `js/cookies.js` — draws the illustrated SVG cookie for each flavor (`data-cookie="choc|strawberry|cutout|snicker|banana|brownie|smores"`)
- `js/box.js` — the Build Your Box model: an exact quantity per flavor (min 4 cookies total), saved in localStorage, shared by the card steppers, the order form's builder, the floating box sticker, and the box summary panel. `window.DoughBox.validate()` is the single validation rule (reuse it server-side when a backend is added). No prices are calculated — the listed prices are placeholders and there's no mixed-flavor pricing rule yet.
- `js/main.js` — header, mobile nav, scroll reveal, hero parallax, order form submit (re-validates the box and builds an order with the exact `[{flavor, qty}]` breakdown; the hidden `box` field carries it as text for plain form posts)
- `assets/images/` — `logo.jpg` (round brand mark), `logo-wordmark.webp` (full logo, upscaled), favicon / touch icon / og image; `original/` keeps the source logo
- `assets/graphics/` — illustration library (see its README for the upscaling pipeline)

## Running locally

This is a static site — no build step required. Serve the directory with any static server, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
