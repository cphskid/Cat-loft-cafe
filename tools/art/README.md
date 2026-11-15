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

## 每日簽到
`acc_cat_clover` / `acc_clip_clover` (day-7 prizes) and `ic_sign` (phone icon) were painted with gen2.py using `acc_cat_sun` / `acc_clip_sun` / `ic_daily` on white as the style reference, cut with cut.py, then scaled to 120 px (collar) / 100 px (clip) tall like the other accessories and 144 px for the icon.

## 公告、喵喵銀行、我的紀錄
`ic_news` / `ic_bank` / `ic_record` (phone icons) were painted together in one gen2.py sheet using `ic_daily` / `ic_sign` / `ic_wallet` on white as the style reference, cropped by their tiles (white corners flood-filled to transparent) and scaled to 144 px.

## 真實店貓
`web/assets/realcat_ref.webp` is the style/pose reference sheet (橘子 and 黑豆, 5 poses each, 2× on white) that `supabase/functions/catloft-realcat-draw` sends to Gemini together with a player's cat photo. The admin page (`web/admin/realcats.js`) cuts the returned sheet into rows of 5 sprites in the browser and scales them like `pack.py cats` (walking pose 160 px wide).

## 喵喵寫真館（貓咪頭飾、拍照背景、抓拍時刻）
`acc_h_*` (cat headwear) were painted in one gen2.py sheet on white, using in-game cat sprites wearing each item as the reference, cut with cut.py (threshold 215) and scaled to 100-150 px wide. Where each one sits on each cat and pose is the `HEAD` table in `web/photo.js`. `pb_*` (photo backdrops, 900x500) are one 2x2 gen2.py sheet of empty photo corners with a stool in the middle, cropped. `mo_*` (抓拍時刻 photos, 800x470) are three 2x2 gen2.py sheets of candid cat moments painted from the cat sprites, cropped.

## 更多傢俱（fx_*）
`web/assets/fx_<id>.webp` (the 20 pieces in `DECOR`, index.html) were painted in three gen2.py sheets on white, with existing props (lamp, cattree, petbed, beanbag, plant, bookshelf) as the style reference, cut with cut.py and packed at 2.2× their scene width (`DECOR[id].w`). The cloud cat tree is mostly white, so it was painted again on a mint backdrop and cut with threshold -40 to keep its edges. Where each one stands, the floors it may go on, and the stairs and painted walls it keeps clear of are in `web/deco.js` (`STAIR_ZONES`, `PAINTED`).
