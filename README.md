# Dough Bunny

Website for Dough Bunny, a local high-end bakery known for clean, honest ingredients.

## Structure

- `index.html` — single-page site (hero, story, clean-label ingredients, cookie menu, how to order, testimonials, gallery, order form)
- `css/style.css` — styles (lavender/cream/gold palette matching the brand logo; Fraunces + Manrope type)
- `js/cookies.js` — draws the illustrated SVG cookie for each flavor (`data-cookie="choc|strawberry|cutout|snicker|banana|brownie|smores"`)
- `js/main.js` — header, mobile nav, scroll reveal, hero parallax, testimonial rotator, order form validation
- `assets/images/logo.jpg` — round brand mark; `assets/images/logo-wordmark.png` — full logo with wordmark (transparent)
- `assets/graphics/` — illustration library (see its README)

## Before launch

- Replace placeholder prices, phone, email, pickup area, and social links
- Replace the sample testimonials with real customer reviews
- Connect the order form to a form service or email (it currently only shows a confirmation message)

## Running locally

This is a static site — no build step required. Serve the directory with any static server, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
