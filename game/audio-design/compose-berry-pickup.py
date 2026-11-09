"""Replace wet rubber-like takes with a tender recorded leaf pluck and tiny object tick."""
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
    target = 'field.berry-pick' + suffix
    leaf_name, tick_name = 'field.leaf-pick' + suffix, 'gather.find' + suffix
    leaves = decode(leaf_name, 'highpass=f=400,lowpass=f=2800')[:22050]
    tick = decode(tick_name, 'highpass=f=600,lowpass=f=3200')[:6615]
    leaves *= .040 / max(.00001, float(np.sqrt(np.mean(leaves ** 2))))
    tick *= .007 / max(.00001, float(np.sqrt(np.mean(tick ** 2))))
    result = leaves.copy()
    count = min(len(result), len(tick))
    result[:count] += tick[:count]
    fade = min(882, len(result) // 6)
    result[:fade] *= np.linspace(0, 1, fade)[:, None]
    result[-fade:] *= np.linspace(1, 0, fade)[:, None]
    path = sources / (target + '.mp3')
    subprocess.run([
        encoder, '-v', 'error', '-y', '-f', 'f32le', '-ar', '44100', '-ac', '2',
        '-i', 'pipe:0', '-b:a', '192k', str(path),
    ], input=result.astype('<f4').tobytes(), check=True)
    (sources / (target + '.json')).write_text(json.dumps({
        'id': target, 'provider': 'ElevenLabs-derived composite',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'recipe': 'Half-second tender 400–2800 Hz leaf pinch; 150 ms recorded glass tick at -15.1 dB relative RMS; 20 ms soft edges',
        'components': [{ 'id': name, 'sha256': hashlib.sha256((sources / (name + '.mp3')).read_bytes()).hexdigest() } for name in [leaf_name, tick_name]],
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    }, indent=2) + '\n', encoding='utf-8')
    subprocess.run([sys.executable, str(root / 'scripts/prepare-bay-audio.py'), '--take', target, '--source', str(path)], check=True)
