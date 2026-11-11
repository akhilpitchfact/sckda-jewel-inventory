# Generates register-article-flow.html (A4, printed to PDF with Playwright).
M='#5a1519'; G='#a8791c'; INK='#2B2B2B'
out=[]
def box(cx,y,h,title,lines=(),fill='#fff',stroke=G,tcol=M,w=210,pill=None):
    x=cx-w/2
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
    ty=y+26
    out.append(f'<text x="{cx}" y="{ty}" text-anchor="middle" class="bt" fill="{tcol}">{title}</text>')
    for i,l in enumerate(lines):
        out.append(f'<text x="{cx}" y="{ty+20+i*18}" text-anchor="middle" class="bl">{l}</text>')
    if pill:
        txt,col,bg=pill; pw=len(txt)*7.2+22
        py=y+h-30
        out.append(f'<rect x="{cx-pw/2}" y="{py}" width="{pw}" height="20" rx="10" fill="{bg}"/><text x="{cx}" y="{py+14}" text-anchor="middle" class="pill" fill="{col}">{txt}</text>')
def arrow(pts,col=M,dash=False,label=None,lx=0,ly=0,lcol=None,anchor='middle'):
    d='M'+' L'.join(f'{x},{y}' for x,y in pts)
    out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2" {"stroke-dasharray=\"6 5\"" if dash else ""} marker-end="url(#ah{"r" if col=="#b42318" else "g" if col=="#067647" else ""})"/>')
    if label:
        for i,l in enumerate(label.split('|')):
            out.append(f'<text x="{lx}" y="{ly+i*16}" text-anchor="{anchor}" class="al" fill="{lcol or col}">{l}</text>')

W=1000; lanes=[('Inventory Officer','ದಾಸ್ತಾನು ಅಧಿಕಾರಿ'),('Application','ತಂತ್ರಾಂಶ'),('Verification Officer','ಪರಿಶೀಲನಾ ಅಧಿಕಾರಿ'),('Secretary (Super Admin)','ಕಾರ್ಯದರ್ಶಿ')]
H=1330
for i,(en,kn) in enumerate(lanes):
    x=i*250
    out.append(f'<rect x="{x}" y="0" width="250" height="{H}" fill="{"#fbf6ea" if i%2==0 else "#fffdf8"}"/>')
    out.append(f'<rect x="{x+6}" y="6" width="238" height="58" rx="10" fill="{M}"/>')
    out.append(f'<text x="{x+125}" y="31" text-anchor="middle" class="lt">{en}</text><text x="{x+125}" y="52" text-anchor="middle" class="lk">{kn}</text>')
    if i: out.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="#e2d6bd" stroke-width="1"/>')
C=[125,375,625,875]
# Inventory officer
box(C[0],90,74,'Article received',['from Hundi counting or Seva'],fill='#f5e1a4',stroke=G)
arrow([(C[0],164),(C[0],188)])
box(C[0],190,210,'Register Article form',['1  Receipt: date, Hundi / Seva, ref.','2  Donor (optional for Hundi)','3  Gold / Silver, category, type,','    description, number of pieces','4  Gross &amp; net weight (mg),','    purity, weight of each piece','5  Photographs','6  Remarks'])
arrow([(C[0],400),(C[0],438)])
box(C[0],440,56,'Save')
arrow([(225,468),(268,468)])
# App checks
box(C[1],440,56,'Checks the entry')
arrow([(C[1],440),(C[1],300),(232,300)],col='#b42318',label='Missing or wrong field?|shown in red, fix it',lx=C[1]+8,ly=372,anchor='start')
arrow([(C[1],496),(C[1],538)],label='All correct',lx=C[1]+8,ly=522,anchor='start',lcol='#067647')
box(C[1],540,124,'Article ID created',['AU-2026-00042 for gold','AG-2026-00017 for silver','Audit entry written'],pill=('Pending verification','#7a4a00','#fde9b8'))
arrow([(480,602),(518,602)])
# Verifier
box(C[2],560,84,'Verification queue',['must be a different officer','from the one who entered it'])
arrow([(C[2],644),(C[2],676)])
box(C[2],678,176,'Checks the physical article',['✓ description matches','✓ photograph matches','✓ quantity counted','✓ weight re-checked on scale','✓ source of receipt correct','✓ donor details (if any)'])
arrow([(C[2],854),(C[2],884)])
cy=934
out.append(f'<polygon points="{C[2]},{cy-48} {C[2]+95},{cy} {C[2]},{cy+48} {C[2]-95},{cy}" fill="#fff" stroke="{M}" stroke-width="2"/>')
out.append(f'<text x="{C[2]}" y="{cy-3}" text-anchor="middle" class="bt" fill="{M}">All six checks</text><text x="{C[2]}" y="{cy+16}" text-anchor="middle" class="bt" fill="{M}">pass?</text>')
# Return path
box(C[0],890,96,'Corrects &amp; resubmits',['reads the remarks,','fixes the entry'],fill='#fdecec',stroke='#b42318',tcol='#b42318')
arrow([(C[2]-95,cy),(228,cy)],col='#b42318',label='No: Return with remarks',lx=C[1]+18,ly=cy-10)
arrow([(C[0],890),(C[0],830),(240,830),(240,640),(268,640)],col='#b42318',label='Pending again',lx=246,ly=822,anchor='start')
# Approve
arrow([(C[2],cy+48),(C[2],1018)],col='#067647',label='Yes: Approve',lx=C[2]+10,ly=1004,anchor='start')
box(C[2],1020,56,'Approved',fill='#e7f6ee',stroke='#067647',tcol='#067647')
arrow([(520,1048),(482,1048)],col='#067647')
box(C[1],1000,150,'Locked in the register',['counts in gold &amp; silver totals,','dashboard and all 12 reports','(PDF &amp; Excel)'],fill='#e7f6ee',stroke='#067647',tcol='#067647',pill=('Approved','#067647','#c9ecd8'))
# Secretary
arrow([(C[1],1150),(C[1],1190),(762,1190)],dash=True,col=G,label='Only if a mistake is found later',lx=C[2],ly=1180,lcol='#7d5913')
box(C[3],1140,100,'Amend with reason',['old and new values','both kept'])
out.append(f'<path d="M752,1190 L752,1290 L762,1290" fill="none" stroke="{G}" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#ah)"/>')
box(C[3],1256,64,'or Cancel with reason',['never deleted'],fill='#fff')
# notes in empty lane 4 top
box(C[3],90,170,'Oversees the register',['manages officers &amp; roles,','categories, audit trail','and reports.','Approved records can be','changed only here.'],fill='#fffdf8',stroke='#e2d6bd')
svg=f'''<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">
<defs>{''.join(f'<marker id="ah{k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>' for k,c in [('',M),('r','#b42318'),('g','#067647')])}</defs>
{''.join(out)}</svg>'''
svg=svg.replace('marker-end="url(#ah)"" ','')
tpl=open('template.html').read().replace('%%SVG%%',svg)
open('register-article-flow.html','w').write(tpl)
