/* ══════════════════════════════════════
   exportImport.js - JSON/CSV 내보내기·불러오기
══════════════════════════════════════ */
import { uid } from './helpers.js';

/** 파일 다운로드 트리거 */
function _download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** JSON 내보내기 */
export function exportJSON(sentences) {
  const data = JSON.stringify(sentences, null, 2);
  _download(data, `english-sentences-${_dateStr()}.json`, 'application/json');
}

/** CSV 내보내기 */
export function exportCSV(sentences) {
  const header = 'id,korean,english,level,createdAt\n';
  const rows   = sentences.map(s => [
    _esc(s.id),
    _esc(s.korean),
    _esc(s.english),
    s.level,
    s.createdAt,
  ].join(',')).join('\n');
  _download(header + rows, `english-sentences-${_dateStr()}.csv`, 'text/csv;charset=utf-8;');
}

/** JSON 또는 CSV 파일 불러오기 → Sentence[] 반환 */
export function importFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        if (file.name.endsWith('.json')) {
          resolve(_parseJSON(text));
        } else if (file.name.endsWith('.csv')) {
          resolve(_parseCSV(text));
        } else {
          reject(new Error('지원하지 않는 파일 형식입니다.'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsText(file, 'UTF-8');
  });
}

function _parseJSON(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('올바른 JSON 배열이 아닙니다.');
  return data.map(_normalize);
}

function _parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // 헤더 건너뜀
  return lines.slice(1).map(line => {
    const cols = _csvParseLine(line);
    return _normalize({
      id:        cols[0] || uid(),
      korean:    cols[1] || '',
      english:   cols[2] || '',
      level:     parseInt(cols[3]) || 1,
      createdAt: parseInt(cols[4]) || Date.now(),
    });
  }).filter(s => s.korean && s.english);
}

function _normalize(s) {
  return {
    id:        s.id || uid(),
    korean:    (s.korean || '').trim(),
    english:   (s.english || '').trim(),
    level:     [1,2,3].includes(Number(s.level)) ? Number(s.level) : 1,
    createdAt: s.createdAt || Date.now(),
  };
}

/** 간단한 CSV 한 줄 파서 (쌍따옴표 이스케이프 지원) */
function _csvParseLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/** CSV 셀 이스케이프 */
function _esc(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function _dateStr() {
  return new Date().toISOString().slice(0, 10);
}
