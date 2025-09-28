// Document parser for .docx (Word with Track Changes/tables) and .xlsx (Excel sheets)
// Best-effort extraction of chronological activities from uploads.

import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import * as XLSX from 'xlsx';

export type DocSource = 'docx' | 'xlsx';

export interface DocActivity {
  date: string; // YYYY-MM-DD if possible
  timestamp?: string; // full ISO timestamp when available
  description: string;
  status?: string;
  sheet?: string; // table name (docx) or sheet name (xlsx)
  cell?: string; // R{row}C{col} (docx tables) or A1 notation (xlsx)
  author?: string;
  changeType?: 'insert' | 'delete' | 'edit' | 'status-change' | 'row';
}

export interface ParseResult {
  source: DocSource;
  activities: DocActivity[];
  meta?: {
    sheets?: string[];
    revisionLogs?: boolean;
  } & Record<string, any>;
}

// Public entry point
export async function parseDocumentFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    return parseDocx(file);
  }
  if (name.endsWith('.xlsx')) {
    return parseXlsx(file);
  }
  throw new Error('Unsupported file type. Please upload .docx or .xlsx');
}

// ------------------------- DOCX -------------------------

async function parseDocx(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error('Invalid .docx file: missing word/document.xml');
  }
  const xmlText = await documentFile.async('text');

  // First, extract table-based changes with row/column context (best-effort)
  const tableActivities = extractDocxTableActivities(xmlText);

  // Then, extract general tracked changes outside tables
  const generalActivities = extractDocxTrackedChanges(xmlText);

  const all = [...tableActivities, ...generalActivities];

  // Sort chronologically if timestamps exist
  all.sort((a, b) => {
    const ta = a.timestamp || a.date || '';
    const tb = b.timestamp || b.date || '';
    return ta.localeCompare(tb);
  });

  return { source: 'docx', activities: all, meta: { tables: true } };
}

// Extract tracked changes from tables with row/col context
function extractDocxTableActivities(xml: string): DocActivity[] {
  const activities: DocActivity[] = [];
  const tableRegex = /<w:tbl[\s\S]*?<\/w:tbl>/g;
  let tableIndex = 0;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRegex.exec(xml)) !== null) {
    tableIndex += 1;
    const tblXml = tableMatch[0];
    // Split rows
    const rowRegex = /<w:tr[\s\S]*?<\/w:tr>/g;
    let rowIndex = 0;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(tblXml)) !== null) {
      rowIndex += 1;
      const trXml = rowMatch[0];
      // Split cells
      const cellRegex = /<w:tc[\s\S]*?<\/w:tc>/g;
      let colIndex = 0;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(trXml)) !== null) {
        colIndex += 1;
        const tcXml = cellMatch[0];
        // Find insertions and deletions inside the cell
        const insRegex = /<w:ins([^>]*)>([\s\S]*?)<\/w:ins>/g;
        let insMatch: RegExpExecArray | null;
        while ((insMatch = insRegex.exec(tcXml)) !== null) {
          const attrs = insMatch[1] || '';
          const inner = insMatch[2] || '';
          const author = attrValue(attrs, 'w:author');
          const date = attrValue(attrs, 'w:date');
          const text = extractInnerText(inner);
          if (text.trim()) {
            activities.push({
              date: date ? date.substring(0, 10) : '',
              timestamp: date || undefined,
              description: text.trim(),
              author: author || undefined,
              sheet: `Table ${tableIndex}`,
              cell: `R${rowIndex}C${colIndex}`,
              changeType: 'insert',
            });
          }
        }
        const delRegex = /<w:del([^>]*)>([\s\S]*?)<\/w:del>/g;
        let delMatch: RegExpExecArray | null;
        while ((delMatch = delRegex.exec(tcXml)) !== null) {
          const attrs = delMatch[1] || '';
          const inner = delMatch[2] || '';
          const author = attrValue(attrs, 'w:author');
          const date = attrValue(attrs, 'w:date');
          const text = extractInnerText(inner);
          if (text.trim()) {
            activities.push({
              date: date ? date.substring(0, 10) : '',
              timestamp: date || undefined,
              description: `Removed: ${text.trim()}`,
              author: author || undefined,
              sheet: `Table ${tableIndex}`,
              cell: `R${rowIndex}C${colIndex}`,
              changeType: 'delete',
            });
          }
        }
      }
    }
  }
  return activities;
}

