"""Audit all tabs in the newly supplied zone files without changing website rates."""
import sys, json, re
from pathlib import Path
from collections import Counter
import openpyxl
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.internal-test/python-packages'))
import xlrd
old=json.loads((ROOT/'data/rates.json').read_text(encoding='utf-8'))
dhl=openpyxl.load_workbook(ROOT/'Dhl New Zone List.xlsx',data_only=True)
ups=xlrd.open_workbook(ROOT/'UPS ZONES_Export Only.xls')
tabs={}
for sheet in dhl:
    tabs['DHL / '+sheet.title]=[[cell for cell in row] for row in sheet.iter_rows(values_only=True)]
for sheet in ups.sheets():tabs['UPS / '+sheet.name]=[sheet.row_values(i) for i in range(sheet.nrows)]
(ROOT/'data/new-zone-workbook-review.json').write_text(json.dumps(tabs,indent=2,default=str),encoding='utf-8')
def zone(value):
    if isinstance(value,(int,float)):return str(int(value))
    return str(value).strip() if value is not None else None
def code(value):return str(value).replace('*','').strip()
dr=[]
for row in tabs['DHL / Zones(Dhl)'][1:]:
    if row[0]=='DHL' and row[3]:dr.append({'code':code(row[3]),'name':row[2],'zoneLabel':row[5],'zone':zone(row[6]),'row':len(dr)+2})
ur=[]
for i,row in enumerate(tabs['UPS / Zones'][3:],4):
    if row[0] and row[1]:ur.append({'code':code(row[0]),'name':str(row[1]).split('\n')[0].replace('*','').strip(),'zone':zone(row[4]),'row':i})
changes=[];missing=[]
for entry in old['countries']:
    matches=[r for r in ur if r['name']==entry['name']]
    if not matches:missing.append(entry)
    elif entry['zone']!=matches[0]['zone']:changes.append({'country':entry['name'],'old':entry['zone'],'new':matches[0]['zone']})
dchanges=[];dmissing=[]
for entry in old['countries']:
    matches=[r for r in dr if r['code']==entry['code']]
    if not matches:dmissing.append(entry)
    elif len({r['zoneLabel'] for r in matches})>1:print('DHL AMBIGUOUS',entry['code'],matches)
    else:
        before=old['DHL']['countryZones'].get(entry['code'],entry['zone'])
        after='US' if entry['code']=='US' else 'CA' if entry['code']=='CA' else matches[0]['zone']
        if before!=after:dchanges.append({'code':entry['code'],'country':entry['name'],'old':before,'new':after,'sourceLabel':matches[0]['zoneLabel']})
first={}
for row in tabs['DHL / Sheet2 (2)'][1:]:
    match=re.search(r'\(([A-Z0-9]{2})\)\s*$',str(row[0]))
    if match:first[match[1]]=zone(row[1])
alternate={}
for row in tabs['DHL / Sheet2'][1:]:
    if row[6]:alternate[str(row[6]).strip()]=zone(row[1])
conflicts=[{'country':r['name'],'code':r['code'],'Zones(Dhl)':r['zoneLabel'],'Sheet2 (2)':first.get(r['code']),'Sheet2':alternate.get(r['code'])} for r in dr if first.get(r['code'])!=r['zone'] or alternate.get(r['code'])!=r['zone']]
report={'tabs':{key:{'rows':len(rows),'columns':max(map(len,rows)),'nonemptyRows':sum(any(v not in ('',None) for v in row) for row in rows)} for key,rows in tabs.items()},'dhl':{'rows':len(dr),'uniqueCodes':len(set(r['code'] for r in dr)),'zoneLabels':dict(Counter(r['zoneLabel'] for r in dr)),'changesFromTemporaryMapping':dchanges,'notMatchedToCurrentCountryCodes':dmissing,'differencesBetweenTabs':conflicts},'ups':{'rows':len(ur),'changes':changes,'notMatchedByName':missing,'specialZones':[r for r in ur if r['zone'] in ['6A','7A','US','CA','AU','NZ','SG','PL','CZ','RO','HU','DE']]}}
(ROOT/'data/new-zone-comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({**report['tabs'],'DHL changed destinations':len(dchanges),'DHL unmatched current codes':dmissing,'DHL tabs differ':len(conflicts),'UPS differences':changes,'UPS unmatched':missing},indent=2))
for c in ['AT','US','CA','AU','NZ','SG','DE','AE','GB','IN']:
    print(c,'DHL',[r for r in dr if r['code']==c],'UPS',[r for r in ur if r['code']==c])
print('DHL differing tab examples:',conflicts[:8])
