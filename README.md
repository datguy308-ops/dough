# Dough Bunny

Website for Dough Bunny, a Florida home bakery making homemade cookies & treats — mixed, shaped, and baked by hand, with love and clean, honest ingredients.

## Structure

- `index.html` — single-page site (hero, our kitchen letter, recipe card & "never" sticky note, cookie menu, how to order, love-note testimonials, snapshot gallery, order form)
- `css/style.css` — homemade look: lavender/cream/blush palette from the logo, gingham, lined paper, washi-tape snapshots, stitched borders; Fraunces + Manrope + Caveat (handwritten) type. The `.love` class gives any phrase the hand-drawn underline + heart.
- `js/cookies.js` — draws the illustrated SVG cookie for each flavor (`data-cookie="choc|strawberry|cutout|snicker|banana|brownie|smores"`)
- `js/main.js` — header, mobile nav, scroll reveal, hero parallax, order form validation
- `assets/images/logo.jpg` — round brand mark; `assets/images/logo-wordmark.png` — full logo with wordmark (transparent)
- `assets/graphics/` — illustration library (see its README)

## Before launch

- Replace placeholder prices, phone, email, pickup area, and social links
- Replace the sample testimonials with real customer reviews
- Personalize the "Our Kitchen" letter with the baker's real story
- Connect the order form to a form service or email (it currently only shows a confirmation message)

## Running locally

This is a static site — no build step required. Serve the directory with any static server, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
