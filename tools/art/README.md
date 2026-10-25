# Art pipeline

The painted art in `web/assets/` was made with the Gemini image model (`gemini-3-pro-image`), using Chuck's reference illustration as the style input.

- `gen2.py out.png aspect "prompt" ref1 [ref2 ...]` generates one image (the API key comes from the environment proxy; never put it in code).
- `cut.py sheet.png N prefix [threshold]` cuts N sprites off a white (or, with a negative threshold, a solid coloured) background.
- `pack.py people|cats|rest|props1|icons1` resizes the cut sprites and writes them as WebP into `web/assets/`.

Backgrounds were repainted from screenshots of the old canvas-drawn floors so that stairs, doors, shelves and cushions stay where the game logic expects them.

## Shop 3 (貓咪室內樂園)
`tools/art/shop3/bg.sh` paints the palace-style floors (s3bg1/2/3/5/6) with gen2.py; `tools/art/shop3/spr.py` paints the s3* staff sheets and the toy_* sheet, then cut.py + pack.py cut them into webp. 5F (s3bg5) is mirrored after generation so its stairs line up with 4F.

## 喵型測驗 and 暖陽好友套裝
`web/q/art/<喵型>.webp` (1080x1350) are full-page 4:5 scenes painted with gen2.py from one in-game cat sprite (on white) plus the style reference, with the top and bottom fading into cream paper so the card text can sit there. `tools/quiz/pages.py` writes the /q/ pages and `tools/quiz/og.js` renders their share images (`web/q/og/`). The invite set (`mo11*`, `acc_clip_sun`, `acc_cat_sun`) used the same prompts as outfits3.py, then cut.py and the people sizes from pack.py (stand/walk 300 px tall, sit 228 px).
