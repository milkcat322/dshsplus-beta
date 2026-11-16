"use strict";
// dshs43.app — js/school.js: 학사일정(NEIS) · dshs.app 신청 내역
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 학사일정 (NEIS) ----------
// 학교 홈페이지의 학사일정을 scripts/fetch-academic.mjs 가 매일 academic.json 으로 받아 둡니다.
// 종류별로 켜고 끄고, 고른 값은 이 기기에 기억합니다.
// 관리자가 만든 학교 일정(school_events)도 같은 종류·같은 모양으로 보여 줍니다.
// academic.json 은 매일 덮어써지므로, 관리자가 고친 NEIS 일정은 school_events 에 neis_key 로 저장해 원본 대신 보여 줍니다.
const ACAD_CATS = [
  ["home", "귀가일", "귀가일"],
  ["exam", "시험", "1·2차 지필평가"],
  ["break", "방학·개학", "방학식 · 개학식 · 방학 기간"],
  ["holiday", "공휴일·휴업일", "공휴일 · 재량휴업일"],
  ["club", "동아리·꿈지락", "학술동아리 · 문화예술동아리 · 꿈지락"],
  ["event", "학교 행사", "입학식 · 졸업식 · 체육대회 · 여명제 등"],
];
let acadList = null;   // academic.json 의 일정 (처음 달력을 열 때 한 번 받습니다)
let acadLoading = false;
let acadOn = (() => {
  try { const v = JSON.parse(localStorage.getItem("dshs-cal-acad")); if (Array.isArray(v)) return new Set(v); } catch {}
  return new Set(ACAD_CATS.map(([k]) => k));
})();

// 설정의 '학교 일정 보이기' (기본 켜짐). 끄면 종류별 선택과 상관없이 학교 일정을 모두 숨깁니다.
let showSchool = (() => { try { return localStorage.getItem("dshs-cal-school") !== "off"; } catch { return true; } })();
const acadShown = (cat) => showSchool && acadOn.has(cat);

const catLabel = (k) => ACAD_CATS.find(([c]) => c === k)?.[1] || "";

function acadCat(e) {
  if (/귀가|귀사/.test(e.name)) return "home";
  if (/지필|고사|시험/.test(e.name)) return "exam";
  if (/방학|개학|종업/.test(e.name)) return "break";
  if (e.type === "공휴일" || e.type === "휴업일") return "holiday";
  if (/동아리|꿈지락/.test(e.name)) return "club";
  return "event";
}

async function loadAcademic() {
  if (acadList || acadLoading) return;
  acadLoading = true;
  try {
    const res = await fetch("academic.json");
    acadList = (await res.json()).events.map((e, i) => ({
      ...e, id: String(i), cat: acadCat(e),
      key: `${e.start}|${e.name}|${e.grades.join("")}`,   // 고친 내용을 잇는 값. 줄 번호는 매일 바뀔 수 있어서 내용으로 만듭니다
    }));
  } catch { return; } finally { acadLoading = false; }   // 못 받으면 학사일정 없이 달력만 보여 줍니다
  refreshAcad();
}
// 달력은 일정만 새로 받고, 목록은 다시 그립니다
function refreshAcad() {
  if (tab === "list") { if (calOpen()) rerender(); } else fc?.refetchEvents();
}

// 내 학년 일정만 (학번 2113 → 2학년, 관리자는 전부). 토요휴업일은 매주라 뺍니다.
const myGrade = () => (me.student_id ? Math.floor(me.student_id / 1000) : 0);
function myAcad() {
  const g = myGrade();
  const replaced = new Set(cache.school.map((x) => x.neis_key).filter(Boolean));   // 관리자가 고치거나 숨긴 일정은 뺍니다
  return (acadList || []).filter((e) => e.name !== "토요휴업일" && (!g || e.grades.includes(g)) && !replaced.has(e.key));
}
// 학교 일정 중 숨기지 않았고 내 학년에 해당하는 것 (NEIS 를 고친 일정은 원본의 대상 학년을 따릅니다)
function liveSchool() {
  const g = String(myGrade());
  return cache.school.filter((e) => !e.hidden && (!e.neis_key || g === "0" || e.neis_key.split("|").pop().includes(g)));
}

function acadEvents(from, to) {
  const lo = dayKey(from), hi = dayKey(to);
  return myAcad().filter((e) => acadShown(e.cat) && e.end >= lo && e.start < hi).map((e) => {
    const after = parseDay(e.end); after.setDate(after.getDate() + 1);   // FullCalendar 종일 일정의 끝은 다음 날(미포함)
    return {
      id: `acad:${e.id}`, title: e.name, start: e.start, end: dayKey(after), allDay: true, editable: false,
      classNames: ["c-school"], extendedProps: { kind: "acad" },
    };
  });
}

