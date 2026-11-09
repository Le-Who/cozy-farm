"""Make absorbed-earth watering variants from accepted ElevenLabs drops and quiet loam."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
import imageio_ffmpeg
import numpy as np

root = Path(__file__).resolve().parents[1]
sources = root / 'audio-design/provider-takes'
encoder = imageio_ffmpeg.get_ffmpeg_exe()


def decode(name, filters):
    return np.frombuffer(subprocess.check_output([
        encoder, '-v', 'error', '-i', str(sources / (name + '.mp3')),
        '-af', filters, '-ar', '44100', '-ac', '2', '-f', 'f32le', 'pipe:1',
    ]), dtype='<f4').reshape(-1, 2).copy()


for suffix in ('', '@2'):
    target = 'field.can-soil' + suffix
    drops = decode('field.can-pour' + suffix, 'lowpass=f=2200')
    soil = decode('field.till' + suffix, 'highpass=f=180,lowpass=f=1400')
    drops *= .055 / max(.00001, float(np.sqrt(np.mean(drops ** 2))))
    soil *= .004 / max(.00001, float(np.sqrt(np.mean(soil ** 2))))
    result = drops.copy()
    count = min(len(result) - 1323, len(soil))
    result[1323:1323 + count] += soil[:count]
    path = sources / (target + '.mp3')
    subprocess.run([
        encoder, '-v', 'error', '-y', '-f', 'f32le', '-ar', '44100', '-ac', '2',
        '-i', 'pipe:0', '-b:a', '192k', str(path),
    ], input=result.astype('<f4').tobytes(), check=True)
    components = ['field.can-pour' + suffix, 'field.till' + suffix]
    (sources / (target + '.json')).write_text(json.dumps({
        'id': target, 'provider': 'ElevenLabs-derived composite',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'recipe': '2.2 kHz absorbed droplets, 180–1400 Hz loam at -22.8 dB relative RMS, delayed 30 ms',
        'components': [{ 'id': name, 'sha256': hashlib.sha256((sources / (name + '.mp3')).read_bytes()).hexdigest() } for name in components],
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    }, indent=2) + '\n', encoding='utf-8')
    subprocess.run([sys.executable, str(root / 'scripts/prepare-bay-audio.py'), '--take', target, '--source', str(path)], check=True)
