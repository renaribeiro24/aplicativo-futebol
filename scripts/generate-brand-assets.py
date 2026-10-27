"""Generate outlined SVG brand variants from one drawing and brand.ts.
Design-tool dependency only: Python fontTools + DejaVu Sans Bold Oblique.
No external font or library is needed by the application at runtime.
"""
from pathlib import Path
import re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[1]
identity = (ROOT / 'src/lib/brand.ts').read_text()
name = re.search(r'name: "([^"]+)"', identity)[1]
slogan = re.search(r'slogan: "([^"]+)"', identity)[1]
font = TTFont('/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf')
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
metrics = font['hmtx'].metrics

def width(text, scale, tracking=0):
    return sum(metrics[cmap[ord(c)]][0] * scale for c in text) + tracking * max(0,len(text)-1)

def lettering(text, x, baseline, scale, fill, tracking=0):
    paths=[]
    for c in text:
        pen=SVGPathPen(glyphs, ntos=lambda n: ('%.2f' % n).rstrip('0').rstrip('.') if n else '0')
        glyphs[cmap[ord(c)]].draw(TransformPen(pen, (scale,0,0,-scale,x,baseline)))
        d=pen.getCommands()
        if d: paths.append(f'<path fill="{fill}" d="{d}"/>')
        x += metrics[cmap[ord(c)]][0]*scale+tracking
    return ''.join(paths)

# Forward-leaning B, independent rounded speed trails, ball integrated in its counter.
# Knockout around the ball preserves separation at small sizes and in one-ink versions.
def mark(ink, mono=False):
    ball_fill='none' if mono else '#ffffff'
    panel=ink if mono else '#20252b'
    return f'''<defs><mask id="ball-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="160"><rect width="192" height="160" fill="white"/><circle cx="123" cy="84" r="39" fill="black"/></mask></defs>
    <g fill="{ink}" mask="url(#ball-cut)"><path d="M67 16h62c31 0 47 16 40 37-3 9-9 15-18 20 15 6 20 21 14 39-8 26-29 40-61 40H39l7-21h60c17 0 28-7 32-20 4-14-4-22-20-22H83l6-21h31c15 0 24-6 27-16 3-10-4-15-19-15H60Z"/><path d="M67 16h26L56 131H39Z"/>
    <rect x="31" y="48" width="65" height="12" rx="6"/><rect x="23" y="70" width="60" height="12" rx="6"/><rect x="14" y="92" width="60" height="12" rx="6"/><rect x="32" y="114" width="33" height="12" rx="6"/><rect x="21" y="138" width="41" height="14" rx="7"/><circle cx="8" cy="76" r="6"/></g>
    <g stroke="{panel}" stroke-width="2.4" stroke-linejoin="round"><circle cx="123" cy="84" r="35" fill="{ball_fill}"/>
    <path d="m123 68 15 11-6 17h-18l-6-17Z" fill="{panel}"/>
    <path d="m123 68-2-19m17 30 18-5m-24 22 10 15m-28-15-11 14m5-31-18-5" fill="none"/>
    <path d="m107 53 14-4 12 4-10 7Zm43 10 6 11-2 13-8-11Zm1 40-9 8-13 7 4-12Zm-42 11-13-12-5-13 12 9Zm-19-40 6-13 11-8-3 14Z" fill="{panel}"/>
    </g>'''

out=ROOT/'public/brand'
scale=.066
split=name.index('F')
word_width=width(name,scale)
canvas_width=round(214+word_width+24)
for layout in ['horizontal','main']:
    height=166 if layout=='horizontal' else 216
    for tone in ['dark','light','white','graphite']:
        mono=tone in ['white','graphite']
        base='#ffffff' if tone in ['dark','white'] else '#20252b'
        ink=base if mono else ('#b8ff28' if tone=='dark' else '#356600')
        word=lettering(name[:split],210,132,scale,base)+lettering(name[split:],210+width(name[:split],scale),132,scale,ink)
        tagline=''
        if layout=='main':
            text=slogan.upper()
            tagline=lettering(text,210+(word_width-width(text,.014,7))/2,190,.014,ink,7)
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{canvas_width}" height="{height}" viewBox="0 0 {canvas_width} {height}"><title>{name + " — " + slogan if layout=="main" else name}</title>{mark(ink,mono)}{word}{tagline}</svg>\n'
        (out/f'borafute-{layout}-{tone}.svg').write_text(svg)
(out/'borafute-symbol.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="192" height="160" viewBox="0 0 192 160"><title>{name}</title>{mark("#b8ff28")}</svg>\n')
icon=f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><title>{name}</title><rect width="512" height="512" rx="104" fill="#20252b"/><g transform="translate(68 80) scale(2.1)">{mark("#b8ff28")}</g></svg>\n'
(ROOT/'public/icons/icon.svg').write_text(icon)
print(f'Generated 9 brand SVGs and app icon, wordmark width {canvas_width}; all lettering outlined.')
