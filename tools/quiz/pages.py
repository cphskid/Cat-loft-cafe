# usage: python3 tools/quiz/pages.py  -> web/q/index.html and web/q/<type>/index.html (one share page per 喵型)
# Each share page has its own og:image (web/q/og/<type>.jpg, drawn by tools/quiz/og.js) so LINE / FB show that card.
# Type names and texts come from web/quiz.js; keep the TYPES list below in step with it (id, name, say).
import os, html
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'q')
SITE = 'https://catloftcafe.ciyulab.com/'
TYPES = [('lazy', '好吃懶做喵', '吃飽睡、睡飽吃，人生就是要舒服'), ('gourmet', '美食評論喵', '這塊蛋糕，我給四顆半星'), ('clingy', '撒嬌黏黏喵', '摸摸我，順便給我零食'),
         ('guardian', '暖心守護喵', '有我在，別怕'), ('party', '派對社交喵', '哪裡熱鬧哪裡就有我'), ('watcher', '默默觀察喵', '我都看在眼裡喔'),
         ('homebody', '社恐宅宅喵', '今天也不想出門'), ('explorer', '好奇探險喵', '那邊是什麼？我去看看！'), ('noble', '優雅貴族喵', '請保持距離，謝謝'),
         ('prankster', '調皮搗蛋喵', '不是我弄的（尾巴在搖）'), ('quirky', '古靈精怪喵', '猜不到我下一步吧'), ('dreamy', '夢遊雲朵喵', '抱著我，我就睡著了')]

PAGE = open(os.path.join(os.path.dirname(__file__), 'page.html'), encoding='utf-8').read()

def write(path, up, tid, title, desc, url, img, w, h):
    out = (PAGE.replace('{{UP}}', up).replace('{{TYPE}}', tid).replace('{{TITLE}}', html.escape(title)).replace('{{DESC}}', html.escape(desc))
           .replace('{{URL}}', url).replace('{{IMG}}', img).replace('{{W}}', str(w)).replace('{{H}}', str(h)))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(out)

write(os.path.join(ROOT, 'index.html'), '../', '', '測測你是哪一種喵？｜暖陽貓閣喵型測驗', '8 題、1 分鐘，看看你是好吃懶做喵還是派對社交喵。測完到暖陽貓閣領一隻跟你同個性的本命貓！',
      SITE + 'q/', SITE + 'about/media/og.jpg', 1200, 630)
for tid, name, say in TYPES:
    write(os.path.join(ROOT, tid, 'index.html'), '../../', tid, f'我是「{name}」！｜暖陽貓閣喵型測驗', f'「{say}」你是哪一種喵？8 題、1 分鐘，測完到暖陽貓閣領你的本命貓。',
          f'{SITE}q/{tid}/', f'{SITE}q/og/{tid}.jpg', 1080, 1350)
print('ok', len(TYPES) + 1, 'pages')
