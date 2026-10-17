"""Import client customer-facing sheets, preserving verified carrier zone mappings."""
from pathlib import Path
import json, openpyxl
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'data/rates.json').read_text())
def num(v):
    try: return float(v)
    except (ValueError,TypeError): return None
def table(s,rows,cols):
    return [{'weight':num(s.cell(r,1).value),'rates':{z:num(s.cell(r,c).value) for z,c in cols.items() if num(s.cell(r,c).value) is not None}} for r in rows if num(s.cell(r,1).value) is not None]
dc={str(i):i+2 for i in range(1,15)}
dc.update(US=14,CA=17);dc['9A']=17
uc={str(i):i+1 for i in range(1,10)}
uc.update(US=11,CA=12,AU=13,NZ=14,SG=15,PL=16,CZ=16,RO=16,HU=16,DE=17);uc.update({'6A':18,'7A':19})
d=openpyxl.load_workbook(ROOT/'royal T dhl updated.xlsx',data_only=True).active
u=openpyxl.load_workbook(ROOT/'ups rates royalty updated.xlsx',data_only=True)['royal t services']
data['DHL'].update(documents=table(d,range(7,11),dc),parcels=table(d,range(14,64),dc),bands=[{'min':lo,'max':hi,'rates':{z:num(d.cell(r,c).value) for z,c in dc.items() if num(d.cell(r,c).value) is not None}} for r,lo,hi in [(67,30,50),(68,50,70),(69,70,100),(70,100,300),(71,300,500),(72,500,99999)]])
data['UPS'].update(documents=table(u,range(15,25),uc),parcels=table(u,range(27,67),uc),bands=[{'min':lo,'max':hi,'rates':{z:num(u.cell(r,c).value) for z,c in uc.items() if num(u.cell(r,c).value) is not None}} for r,lo,hi in [(67,20,44),(68,44,70),(69,70,99),(70,99,299)]])
aliases={'Hongkong':'Hong Kong','UAE':'United Arab Emirates','GERMANY':'Germany','Bosnia':'Bosnia and Herzegovina','Liechenstein':'Liechtenstein','Czech Republic':'Czech Republic','Ireland':'Ireland, Republic of','Netherlands':'Netherlands (Holland)','Monaco':'Monaco (France)'}
s=openpyxl.load_workbook(ROOT/'self updated.xlsx',data_only=True).active
routes=[]; group=''; group_routes=[]
for row in s.values:
    label=str(row[1] or '').strip()
    if label.lower() in ('note:','note'):
        for route in group_routes: route['notes']+=' '+str(row[2] or '').strip()
        continue
    if label=='Destination' or not label: continue
    if row[10] is None:
        group=label; group_routes=[]; continue
    if label=='Destination': continue
    name=aliases.get(label,label)
    for prefix in ['Mauritius','Kenya','Mozambique','Nigeria','Tanzania','Uganda','Zambia','Malaysia','THAILAND','CHINA','PHILIPPINES','Bhutan','Sri Lanka','NEW ZEALAND']:
        if label.startswith(prefix): name={'THAILAND':'Thailand','CHINA':'China','PHILIPPINES':'Philippines','NEW ZEALAND':'New Zealand'}.get(prefix,prefix)
    if label.startswith('Zone-'): name='Australia'
    if label.startswith(('Northern Ireland','Isle of Man','JERSEY','Scotland','Glasgow','Edinburgh')): name='United Kingdom'
    if name=='Tanzania': name='Tanzania, United Republic of'
    names=['Serbia','Montenegro'] if label=='Serbia & Montenegro' else ['China South¹ (Fujian & Guangdong Province)','China² (Excluding China South)'] if name=='China' else [name]
    matches=[c for c in data['countries'] if c['name'].casefold() in [n.casefold() for n in names]]
    if not matches: continue
    rates=[num(v) for v in row[2:10]]
    notes=' · '.join(str(v).strip() for v in row[2:10] if v is not None and num(v) is None)
    if name=='New Zealand': rates[2:]=[rates[2]]*6  # The source has one open-ended 6+ column.
    max_weight=50 if name in ['Australia','New Zealand'] else 13 if name=='Saudi Arabia' else 10 if name=='Thailand' else 25 if name=='Philippines' else 30 if name in ['United Kingdom','United Arab Emirates','Oman','Qatar','Bahrain','Kuwait'] or group.startswith('DDP') else 99999
    route={'country':matches[0]['name'],'name':label,'group':group,'base':rates[0],'additional':rates[1],'bands':[{'min':w,'amount':v} for w,v in zip([6,8,11,16,21,26],rates[2:])], 'maxWeight':max_weight,'notes':notes}
    for country in matches:
        copy={**route,'country':country['name']}
        routes.append(copy);group_routes.append(copy)
data['SELF']={'routes':routes,'validFrom':'2026-07-01','validUntil':None}
data.update(validFrom='2026-10-13',validUntil='2026-10-17',sources={'DHL':'royal T dhl updated.xlsx / royalty dhl','UPS':'ups rates royalty updated.xlsx / royal t services','SELF':'self updated.xlsx / royal t services'})
(ROOT/'data/rates.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
print(f'Imported updated DHL, UPS and {len(routes)} Self routes.')
