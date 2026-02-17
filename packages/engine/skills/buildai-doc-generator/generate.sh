#!/usr/bin/env bash
# BuildAI Doc Generator — Create PDF/DOCX reports
# Usage: echo '{"data":...}' | bash skills/buildai-doc-generator/generate.sh <type> <output_path> [title]
set -euo pipefail

REPORT_TYPE="${1:-custom}"
OUTPUT_PATH="${2:-/tmp/buildai-report.pdf}"
TITLE="${3:-Project Report}"

# Read JSON data from stdin
DATA=$(cat)

if [ -z "$DATA" ]; then
  echo '{"error": "No data provided. Pipe JSON data via stdin."}'
  exit 1
fi

# Ensure reportlab is installed for PDF
python3 -c "import reportlab" 2>/dev/null || pip3 install -q reportlab 2>/dev/null

python3 - "$REPORT_TYPE" "$OUTPUT_PATH" "$TITLE" << 'PYEOF'
import sys, json, os
from datetime import datetime

report_type = sys.argv[1]
output_path = sys.argv[2]
title = sys.argv[3]
data = json.loads(sys.stdin.read() if not sys.stdin.isatty() else '{}')

# If data was already read by bash, it's in env
import os as _os
raw = _os.environ.get('REPORT_DATA', '')

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
except ImportError:
    print(json.dumps({"error": "reportlab not installed. Run: pip3 install reportlab"}))
    sys.exit(1)

doc = SimpleDocTemplate(output_path, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='ReportTitle', fontSize=18, spaceAfter=12, fontName='Helvetica-Bold'))
styles.add(ParagraphStyle(name='SectionHead', fontSize=13, spaceAfter=8, spaceBefore=12, fontName='Helvetica-Bold', textColor=colors.HexColor('#333333')))
styles.add(ParagraphStyle(name='BodyText2', fontSize=10, spaceAfter=6, leading=14))

elements = []
date_str = data.get('date', datetime.now().strftime('%Y-%m-%d'))

# Header
elements.append(Paragraph(title, styles['ReportTitle']))
elements.append(Paragraph(f"Date: {date_str} | Project: {data.get('project', 'N/A')}", styles['BodyText2']))
elements.append(Spacer(1, 12))

if report_type == 'executive-summary':
    # Budget section
    elements.append(Paragraph("Budget Overview", styles['SectionHead']))
    budget_data = [
        ['Metric', 'Value'],
        ['Total Budget', f"${data.get('budget_total', 0):,.0f}"],
        ['Spent to Date', f"${data.get('budget_spent', 0):,.0f}"],
        ['Remaining', f"${data.get('budget_total', 0) - data.get('budget_spent', 0):,.0f}"],
        ['% Complete', f"{data.get('budget_spent', 0) / max(data.get('budget_total', 1), 1) * 100:.1f}%"],
    ]
    t = Table(budget_data, colWidths=[3*inch, 3*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#333333')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 12))

    # RFI summary
    elements.append(Paragraph("RFI Status", styles['SectionHead']))
    elements.append(Paragraph(f"Open RFIs: {data.get('open_rfis', 0)} | Overdue: {data.get('overdue_rfis', 0)}", styles['BodyText2']))
    elements.append(Paragraph(f"Schedule Status: {data.get('schedule_status', 'N/A')}", styles['BodyText2']))

    # Risks
    risks = data.get('key_risks', [])
    if risks:
        elements.append(Paragraph("Key Risks", styles['SectionHead']))
        for r in risks:
            elements.append(Paragraph(f"• {r}", styles['BodyText2']))

elif report_type == 'meeting-minutes':
    attendees = data.get('attendees', [])
    if attendees:
        elements.append(Paragraph("Attendees", styles['SectionHead']))
        elements.append(Paragraph(", ".join(attendees), styles['BodyText2']))

    items = data.get('items', [])
    if items:
        elements.append(Paragraph("Discussion Items", styles['SectionHead']))
        table_data = [['Topic', 'Notes', 'Action', 'Owner', 'Due']]
        for item in items:
            table_data.append([
                item.get('topic', ''),
                item.get('notes', ''),
                item.get('action', ''),
                item.get('owner', ''),
                item.get('due', ''),
            ])
        t = Table(table_data, colWidths=[1.2*inch, 1.8*inch, 1.5*inch, 0.9*inch, 0.9*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#333333')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t)

elif report_type == 'daily-report':
    elements.append(Paragraph(f"Weather: {data.get('weather', 'N/A')}", styles['BodyText2']))
    elements.append(Paragraph(f"Crew Size: {data.get('crew_size', 'N/A')}", styles['BodyText2']))
    elements.append(Spacer(1, 8))

    if data.get('work_completed'):
        elements.append(Paragraph("Work Completed", styles['SectionHead']))
        for item in data['work_completed']:
            elements.append(Paragraph(f"• {item}", styles['BodyText2']))

    if data.get('issues'):
        elements.append(Paragraph("Issues / Delays", styles['SectionHead']))
        for item in data['issues']:
            elements.append(Paragraph(f"• {item}", styles['BodyText2']))

    if data.get('tomorrow'):
        elements.append(Paragraph("Planned for Tomorrow", styles['SectionHead']))
        for item in data['tomorrow']:
            elements.append(Paragraph(f"• {item}", styles['BodyText2']))

elif report_type in ('status-report', 'rfi-report', 'custom'):
    # Generic: render all data keys as sections
    for key, value in data.items():
        if key in ('project', 'date', 'title'):
            continue
        section_title = key.replace('_', ' ').title()
        elements.append(Paragraph(section_title, styles['SectionHead']))
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    for k, v in item.items():
                        elements.append(Paragraph(f"<b>{k}:</b> {v}", styles['BodyText2']))
                    elements.append(Spacer(1, 4))
                else:
                    elements.append(Paragraph(f"• {item}", styles['BodyText2']))
        elif isinstance(value, dict):
            for k, v in value.items():
                elements.append(Paragraph(f"<b>{k}:</b> {v}", styles['BodyText2']))
        else:
            elements.append(Paragraph(str(value), styles['BodyText2']))

# Build PDF
doc.build(elements)

result = {
    "success": True,
    "file": output_path,
    "type": report_type,
    "title": title,
    "size_bytes": os.path.getsize(output_path),
}
print(json.dumps(result, indent=2))
PYEOF
