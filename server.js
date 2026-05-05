import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const XLSX_FILE = process.env.ORDER_XLSX_FILE || path.join(__dirname, '2026_1-11반_반티주문서.xlsx');

let state = {
  ready: false,
  sourceFile: XLSX_FILE,
  students: new Map(),
  lastLoadedAt: null,
  loadError: null,
};

const headerAliases = {
  studentId: ['학번', 'studentId'],
  name: ['이름', 'name'],
  top_size: ['상의 사이즈', 'top_size'],
  top_sleeve: ['소매', 'top_sleeve'],
  top_number: ['등번호', 'top_number'],
  top_initial: ['이니셜', 'top_initial'],
  bottom_option: ['하의 옵션', 'bottom_option'],
  bottom_size: ['하의 사이즈', 'bottom_size'],
  cost_top: ['상의(12,000)', '상의 금액', 'cost_top'],
  cost_bottom: ['하의(5,000)', '하의 금액', 'cost_bottom'],
  cost_number: ['등번호(3,000)', '등번호 금액', 'cost_number'],
  cost_initial: ['이니셜(2,000)', '이니셜 금액', 'cost_initial'],
  cost_total: ['합계', '총 결제 금액', 'cost_total'],
  warning: ['주의사항', '내용', '비고', 'warning'],
};

function normalizeRowKeys(row) {
  const map = {};
  for (const [k, v] of Object.entries(row || {})) {
    map[String(k).trim()] = v;
  }
  return map;
}

function pick(row, field) {
  const aliases = headerAliases[field] || [];
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  return '';
}

function t(v) {
  const s = String(v ?? '').trim();
  return s ? s : '-';
}
function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function loadData() {
  const next = {
    ready: false,
    sourceFile: XLSX_FILE,
    students: new Map(),
    lastLoadedAt: null,
    loadError: null,
  };

  try {
    if (!fs.existsSync(XLSX_FILE)) {
      throw new Error(`엑셀 파일이 없습니다: ${XLSX_FILE}`);
    }

    const wb = xlsx.readFile(XLSX_FILE);
    const top = wb.Sheets['2_상의 개별내역'];
    const bottom = wb.Sheets['3_하의 개별내역'];
    const cost = wb.Sheets['4_학생별 비용'];
    const warn = wb.Sheets['5_주의사항'];

    if (!top || !bottom || !cost) {
      throw new Error('필수 시트 누락: 2_상의 개별내역, 3_하의 개별내역, 4_학생별 비용');
    }

    const tops = xlsx.utils.sheet_to_json(top, { defval: '' }).map(normalizeRowKeys);
    const bottoms = xlsx.utils.sheet_to_json(bottom, { defval: '' }).map(normalizeRowKeys);
    const costs = xlsx.utils.sheet_to_json(cost, { defval: '' }).map(normalizeRowKeys);
    const warns = warn ? xlsx.utils.sheet_to_json(warn, { defval: '' }).map(normalizeRowKeys) : [];

    for (const r of tops) {
      const studentId = String(pick(r, 'studentId')).trim();
      if (!/^\d{5}$/.test(studentId)) continue;

      next.students.set(studentId, {
        studentId,
        name: t(pick(r, 'name')),
        top: {
          size: t(pick(r, 'top_size')),
          sleeve: t(pick(r, 'top_sleeve')),
          number: t(pick(r, 'top_number')),
          initial: t(pick(r, 'top_initial')),
        },
        bottom: { ordered: false, option: '-', size: '-' },
        cost: { top: 0, bottom: 0, number: 0, initial: 0, total: 0 },
        warnings: [],
      });
    }

    for (const r of bottoms) {
      const studentId = String(pick(r, 'studentId')).trim();
      const rec = next.students.get(studentId);
      if (!rec) continue;

      const option = t(pick(r, 'bottom_option'));
      const size = t(pick(r, 'bottom_size'));
      const ordered = option !== '-' || size !== '-';
      rec.bottom = { ordered, option: ordered ? option : '-', size: ordered ? size : '-' };
    }

    for (const r of costs) {
      const studentId = String(pick(r, 'studentId')).trim();
      const rec = next.students.get(studentId);
      if (!rec) continue;

      rec.cost = {
        top: n(pick(r, 'cost_top')),
        bottom: n(pick(r, 'cost_bottom')),
        number: n(pick(r, 'cost_number')),
        initial: n(pick(r, 'cost_initial')),
        total: n(pick(r, 'cost_total')),
      };
    }

    for (const r of warns) {
      const studentId = String(pick(r, 'studentId')).trim();
      const rec = next.students.get(studentId);
      if (!rec) continue;
      const w = t(pick(r, 'warning'));
      if (w !== '-') rec.warnings.push(w);
    }

    next.ready = true;
    next.lastLoadedAt = new Date().toISOString();
  } catch (err) {
    next.loadError = err instanceof Error ? err.message : '알 수 없는 로딩 오류';
  }

  state = next;
}

function badRequest(message) {
  return { ok: false, status: 'INVALID_REQUEST', message, data: null };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ready: state.ready,
    sourceFile: state.sourceFile,
    studentCount: state.students.size,
    lastLoadedAt: state.lastLoadedAt,
    loadError: state.loadError,
  });
});

app.post('/api/reload', (_req, res) => {
  loadData();
  res.json({ ok: true, ready: state.ready, loadError: state.loadError, studentCount: state.students.size });
});

app.get('/api/order', (req, res) => {
  if (!state.ready) {
    return res.status(503).json({
      ok: false,
      status: 'SERVER_NOT_READY',
      message: `서버 데이터 로딩 실패: ${state.loadError || '원인 미상'}`,
      data: null,
    });
  }

  const studentId = String(req.query.studentId || '').trim();
  if (!studentId) return res.status(400).json(badRequest('학번을 입력해주세요.'));
  if (!/^\d+$/.test(studentId)) return res.status(400).json(badRequest('학번은 숫자만 입력해주세요.'));
  if (!/^\d{5}$/.test(studentId)) return res.status(400).json(badRequest('학번은 5자리로 입력해주세요.'));

  const rec = state.students.get(studentId);
  if (!rec) {
    return res.status(404).json({ ok: false, status: 'NOT_FOUND', message: '입력한 학번의 주문 정보를 찾을 수 없습니다.', data: null });
  }

  const isNoOrder = rec.cost.total === 0 && rec.top.size === '-' && rec.bottom.ordered === false;
  return res.json({ ok: true, status: isNoOrder ? 'NO_ORDER' : 'FOUND', message: isNoOrder ? '아직 주문 정보가 확인되지 않았습니다.' : '조회 성공', data: rec });
});

app.use(express.static(__dirname));

loadData();
app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
});
