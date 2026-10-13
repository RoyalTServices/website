"""Read client workbooks without modifying them; export only usable rate tables."""
from pathlib import Path
import json
import sys
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
dhl = openpyxl.load_workbook(ROOT/'DHL COLOADER RATE 11-10-2026 TO 17-10-2026.xlsx', data_only=True)
ups = openpyxl.load_workbook(next(ROOT.glob('UPS_World*.xlsx')), data_only=True)
try:
    import xlrd
except ImportError:
    sys.path.insert(0,str(ROOT/'.internal-test/python-packages'))
    import xlrd
ups_zones = xlrd.open_workbook(ROOT/'UPS ZONES_Export Only.xls').sheet_by_name('Zones')
dhl_zones = openpyxl.load_workbook(ROOT/'Dhl New Zone List.xlsx',data_only=True)['Zones(Dhl)']

def zone_label(value):
    return str(int(value)) if isinstance(value,(int,float)) else str(value).strip()

def number(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

countries = []
for r in range(3,ups_zones.nrows):
    row=ups_zones.row_values(r)
    code, name, zone = row[0],row[1],row[4]  # Export Express Saver only.
    if name is None or zone is None:
        continue
    name = str(name).split('\n')[0].replace('*', '').strip()
    code = str(code).replace('*', '').strip()
    zone = zone_label(zone)
    if any(c['name'] == name for c in countries):
        continue
    countries.append({'code': code, 'name': name, 'zone':None if zone in ('','-') else zone,'dhlZone':None})
dhl_country_zones={}
dhl_labels={}
for row in dhl_zones.iter_rows(min_row=2,values_only=True):
    if row[0]!='DHL' or not row[3]:continue
    code,name,label=str(row[3]).strip(),str(row[2]).strip(),str(row[5]).strip()
    # The rate workbook has both Zone 9 and a dedicated Zone 9A.
    zone='9A' if label=='9A' else zone_label(row[6])
    if code=='US':zone='US'
    if code=='CA':zone='CA'
    dhl_country_zones[code]=zone
    dhl_labels[code]=label
    name_matches=[c for c in countries if c['name'].casefold()==name.casefold()]
    matches=name_matches or [c for c in countries if c['code']==code]
    if matches:
        for country in matches:
            country['dhlZone']=zone
            country['dhlCountryCode']=code
    else:
        countries.append({'code':code,'name':name,'zone':None,'dhlZone':zone,'dhlCountryCode':code})
countries.sort(key=lambda c: c['name'])

def table(sheet, rows, weight_col, columns):
    result = []
    for r in rows:
        weight = number(sheet.cell(r, weight_col).value)
        if weight is not None:
            result.append({'weight': weight, 'rates': {zone: number(sheet.cell(r, col).value) for zone, col in columns.items() if number(sheet.cell(r, col).value) is not None}})
    return result

dc = {str(i): i + 2 for i in range(1, 15)}
dc['US'], dc['CA'] = 14, 17
dc['9A']=17
uc = {str(i): i + 1 for i in range(1, 10)}
uc.update({'US':11, 'CA':12, 'AU':13, 'NZ':14, 'SG':15, 'PL':16, 'CZ':16, 'RO':16, 'HU':16, 'DE':17, '6A':18, '7A':19})
ds, us = dhl['COLAODER++'], ups['Partner Base++']
data = {
    'validFrom': '2026-10-11', 'validUntil': '2026-10-17',
    'countries': countries,
    'mappingMode': 'Carrier-specific zones: DHL Zones(Dhl); UPS Export Saver. Unmapped routes require enquiry.',
    'mappingSources':{'DHL':'Dhl New Zone List.xlsx / Zones(Dhl)','UPS':'UPS ZONES_Export Only.xls / Zones / Export Saver'},
    'DHL': {'countryZones': dhl_country_zones, 'countryZoneLabels':dhl_labels, 'documents':table(ds, range(7,11),1,dc), 'parcels':table(ds, range(14,64),1,dc),
        'bands':[{'min':lo, 'max':hi, 'rates':table(ds,[r],1,dc)[0]['rates']} for r,lo,hi in [(67,30,50),(68,50,70),(69,70,100),(70,100,300),(71,300,500),(72,500,99999)]]},
    'UPS': {'documents':table(us,range(16,27),1,uc), 'parcels':table(us,range(28,68),1,uc),
        'bands':[{'min':lo,'max':hi,'rates':{z:round(number(us.cell(r,c).value),2) for z,c in uc.items() if number(us.cell(r,c).value) is not None}} for r,lo,hi in [(68,20,44),(69,44,70),(70,70,99),(71,99,299)]]}
}
(ROOT/'data'/'rates.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
print(f'Exported {len(countries)} destinations; DHL and UPS rates with effective dates.')
