"use strict";
// dshs43.app — js/notice.js: 수행평가 공지 탭
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 수행평가 공지 탭 ----------
// 분반에 공지된 것 + 내가 올렸지만 아직 승인 안 된(또는 반려된) 것. 내 것은 승인과 상관없이 나에게 보입니다.
const noticeItems = () => [...cache.items, ...(cache.mine || []).filter((a) => a.status !== "approved")].sort(byDue);
// 위: 다가오는 수행평가 전체를 한 줄씩 (많아도 한눈에). 아래: 과목 블록을 누르면 그 아래에 그 과목 공지.
let openSubj = null;    // 고른 과목 이름
const ASG_SORT_KEY = "dshs-asg-sort";
let asgSort = (() => { try { return localStorage.getItem(ASG_SORT_KEY) === "subject" ? "subject" : "due"; } catch { return "due"; } })();

// 수행평가 한 줄: 완료 체크 · D-day · 과목 · 제목 · 마감 일시. 누르면 자세히
function asgRow(a, showSubj = true) {
  const d = asgDue(a), done = cache.done.has(a.id);
  return `<div class="asg-row${done ? " done" : ""}">
    <button class="asg-chk${done ? " on" : ""}" data-chk="asg:${a.id}" aria-label="${done ? "완료 취소" : "완료 표시"}">${done ? "✓" : ""}</button>
    <button class="asg-row-main" data-open="asg:${a.id}">
      <span class="due-badge ${d.tone}">${d.label}</span>
      ${showSubj ? `<span class="ar-subj">${esc(subjName(a.subject))}</span>` : ""}
      <span class="ar-title">${esc(a.title)}</span>${stBadge(a.status)}
      <span class="ar-when">${a.due_at ? `${md(new Date(a.due_at))} ${hm(new Date(a.due_at))}` : "미정"}</span>
    </button>
  </div>`;
}

function allAsgHtml(now) {
  const up = noticeItems().filter((a) => dueMs(a) >= +now);   // 마감 일시 없는 것은 맨 뒤
  const left = up.filter((a) => !cache.done.has(a.id)).length;
  const sortBtns = [["due", "마감 기한순"], ["subject", "과목별"]].map(([k, label]) =>
    `<button class="seg-btn${asgSort === k ? " on" : ""}" data-asort="${k}">${label}</button>`).join("");
  let list;
  if (!up.length) list = `<div class="study-empty">다가오는 수행평가가 없어요.</div>`;
  else if (asgSort === "due") list = up.map((a) => asgRow(a)).join("");
  else list = [...new Set(up.map((a) => a.subject))].sort((x, y) => x.localeCompare(y, "ko")).map((s) => {
    const rows = up.filter((a) => a.subject === s);
    return `<div class="ar-group">${esc(subjName(s))} <small>${rows.length}</small></div>` + rows.map((a) => asgRow(a, false)).join("");
  }).join("");
  return `<div class="asg-all-head"><div class="study-section">전체 수행평가 · 남은 ${left}건</div><div class="seg">${sortBtns}</div></div>
    <div class="asg-rows">${list}</div>`;
}

function renderNotice() {
  destroyCal();
  view = "notice";
  const body = $("studyBody");
  const now = new Date();
  const subjects = noticeSubjects(now);
  const picked = subjects.find((sj) => sj.name === openSubj);
  body.innerHTML =
    allAsgHtml(now) +
    `<div class="study-section">과목별 수행평가</div>` +
    `<div class="subj-grid">${subjects.map(subjBlock).join("")}</div>` +
    `<div id="subjDetail">${picked ? subjDetail(picked) : `<div class="subj-hint">과목을 누르면 그 과목 수행평가가 여기에 보여요</div>`}</div>`;
  body.querySelectorAll("[data-subj]").forEach((b) => b.onclick = () => {
    openSubj = openSubj === b.dataset.subj ? null : b.dataset.subj;
    renderNotice();
    if (openSubj) $("subjDetail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  body.querySelectorAll("[data-adone]").forEach((b) => b.onclick = () => toggleDone("asg", b.dataset.adone));
  body.querySelectorAll("[data-asort]").forEach((b) => b.onclick = () => {
    asgSort = b.dataset.asort;
    try { localStorage.setItem(ASG_SORT_KEY, asgSort); } catch {}
    renderNotice();
  });
  bindRows(body);
}

// 내 과목(관리자는 전체 과목)마다 공지를 묶습니다. 남은 공지가 있는 과목을 마감 가까운 순으로 위에.
function noticeSubjects(now) {
  return asgSubjects().map((name) => {
    const items = noticeItems().filter((a) => a.subject === name);
    const up = items.filter((a) => dueMs(a) >= +now);   // 마감 일시 없는 공지는 끝나지 않은 것으로
    const left = up.filter((a) => !cache.done.has(a.id));
    const bans = [...new Set(myClasses.filter((c) => c.subject === name).map((c) => banLabel(c.ban)))];
    const credit = SUBJECT_CREDITS[name];
    return {
      name, up, left,
      past: items.filter((a) => dueMs(a) < +now).reverse().slice(0, 5),
      ban: bans.join(", ") + (credit ? ` · ${credit}학점` : ""),   // 43기는 모두 "전체 분반 · n학점"
    };
  }).sort((x, y) =>
    (!x.left.length - !y.left.length) ||
    (x.left.length ? byDue(x.left[0], y.left[0]) : 0) ||
    x.name.localeCompare(y.name, "ko"));
}

function subjBlock(sj) {
  const next = sj.left[0] ? asgDue(sj.left[0]) : null;
  return `<button class="subj-box${sj.left.length ? " has" : ""}${openSubj === sj.name ? " on" : ""}" data-subj="${esc(sj.name)}" aria-pressed="${openSubj === sj.name}">
    <span class="subj-name">${esc(subjName(sj.name))}</span>
    <span class="subj-ban">${esc(sj.ban)}</span>
    <span class="subj-meta">${next
      ? `<span class="due-badge ${next.tone}">${next.label}</span>${sj.left.length}건`
      : sj.up.length ? "모두 완료" : "없음"}</span>
  </button>`;
}

function subjDetail(sj) {
  return `<div class="subj-detail">
    <div class="study-section">${esc(subjName(sj.name))} 수행평가</div>
    ${sj.up.length ? sj.up.map((a) => card(a, { check: true })).join("")
      : `<div class="study-empty">다가오는 수행평가가 없어요.</div>`}
    ${sj.past.length ? `<div class="study-section">지난 수행평가</div>` + sj.past.map((a) => card(a, { check: true })).join("") : ""}
  </div>`;
}
