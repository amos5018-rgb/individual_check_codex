const CONFIG = {
  // 우선순위: window 전역 설정 > data attribute > 하드코딩 상수
  apiBaseUrl:
    (window.__APP_CONFIG__ && window.__APP_CONFIG__.apiBaseUrl) ||
    document.body?.dataset?.apiBaseUrl ||
    '/api/order',
};

const studentIdInput = document.getElementById('studentId');
const searchBtn = document.getElementById('searchBtn');
const messageEl = document.getElementById('message');
const resultEl = document.getElementById('result');

let isLoading = false;

searchBtn.addEventListener('click', onSearch);
studentIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onSearch();
});
studentIdInput.addEventListener('input', () => {
  // 모바일 키보드에서 공백/기호가 섞일 수 있어 숫자만 유지
  studentIdInput.value = studentIdInput.value.replace(/\D/g, '').slice(0, 5);
});

async function onSearch() {
  if (isLoading) return;

  const studentId = studentIdInput.value.trim();
  const validationError = validateStudentId(studentId);
  if (validationError) {
    showMessage(validationError, 'error');
    hideResult();
    return;
  }

  const apiError = validateApiBaseUrl(CONFIG.apiBaseUrl);
  if (apiError) {
    showMessage(apiError, 'error');
    hideResult();
    return;
  }

  try {
    setLoading(true);
    showMessage('조회 중입니다...', 'ok');
    hideResult();

    const url = `${CONFIG.apiBaseUrl}?studentId=${encodeURIComponent(studentId)}`;
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });

    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }

    const json = await res.json();
    if (!isValidApiResponse(json)) {
      throw new Error('INVALID_API_RESPONSE');
    }

    if (!json.ok) {
      showMessage(json.message || '조회에 실패했습니다.', 'error');
      return;
    }

    showMessage(json.message || '조회 성공', 'ok');
    renderResult(json.data);
  } catch (err) {
    showMessage('조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
  } finally {
    setLoading(false);
  }
}

function validateStudentId(studentId) {
  if (!studentId) return '학번을 입력해주세요.';
  if (!/^\d+$/.test(studentId)) return '학번은 숫자만 입력해주세요.';
  if (!/^\d{5}$/.test(studentId)) return '학번은 5자리로 입력해주세요.';
  return null;
}

function validateApiBaseUrl(url) {
  if (!url || url.includes('PUT_YOUR_GAS_EXEC_URL_HERE')) {
    return 'API 주소가 설정되지 않았습니다. 관리자에게 문의하세요.';
  }
  return null;
}

function isValidApiResponse(json) {
  return json && typeof json === 'object' && 'ok' in json && 'status' in json;
}

function setLoading(loading) {
  isLoading = loading;
  searchBtn.disabled = loading;
  searchBtn.textContent = loading ? '조회 중...' : '조회하기';
}

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function hideResult() {
  resultEl.classList.add('hidden');
  resultEl.innerHTML = '';
}

function renderResult(data) {
  const safeData = normalizeData(data);
  const warnings = safeData.warnings.length > 0
    ? `<ul class="warn-list">${safeData.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
    : '<p>확인 필요 사항 없음</p>';

  resultEl.innerHTML = `
    ${card('기본 정보', [
      ['이름', safeData.name],
      ['학번', safeData.studentId],
    ])}
    ${card('상의 정보', [
      ['상의 사이즈', safeData.top.size],
      ['소매', safeData.top.sleeve],
      ['등번호', safeData.top.number],
      ['이니셜', safeData.top.initial],
    ])}
    ${card('하의 정보', [
      ['하의 구매 여부', safeData.bottom.ordered ? '신청' : '미신청'],
      ['하의 옵션', safeData.bottom.option],
      ['하의 사이즈', safeData.bottom.size],
    ])}
    ${card('결제 금액', [
      ['상의 금액', formatKRW(safeData.cost.top)],
      ['하의 금액', formatKRW(safeData.cost.bottom)],
      ['등번호 금액', formatKRW(safeData.cost.number)],
      ['이니셜 금액', formatKRW(safeData.cost.initial)],
      ['총 결제 금액', formatKRW(safeData.cost.total)],
    ])}
    <article class="info-card"><h2>확인 필요 사항</h2>${warnings}</article>
  `;
  resultEl.classList.remove('hidden');
}

function normalizeData(data) {
  return {
    studentId: String(data?.studentId ?? '-'),
    name: String(data?.name ?? '-'),
    top: {
      size: String(data?.top?.size ?? '-'),
      sleeve: String(data?.top?.sleeve ?? '-'),
      number: String(data?.top?.number ?? '-'),
      initial: String(data?.top?.initial ?? '-'),
    },
    bottom: {
      ordered: Boolean(data?.bottom?.ordered),
      option: String(data?.bottom?.option ?? '-'),
      size: String(data?.bottom?.size ?? '-'),
    },
    cost: {
      top: Number(data?.cost?.top || 0),
      bottom: Number(data?.cost?.bottom || 0),
      number: Number(data?.cost?.number || 0),
      initial: Number(data?.cost?.initial || 0),
      total: Number(data?.cost?.total || 0),
    },
    warnings: Array.isArray(data?.warnings) ? data.warnings : [],
  };
}

function card(title, rows) {
  return `<article class="info-card"><h2>${title}</h2>${rows
    .map(([k, v]) => `<div class="row"><span class="key">${k}</span><span class="value">${escapeHtml(String(v ?? '-'))}</span></div>`)
    .join('')}</article>`;
}

function formatKRW(n) {
  const num = Number(n) || 0;
  return `${num.toLocaleString('ko-KR')}원`;
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
