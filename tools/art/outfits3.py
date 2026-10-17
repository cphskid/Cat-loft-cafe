# usage: outfits3.py (run inside a folder with ref_mgr.png / ref_mgrm.png: the manager stand/walk/sit sprites on white) -> mo7..mo10 sheets
GEN='/home/user/cat-loft-cafe/tools/art/gen2.py'
COMMON=("Draw in exactly the same hand-drawn watercolor storybook illustration style as the reference picture: soft pencil outlines, gentle watercolor washes, muted warm colors, natural realistic body proportions (about 7 heads tall), small simple face. NOT anime, NOT chibi, no big shiny eyes. "
 "Show the SAME single person three times, side by side from left to right, full body, evenly spaced, on a plain pure white background: "
 "(1) standing still facing the viewer, body turned slightly to the right; (2) walking to the right in side view, mid-stride; (3) sitting on an invisible chair in side view facing right, knees bent, hands resting on the lap. "
 "No chair, no floor, no shadows, no scenery, no text, no frames, no extra people.")
F="The person is the same young woman cafe manager as in the reference: same face, same dark brown long hair tied in a low ponytail. Only her clothes change. Her new outfit: "
M="The person is the same young man cafe manager as in the reference: same face, same short tousled dark brown hair. Only his clothes change. His new outfit: "
J={
 'mo7': (F,"a cream colored hoodie with small cat ears on the hood (hood down on the back), a light brown pleated skirt, white socks and brown loafers."),
 'mo7m':(M,"a cream colored hoodie with small cat ears on the hood (hood down on the back), light brown chino trousers, brown loafers."),
 'mo8': (F,"a brown and cream tartan plaid pinafore dress over a white blouse with a round collar, dark tights, brown mary-jane shoes."),
 'mo8m':(M,"a brown and cream tartan plaid knit vest over a white shirt, a small brown bow tie, dark brown trousers, brown shoes."),
 'mo9': (F,"a professional barista look: a black shirt with rolled sleeves, a dark indigo denim apron with leather straps and a coffee bean embroidery, black trousers, black shoes."),
 'mo9m':(M,"a professional barista look: a black shirt with rolled sleeves, a dark indigo denim apron with leather straps and a coffee bean embroidery, black trousers, black shoes."),
 'mo10': (F,"a cute Halloween witch costume: a tall pointed black witch hat with an orange band and a small pumpkin, a deep purple dress with orange trim and tiny bat prints, a short black cape, striped orange and black stockings, black ankle boots."),
 'mo10m':(M,"a cute Halloween wizard costume: a tall pointed black wizard hat with an orange band and a small pumpkin, a deep purple robe-jacket with orange trim and tiny bat prints, a short black cape, black trousers, black ankle boots."),
}
def run(k):
    out=f'{k}.png'
    if os.path.exists(out): return k,'skip'
    pre,desc=J[k]; ref='ref_mgrm.png' if k.endswith('m') else 'ref_mgr.png'
    r=subprocess.run(['python3',GEN,out,'16:9',COMMON+' '+pre+desc,ref],capture_output=True,text=True)
    return k,r.stdout.strip()[-200:]
with cf.ThreadPoolExecutor(8) as ex:
    for res in ex.map(run, J): print(*res, flush=True)