// Extract tracked changes outside tables (best-effort)
function extractDocxTrackedChanges(xml: string): DocActivity[] {
  const activities: DocActivity[] = [];
  const insRegex = /<w:ins([^>]*)>([\s\S]*?)<\/w:ins>/g;
  let m: RegExpExecArray | null;
  while ((m = insRegex.exec(xml)) !== null) {
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const author = attrValue(attrs, 'w:author');
    const date = attrValue(attrs, 'w:date');
    const text = extractInnerText(inner);
    if (text.trim()) {
      activities.push({
        date: date ? date.substring(0, 10) : '',
        timestamp: date || undefined,
        description: text.trim(),
        author: author || undefined,
        changeType: 'insert',
      });
    }
  }
  const delRegex = /<w:del([^>]*)>([\s\S]*?)<\/w:del>/g;
  let d: RegExpExecArray | null;
  while ((d = delRegex.exec(xml)) !== null) {
    const attrs = d[1] || '';
    const inner = d[2] || '';
    const author = attrValue(attrs, 'w:author');
    const date = attrValue(attrs, 'w:date');
    const text = extractInnerText(inner);
    if (text.trim()) {
      activities.push({
        date: date ? date.substring(0, 10) : '',
        timestamp: date || undefined,
        description: `Removed: ${text.trim()}`,
        author: author || undefined,
        changeType: 'delete',
      });
    }
  }
  return activities;
}

function attrValue(attrs: string, key: string): string | undefined {
  const re = new RegExp(key + '="([^"]+)"');
  const mm = attrs.match(re);
  return mm ? mm[1] : undefined;
}

function extractInnerText(innerXml: string): string {
  // collect <w:t>text</w:t>
  const texts = [] as string[];
  const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tRegex.exec(innerXml)) !== null) {
    texts.push(decodeXmlEntities(tm[1]));
  }
  return texts.join(' ');
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ------------------------- XLSX -------------------------

