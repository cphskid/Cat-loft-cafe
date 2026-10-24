import subprocess, concurrent.futures as cf, os
S='/tmp/claude-0/-home-user-cat-loft-cafe/9fe3dad0-4161-50ee-814c-410c3d9549ce/scratchpad'
O=S+'/gen3'; GEN='/home/user/cat-loft-cafe/tools/art/gen2.py'
COMMON=("Draw in exactly the same hand-drawn watercolor storybook illustration style as the reference picture: soft pencil outlines, gentle watercolor washes, muted warm colors, natural realistic body proportions (about 7 heads tall), small simple face. NOT anime, NOT chibi, no big shiny eyes. "
 "Show the SAME single person three times, side by side from left to right, full body, evenly spaced, on a plain pure white background: "
 "(1) standing still facing the viewer, body turned slightly to the right; (2) walking to the right in side view, mid-stride; (3) sitting on an invisible chair in side view facing right, knees bent, hands resting on the lap. "
 "No chair, no floor, no shadows, no scenery, no text, no frames, no extra people. "
 "The person works at a cat cafe in a traditional Chinese palace building, wearing a cafe uniform inspired by traditional Chinese clothing (a hanfu-style cross-collar top with a sash) plus a short apron. ")
P={
 's3cook':"A young man cook, short black hair, white cross-collar top, a tan apron, a small white cook cap.",
 's3server':"A young woman server, long black hair in a bun with a red hairpin, pale pink cross-collar top, a light green apron.",
 's3cashier':"A young man cashier, neat brown hair, light blue cross-collar top with a navy sash, a beige apron.",
 's3feeder':"A young woman cat caretaker, shoulder-length brown hair with a small braid, peach cross-collar top, a cream apron with a paw print.",
 's3sitter':"A cheerful young man cat sitter, curly light-brown hair, yellow cross-collar top, a red sash, holding nothing.",
}
TOYS=("Draw SIX separate cat toys for an indoor cat playground, side by side in one row, evenly spaced, each one complete and not touching the others, on a plain pure white background, side view, in exactly the same hand-drawn watercolor storybook style as the reference picture (soft pencil outlines, gentle watercolor washes, muted warm colors). No cats, no people, no text, no shadows, no floor. "
 "From left to right: (1) a tall cat tree shaped like a little red Chinese palace tower with golden roofs and round holes, (2) a long rainbow-striped fabric cat tunnel lying on the floor, (3) a wooden spinning feather toy on a stand with colorful feathers, (4) a curved cardboard scratching sofa, (5) a three-level ball track tower with little bells, (6) a cardboard box castle with towers and windows.")
def run(name, prompt, ref, aspect='16:9'):
    out=f'{O}/{name}.png'
    if os.path.exists(out): return name,'skip'
    r=subprocess.run(['python3',GEN,out,aspect,prompt,ref],capture_output=True,text=True)
    return name,r.stdout.strip()[-200:]
jobs=[(k, COMMON+v, f'{S}/s2cook_0.png') for k,v in P.items()]+[('toys', TOYS, f'{S}/styleref.jpeg', '21:9')]
with cf.ThreadPoolExecutor(6) as ex:
    for res in ex.map(lambda j: run(*j), jobs): print(*res, flush=True)
