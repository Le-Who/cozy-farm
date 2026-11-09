"""Measure the shipped bank after MP3 decoding; no provider account is accessed."""
import json
import argparse
import csv
import subprocess
from pathlib import Path
import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--directory', type=Path, default=ROOT / 'public/audio')
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
encoder = imageio_ffmpeg.get_ffmpeg_exe()
report = []
for path in sorted(args.directory.glob('*.mp3')):
    data = np.frombuffer(subprocess.check_output([encoder, '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', '44100', 'pipe:1']), dtype='<f4').reshape(-1, 2)
    windows = np.array([np.sqrt(np.mean(frame ** 2)) for frame in np.array_split(data, max(1, len(data) // 441))])
    audible = np.flatnonzero(windows > max(.0005, windows.max() * .025))
    # Sum power across stereo channels; downmixing can cancel a narrow whistle.
    frame_size = min(2048,len(data))
    spectral_frames = np.lib.stride_tricks.sliding_window_view(data, frame_size, axis=0)[::max(1,frame_size//2)]
    spectrum = np.mean(abs(np.fft.rfft(spectral_frames*np.hanning(frame_size),axis=-1))**2, axis=(0,1))
    hz = np.fft.rfftfreq(frame_size, 1/44100)
    upper = 100*spectrum[(hz>=2000)&(hz<=6500)].sum()/max(1e-12,spectrum.sum())
    dominant = hz[np.argmax(spectrum)]
    report.append(dict(id=path.stem, upperMidPercent=round(float(upper),3), dominantHz=round(float(dominant)), bytes=path.stat().st_size, seconds=round(len(data)/44100, 3), peakDb=round(float(20*np.log10(max(1e-9, np.abs(data).max()))), 2), rmsDb=round(float(20*np.log10(max(1e-9, np.sqrt(np.mean(data**2)))))), onsetMs=int(audible[0]*10) if len(audible) else None, tailMs=int((len(windows)-1-audible[-1])*10) if len(audible) else None))
if args.check:
    manifest = json.loads((args.directory/'bay-samples.json').read_text(encoding='utf-8'))
    referenced = {Path(sample['url']).name for entries in manifest.values() for sample in (entries if isinstance(entries,list) else [entries])}
    present = {row['id']+'.mp3' for row in report}
    bank = {row['id']+'.mp3' for bank_file in (ROOT/'audio-design').glob('*-bank.txt') for row in csv.DictReader(bank_file.read_text(encoding='utf-8-sig').splitlines(),delimiter='|')}
    assert referenced == present == bank, {'missing':sorted(bank-present), 'unreferenced':sorted(present-referenced), 'unknown':sorted(present-bank)}
    effects = [row for row in report if not row['id'].startswith('instrument.')]
    assert all(row['peakDb'] <= -3 for row in effects), 'Effect exceeds decoded stereo peak ceiling'
    for row in effects:
        assert row['onsetMs'] is not None, f"Silent take: {row['id']}"
        if row['id'].startswith(('page.','angling.lower','angling.raise')):
            assert row['upperMidPercent'] < 12 and row['dominantHz'] < 1800, f"Recheck upper-mid fatigue: {row}"
    print(json.dumps({'takes':len(report),'effects':len(effects),'bytes':sum(row['bytes'] for row in report),'maximumEffectPeakDb':max(row['peakDb'] for row in effects),'missing':[],'unreferenced':[]},indent=2))
else:
    print(json.dumps(report, indent=2))
