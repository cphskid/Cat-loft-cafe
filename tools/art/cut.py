# usage: cut.py in.png n outprefix [thr]  -> outprefix_0.png ... (sorted left->right), trimmed RGBA
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd
src, n, pre = sys.argv[1], int(sys.argv[2]), sys.argv[3]
thr = int(sys.argv[4]) if len(sys.argv) > 4 else 200
minf = float(sys.argv[5]) if len(sys.argv) > 5 else 0.04
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int)
if thr < 0:   # colored backdrop: background = close to the corner colour
    ref = np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)]), axis=0)
    light = np.sqrt(((a - ref) ** 2).sum(axis=2)) < -thr
else:
    light = a.min(axis=2) > thr                     # paper-white or very pale
lab, k = nd.label(light)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
fg = ~bg
fg = nd.binary_opening(fg, iterations=1)
fg = nd.binary_fill_holes(fg)
# group parts of one figure that sit close together
grp, m = nd.label(nd.binary_dilation(fg, iterations=12))
areas = nd.sum(fg, grp, range(1, m + 1))
order = np.argsort(areas)[::-1][:n]
boxes = []
for i in order:
    ys, xs = np.where((grp == i + 1) & fg)
    boxes.append((xs.min(), i, ys.min(), ys.max(), xs.max()))
boxes.sort()
alpha = Image.fromarray((fg * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
rgba = im.copy(); rgba.putalpha(alpha)
A = np.asarray(rgba).copy()
for j, (x0, i, y0, y1, x1) in enumerate(boxes):
    sel = (grp == i + 1) & fg
    cl, cn = nd.label(sel); ca = nd.sum(sel, cl, range(1, cn + 1))
    sel = np.isin(cl, [q + 1 for q in range(cn) if ca[q] > ca.max() * minf])
    ys, xs = np.where(sel); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    sub = A[y0:y1 + 1, x0:x1 + 1].copy()
    sub[..., 3] = np.where(sel[y0:y1 + 1, x0:x1 + 1], sub[..., 3], 0)
    Image.fromarray(sub).save(f'{pre}_{j}.png')
    print(pre, j, x1 - x0 + 1, y1 - y0 + 1, int(areas[i]))
