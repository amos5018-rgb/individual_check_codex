const API_BASE_URL = 'PUT_YOUR_GAS_EXEC_URL_HERE';

const studentIdInput = document.getElementById('studentId');
const searchBtn = document.getElementById('searchBtn');
const messageEl = document.getElementById('message');
const resultEl = document.getElementById('result');

searchBtn.addEventListener('click', onSearch);
studentIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onSearch();
});

async function onSearch() {
  const studentId = studentIdInput.value.trim();

  const validationError = validateStudentId(studentId);
  if (validationError) {
    showMessage(validationError, 'error');
    hideResult();
    return;
  }

  try {
    showMessage('조회 중입니다...', 'ok');
    hideResult();

    const url = `${API_BASE_URL}?studentId=${encodeURIComponent(studentId)}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!json.ok) {
      showMessage(json.message || '조회에 실패했습니다.', 'error');
      return;
    }

    showMessage(json.message || '조회 성공', 'ok');
    renderResult(json.data);
  } catch (err) {
    showMessage('조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
  }
}

function validateStudentId(studentId) {
  if (!studentId) return '학번을 입력해주세요.';
  if (!/^\d+$/.test(studentId)) return '학번은 숫자만 입력해주세요.';
  if (!/^\d{5}$/.test(studentId)) return '학번은 5자리로 입력해주세요.';
  return null;
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
  const warnings = data.warnings && data.warnings.length > 0
    ? `<ul class="warn-list">${data.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
    : '<p>확인 필요 사항 없음</p>';

  resultEl.innerHTML = `
    ${card('기본 정보', [
      ['이름', data.name],
      ['학번', data.studentId],
    ])}
    ${card('상의 정보', [
      ['상의 사이즈', data.top.size],
      ['소매', data.top.sleeve],
      ['등번호', data.top.number],
      ['이니셜', data.top.initial],
    ])}
    ${card('하의 정보', [
      ['하의 구매 여부', data.bottom.ordered ? '신청' : '미신청'],
      ['하의 옵션', data.bottom.option],
      ['하의 사이즈', data.bottom.size],
    ])}
    ${card('결제 금액', [
      ['상의 금액', formatKRW(data.cost.top)],
      ['하의 금액', formatKRW(data.cost.bottom)],
      ['등번호 금액', formatKRW(data.cost.number)],
      ['이니셜 금액', formatKRW(data.cost.initial)],
      ['총 결제 금액', formatKRW(data.cost.total)],
    ])}
    <article class="info-card"><h2>확인 필요 사항</h2>${warnings}</article>
  `;
  resultEl.classList.remove('hidden');
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