async function parseXlsx(file: File): Promise<ParseResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(data, { type: 'array' });

  type SnapshotRow = {
    key: string;
    rowIndex: number; // 1-based index in sheet
    values: Record<string, string>;
  };
  type Snapshot = {
    sheet: string;
    header: string[];
    rows: SnapshotRow[];
    indices: Record<string, number>; // header -> col index
    keyCol: number;
    dateCol?: number;
  };

  const sheets: string[] = [...wb.SheetNames];
  const snapshots: Snapshot[] = [];

  const headerCandidates = {
    date: ['date', 'data', 'updated', 'last updated'],
    key: ['page', 'task', 'zadanie', 'opis', 'title', 'request', 'name'],
    status: ['status', 'state'],
    comments: ['comments', 'komentarz', 'uwagi', 'notes', 'note'],
    owner: ['owner', 'assigned', 'assignee'],
  };

  function findIndex(headerRow: string[], cands: string[]): number {
    for (const c of cands) {
      const idx = headerRow.findIndex((h) => h === c);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  for (const sheetName of sheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows2d: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    if (rows2d.length === 0) continue;

    const headerRow = (rows2d[0] || []).map((h: any) => String(h || '').trim().toLowerCase());
    const indices: Record<string, number> = {};
    headerRow.forEach((h, i) => (indices[h] = i));

    const idxKey = findIndex(headerRow, headerCandidates.key);
    const idxDate = findIndex(headerRow, headerCandidates.date);

    const snapshot: Snapshot = {
      sheet: sheetName,
      header: headerRow,
      rows: [],
      indices,
      keyCol: idxKey >= 0 ? idxKey : 0,
      dateCol: idxDate >= 0 ? idxDate : undefined,
    };

    for (let r = 1; r < rows2d.length; r++) {
      const row = rows2d[r] || [];
      const key = String(row[snapshot.keyCol] || '').trim();
      if (!key) continue;

      const values: Record<string, string> = {};
      for (let c = 0; c < headerRow.length; c++) {
        const hv = headerRow[c];
        if (!hv) continue;
        values[hv] = String(row[c] ?? '').trim();
      }

      snapshot.rows.push({ key, rowIndex: r, values });
    }

    snapshots.push(snapshot);
  }

  const activities: DocActivity[] = [];

  // Diff consecutive snapshots to get change history
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];

    const prevMap = new Map<string, SnapshotRow>(prev.rows.map((r) => [r.key, r]));
    const currMap = new Map<string, SnapshotRow>(curr.rows.map((r) => [r.key, r]));

    const fieldCands = [
      ...headerCandidates.status,
      ...headerCandidates.comments,
      ...headerCandidates.owner,
    ];

    // Keys present in current snapshot
    for (const [key, newRow] of currMap.entries()) {
      const oldRow = prevMap.get(key);
      if (!oldRow) {
        // Added row
        activities.push({
          date: '',
          description: `Added: ${key}`,
          status: newRow.values['status'] || newRow.values['state'] || undefined,
          sheet: curr.sheet,
          cell: XLSX.utils.encode_cell({ r: newRow.rowIndex, c: curr.keyCol }),
          changeType: 'insert',
        });
        continue;
      }
      // Compare fields
      for (const fname of fieldCands) {
        const oldVal = oldRow.values[fname] || '';
        const newVal = newRow.values[fname] || '';
        if (oldVal !== newVal && (oldVal || newVal)) {
          const col = curr.indices[fname] ?? 0;
          const cellRef = XLSX.utils.encode_cell({ r: newRow.rowIndex, c: col });
          const humanField = fname.charAt(0).toUpperCase() + fname.slice(1);
          const desc = `${humanField} changed for "${key}": ${oldVal || '(empty)'} → ${newVal || '(empty)'} `;
          const date = curr.dateCol != null ? normalizeDate(newRow.values[curr.header[curr.dateCol]]) : '';
          activities.push({
            date,
            description: desc.trim(),
            status: (fname === 'status' || fname === 'state') ? newVal || undefined : undefined,
            sheet: curr.sheet,
            cell: cellRef,
            changeType: fname === 'status' || fname === 'state' ? 'status-change' : 'edit',
          });
        }
      }
    }

    // Keys removed in current snapshot
    for (const [key, oldRow] of prevMap.entries()) {
      if (!currMap.has(key)) {
        activities.push({
          date: '',
          description: `Removed: ${key}`,
          sheet: curr.sheet,
          changeType: 'delete',
        });
      }
    }
  }

  // If no diffs detected, fall back to row-based extraction (first snapshot)
  if (activities.length === 0 && snapshots[0]) {
    const s0 = snapshots[0];
    const idxTask = s0.keyCol;
    const idxStatus = s0.indices['status'] ?? s0.indices['state'];
    const idxComments = s0.indices['comments'] ?? s0.indices['komentarz'] ?? s0.indices['uwagi'] ?? s0.indices['notes'] ?? s0.indices['note'];
    for (const row of s0.rows) {
      const description = row.values[s0.header[idxTask]] || '';
      const status = idxStatus != null ? row.values[s0.header[idxStatus]] : '';
      const date = s0.dateCol != null ? normalizeDate(row.values[s0.header[s0.dateCol]]) : '';
      const cellRef = XLSX.utils.encode_cell({ r: row.rowIndex, c: idxTask });
      if (description) {
        activities.push({
          date,
          description,
          status: status || undefined,
          sheet: s0.sheet,
          cell: cellRef,
          changeType: 'row',
        });
      }
    }
  }

  // Best-effort: detect embedded revision logs (rare in cloud scenarios)
  let revisionLogs = false;
  try {
    const zip = await JSZip.loadAsync(data.buffer);
    const revisions = Object.keys(zip.files).filter((p) => p.startsWith('xl/revisions/'));
    if (revisions.length > 0) revisionLogs = true;
  } catch {}

  return { source: 'xlsx', activities, meta: { sheets, revisionLogs } };
}

function normalizeDate(v: any): string {
  if (!v) return '';
  const s = String(v).trim();
  // Try ISO
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) {
    return iso.toISOString().split('T')[0];
  }
  // Try dd.mm.yyyy or dd-mm-yyyy
  const m = s.match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/); // yyyy-mm-dd first
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = s.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return s;
}
