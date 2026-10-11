# usage: people2m.py [male_ref.png]  -> mo1m.png..mo6m.png sheets (male manager outfits, matching people2.py's female ones)
import subprocess, sys, concurrent.futures as cf, os
GEN=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gen2.py')
COMMON=("Draw in exactly the same hand-drawn watercolor storybook illustration style as the reference picture: soft pencil outlines, gentle watercolor washes, muted warm colors, natural realistic body proportions (about 7 heads tall), small simple face. NOT anime, NOT chibi, no big shiny eyes. "
 "Show the SAME single person three times, side by side from left to right, full body, evenly spaced, on a plain pure white background: "
 "(1) standing still facing the viewer, body turned slightly to the right; (2) walking to the right in side view, mid-stride; (3) sitting on an invisible chair in side view facing right, knees bent, hands resting on the lap. "
 "No chair, no floor, no shadows, no scenery, no text, no frames, no extra people.")
MGR="The person is the same young man cafe manager as in the reference: same face, same short tousled dark brown hair. Only his clothes change. His new outfit: "
OUT={
 'mo1m':"a cozy oatmeal knitted sweater with a small cat face on the chest, dark brown trousers, brown shoes.",
 'mo2m':"a pale yellow short-sleeved shirt with a tiny strawberry print and a white cafe apron tied at the waist, light beige trousers, white sneakers.",
 'mo3m':"a navy blue Japanese summer yukata for men with a subtle white morning-glory pattern and a grey obi sash, wooden sandals.",
 'mo4m':"a white double-breasted pastry chef jacket, a tall white chef hat, black trousers, black shoes.",
 'mo5m':"a red Christmas knit sweater with a white snowflake and cat pattern, a green scarf, dark jeans, brown boots.",
 'mo6m':"a sage green linen shirt with rolled sleeves, cream linen trousers, a straw sun hat with a ribbon, a little woven basket bag, sandals.",
}
def run(k):
    out=f'{k}.png'
    if os.path.exists(out): return k,'skip'
    r=subprocess.run(['python3',GEN,out,'16:9',COMMON+' '+MGR+OUT[k],sys.argv[1] if len(sys.argv)>1 else 'male.png'],capture_output=True,text=True)
    return k,r.stdout.strip()[-200:]
with cf.ThreadPoolExecutor(6) as ex:
    for res in ex.map(run, OUT): print(*res, flush=True)
