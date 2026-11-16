"use strict";
// dshs43.app — js/meal.js: 급식
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 급식 ----------
// NEIS 급식 식단(학사일정과 같은 학교 코드). 브라우저에서 바로 받고(CORS 허용) 날짜별로 이 기기에 6시간 기억합니다.
// 인증키 없이 한 번에 5줄까지라 하루(조식 · 중식 · 석식 3줄)씩 받습니다.
const MEAL_API = "https://open.neis.go.kr/hub/mealServiceDietInfo";
const MEAL_KEY = "dshs-meal";
const MEAL_TTL = 6 * 3600 * 1000;
const ALLERGY = ["", "난류", "우유", "메밀", "땅콩", "대두", "밀", "고등어", "게", "새우", "돼지고기", "복숭아",
  "토마토", "아황산류", "호두", "닭고기", "쇠고기", "오징어", "조개류", "잣"];
let mealDay = null;   // 보고 있는 날 (YYYY-MM-DD)

function mealStore() { try { return JSON.parse(localStorage.getItem(MEAL_KEY) || "{}"); } catch { return {}; } }
async function fetchMeal(key) {
  const store = mealStore();
  const hit = store[key];
  if (hit && Date.now() - hit.at < MEAL_TTL) return hit.meals;
  const q = new URLSearchParams({ Type: "json", pSize: "5", ATPT_OFCDC_SC_CODE: "G10", SD_SCHUL_CODE: "7430032", MLSV_YMD: key.replaceAll("-", "") });
  try {
    const r = await fetch(`${MEAL_API}?${q}`, { cache: "no-store" });
    const j = await r.json();
    const rows = j.mealServiceDietInfo?.[1]?.row || [];
    if (!rows.length && j.RESULT?.CODE !== "INFO-200") throw new Error(j.RESULT?.MESSAGE || "neis");
    const meals = rows.sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE).map((m) => ({
      name: m.MMEAL_SC_NM,
      kcal: (m.CAL_INFO || "").replace(/\s*Kcal/i, ""),
      dishes: (m.DDISH_NM || "").split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean).map((s) => {
        // 끝의 (1.2.5) 가 알레르기 번호 (1~19). '스파클링(350)' 같은 용량은 이름에 그대로 둡니다
        let a = s.match(/\s*\(([\d.\s]+)\)\s*$/);
        const nums = a ? a[1].split(".").map(Number).filter(Boolean) : [];
        if (a && !(nums.length && nums.every((n) => n >= 1 && n < ALLERGY.length))) a = null;
        return { name: (a ? s.slice(0, a.index) : s).replace(/^\*/, "").trim(), allergy: a ? nums : [] };
      }),
    }));
    // 지난 날짜는 지우고 오늘 기준 앞뒤 2주만 남깁니다
    const keep = Date.now() - 14 * 86400000;
    for (const k of Object.keys(store)) if (parseDay(k) < keep) delete store[k];
    store[key] = { at: Date.now(), meals };
    try { localStorage.setItem(MEAL_KEY, JSON.stringify(store)); } catch {}
    return meals;
  } catch {
    return hit ? hit.meals : null;   // 못 받으면 예전에 받아 둔 것이라도
  }
}

// 지금 시각 기준 다음 끼니: 9시 전 조식 · 14시 전 중식 · 20시 전 석식, 그 뒤는 내일 조식
function nextMeal() {
  const n = new Date(), h = n.getHours() + n.getMinutes() / 60;
  if (h >= 20) return { key: dayKey(new Date(+n + 86400000)), name: "조식" };
  return { key: dayKey(n), name: h < 9 ? "조식" : h < 14 ? "중식" : "석식" };
}

