#!/usr/bin/env python3
"""effects: apply a video effect to your own talking-head clip.

Usage:
  python3 effects.py --input clip.mp4 --effect carousel-spin
  python3 effects.py --input clip.mp4 --effect all                 # all six, one file each
  python3 effects.py --check                                        # check dependencies only

Effects: carousel-spin, match-cut, glass-graph, phone-fan, led-sign, type-behind

Options:
  --out FILE or DIR      where to write (default: next to the input, <name>_<effect>.mp4)
  --broll DIR            images/videos shown on carousel cards and phone screens (default: your own clip, tinted)
  --words "TEXT"         the words for match-cut (paste your script or transcript)
  --highlight "a,b"      words boxed in red in match-cut (default: Claude)
  --title "TEXT"         title box for phone-fan (default: One clip. Six edits.)
  --lines "L1|L2"        LED sign lines for led-sign (default: ONE CLIP|ZERO APPS)
  --word WORD            giant word for type-behind (default: EDIT)
  --color "#hex"         background color for type-behind (default: #D97757)
  --start S --duration D trim the input before editing
  --max-side PX          longest side of the output (default 1920)
  --workers N            parallel render pages (default 3)
  --quality crf          x264 CRF (default 14, lower = higher quality)
"""
import argparse, json, os, shutil, subprocess, sys, glob, math

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(os.path.dirname(HERE), 'engine')
FX = ['carousel-spin', 'match-cut', 'glass-graph', 'phone-fan', 'led-sign', 'type-behind']
NEEDS_CUT = {'carousel-spin', 'match-cut', 'phone-fan', 'led-sign', 'type-behind'}
FPS = 30

def run(cmd, **kw):
    r = subprocess.run(cmd, **kw)
    if r.returncode != 0: sys.exit(f'command failed: {" ".join(map(str, cmd))}')
    return r

def check(fix=True, need_cut=True):
    ok = True
    for b in ('ffmpeg', 'ffprobe', 'node'):
        if not shutil.which(b): print(f'MISSING  {b}  (install it first)'); ok = False
        else: print(f'OK       {b}')
    pw = subprocess.run(['node', '-e', "require('playwright')"], capture_output=True, cwd=ENGINE).returncode == 0 if shutil.which('node') else False
    if not pw and fix and shutil.which('npm'):
        print('...      installing playwright for the renderer (one time)')
        subprocess.run(['npm', 'install', '--no-audit', '--no-fund', 'playwright'], cwd=ENGINE)
        subprocess.run(['npx', 'playwright', 'install', 'chromium'], cwd=ENGINE)
        pw = subprocess.run(['node', '-e', "require('playwright')"], capture_output=True, cwd=ENGINE).returncode == 0
    print(('OK       ' if pw else 'MISSING  ') + 'playwright + chromium'); ok &= pw
    if need_cut:
        try:
            import rembg, onnxruntime  # noqa
            print('OK       rembg (person cutout)')
        except Exception:
            if fix:
                print('...      installing rembg for the person cutout (one time)')
                subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'rembg', 'onnxruntime', 'numpy', 'pillow'] +
                               (['--break-system-packages'] if sys.platform.startswith('linux') else []))
            try:
                import rembg, onnxruntime  # noqa
                print('OK       rembg (person cutout)')
            except Exception:
                print('MISSING  rembg  (pip install rembg onnxruntime)'); ok = False
    return ok

def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration',
                        '-of', 'json', path], capture_output=True, text=True)
    j = json.loads(r.stdout); s = j['streams'][0]
    has_audio = bool(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', path],
                                    capture_output=True, text=True).stdout.strip())
    return int(s['width']), int(s['height']), float(j['format']['duration']), has_audio

def even(x): return int(round(x / 2)) * 2

def cutouts(frames_dir, cut_dir, workers):
    os.makedirs(cut_dir, exist_ok=True)
    todo = [f for f in sorted(glob.glob(os.path.join(frames_dir, 'f*.png'))) if not os.path.exists(os.path.join(cut_dir, os.path.basename(f)))]
    if not todo: return
    print(f'  cutting you out of {len(todo)} frames (first run downloads the cutout model, ~170 MB)')
    from multiprocessing import Pool
    chunks = [todo[k::workers] for k in range(workers)]
    with Pool(workers) as pool: pool.starmap(_cut_chunk, [(c, cut_dir) for c in chunks if c])

def _cut_chunk(files, cut_dir):
    os.environ.setdefault('OMP_NUM_THREADS', '1')
    from rembg import new_session, remove
    from PIL import Image
    s = new_session('u2net_human_seg')
    for f in files:
        im = Image.open(f).convert('RGB'); m = remove(im, session=s, only_mask=True, post_process_mask=True)
        im.putalpha(m); im.save(os.path.join(cut_dir, os.path.basename(f)), compress_level=3)

def rms_per_frame(src, start, dur, nf):
    try:
        import numpy as np
        cmd = ['ffmpeg', '-v', 'error'] + (['-ss', str(start)] if start else []) + ['-i', src] + (['-t', str(dur)] if dur else []) + ['-ac', '1', '-ar', '16000', '-f', 's16le', '-']
        a = np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.int16).astype(np.float32) / 32768
        if not len(a): return [0] * nf
        hop = 16000 // FPS; r = [float(np.sqrt((a[i * hop:(i + 1) * hop] ** 2).mean())) if i * hop < len(a) else 0.0 for i in range(nf)]
        m = max(r) or 1; return [round(min(1, x / m * 1.2), 3) for x in r]
    except Exception:
        return [0.5] * nf

