"""Prepare runtime MP3 takes and measure instrument roots. Requires numpy and imageio-ffmpeg."""
import argparse
import hashlib
import os
import csv
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'audio'
BANKS = sorted((ROOT / 'audio-design').glob('*-bank.txt'))
LOOPS = set()

def prepare_take(name, source, encoder, mode=None):
    import numpy as np
    raw = np.frombuffer(subprocess.check_output([encoder, '-v', 'error', '-i', str(source), '-ar', '44100', '-ac', '2', '-f', 'f32le', 'pipe:1']), dtype='<f4').reshape(-1, 2).copy()
    if not len(raw) or not np.isfinite(raw).all():
        raise RuntimeError('Invalid sound: '+name)
    # A texture take has an intentional lead-in and release. Use its active
    # middle for the loop, then crossfade the decoded ends in Web Audio.
    if mode == 'texture' and len(raw) > 44100:
        raw = raw[8820:-11025]
    # Provider takes often contain pre-roll or a long silent pad. Keep the soft
    # attack and a short natural release instead of making contact feel late.
    frames = np.array([np.sqrt(np.mean(frame**2)) for frame in np.array_split(raw, max(1, len(raw)//220))])
    audible = np.flatnonzero(frames > max(.0005, float(frames.max())*.025))
    if not len(audible):
        raise RuntimeError('Silent sound: '+name)
    start=max(0, int(audible[0]*len(raw)/len(frames))-350)
    end=min(len(raw), int((audible[-1]+1)*len(raw)/len(frames))+2205)
    raw=raw[start:end]
    if name in LOOPS:
        # Level the texture over 100 ms windows, with interpolated gain, so a
        # quiet syrup ribbon does not disappear between isolated sticky folds.
        frames = np.array_split(raw, max(1, len(raw)//4410))
        levels = np.array([np.sqrt(np.mean(frame**2)) for frame in frames])
        gains = np.minimum(6, .045/np.maximum(.001, levels))
        raw *= np.interp(np.arange(len(raw)), (np.arange(len(frames))+.5)*len(raw)/len(frames), gains)[:,None]
    rms=float(np.sqrt(np.mean(raw**2)));peak=float(np.abs(raw).max())
    raw *= min(4 if name.startswith('instrument.') else 32, .065/max(.00001,rms), .50/max(.00001,peak))
    family = name.split('@')[0]
    attack_ms, cutoff = 3, 10500
    if family == 'field.step':
        attack_ms, cutoff = 20, 1800
    elif family == 'field.berry-pluck':
        attack_ms, cutoff = 12, 2600
    elif family == 'field.soil-sprinkle':
        attack_ms, cutoff = 20, 4800
    elif family == 'field.grain-pick':
        attack_ms, cutoff = 12, 2500
    elif family == 'gather.shell':
        attack_ms, cutoff = 10, 3500
    elif family.startswith(('field.root','field.grain','field.pumpkin','field.leaf','field.crop')):
        attack_ms, cutoff = 10, 4000
    elif family == 'field.refill':
        attack_ms, cutoff = 15, 5000
    elif family in ('angling.lower','angling.raise'):
        attack_ms, cutoff = 50, 1550 if family == 'angling.lower' else 1150
    elif family.startswith(('page.','menu.')):
        attack_ms, cutoff = (32, 1700) if family.startswith('page.') else (12, 3100)
    fade = min(round(44.1 * attack_ms), len(raw)//6)
    release = min(400,len(raw)//6)
    raw[:fade] *= np.linspace(0,1,fade)[:,None]
    raw[-release:] *= np.linspace(1,0,release)[:,None]
    target = OUT / (name + '.part.mp3')
    filters = f'highpass=f=48,lowpass=f={cutoff}'
    if family == 'field.berry-pluck':
        filters += ',highpass=f=210,lowshelf=f=300:g=-6,lowpass=f=2600'
    if family == 'field.grain-pick':
        filters += f',lowpass=f={cutoff}'
    if family.startswith('page.') or family in ('angling.lower','angling.raise'):
        filters += f',lowpass=f={cutoff},volume=-4dB'
    if family.startswith(('field.','gather.','orchard.','flock.','apiary.')):
        filters += ',highshelf=f=4800:g=-3'
    if name.startswith('instrument.shaker'):
        filters += ',highshelf=f=5000:g=-7,lowpass=f=10000'
    if name.startswith('instrument.handpan'):
        filters += ',lowpass=f=4200'
    filters += ',alimiter=limit=0.50:level=0:latency=1'
    subprocess.run([encoder, '-loglevel','error','-y','-f','f32le','-ar','44100','-ac','2','-i','pipe:0','-af',filters,'-ar','44100','-ac','2','-b:a','128k',str(target)],input=raw.astype('<f4').tobytes(),check=True)
    if target.stat().st_size < 700:
        raise RuntimeError('Empty sound: '+name)
    target.replace(OUT / (name+'.mp3'))

def bank_manifest(rows, encoder):
    import math
    import numpy as np
    manifest = {}
    pitch_report = {}
    for row in rows:
        name = row['id']
        path = OUT / (name + '.mp3')
        if not path.is_file():
            continue
        entry = {'url': './'+path.name, 'gain': float(row['gain']), 'revision': hashlib.sha256(path.read_bytes()).hexdigest()[:12]}
        if name in LOOPS:
            entry['loop'] = True
        key = name.split('-')[0]
        if not name.startswith('instrument.'):
            manifest.setdefault(name.split('@')[0],[]).append(entry)
            continue
        if key not in ('instrument.shaker','instrument.ceramic'):
            # Compare multiple windows after attack. Some bass takes have a louder second harmonic.
            samples = np.frombuffer(subprocess.check_output([encoder,'-loglevel','error','-i',str(path),'-ar','24000','-ac','1','-f','f32le','pipe:1']),dtype='<f4')
            fundamentals = []
            for start in (500, 850, 1350, 1800):
                frame = samples[start:start+4096]
                if len(frame) < 4096 or np.max(np.abs(frame)) < .001:
                    continue
                spectrum = np.abs(np.fft.rfft(frame*np.hanning(len(frame)),32768))
                band = spectrum[55:2200]
                peak = int(np.argmax(band))+55
                half = peak//2
                if key == 'instrument.bass' and spectrum[half-2:half+3].max() > .32*spectrum[peak]:
                    peak = int(np.argmax(spectrum[half-4:half+5]))+half-4
                left, mid, right = np.log(np.maximum(1e-10,spectrum[peak-1:peak+2]))
                fraction = .5*(left-right)/(left-2*mid+right)
                fundamentals.append((peak+fraction)*24000/32768)
            if len(fundamentals)<2 or max(fundamentals)/min(fundamentals)>1.035:
                raise RuntimeError('Unstable instrument pitch: '+name)
            hz = float(np.median(fundamentals))
            entry.update(rootMidi=round(69+12*math.log2(hz/440),3), tuned=True)
            pitch_report[name] = round(hz,2)
        manifest.setdefault(key,[]).append(entry)
    temporary = OUT / f'.bank-{os.getpid()}.tmp'
    temporary.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    temporary.replace(OUT/'bay-samples.json')
    print('Measured fundamentals (Hz):',pitch_report,flush=True)

def main():
    import imageio_ffmpeg
    parser = argparse.ArgumentParser()
    parser.add_argument('--take')
    parser.add_argument('--source',type=Path)
    args = parser.parse_args()
    rows = [row for path in BANKS for row in csv.DictReader(path.read_text(encoding='utf-8-sig').splitlines(),delimiter='|')]
    global LOOPS
    LOOPS = {row['id'] for row in rows if row.get('mode') in ('loop', 'texture')}
    encoder = imageio_ffmpeg.get_ffmpeg_exe()
    if args.take:
        if args.take not in {row['id'] for row in rows} or not args.source:
            raise SystemExit('Choose an existing sound-bank entry and source recording')
        mode = next(row.get('mode') for row in rows if row['id'] == args.take)
        prepare_take(args.take, args.source, encoder, mode)
    else:
        bank_manifest(rows, encoder)

if __name__=='__main__':
    main()
