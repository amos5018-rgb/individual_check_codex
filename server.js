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

let students = new Map();

function normText(v) {
  const t = String(v ?? '').trim();
  return t ? t : '-';
}
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function toBool(v) {
  const t = String(v ?? '').trim().toLowerCase();
  return ['true', '1', 'y', 'yes', '신청', '구매'].includes(t);
}

function detectColumn(row, candidates) {
  const keys = Object.keys(row || {});
  for (const c of candidates) {
    const found = keys.find((k) => String(k).trim() === c);
    if (found) return found;
  }
  return null;
}

function loadWorkbookData() {
  if (!fs.existsSync(XLSX_FILE)) {
    throw new Error(`엑셀 파일을 찾을 수 없습니다: ${XLSX_FILE}`);
  }

  const wb = xlsx.readFile(XLSX_FILE);
  const topSheet = wb.Sheets['2_상의 개별내역'];
  const bottomSheet = wb.Sheets['3_하의 개별내역'];
  const costSheet = wb.Sheets['4_학생별 비용'];
  const warnSheet = wb.Sheets['5_주의사항'];

  if (!topSheet || !bottomSheet || !costSheet) {
    throw new Error('필수 시트(2_상의 개별내역, 3_하의 개별내역, 4_학생별 비용)가 없습니다.');
  }

  const tops = xlsx.utils.sheet_to_json(topSheet, { defval: '' });
  const bottoms = xlsx.utils.sheet_to_json(bottomSheet, { defval: '' });
  const costs = xlsx.utils.sheet_to_json(costSheet, { defval: '' });
  const warns = warnSheet ? xlsx.utils.sheet_to_json(warnSheet, { defval: '' }) : [];

  const map = new Map();

  for (const r of tops) {
    const sidKey = detectColumn(r, ['학번', 'studentId']);
    const nameKey = detectColumn(r, ['이름', 'name']);
    const sizeKey = detectColumn(r, ['상의 사이즈']);
    const sleeveKey = detectColumn(r, ['소매']);
    const numberKey = detectColumn(r, ['등번호']);
    const initialKey = detectColumn(r, ['이니셜']);
    const studentId = String(r[sidKey] ?? '').trim();
    if (!/^\d{5}$/.test(studentId)) continue;

    map.set(studentId, {
      studentId,
      name: normText(r[nameKey]),
      top: {
        size: normText(r[sizeKey]),
        sleeve: normText(r[sleeveKey]),
        number: normText(r[numberKey]),
        initial: normText(r[initialKey]),
      },
      bottom: { ordered: false, option: '-', size: '-' },
      cost: { top: 0, bottom: 0, number: 0, initial: 0, total: 0 },
      warnings: [],
    });
  }

  for (const r of bottoms) {
    const sidKey = detectColumn(r, ['학번', 'studentId']);
    const optionKey = detectColumn(r, ['하의 옵션']);
    const sizeKey = detectColumn(r, ['하의 사이즈']);
    const studentId = String(r[sidKey] ?? '').trim();
    if (!map.has(studentId)) continue;

    const rec = map.get(studentId);
    const option = normText(r[optionKey]);
    const size = normText(r[sizeKey]);
    const ordered = option !== '-' || size !== '-';
    rec.bottom = { ordered, option: ordered ? option : '-', size: ordered ? size : '-' };
  }

  for (const r of costs) {
    const sidKey = detectColumn(r, ['학번', 'studentId']);
    const studentId = String(r[sidKey] ?? '').trim();
    if (!map.has(studentId)) continue;

    const topAmtKey = detectColumn(r, ['상의(12,000)', '상의 금액']);
    const bottomAmtKey = detectColumn(r, ['하의(5,000)', '하의 금액']);
    const numberAmtKey = detectColumn(r, ['등번호(3,000)', '등번호 금액']);
    const initialAmtKey = detectColumn(r, ['이니셜(2,000)', '이니셜 금액']);
    const totalKey = detectColumn(r, ['합계', '총 결제 금액']);

    const rec = map.get(studentId);
    rec.cost = {
      top: toInt(r[topAmtKey]),
      bottom: toInt(r[bottomAmtKey]),
      number: toInt(r[numberAmtKey]),
      initial: toInt(r[initialAmtKey]),
      total: toInt(r[totalKey]),
    };
  }

  for (const r of warns) {
    const sidKey = detectColumn(r, ['학번', 'studentId']);
    const msgKey = detectColumn(r, ['주의사항', '내용', '비고']);
    const studentId = String(r[sidKey] ?? '').trim();
    if (!map.has(studentId)) continue;
    const msg = normText(r[msgKey]);
    if (msg !== '-') map.get(studentId).warnings.push(msg);
  }

  students = map;
}

app.get('/api/order', (req, res) => {
  const studentId = String(req.query.studentId || '').trim();

  if (!studentId) {
    return res.status(400).json({ ok: false, status: 'INVALID_REQUEST', message: '학번을 입력해주세요.', data: null });
  }
  if (!/^\d+$/.test(studentId)) {
    return res.status(400).json({ ok: false, status: 'INVALID_REQUEST', message: '학번은 숫자만 입력해주세요.', data: null });
  }
  if (!/^\d{5}$/.test(studentId)) {
    return res.status(400).json({ ok: false, status: 'INVALID_REQUEST', message: '학번은 5자리로 입력해주세요.', data: null });
  }

  const data = students.get(studentId);
  if (!data) {
    return res.status(404).json({ ok: false, status: 'NOT_FOUND', message: '입력한 학번의 주문 정보를 찾을 수 없습니다.', data: null });
  }

  const noOrder = data.cost.total === 0 && data.top.size === '-' && !data.bottom.ordered;
  return res.json({ ok: true, status: noOrder ? 'NO_ORDER' : 'FOUND', message: noOrder ? '아직 주문 정보가 확인되지 않았습니다.' : '조회 성공', data });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, students: students.size });
});

app.use(express.static(__dirname));

try {
  loadWorkbookData();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