// 목록 보기: 앞으로 두 달 안의 학사일정 (2년 치가 있어서 전부 넣으면 내 일정이 묻힙니다)
function acadAgenda() {
  const today = dayKey(new Date()), until = new Date(); until.setDate(until.getDate() + 60);
  return myAcad().filter((e) => acadShown(e.cat) && e.end >= today && e.start <= dayKey(until)).map((e) => ({
    kind: "acad", id: e.id, title: e.name, at: parseDay(e.start), allDay: true, done: false, color: "school",
    end: e.end > e.start ? new Date(`${e.end}T23:59`) : null,
  }));
}

function openAcadDetail(e) {
  const when = e.start === e.end ? `${dayTitle(e.start)} · 하루 종일` : `${dayTitle(e.start)} – ${dayTitle(e.end)}`;
  const label = catLabel(e.cat);
  openSheet("학교 일정", `
    <div class="shared-card c-school">
      <div class="ev-title">${esc(e.name)}</div>
      <div class="ev-meta">${esc(when)} · ${label}${e.grades.length < 3 ? ` · ${e.grades.join("·")}학년` : ""}</div>
      ${e.memo ? `<div class="asg-body">${esc(e.memo)}</div>` : ""}
    </div>
    <div class="study-foot">${e.from ? `${esc(e.from)}로 추가한 일정이에요.` : "학교 홈페이지 학사일정(NEIS)에서 가져온 일정이에요."}</div>`);
}

// 설정의 달력 항목: 학교 일정(전체 · 종류 6가지) · 학교 시간표 보이기
function calSettingsHtml() {
  const g = myGrade();
  return `
    <label class="set-row"><span><b>학교 일정 보이기</b><span class="ev-hint">학교 홈페이지 학사일정(NEIS)을 하루 한 번 받아 와요.${g ? ` ${g}학년 일정만 보여요.` : ""}</span></span>
      <input type="checkbox" id="setSchool"${showSchool ? " checked" : ""}></label>
    <div class="set-sub" id="acadOpts">${ACAD_CATS.map(([k, label, hint]) =>
      `<label class="set-row"><span><b>${label}</b><span class="ev-hint">${hint}</span></span>
        <input type="checkbox" data-acad="${k}"${acadOn.has(k) ? " checked" : ""}${showSchool ? "" : " disabled"}></label>`).join("")}</div>
    ${me?.student_id ? `<label class="set-row"><span><b>학교 시간표 보이기</b><span class="ev-hint">내 일정 달력의 3일 · 주 보기에 우리 반 수업을 깔아 줘요</span></span>
      <input type="checkbox" id="setTT"${showTT ? " checked" : ""}></label>` : ""}`;
}
function bindCalSettings() {
  if ($("setTT")) $("setTT").onchange = () => {
    showTT = $("setTT").checked;
    try { localStorage.setItem("dshs-cal-tt", showTT ? "on" : "off"); } catch {}
    fc?.refetchEvents();
  };
  $("setSchool").onchange = () => {
    showSchool = $("setSchool").checked;
    try { localStorage.setItem("dshs-cal-school", showSchool ? "on" : "off"); } catch {}
    $("acadOpts").querySelectorAll("input").forEach((c) => c.disabled = !showSchool);
    refreshAcad();
  };
  $("acadOpts").querySelectorAll("[data-acad]").forEach((c) => c.onchange = () => {
    c.checked ? acadOn.add(c.dataset.acad) : acadOn.delete(c.dataset.acad);
    try { localStorage.setItem("dshs-cal-acad", JSON.stringify([...acadOn])); } catch {}
    refreshAcad();
  });
}

// ---------- dshs.app 신청 내역 ----------
// dshs.app 계정을 연결하면 내 신청(외출 · 특별실 등)을 달력에 읽기 전용으로 보여 줍니다.
// 토큰은 Edge Function(dshs-oauth)만 갖고, 여기서는 신청 목록만 받습니다. 신청 · 변경은 dshs.app 에서 합니다.
const DSHS_FN = `${CFG.SUPABASE_URL}/functions/v1/dshs-oauth`;
const DSHS_STATUS = { pending: "승인 대기", approved: "승인", rejected: "반려" };
const DSHS_RETURNED = {
  linked: "dshs.app 계정을 연결했어요. 신청 내역이 달력에 보여요",
  login: "dshs.app 계정으로 로그인했어요",
  joined: "dshs.app 계정으로 가입했어요. 반가워요",
  denied: "dshs.app 로그인을 취소했어요",
  mismatch: "dshs.app 계정의 학번이 이 계정과 달라서 연결하지 않았어요",
  notstudent: "43기(1학년) 학생의 dshs.app 계정만 로그인할 수 있어요",
  expired: "시간이 지났어요. 다시 시도해 주세요",
};
const dshsEmpty = () => ({ linked: null, name: null, items: [], at: 0 });   // linked: null = 아직 모름
let dshs = dshsEmpty();