async function renderMeal(key) {
  const next = nextMeal();
  mealDay = key || mealDay || next.key;
  const day = mealDay;
  const today = dayKey(new Date());
  const d = parseDay(day);
  const rel = day === today ? "오늘" : day === dayKey(new Date(Date.now() + 86400000)) ? "내일"
    : day === dayKey(new Date(Date.now() - 86400000)) ? "어제" : "";
  const shift = (n) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
  $("studyView").innerHTML = `
    <div class="study-head">
      <div>
        <h2>급식</h2>
        <div class="study-sub">대전과학고 식단 · NEIS</div>
      </div>
    </div>
    <div class="meal-nav">
      <button class="cal-nav" id="mealPrev" type="button" aria-label="전날" title="전날">${icon("chevron_left")}</button>
      <button class="meal-day" id="mealToday" title="오늘로">${d.getMonth() + 1}월 ${d.getDate()}일 (${"일월화수목금토"[d.getDay()]})${rel ? ` <span class="meal-rel">${rel}</span>` : ""}</button>
      <button class="cal-nav" id="mealNext" type="button" aria-label="다음 날" title="다음 날">${icon("chevron_right")}</button>
    </div>
    <div id="mealBody"><div class="study-empty">불러오는 중…</div></div>
    <div class="study-foot meal-legend">알레르기 번호 · ${ALLERGY.slice(1).map((a, i) => `${i + 1} ${a}`).join(" · ")}</div>`;
  $("mealPrev").onclick = () => renderMeal(shift(-1));
  $("mealNext").onclick = () => renderMeal(shift(1));
  $("mealToday").onclick = () => renderMeal(next.key);
  const meals = await fetchMeal(day);
  if (view !== "meal" || mealDay !== day) return;   // 그사이 다른 날 · 다른 탭으로 갔으면 그리지 않음
  const box = $("mealBody");
  if (meals === null) { box.innerHTML = `<div class="study-empty">급식 정보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</div>`; return; }
  if (!meals.length) { box.innerHTML = `<div class="study-empty">이날은 급식 정보가 없어요.</div>`; return; }
  box.innerHTML = `<div class="meal-list">${meals.map((m) => `
    <div class="meal-card">
      <div class="meal-head"><span class="meal-name">${esc(m.name)}</span>
        ${m.kcal ? `<span class="meal-kcal">${esc(m.kcal)} kcal</span>` : ""}</div>
      <ul class="meal-dishes">${m.dishes.map((x) => `<li>${esc(x.name)}${x.allergy.length
        ? ` <span class="meal-alg" title="${esc(x.allergy.map((n) => ALLERGY[n]).filter(Boolean).join(", "))}">${x.allergy.join(".")}</span>` : ""}</li>`).join("")}</ul>
    </div>`).join("")}</div>`;
  fetchMeal(shift(1));   // 다음 날도 미리 받아 둡니다
}

function renderStudy() {
  const subjects = `${asgSubjects().length}과목`;
  const [title, sub] = {
    cal: ["내 일정", `수행평가 ${subjects} + 개인 일정`],
    notice: ["수행평가", `43기 수행평가 ${subjects}`],
    todo: ["할 일", "체크하면서 하나씩 끝내요"],
  }[page];
  // 내 위치 줄과 알림 받기 카드는 시간표 탭(renderTimetable)에 있습니다
  $("studyView").innerHTML = `
    <div class="study-head">
      <div>
        <h2>${title}</h2>
        <div class="study-sub">${sub}</div>
      </div>
    </div>
    ${page === "cal" ? `<div class="study-row">
      <button class="add-btn" id="btnEv" type="button" aria-label="일정 추가" title="일정 추가">${icon("add")}<span class="add-label">일정 추가</span></button>
    </div>
    <div id="dshsHint"></div>` : ""}
    ${page === "notice" ? `<div class="study-row">
      <button class="add-btn" id="btnNew" type="button" aria-label="수행평가 추가" title="수행평가 추가">${icon("add")}<span class="add-label">수행평가 추가</span></button>
    </div>` : ""}
    <div id="studyBody"><div class="study-empty">불러오는 중…</div></div>`;
  if ($("btnEv")) $("btnEv").onclick = () => openEventForm(null);
  paintDshs();
  if ($("btnNew")) $("btnNew").onclick = () => openNewForm();   // 클릭 이벤트가 "고칠 공지" 로 넘어가지 않게
}

