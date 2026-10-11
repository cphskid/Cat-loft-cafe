import subprocess, sys, concurrent.futures as cf, os
# usage: people2.py <dir>  (dir holds ref_mgr.png / ref_guest.png; sheets are written there)
SP=sys.argv[1] if len(sys.argv) > 1 else '.'
GEN=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gen2.py')
COMMON=("Draw in exactly the same hand-drawn watercolor storybook illustration style as the reference picture: soft pencil outlines, gentle watercolor washes, muted warm colors, natural realistic body proportions (about 7 heads tall), small simple face. NOT anime, NOT chibi, no big shiny eyes. "
 "Show the SAME single person three times, side by side from left to right, full body, evenly spaced, on a plain pure white background: "
 "(1) standing still facing the viewer, body turned slightly to the right; (2) walking to the right in side view, mid-stride; (3) sitting on an invisible chair in side view facing right, knees bent, hands resting on the lap. "
 "No chair, no floor, no shadows, no scenery, no text, no frames, no extra people.")
MGR=("The person is the same young woman cafe manager as in the reference: same face, same dark brown long hair tied in a low ponytail. Only her clothes change. Her new outfit: ")
OUTFITS={
 'mo1':"a cozy oatmeal knitted sweater with a small cat face on the chest, dark brown long skirt, brown shoes.",
 'mo2':"a pale yellow summer dress with a tiny strawberry print and a white cafe apron tied at the waist, white sneakers.",
 'mo3':"a soft blue Japanese summer yukata with white morning-glory flowers and a pink obi sash, wooden sandals.",
 'mo4':"a white double-breasted pastry chef jacket, a tall white chef hat, black trousers, black shoes.",
 'mo5':"a red Christmas knit sweater with a white snowflake and cat pattern, a green scarf, dark jeans, brown boots.",
 'mo6':"a sage green linen shirt dress, a straw sun hat with a ribbon, a little woven basket bag, sandals.",
}
GUESTS={
 'c9': "a young man photographer, short messy hair, khaki fishing vest over a grey t-shirt, a big camera hanging around his neck, dark jeans.",
 'c10':"a cheerful young woman cat blogger, short bob hair, pink cardigan, holding a smartphone, a tote bag with a cat print.",
 'c11':"a little primary-school boy about 8 years old, yellow school cap, red backpack, white shirt and navy shorts (child proportions).",
 'c12':"a sporty teenage girl, high ponytail, light blue track jacket, white sneakers, a water bottle.",
 'c13':"an elderly gentleman food critic, round glasses, grey beard, tweed jacket with a bow tie, holding a small leather notebook.",
 'c14':"a tall European backpacker tourist, blond hair, big hiking backpack, holding a folded paper map, shorts and boots.",
 'c15':"a graceful elderly lady in a purple kimono with a crane pattern, grey hair in a neat bun, holding a folding fan.",
 'c16':"a handsome young pastry chef visiting on his day off, wavy hair, white shirt with rolled sleeves, a dessert box tied with ribbon.",
 'c17':"a TV news presenter woman, neat shoulder-length hair, navy blazer and skirt, holding a microphone with a station flag.",
 'c18':"a famous painter, a man with a black beret, paint-splattered smock, holding a sketchbook and a pencil.",
 'c19':"a kind cat doctor, a middle-aged woman with glasses, long white lab coat, a stethoscope, a small cat-shaped pin.",
 'c20':"a mysterious old gentleman, black top hat, long dark coat, a walking cane, a white mustache, a ginger cat sitting on his shoulder.",
}
def run(name, prompt, ref):
    out=f'{SP}/{name}.png'
    if os.path.exists(out): return name,'skip'
    r=subprocess.run(['python3',GEN,out,'16:9',prompt,ref],capture_output=True,text=True)
    return name,r.stdout.strip()[-200:]
jobs=[(k, COMMON+' '+MGR+v, f'{SP}/ref_mgr.png') for k,v in OUTFITS.items()]
jobs+=[(k, COMMON+' The person: '+v, f'{SP}/ref_guest.png') for k,v in GUESTS.items()]
with cf.ThreadPoolExecutor(6) as ex:
    for res in ex.map(lambda j: run(*j), jobs): print(*res, flush=True)
