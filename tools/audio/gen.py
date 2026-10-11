#!/usr/bin/env python3
"""Generate 暖陽貓閣 music, ambience and sound effects with ElevenLabs.

Usage: python3 tools/audio/gen.py [name ...]   (no names = everything missing)
Raw API output goes to tools/audio/raw/, web-ready files to web/assets/audio/.
Needs ELEVENLABS_API_KEY (or a proxy that injects it).
"""
import json, os, re, subprocess, sys, urllib.request, concurrent.futures as cf

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', '..', 'web', 'assets', 'audio')
API = 'https://api.elevenlabs.io/v1'
SPEC = json.load(open(os.path.join(HERE, 'sounds.json'), encoding='utf-8'))


def post(path, body):
    hdr = {'Content-Type': 'application/json'}
    if os.environ.get('ELEVENLABS_API_KEY'):
        hdr['xi-api-key'] = os.environ['ELEVENLABS_API_KEY']
    req = urllib.request.Request(API + path, json.dumps(body).encode(), hdr)
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.read()


def jobs():
    for k, v in SPEC['music'].items():
        yield k, 'music', lambda v=v: post('/music?output_format=mp3_44100_128', {
            'prompt': v['prompt'], 'music_length_ms': v['len'] * 1000, 'model_id': 'music_v1', 'force_instrumental': True})
    for k, v in SPEC['ambience'].items():
        yield k, 'amb', lambda v=v: post('/sound-generation?output_format=mp3_44100_128', {
            'text': v['prompt'], 'duration_seconds': v['len'], 'loop': True, 'prompt_influence': 0.4})
    for k, (dur, text) in SPEC['sfx'].items():
        yield k, 'sfx', lambda d=dur, t=text: post('/sound-generation?output_format=mp3_44100_128', {
            'text': t, 'duration_seconds': d, 'prompt_influence': 0.5})


def finish(name, kind):
    src, dst = os.path.join(RAW, name + '.mp3'), os.path.join(OUT, name + '.mp3')
    if kind == 'music':   # fade the ends so the loop seam is soft
        dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]))
        af, br, ch = f'afade=t=in:d=0.3,afade=t=out:st={dur - 2.5:.2f}:d=2.5,loudnorm=I=-20:TP=-2', '96k', '2'
    elif kind == 'amb':
        af, br, ch = 'loudnorm=I=-28:TP=-6', '48k', '1'
    else:                 # trim silence at both ends, peak-normalise to -3 dB
        trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse'
        if duration(src, trim) < 0.15:
            trim = 'anull'   # very quiet clip: keep it whole
        af, br, ch = f'{trim},volume={-3 - peak(src, trim):.1f}dB', '64k', '1'
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', af, '-ac', ch, '-ar', '44100', '-b:a', br, dst])


def measure(src, af):
    return subprocess.run(['ffmpeg', '-i', src, '-af', af + ',volumedetect,ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr


def peak(src, af):
    return float(re.search(r'max_volume: (-?[\d.]+) dB', measure(src, af)).group(1))


def duration(src, af):
    t = re.findall(r'time=(\d+):(\d+):([\d.]+)', measure(src, af))
    return int(t[-1][0]) * 3600 + int(t[-1][1]) * 60 + float(t[-1][2]) if t else 0


def main():
    os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    if sys.argv[1:2] == ['--refinish']:   # re-run only the ffmpeg step on existing raw files
        kinds = {n: k for n, k, _ in jobs()}
        for n in sys.argv[2:] or kinds:
            if os.path.exists(os.path.join(RAW, n + '.mp3')): finish(n, kinds[n])
        return
    want = set(sys.argv[1:])
    todo = [(n, k, f) for n, k, f in jobs() if (n in want) or (not want and not os.path.exists(os.path.join(RAW, n + '.mp3')))]

    def run(job):
        n, k, f = job
        try:
            data = f()
            open(os.path.join(RAW, n + '.mp3'), 'wb').write(data)
            finish(n, k)
            return n, 'ok', len(data)
        except Exception as e:
            return n, 'FAIL', str(e)[:200]

    with cf.ThreadPoolExecutor(int(os.environ.get("WORKERS", "2"))) as ex:
        for r in ex.map(run, todo):
            print(*r, flush=True)


if __name__ == '__main__':
    main()
