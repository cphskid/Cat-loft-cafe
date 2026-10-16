# 宣傳影片與介紹頁素材

介紹頁在 `web/about/`（上線網址 https://catloftcafe.ciyulab.com/about/），影片和截圖都是用這裡的腳本從真的遊戲錄出來的。

## 怎麼做的
- `record.js`：用 Playwright 開遊戲，假時鐘一格一格往前推（每秒 30 格），每格截圖。遊戲照常跑，只是腳本會代替玩家操作：開店、做甜點、收銀找錢、上 2F 摸貓、開手機。字幕、點擊圈圈和結尾卡是錄影時蓋在畫面上的。
- `story_land.js`（橫式 62 秒）／`story_port.js`（直式 31 秒）：分鏡表，幾秒做什麼、字幕寫什麼都在這裡改。
- `drivers.js`：小遊戲自動操作（做甜點看準火候、收銀算找錢）。
- `common.js`：錄影用的存檔（第 12 天、5 位員工、7 隻貓）；錄影時擋掉雲端存檔，不會寫到真的資料庫。
- `mix.py`：配樂（遊戲主題曲）＋錄影時遊戲真的播出的音效，對齊時間混成一軌。
- `og.js`：分享到 LINE／FB 時的預覽圖。

## 重新產生
在 `web/` 開本機伺服器：`python3 -m http.server 8765`，然後在這個資料夾：

```
node record.js land            # 橫式，frames_land/
node record.js port            # 直式，frames_port/
node record.js land stills     # 介紹頁截圖，stills_land/
python3 mix.py land 62 title && python3 mix.py port 31 title
ffmpeg -framerate 30 -i frames_land/%05d.jpg -i audio_land.m4a -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -c:a copy -shortest -movflags +faststart ../../web/about/media/promo.mp4
ffmpeg -framerate 30 -i frames_port/%05d.jpg -i audio_port.m4a -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -c:a copy -shortest -movflags +faststart ../../web/about/media/promo-vertical.mp4
```
`node record.js land preview` 每秒只存一張，用來快速檢查分鏡。
