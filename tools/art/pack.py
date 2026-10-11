import sys, os
from PIL import Image
OUT='/home/user/cat-loft-cafe/web/assets'; os.makedirs(OUT, exist_ok=True)
def save(im, name, q=86): im.save(f'{OUT}/{name}.webp', quality=q, method=6)
def people():
    for pid in 'mgr mgrm cook server cashier feeder sitter c1 c2 c3 c4 c5 c6 c7 c8'.split():
        ims=[Image.open(f'cut/{pid}_{i}.png') for i in range(3)]
        s=300/ims[0].height
        for i,im in enumerate(ims):
            w,h=im.width*s, im.height*s
            if i==2:
                th=(204 if pid.startswith('c') else 228); w,h=im.width*th/im.height, th
            save(im.resize((round(w),round(h)),Image.LANCZOS), f'{pid}_{i}')
def cats():
    for k in 'orange tux fluffy calico gray tabby milk'.split():
        ims=[Image.open(f'cut/cat_{k}_{i}.png') for i in range(5)]
        s=160/ims[0].width
        for i,im in enumerate(ims): save(im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS), f'cat_{k}_{i}')
def props(spec):
    for src,name,w in spec:
        im=Image.open(f'cut/{src}.png'); s=w/im.width
        save(im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS), name)
def icons(spec):
    for src,name in spec:
        im=Image.open(f'cut/{src}.png'); save(im.resize((144,144),Image.LANCZOS), 'ic_'+name)
what=sys.argv[1]
if what=='people': people()
if what=='cats': cats()
if what=='props1': props([('p1_0','counter',420),('p1_1','bowl',120),('p1_2','table',180),('p1_3','litter',150),('p1_4','basket',140),('p1_5','cushion',150)])
if what=='icons1': icons([('i1_0','menu'),('i1_1','wallet'),('i1_2','shop'),('i1_3','music'),('i1_4','hire'),('i1_5','myshop'),('i1_6','promo')])
if what=='rest':
    cats()
    props([('p2_0','record',150),('p2_1','warmer',120),('p2_2','petbed',140),('p2_3','deodor',80),('p2_4','lightbox',120),('p2_5','plant',100)])
    for i,n in enumerate(['badge','game','phone','cats','daily','save','review']):
        Image.open(f'cut/j2_{i}.png').resize((144,144),Image.LANCZOS).save(f'{OUT}/ic_{n}.webp',quality=86,method=6)
if what=='props3': props([('p3_0','lamp',90),('p3_1','cattree',200),('p3_2','chalkboard',110),('p3_3','bookshelf',180)])
