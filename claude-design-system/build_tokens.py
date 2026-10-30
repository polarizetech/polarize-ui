import json,re,os,shutil,datetime
R='/Users/joshuaanderton/Sites/polarize-ui/'
t=json.load(open(R+'tokens.json'))
P='project/'
def w(p,s):
    os.makedirs(os.path.dirname(P+p),exist_ok=True); open(P+p,'w').write(s)
themes=[('instrument','Instrument (light)','light'),('instrument-dark','Instrument (dark)','dark'),('polarize','Polarize (warm dark)','dark'),('fieldguide','Field guide (light)','light'),('fieldguide-dark','Field guide (dark)','dark')]
col=t['color']
use={'background':'Page ground. Text on it: foreground, muted-foreground.','surface':'Cards and panels on background.','surface-2':'Raised panels, table headers, inset wells on surface.','border':'Hairline dividers; structure comes from these, not boxes.','border-strong':'Control outlines, emphasised dividers (not a meaning-bearing mark: pair with a label).','foreground':'Primary text on background, surface, surface-2.','muted-foreground':'Body copy and secondary text on background and surface.','faint-foreground':'Captions and disabled text; large or non-essential only (can sit under 4.5:1 on surface-2).','ring':'Focus ring colour on any surface; 2px solid.','accent':'The one brand/action colour per view: primary button fill, active tab underline, links.','overlay':'Scrim behind drawers and sheets.'}
toks=[]
for k in ['background','surface','surface-2','border','border-strong','foreground','muted-foreground','faint-foreground','ring','accent','overlay']:
    toks.append({'name':k,'value':{th:col[th][k] for th,_,_ in themes},'usage':use[k]})
fam={'measured':'Tier A / MEASURED / PHYSICS. Established or read off an instrument.','predicted':'Tier B / PREDICTED / MODELLED. Model output; always italic in values.','exploring':'Tier C / EXPLORATORY. Open, weak or contested.','spec':'SPEC / ADDED / TASTE. Speculative or invented; never evidence.','refuted':'REFUTED. A claim this project explicitly does not make.'}
for k,u in fam.items():
    toks.append({'name':k,'value':{th:t['epistemic']['families'][k][m] for th,_,m in themes},'usage':u+' Reserved: never a chart series or UI state. Always paired with a word and glyph (see Tier).'})
ser=t['series']
for i in range(8):
    toks.append({'name':f'series-{i+1}','value':{th:ser[m][i] for th,_,m in themes},'usage':f'Chart series slot {i+1}, assigned in fixed order, never cycled. Only slots 1-3 are safe for all-pairs forms (scatter, small multiples).'})
sq=t['sequential']['steps']
for k in ['100','300','500','700']:
    toks.append({'name':f'sequential-{k}','value':sq[k],'usage':'One-hue magnitude ramp (heatmaps, spectrogram, density); light to dark with value.'})
ai=t['audioInk']
toks+= [{'name':'clay','value':ai['clay']['value'],'usage':'Signal/action ink in audio views (Polarize theme): one dominant clay element per view. Fills, marks, large type; not small text on surface-2 (4.23:1).'},
{'name':'ochre','value':ai['ochre']['value'],'usage':'Human annotation only: markers, note timestamps, citation anchors.'},
{'name':'lichen','value':ai['lichen']['value'],'usage':'Machine state only: verified, transcribed, synced.'}]
tx=t['type']
fonts=[{'family':'Inter','file':'fonts/inter-variable.woff2','weight':'100 900','style':'normal'},
{'family':'Instrument Serif','file':'fonts/instrument-serif-400.woff2','weight':'400','style':'normal'},
{'family':'IBM Plex Mono','file':'fonts/ibm-plex-mono-400.woff2','weight':'400 500','style':'normal'},
{'family':'Geist','file':'fonts/geist-400.woff2','weight':'400','style':'normal'},
{'family':'Literata','file':'fonts/literata-normal-variable.woff2','weight':'300 700','style':'normal'}]
tokens={'name':'Polarize UI','version':1,
'color':{'themes':[{'id':i,'name':n} for i,n,_ in themes],'tokens':toks},
'type':{'fonts':fonts,'families':{'sans':'Inter, ui-sans-serif, -apple-system, "SF Pro Text", "Segoe UI", Roboto, sans-serif','display':'"Instrument Serif", "Iowan Old Style", Georgia, serif','mono':'"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace','geist':'Geist, ui-sans-serif, -apple-system, "Segoe UI", sans-serif','serif':'Literata, Georgia, serif'},
'groups':[
{'name':'Display','family':'display','styles':[
 {'name':'display-1','fontSize':'54px','lineHeight':'1.1','fontWeight':400,'usage':'Page titles. Instrument Serif, regular case only, never uppercased.'},
 {'name':'display-2','fontSize':'27px','lineHeight':'1.15','fontWeight':400,'usage':'Section headings.'},
 {'name':'display-3','fontSize':'20px','lineHeight':'1.25','fontWeight':400,'usage':'Card headings.'}]},
{'name':'Text','family':'sans','styles':[
 {'name':'text-lg','fontSize':'15.5px','lineHeight':'1.55','fontWeight':400,'usage':'Lede and standfirst.'},
 {'name':'text-base','fontSize':'14px','lineHeight':'1.55','fontWeight':400,'usage':'All running text. Inter is never bold and never tracked; hierarchy is size, face, colour, case.'},
 {'name':'text-sm','fontSize':'12px','lineHeight':'1.55','fontWeight':400,'usage':'Table cells, helper text.'}]},
{'name':'Label','family':'mono','styles':[
 {'name':'label','fontSize':'10.5px','lineHeight':'1.25','fontWeight':500,'letterSpacing':'0.12em','usage':'ALL uppercase text is IBM Plex Mono: eyebrows, kickers, data captions, tier names.','sample':'MEASURED 12.4 Hz'}]}]},
'spacing':{'tokens':[{'name':f'space-{k}','value':v,'usage':u} for (k,v),u in zip(t['space'].items(),['Icon gaps.','Inline gaps, pill padding.','Control padding.','Card padding.','Section gaps.','Between blocks.','Page sections.','Large separation.','Hero spacing.']) if k.isdigit()]},
'radius':{'tokens':[{'name':f'radius-{k}','value':v,'usage':u} for (k,v),u in zip(t['radius'].items(),['Badges, inputs.','Buttons.','Cards.','Panels, drawers.','Pills and tags.'])]},
'shadow':{'tokens':[{'name':'shadow-raised','value':{th:col[th]['shadow'] if 'rgba' in col[th]['shadow'] and ' ' in col[th]['shadow'] and not col[th]['shadow'].startswith('rgba') else '0 8px 24px -16px '+col[th]['shadow'] for th,_,_ in themes},'usage':'Drawers and raised panels. Structure elsewhere comes from hairlines, not shadow.'}]},
'meta':{'source':'polarizetech/polarize-ui tokens.json @ v0.6.2'}}
json.dump(tokens,open(P+'tokens.json','w'),indent=1) if os.makedirs(P,exist_ok=True) is None else 0
os.makedirs(P+'fonts',exist_ok=True)
for f in fonts: shutil.copy(R+f['file'],P+f['file'])
# bundle.css
css=open(R+'design.css').read()
css=re.sub(r'@font-face\s*\{[^}]*\}','',css)
w('components/bundle.css',css)
print(len(css))
