"""Regenerate with fonttools: a tiny original MIT-licensed type test fixture."""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables.TupleVariation import TupleVariation
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from pathlib import Path
fb = FontBuilder(1000, isTTF=True)
order = ['.notdef', 'space', 'A', 'a', 'a.sc', 'a.round', 'a.square']
fb.setupGlyphOrder(order)
fb.setupCharacterMap({32:'space',65:'A',97:'a'})
glyphs = {}
for i, name in enumerate(order):
    pen = TTGlyphPen(None)
    if name != 'space':
        h = 700 if name == 'A' else 400 + i * 15
        pen.moveTo((60,0)); pen.lineTo((440,0)); pen.lineTo((440,h)); pen.lineTo((60,h)); pen.closePath()
    glyphs[name] = pen.glyph()
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({name:(500,60) for name in order})
fb.setupHorizontalHeader(ascent=800,descent=-200)
fb.setupNameTable({'familyName':'Dopedocs Type Fixture','styleName':'Regular','uniqueFontIdentifier':'DopedocsTypeFixture','fullName':'Dopedocs Type Fixture','psName':'DopedocsTypeFixture','version':'Version 1.0','licenseDescription':'MIT; original test fixture, see repository LICENSE.'})
fb.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=800,usWinDescent=200)
fb.setupPost(); fb.setupMaxp()
fb.setupFvar([('wght',100,400,900,'Weight')],[])
fb.setupGvar({name:[TupleVariation({'wght':(0,1,1)}, ([(0,0),(100,0),(100,0),(0,0)] if name!='space' else [])+[(0,0)]*4)] for name in order})
addOpenTypeFeaturesFromString(fb.font, '''languagesystem DFLT dflt;
feature smcp { sub a by a.sc; } smcp;
feature ss01 { featureNames { name "Round forms"; }; sub a by a.round; } ss01;
feature ss02 { featureNames { name "Square forms"; }; sub a by a.square; } ss02;
''')
# Fixed timestamps make regeneration reproducible.
fb.font['head'].created = fb.font['head'].modified = 3800000000
fb.save(Path(__file__).with_name('type-features.ttf'))