// quiet: 탭을 눌러 화면을 이미 그린 경우. 30초 안에 받았으면 다시 받지 않고, 받은 내용이 같으면 다시 그리지 않습니다.
// 일정 추가 · 수정 뒤처럼 인자 없이 부르면 늘 새로 받아 다시 그립니다.
let haveData = false, dataAt = 0, dataSig = "";
async function loadAssignments({ quiet = false } = {}) {
  if (!sb) await sbWait;   // 지난 화면에서 탭을 먼저 누른 경우
  if (!me || me.is_admin || otherCohort()) return;   // 관리자 계정은 관리자 사이트, 다른 기수는 그 기수 사이트에서 씁니다
  if (quiet && haveData && Date.now() - dataAt < 30000) return;
  loadDshs();   // dshs.app 신청 내역은 따로 받아서, 오면 달력에 더합니다
  const [asg, personal, evs, done, people, todos, school, invites, tgroups] = await Promise.all([
    sb.from("assignments").select("*").order("due_at", { ascending: true }),
    sb.from("assignment_personal").select("*"),
    sb.from("events").select("*").order("starts_at", { ascending: true }),   // 내 일정 + 친구가 공유한 일정
    sb.from("assignment_done").select("assignment_id"),
    sb.rpc("my_event_people"),
    sb.from("todos").select("*").order("created_at", { ascending: true }),
    sb.from("school_events").select("*, school_event_targets(student_id)").order("starts_at", { ascending: true }),
    sb.from("event_invites").select("event_id, student_id"),   // 내 일정에 학번으로 넣은 가입 전 친구 (invites.sql)
    sb.from("todo_groups").select("*").order("position").order("created_at"),   // 할 일 그룹 (todogroups.sql)
  ]);
  cache.school = school.data || [];
  cache.invites = new Map();   // 일정 id → [학번]
  for (const r of invites.data || []) {
    if (!cache.invites.has(r.event_id)) cache.invites.set(r.event_id, []);
    cache.invites.get(r.event_id).push(r.student_id);
  }
  cache.todos = todos.error ? null : todos.data;
  cache.todoGroups = tgroups.error ? null : tgroups.data;   // null 이면 그룹 기능을 숨깁니다 (표가 아직 없을 때)
  const { data, error } = asg;
  // 개인 일정·완료 체크를 못 불러와도 수행평가는 그대로 보여줍니다
  cache.events = evs.data || [];
  cache.done = new Set((done.data || []).map((r) => r.assignment_id));
  cache.people = new Map();   // 공유 일정 id → [{ user_id, name, is_owner, done }]
  for (const r of people.data || []) {
    if (!cache.people.has(r.event_id)) cache.people.set(r.event_id, []);
    cache.people.get(r.event_id).push(r);
  }
  if (error) {
    const body = $("studyBody");
    if (body) body.innerHTML = `<div class="study-empty">불러오지 못했어요.</div>`;
    return;
  }
  const sig = JSON.stringify([data, personal.data, evs.data, done.data, people.data, todos.data, school.data, invites.data, tgroups.data]);
  const same = haveData && sig === dataSig;
  haveData = true; dataAt = Date.now(); dataSig = sig;
  const mineOnly = new Map((personal.data || []).map((p) => [p.assignment_id, p]));
  const rows = (data || []).map((a) => withPersonal(a, mineOnly.get(a.id)));
  // 보이는 공지는 DB 권한(RLS, 기수별 수강 정보)이 정합니다. 혹시 다른 기수 과목 공지가 섞여 오더라도 43기 과목만 보여 줍니다.
  const mine43 = new Set(mySubjects());
  cache.items = rows.filter((a) => a.status === "approved" && mine43.has(a.subject));
  cache.mine = rows.filter((a) => a.created_by === me.id);
  cache.pending = rows.filter((a) => a.status === "pending");
  saveSnap();
  renderNav();   // 수행평가 탭 옆 숫자 갱신
  if (quiet && same) return;
  // 작성 중인 공지 추가 폼은 덮어쓰지 않습니다
  if ($("studyView").style.display === "block" && view !== "form") rerender();
}

// 마감 일시는 선택입니다. 없으면 D-? 로 보이고, 달력·알림·급한 공지에서는 빠집니다.
// 내 계정에서만 고친 내용을 덮어씌웁니다. 안 고친 칸은 공지 값을 따라갑니다. shared 가 원래 공지입니다.
function withPersonal(a, p) {
  if (!p || a.status !== "approved") return a;
  return {
    ...a, personal: true, shared: a,
    title: p.title ?? a.title,
    body: p.no_body ? "" : p.body ?? a.body,
    due_at: p.no_due ? null : p.due_at ?? a.due_at,
    submit_to: p.no_submit ? null : p.submit_to ?? a.submit_to,
  };
}

const dueMs = (a) => (a.due_at ? Date.parse(a.due_at) : Infinity);
const byDue = (a, b) => (dueMs(a) > dueMs(b)) - (dueMs(a) < dueMs(b));   // 마감 없는 공지는 맨 뒤
const asgDue = (a) => (a.due_at ? dueInfo(a.due_at) : { label: "D-?", tone: "ok", when: null });
// 수정: 승인된 수행평가는 누구나 (내 계정에서만 바뀝니다), 아직 나만 보이는 것은 작성자.
// 삭제: 작성자가 아직 분반 공지가 아닌(대기·반려) 자기 공지를. 모두에게 고치고 지우는 건 관리자 사이트에서 합니다.
const editsOnlyForMe = (a) => a.status === "approved";
const canEditAsg = (a) => a.status === "approved" || a.created_by === me.id;
const canDelAsg = (a) => a.created_by === me.id && a.status !== "approved";

// 승인 전 수행평가의 상태. D-day 옆에 함께 보여 줍니다
const stBadge = (status) => (status === "pending" ? '<span class="st-badge pending">대기</span>'
  : status === "rejected" ? '<span class="st-badge rejected">반려됨</span>' : "");

