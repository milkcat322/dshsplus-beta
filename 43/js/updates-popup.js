// ===== 업데이트 소식 =====
// 아직 안 본 주요 업데이트가 있으면 들어올 때 한 번 팝업으로 보여 줍니다. 닫으면 이 기기에 기억합니다.
// 좌측 상단 버튼으로는 언제든 전체 내역을 봅니다. 내용은 updates.js 에 있습니다.
(function () {
  const list = window.DSHS_UPDATES || [];
  const KEY = 'dshs-update-seen';
  const btn = document.getElementById('updBtn'), modal = document.getElementById('updModal');
  const majors = list.filter(u => u.major);
  let seen = null;
  try { seen = localStorage.getItem(KEY); } catch {}
  // 마지막으로 본 주요 업데이트보다 최신인 것들. 처음 온 사람에게는 가장 최근 것 하나만 보여 줍니다.
  const seenAt = majors.findIndex(u => u.id === seen);
  const unseen = seenAt < 0 ? majors.slice(0, 1) : majors.slice(0, seenAt);

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = d => { const [, m, dd] = d.split('-'); return `${+m}월 ${+dd}일`; };
  const entry = u => `<div class="upd-entry">
    <div class="upd-date">${day(u.date)}${u.major ? '<span class="upd-tag">주요</span>' : ''}</div>
    <div class="upd-title">${esc(u.title)}</div>
    ${u.items.length ? `<ul class="upd-items">${u.items.map(i => `<li>${esc(i).replace(/{([a-z_]+)}/g, (m, n) => icon(n))}</li>`).join('')}</ul>` : ''}
  </div>`;

  function open(title, entries, foot) {
    modal.innerHTML = `<div class="study-sheet upd-sheet" role="dialog" aria-modal="true" aria-labelledby="updTitle">
      <div class="study-sheet-head"><div class="sheet-title" id="updTitle">${title}</div><button class="study-x" type="button" aria-label="닫기">✕</button></div>
      ${entries.map(entry).join('')}${foot}
    </div>`;
    modal.className = 'study-modal show';
    modal.querySelectorAll('.study-x, .upd-ok').forEach(b => b.onclick = close);
    modal.onclick = e => { if (e.target === modal) close(); };
    // 피드백 탭: 보내는 창은 js/ 의 openFeedback (로그인 정보가 거기 있음)
    const fbTab = modal.querySelector('[data-utab="fb"]');
    if (fbTab) fbTab.onclick = () => { close(); if (window.openFeedback) window.openFeedback(); };
  }
  // 업데이트 내역 · 피드백 탭 머리 (피드백 창도 같은 머리를 씁니다)
  window.updTabs = on => `<div class="study-tabs">
    <button class="study-tab${on === 'upd' ? ' on' : ''}" type="button" data-utab="upd">업데이트 내역</button>
    <button class="study-tab${on === 'fb' ? ' on' : ''}" type="button" data-utab="fb">피드백${btn.classList.contains('has-reply') ? '<span class="tab-dot" aria-label="새 답장"></span>' : ''}</button></div>`;
  window.openUpdates = () => open(window.updTabs('upd'), list, '');
  function close() {
    modal.className = 'study-modal';
    if (majors.length) { try { localStorage.setItem(KEY, majors[0].id); } catch {} }
    btn.classList.remove('has-new');
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('show')) close(); });

  btn.onclick = window.openUpdates;
  if (unseen.length) {
    btn.classList.add('has-new');
    open(icon('auto_awesome') + ' 새로워진 점', unseen, '<button class="study-submit upd-ok" type="button">확인했어요</button>');
  }
})();
