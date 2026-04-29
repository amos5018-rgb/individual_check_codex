const SPREADSHEET_ID = 'PUT_YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'students_normalized';

function doGet(e) {
  try {
    const studentId = (e && e.parameter && e.parameter.studentId ? String(e.parameter.studentId) : '').trim();

    const validationError = validateStudentId(studentId);
    if (validationError) {
      return jsonResponse({
        ok: false,
        status: 'INVALID_REQUEST',
        message: validationError,
        data: null,
      });
    }

    const row = findStudentRow(studentId);
    if (!row) {
      return jsonResponse({
        ok: false,
        status: 'NOT_FOUND',
        message: '입력한 학번의 주문 정보를 찾을 수 없습니다.',
        data: null,
      });
    }

    const data = mapRowToResponse(row);
    const isNoOrder = data.cost.total === 0 && data.top.size === '-' && data.bottom.ordered === false;

    return jsonResponse({
      ok: true,
      status: isNoOrder ? 'NO_ORDER' : 'FOUND',
      message: isNoOrder ? '아직 주문 정보가 확인되지 않았습니다.' : '조회 성공',
      data,
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      status: 'SERVER_ERROR',
      message: '서버 오류가 발생했습니다.',
      data: null,
    });
  }
}

function validateStudentId(studentId) {
  if (!studentId) return '학번을 입력해주세요.';
  if (!/^\d+$/.test(studentId)) return '학번은 숫자만 입력해주세요.';
  if (!/^\d{5}$/.test(studentId)) return '학번은 5자리로 입력해주세요.';
  return null;
}

function findStudentRow(studentId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + SHEET_NAME);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0];
  const idIndex = headers.indexOf('studentId');
  if (idIndex < 0) throw new Error('studentId 헤더가 없습니다.');

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[idIndex]).trim() === studentId) return toObject(headers, row);
  }

  return null;
}

function toObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i];
  });
  return obj;
}

function mapRowToResponse(row) {
  const warnings = String(row.warnings || '')
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);

  const ordered = parseOrdered(row.bottom_ordered);

  return {
    studentId: String(row.studentId || '').trim(),
    name: normalizeText(row.name),
    top: {
      size: normalizeText(row.top_size),
      sleeve: normalizeText(row.top_sleeve),
      number: normalizeText(row.top_number),
      initial: normalizeText(row.top_initial),
    },
    bottom: {
      ordered,
      option: ordered ? normalizeText(row.bottom_option) : '-',
      size: ordered ? normalizeText(row.bottom_size) : '-',
    },
    cost: {
      top: toInt(row.cost_top),
      bottom: ordered ? toInt(row.cost_bottom) : 0,
      number: toInt(row.cost_number),
      initial: toInt(row.cost_initial),
      total: toInt(row.cost_total),
    },
    warnings,
  };
}

function parseOrdered(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'true' || raw === 'y' || raw === 'yes' || raw === '1';
}

function normalizeText(value) {
  const t = String(value == null ? '' : value).trim();
  return t ? t : '-';
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
