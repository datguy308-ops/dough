# Graphics library

Individual illustration assets cut from the Dough Bunny brand sticker sheet, organized by category:

- `bunny/` — the 6 character poses (kitchen scenes), style untouched
- `baking-tools/` — rolling pin, whisk, spoon, mixing bowl, oven mitt, piping bag, chef hat
- `ingredients/` — cookies, bread, cupcake, egg, butter, jar, dough cloud
- `decorative/` — hearts, sparkles, paw prints, swirls, bows, clouds, and the three repeating border strips
- `frames/` — label/frame shapes (cloud, circle, scalloped rectangle, ribbon banner, rounded rectangle)

Each asset exists in two places:

- `original/<category>/<name>.png` — full resolution as cropped from the source sheet, lossless
- `web/<category>/<name>.png` and `.png`/`.webp` — size-capped (480px longest side) and compressed for use on the site

`manifest.json` lists every asset with its category, name, pixel size, and which panel/component it came from.

All backgrounds are true transparency (alpha channel from the source), not color-keyed, so edges are clean at any size.
