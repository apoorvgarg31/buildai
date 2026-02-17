#!/usr/bin/env bash
set -euo pipefail
FILE_PATH="${1:-}"; FORMAT="${2:-auto}"
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then echo '{"error":"Usage: import.sh <file_path> [csv|excel|pdf]"}'; exit 1; fi
python3 -c "import pdfplumber" 2>/dev/null || pip3 install -q pdfplumber openpyxl 2>/dev/null
python3 - "$FILE_PATH" "$FORMAT" << 'PYEOF'
import sys,json,os,csv,re
from datetime import datetime
fp,fmt=sys.argv[1],sys.argv[2]
ext=os.path.splitext(fp)[1].lower()
if fmt=="auto": fmt={"csv":"csv",".xlsx":"excel",".xls":"excel",".pdf":"pdf"}.get(ext,"csv")
activities,milestones=[],[]
SCHED_COLS={"id":["id","activity_id","task_id","wbs","code"],"name":["name","activity_name","task_name","description","title"],"start":["start","start_date","early_start","planned_start","begin"],"finish":["finish","end","finish_date","end_date","early_finish","planned_finish"],"duration":["duration","orig_dur","original_duration","dur","days"],"pct":["percent","pct_complete","percent_complete","complete","%"],"predecessor":["predecessor","predecessors","pred","depends_on"]}
def match_col(header,key):
    h=header.lower().strip().replace(" ","_")
    return any(c in h for c in SCHED_COLS.get(key,[]))
def map_headers(headers):
    m={}
    for i,h in enumerate(headers):
        for key in SCHED_COLS:
            if match_col(h,key) and key not in m: m[key]=i
    return m
def parse_rows(headers,rows):
    cm=map_headers(headers)
    for row in rows:
        if not row or not any(str(c).strip() for c in row): continue
        a={}
        for key,idx in cm.items():
            if idx<len(row): a[key]=str(row[idx] or "").strip()
        if a.get("name"):
            activities.append(a)
            d=a.get("duration","")
            if d and (d=="0" or d.startswith("0 ")): milestones.append(a)
if fmt=="csv":
    with open(fp,newline="",encoding="utf-8-sig") as f:
        reader=csv.reader(f)
        headers=next(reader,[])
        parse_rows(headers,list(reader))
elif fmt=="excel":
    try:
        from openpyxl import load_workbook
        wb=load_workbook(fp,read_only=True,data_only=True)
        ws=wb.active
        rows=list(ws.iter_rows(values_only=True))
        if rows: parse_rows([str(h or "") for h in rows[0]],rows[1:])
    except ImportError:
        print(json.dumps({"error":"openpyxl not installed. Run: pip3 install openpyxl"}));sys.exit(1)
elif fmt=="pdf":
    import pdfplumber
    with pdfplumber.open(fp) as pdf:
        for page in pdf.pages:
            for table in (page.extract_tables() or []):
                if table and len(table)>1: parse_rows([str(h or "") for h in table[0]],table[1:])
dates=[a.get("start","") for a in activities if a.get("start")]+[a.get("finish","") for a in activities if a.get("finish")]
pcts=[float(re.sub(r'[%\s]','',a["pct"])) for a in activities if a.get("pct") and re.match(r'[\d.]+',a["pct"].replace('%',''))]
result={"file":os.path.basename(fp),"format":fmt,"activities":activities[:200],"milestones":milestones[:50],"summary":{"total_activities":len(activities),"milestones":len(milestones),"avg_completion":round(sum(pcts)/len(pcts),1) if pcts else None}}
print(json.dumps(result,indent=2))
PYEOF