function card(a, opts = {}) {
  const d = asgDue(a);
  const badge = `<span class="asg-badges">${a.personal ? '<span class="own-tag">내가 수정함</span>' : ""}${stBadge(a.status)}<span class="due-badge ${d.tone}">${d.label}</span></span>`;
  const done = opts.check && cache.done.has(a.id);
  const editBtn = canEditAsg(a) ? `<button class="study-btn small" data-aedit="${a.id}">수정</button>` : "";
  const delBtn = canDelAsg(a) ? `<button class="study-btn small no" data-del="${a.id}">삭제</button>` : "";
  return `<div class="asg-card${done ? " done" : ""}">
    <div class="asg-top"><span class="asg-subject">${esc(subjName(a.subject))} · ${esc(banLabel(a.ban))}</span>${badge}</div>
    <div class="asg-title">${esc(a.title)}</div>
    ${a.body ? `<div class="asg-body${opts.check ? " clamp" : ""}">${esc(a.body)}</div>` : ""}
    <div class="asg-due"><span>${d.when ? `${d.when} 마감` : "마감 일시 미정"}</span>${a.author_name ? `<span class="asg-by">${esc(a.author_name)} 작성</span>` : ""}</div>
    ${a.submit_to ? `<div class="asg-due">제출: ${esc(a.submit_to)}</div>` : ""}
    ${opts.check ? `<div class="asg-actions">
      <button class="study-btn small${done ? " on" : ""}" data-adone="${a.id}">${done ? "완료함" : "완료 표시"}</button>
      ${editBtn}${delBtn}
    </div>` : ""}
  </div>`;
}

function renderList(mode) {
  const body = $("studyBody");
  view = mode;
  loadAcademic();
  // 달력이 이미 떠 있으면 다시 그리지 않고 일정만 새로 받습니다 (보던 날짜·스크롤 유지)
  if (tab !== "list" && fc && body.contains(fc.el)) {
    fc.refetchEvents();
    return;
  }
  destroyCal();
  body.innerHTML = `
    <div class="cal-bar">
      ${tab === "list" ? "" : `<div class="cal-nav-group">
        <button class="study-btn small" data-nav="today">오늘</button>
        <button class="cal-nav" data-nav="prev" type="button" aria-label="이전" title="이전">${icon("chevron_left")}</button>
        <span class="cal-title" id="calTitle"></span>
        <button class="cal-nav" data-nav="next" type="button" aria-label="다음" title="다음">${icon("chevron_right")}</button>
      </div>`}
      <div class="cal-right">
        <div class="seg">${VIEWS.map(([k, label]) =>
          `<button class="seg-btn${tab === k ? " on" : ""}" data-seg="${k}">${label}</button>`).join("")}</div>
      </div>
    </div>${legendHtml()}` +
    (tab === "list" ? listHtml([...agenda(), ...acadAgenda()].sort(byAgenda)) : `<div class="fc-host" id="calHost"><div class="study-empty">달력 불러오는 중…</div></div>`);
  body.querySelectorAll("[data-seg]").forEach((b) => b.onclick = () => switchTab(b.dataset.seg));
  body.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => fc && fc[b.dataset.nav]());
  bindRows(body);
  if (tab !== "list") mountCal();
}

// 목록의 완료 동그라미 · 항목 열기 · 공지 취소
function bindRows(root) {
  root.querySelectorAll("[data-chk]").forEach((b) => b.onclick = () => toggleDone(...b.dataset.chk.split(":")));
  root.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => openItem(...b.dataset.open.split(":")));
  root.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => removeItem(b.dataset.del));
  root.querySelectorAll("[data-aedit]").forEach((b) => b.onclick = () => openNewForm(findAsg(b.dataset.aedit)));
}
const findAsg = (id) => cache.items.find((a) => a.id === id) || cache.mine.find((a) => a.id === id) || cache.pending.find((a) => a.id === id);
function openItem(kind, id) {
  if (kind === "asg") openAsgDetail(findAsg(id));
  else if (kind === "sch") openSchoolDetail(cache.school.find((x) => x.id === id));
  else if (kind === "tt") return;
  else if (kind === "acad") openAcadDetail(acadList.find((e) => e.id === id));
  else if (kind === "dshs") openDshsDetail(dshs.items.find((r) => r.uid === id));
  else if (kind === "todo") openTodoForm(cache.todos.find((t) => t.id === id));
  else {
    const ev = cache.events.find((e) => e.id === id);
    ownsEvent(ev) ? openEventForm(ev) : openSharedEvent(ev);
  }
}

function switchTab(next) {
  const wasList = tab === "list";
  tab = next;
  try { localStorage.setItem("dshs-cal-view", next); } catch {}
  if (next !== "list" && !wasList && fc) {
    // 보던 범위에 오늘이 있으면 오늘부터, 아니면 그 범위의 첫날부터
    const t = new Date(), v = fc.view;
    fc.changeView(FC_VIEW[next], t >= v.activeStart && t < v.activeEnd ? t : v.currentStart);
    $("studyBody").querySelectorAll("[data-seg]").forEach((b) => b.classList.toggle("on", b.dataset.seg === next));
    return;
  }
  renderList("feed");
}