def prep_broll(broll_dir, job):
    items = []
    if not broll_dir or not os.path.isdir(broll_dir): return items
    files = sorted(glob.glob(os.path.join(broll_dir, '*')))
    for i, f in enumerate(files[:12]):
        ext = f.lower().rsplit('.', 1)[-1]
        if ext in ('png', 'jpg', 'jpeg', 'webp'):
            dst = f'broll/i{i:02d}.png'; os.makedirs(os.path.join(job, 'broll'), exist_ok=True)
            run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280', os.path.join(job, dst)])
            items.append({'kind': 'img', 'src': dst})
        elif ext in ('mp4', 'mov', 'm4v', 'webm', 'mkv'):
            d = f'broll/v{i:02d}'; os.makedirs(os.path.join(job, d), exist_ok=True)
            run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-t', '4', '-vf', f'fps={FPS},scale=540:960:force_original_aspect_ratio=increase,crop=540:960', os.path.join(job, d, 'f%05d.png')])
            n = len(glob.glob(os.path.join(job, d, 'f*.png')))
            if n: items.append({'kind': 'seq', 'dir': d, 'n': n})
    return items

def main():
    ap = argparse.ArgumentParser(description='Apply a video effect to your own clip.')
    ap.add_argument('--input'); ap.add_argument('--effect', default='carousel-spin'); ap.add_argument('--out')
    ap.add_argument('--broll'); ap.add_argument('--words'); ap.add_argument('--highlight'); ap.add_argument('--title')
    ap.add_argument('--lines'); ap.add_argument('--word'); ap.add_argument('--color'); ap.add_argument('--start', type=float, default=0)
    ap.add_argument('--duration', type=float); ap.add_argument('--max-side', type=int, default=1920); ap.add_argument('--workers', type=int, default=3)
    ap.add_argument('--quality', type=int, default=14); ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    if a.check: sys.exit(0 if check() else 1)
    if not a.input or not os.path.exists(a.input): sys.exit('give --input path/to/clip.mp4')
    effects = FX if a.effect == 'all' else [e.strip() for e in a.effect.split(',')]
    for e in effects:
        if e not in FX: sys.exit(f'unknown effect "{e}". Choose from: {", ".join(FX)} or all')
    if not check(need_cut=any(e in NEEDS_CUT for e in effects)): sys.exit('fix the missing pieces above, then run again')

    src = os.path.abspath(a.input); stem = os.path.splitext(os.path.basename(src))[0]
    w0, h0, dur0, has_audio = probe(src)
    dur = min(a.duration or dur0 - a.start, dur0 - a.start)
    k = min(1.0, a.max_side / max(w0, h0)); W, H = even(w0 * k), even(h0 * k)
    job = os.path.join(os.path.dirname(src), '.effects_work', stem + (f'_{a.start:g}_{dur:g}' if a.start or a.duration else ''))
    frames = os.path.join(job, 'frames'); os.makedirs(frames, exist_ok=True)
    print(f'clip: {w0}x{h0}, {dur:.2f} s  ->  rendering at {W}x{H}, {FPS} fps')
    if not glob.glob(os.path.join(frames, 'f*.png')):
        print('  extracting frames')
        run(['ffmpeg', '-v', 'error', '-y'] + (['-ss', str(a.start)] if a.start else []) + ['-i', src, '-t', str(dur),
             '-vf', f'fps={FPS},scale={W}:{H}:flags=lanczos', os.path.join(frames, 'f%05d.png')])
    nf = len(glob.glob(os.path.join(frames, 'f*.png')))
    if any(e in NEEDS_CUT for e in effects): cutouts(frames, os.path.join(job, 'cut'), max(1, min(4, os.cpu_count() or 2)))
    for f in os.listdir(ENGINE):
        if f in ('effects.html', 'effects.js'): shutil.copy(os.path.join(ENGINE, f), job)
    if not os.path.exists(os.path.join(job, 'fonts')): shutil.copytree(os.path.join(ENGINE, 'fonts'), os.path.join(job, 'fonts'))
    rms = rms_per_frame(src, a.start, dur, nf) if has_audio else [0.4] * nf
    broll = prep_broll(a.broll, job)

    outs = []
    for e in effects:
        cfg = {'fx': e, 'w': W, 'h': H, 'fps': FPS, 'nf': nf, 'cut': e in NEEDS_CUT, 'rms': rms, 'broll': broll,
               'words': (a.words.split() if a.words else []), 'highlight': ([x.strip() for x in a.highlight.split(',')] if a.highlight else []),
               'title': a.title, 'lines': (a.lines.split('|') if a.lines else []), 'word': a.word, 'color': a.color}
        with open(os.path.join(job, 'cfg.js'), 'w') as fh: fh.write('window.CFG = ' + json.dumps(cfg) + ';')
        rdir = os.path.join(job, 'render_' + e); shutil.rmtree(rdir, ignore_errors=True)
        print(f'{e}:')
        run(['node', os.path.join(ENGINE, 'render.cjs'), job, rdir, str(W), str(H), str(FPS), str(nf), str(a.workers)], cwd=ENGINE)
        if a.out and (a.out.endswith('.mp4') and len(effects) == 1): out = os.path.abspath(a.out)
        else:
            d = os.path.abspath(a.out) if a.out else os.path.dirname(src); os.makedirs(d, exist_ok=True)
            out = os.path.join(d, f'{stem}_{e}.mp4')
        cmd = ['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', os.path.join(rdir, '%05d.png')]
        if has_audio: cmd += (['-ss', str(a.start)] if a.start else []) + ['-t', str(dur), '-i', src, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest']
        cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.quality), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
        run(cmd); shutil.rmtree(rdir, ignore_errors=True)
        print(f'  saved {out}'); outs.append(out)
    print('done:'); [print('  ' + o) for o in outs]

if __name__ == '__main__':
    main()
