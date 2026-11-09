"""Prepare runtime MP3 takes and measure instrument roots. Requires numpy and imageio-ffmpeg."""
import argparse
import csv
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'audio'
BANK = ROOT / 'audio-design' / 'sound-bank.txt'
LOOPS = ('kitchen.grill@2','kitchen.stir@2','kitchen.honey@3','workshop.roll@2')

def prepare_take(name, source, encoder):
    import numpy as np
    raw = np.frombuffer(subprocess.check_output([encoder, '-v', 'error', '-i', str(source), '-ar', '44100', '-ac', '2', '-f', 'f32le', 'pipe:1']), dtype='<f4').reshape(-1, 2).copy()
    if not len(raw) or not np.isfinite(raw).all():
        raise RuntimeError('Invalid sound: '+name)
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
    raw *= min(4, .065/max(.00001,rms), .50/max(.00001,peak))
    fade=min(132,len(raw)//8);raw[:fade]*=np.linspace(0,1,fade)[:,None];raw[-fade:]*=np.linspace(1,0,fade)[:,None]
    target = OUT / (name + '.part.mp3')
    filters = 'highpass=f=48,lowpass=f=10500'
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
        entry = {'url': './'+path.name, 'gain': float(row['gain'])}
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
    (OUT/'bay-samples.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print('Measured fundamentals (Hz):',pitch_report,flush=True)

def main():
    import imageio_ffmpeg
    parser = argparse.ArgumentParser()
    parser.add_argument('--take')
    parser.add_argument('--source',type=Path)
    args = parser.parse_args()
    rows = list(csv.DictReader(BANK.read_text(encoding='utf-8-sig').splitlines(),delimiter='|'))
    encoder = imageio_ffmpeg.get_ffmpeg_exe()
    if args.take:
        if args.take not in {row['id'] for row in rows} or not args.source:
            raise SystemExit('Choose an existing sound-bank entry and source recording')
        prepare_take(args.take, args.source, encoder)
    else:
        bank_manifest(rows, encoder)

if __name__=='__main__':
    main()
