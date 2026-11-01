"""Build the single-file game (index.html) from src/ and audio/.

Usage (from the repository root):
    python tools/build.py              -> writes index.html with the music embedded
    python tools/build.py --noaudio    -> smaller build without music (for quick testing)
"""
import base64, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
AUDIO = os.path.join(ROOT, 'audio')

ORDER = ['util', 'audio', 'gesture', 'sprites', 'levels', 'game', 'hud', 'concert', 'prologue', 'ui']
FILES = {'rescue1': 'stage-1-rescue.mp3', 'rescue2': 'stage-2-rescue.mp3',
         'rescue3': 'stage-3-rescue.mp3', 'finale': 'back-on-stage.mp3'}

def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

def main():
    js = '\n'.join(read(os.path.join(SRC, 'js', n + '.js')) for n in ORDER)
    tpl = read(os.path.join(SRC, 'template.html'))
    if '--noaudio' in sys.argv:
        data = '/* no audio */'
    else:
        parts = []
        for key, name in FILES.items():
            with open(os.path.join(AUDIO, name), 'rb') as f:
                parts.append(f'"{key}":"{base64.b64encode(f.read()).decode()}"')
        data = 'const AUDIO_DATA = {\n' + ',\n'.join(parts) + '\n};'
    out = tpl.replace('/*__JS__*/', js).replace('/*__AUDIO__*/', data)
    target = os.path.join(ROOT, 'index.html')
    with open(target, 'w', encoding='utf-8') as f:
        f.write(out)
    print(f'wrote {target} ({len(out) // 1024} KB)')

if __name__ == '__main__':
    main()
