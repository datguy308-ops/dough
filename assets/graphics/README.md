# Graphics library

Individual illustration assets cut from the Dough Bunny brand sticker sheet, organized by category:

- `bunny/` — the 6 character poses (kitchen scenes), style untouched
- `baking-tools/` — rolling pin, whisk, spoon, mixing bowl, oven mitt, piping bag, chef hat
- `ingredients/` — cookies, bread, cupcake, egg, butter, jar, dough cloud
- `decorative/` — hearts, sparkles, paw prints, swirls, bows, clouds, and the three repeating border strips
- `frames/` — label/frame shapes (cloud, circle, scalloped rectangle, ribbon banner, rounded rectangle)

## Folders

- `original/<category>/<name>.png` — the untouched crops from the sticker sheet (small: most are 50–200px). Keep these as the source of truth.
- `web/<category>/<name>.webp` — what the site uses. Each original was upscaled 4× with Real-ESRGAN
  (`realesr-animevideov3`, chosen because it kept the bunny's blush, eye highlights, and line work
  faithful where the anime-still model flattened them), then downsized with Lanczos to a Retina-friendly
  cap (bunnies ≤900px, tools/ingredients ≤360px, small decorations ≤220px; the bow and rolling pin are
  kept at full upscaled size because they're shown large in the hero) and saved as WebP with alpha.

The wordmark logo (`assets/images/original/logo-wordmark.png`, 500px) went through the same pipeline
to `assets/images/logo-wordmark.webp` (1200px). Lettering was checked side by side for legibility.

To regenerate: run the Real-ESRGAN ncnn-vulkan release with `-n realesr-animevideov3 -s 4` on the
originals, then export to WebP (quality 88, alpha quality 95).

`manifest.json` lists every asset with its category, name, original pixel size, and source panel.
