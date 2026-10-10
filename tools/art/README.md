# Art pipeline

The painted art in `web/assets/` was made with the Gemini image model (`gemini-3-pro-image`), using Chuck's reference illustration as the style input.

- `gen2.py out.png aspect "prompt" ref1 [ref2 ...]` generates one image (the API key comes from the environment proxy; never put it in code).
- `cut.py sheet.png N prefix [threshold]` cuts N sprites off a white (or, with a negative threshold, a solid coloured) background.
- `pack.py people|cats|rest|props1|icons1` resizes the cut sprites and writes them as WebP into `web/assets/`.

Backgrounds were repainted from screenshots of the old canvas-drawn floors so that stairs, doors, shelves and cushions stay where the game logic expects them.
