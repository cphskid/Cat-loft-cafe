# Mix the game's own music + the sound effects the game fired while recording (logged per frame) into one track.
import json, subprocess, sys, numpy as np
mode, length, music = sys.argv[1], float(sys.argv[2]), sys.argv[3]
import os
A = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../web/assets/audio/')
SR, FPS = 44100, 30
VOL = dict(ui_click=.35, app_switch=.4, purr=.45, cat_highfive=.5, fan=.5, sofa=.5, phone_open=.5, phone_close=.5, door_bell=.55, leave=.45, order=.6,
           litter=.6, kibble=.6, cat_eat=.8, whisk=.8, morning=.7, day_end=.9)
def load(name):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', A + name + '.mp3', '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768
n = int(length * SR); out = np.zeros((n, 2), np.float32)
m = load(music)[:n] * .5
fade = int(2.5 * SR); m[-fade:] *= np.linspace(1, 0, fade)[:, None]
out[:len(m)] += m
cache, last = {}, {}
SKIP = {'badge', 'fan', 'stars', 'leave', 'cat_grumpy', 'quest', 'alert', 'notify'}
for e in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), f'frames_{mode}/sfx.json'))):
    t = e['t'] / FPS
    if e['quiet'] or e['name'] in SKIP or t >= length - .3 or t - last.get(e['name'], -9) < .9 or t - last.get('*', -9) < .15: continue
    last[e['name']] = last['*'] = t
    b = cache.get(e['name']) if e['name'] in cache else cache.setdefault(e['name'], load(e['name']))
    g = VOL.get(e['name'], .7) * (.3 if e['quiet'] else 1) * .75
    i = int(t * SR); seg = b[: n - i] * g; out[i:i + len(seg)] += seg
peak = np.abs(out).max(); out *= min(1, .95 / peak)
out = (out * 32767).astype(np.int16)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ac', '2', '-ar', str(SR), '-i', '-', '-c:a', 'aac', '-b:a', '160k', f'audio_{mode}.m4a'], input=out.tobytes())
print('peak', peak)
