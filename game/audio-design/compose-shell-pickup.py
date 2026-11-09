"""Give shell collection a soft distinct object signal using recorded ElevenLabs takes."""
from pathlib import Path
import hashlib
import json
import shutil
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
    target = 'gather.shell' + suffix
    texture_name = 'gather.shell-texture' + suffix
    texture = sources / (texture_name + '.mp3')
    if not texture.exists():
        shutil.copyfile(sources / (target + '.mp3'), texture)
    clink_name = 'gather.find' + suffix
    clink = decode(clink_name, 'asetrate=39690,aresample=44100,lowpass=f=3200')
    shell = decode(texture_name, 'highpass=f=1200,lowpass=f=3800')
    clink *= .060 / max(.00001, float(np.sqrt(np.mean(clink ** 2))))
    shell *= .007 / max(.00001, float(np.sqrt(np.mean(shell ** 2))))
    count = min(len(clink), len(shell))
    result = clink.copy()
    result[:count] += shell[:count]
    path = sources / (target + '.mp3')
    subprocess.run([
        encoder, '-v', 'error', '-y', '-f', 'f32le', '-ar', '44100', '-ac', '2',
        '-i', 'pipe:0', '-b:a', '192k', str(path),
    ], input=result.astype('<f4').tobytes(), check=True)
    (sources / (target + '.json')).write_text(json.dumps({
        'id': target, 'provider': 'ElevenLabs-derived composite',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'recipe': 'Accepted hard-object clink at 90% speed with 3.2 kHz lowpass; recorded shell texture at -18.7 dB relative RMS',
        'components': [{ 'id': name, 'sha256': hashlib.sha256((sources / (name + '.mp3')).read_bytes()).hexdigest() } for name in [clink_name, texture_name]],
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    }, indent=2) + '\n', encoding='utf-8')
    subprocess.run([sys.executable, str(root / 'scripts/prepare-bay-audio.py'), '--take', target, '--source', str(path)], check=True)
