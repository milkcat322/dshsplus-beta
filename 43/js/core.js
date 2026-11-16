"use strict";
// ============================================================
// dshs43.app — 대전과학고 43기: 계정 · 수행평가 공지 · 내 일정 · 할 일 · 급식 · 기한 알림
// 42기 사이트(dshs42.app, milkcat322/dshs-study)를 옮겨 온 것이고, 같은 Supabase DB 를 씁니다.
// 43기는 아직 시간표가 없어 시간표 화면 · 검색은 빼고, 로그인하면 내 일정으로 시작합니다.
// ============================================================
// 파일 나눔: js/ 의 파일들은 ES 모듈이 아니라 전역 스코프를 함께 쓰는 일반 스크립트입니다.
//   index.html 맨 아래에 적힌 순서대로 읽고(defer), 맨 끝 js/main.js 가 init() 을 한 번 부릅니다.
//   그래서 import/export 없이 다른 파일의 함수 · 변수를 그대로 씁니다. 같은 이름을 두 파일에서 선언하면
//   뒤 파일이 통째로 실행되지 않으니, 고친 뒤 node scripts/check.mjs 로 확인합니다.
//   이 파일(js/core.js): 설정 · 과목 · 전역 상태 · 유틸
const CFG = window.DSHS_CONFIG || {};
const ENABLED = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
const EMAIL_DOMAIN = "dshs.study";   // 계정이 아이디@dshs.study 로 저장돼 있어 서비스 이름이 바뀌어도 바꾸지 않습니다

// 43기 학번 범위 (1학년: 1000 ~ 1999). 이 범위 밖의 학생 계정은 42기 사이트로 안내합니다.
const COHORT_SID = [1000, 1999];
const inCohort = (sid) => sid >= COHORT_SID[0] && sid <= COHORT_SID[1];
const COHORT_OTHER_URL = "https://dshs42.app";

// 43기 과목 (모두 함께 들으므로 분반 없음 → ban: null = "전체 분반"). 이수학점은 프로필 등에 쓸 수 있게 둡니다.
// 과목 이름은 DB(cohort43_subjects · 수강 · 수행평가)와 같아야 합니다. 학생들이 부르는 이름으로 통일했습니다.
const SUBJECTS_43 = [
  ["국어", 3], ["영어회화", 3], ["지구과학", 3], ["진로", 1], ["체육", 1], ["화학", 3],
  ["적분과 통계", 3], ["기하와 벡터", 3], ["물리", 3], ["한국사", 2], ["프로그래밍", 3], ["생명과학", 3],
];
// 화면에 보이는 과목 이름. DB · 시간표 자료의 이름(영어회화)은 그대로 두고, 학생에게 보일 때만 바꿉니다.
// 과목 이름을 화면에 그릴 때는 꼭 subjName() 을 거칩니다 (비교 · 저장에는 원래 이름).
const SUBJECT_LABEL = { 영어회화: "영어" };
const subjName = (s) => SUBJECT_LABEL[s] || s;
const SUBJECT_CREDITS = Object.fromEntries(SUBJECTS_43);
const TOTAL_CREDITS = SUBJECTS_43.reduce((a, [, c]) => a + c, 0);   // 31

let sb = null;
let me = null;          // { id, username, student_id, name, is_admin }
let myAvatar = "";      // 내 프로필 사진 주소 (Gravatar. setAvatar 가 채움)
let myMail = "";        // 프로필 사진용으로 등록한 학교 메일 (43th…@djshs.djsch.kr. 없으면 "")
let myClasses = [];     // 내 수강 과목 [{ subject, ban }] (43기는 모든 과목 ban: null)
let cache = { items: [], pending: [], mine: [], events: [], done: new Set(), people: new Map(), todos: null, todoGroups: null, school: [] };
let page = "cal";       // 열린 탭: cal(내 일정) | notice(수행평가) | todo(할 일)
let view = "feed";      // studyBody 에 떠 있는 화면: feed | notice | form | todo
let fc = null;          // FullCalendar 인스턴스 (달력 탭일 때만)
let fcDate = null;      // 달력을 다시 그릴 때 돌아갈 날짜

const VIEWS = [["3day", "3일"], ["week", "주"], ["month", "월"], ["list", "목록"]];
let tab = (() => {      // feed 화면의 탭. 마지막에 고른 보기를 기억합니다
  try { const v = localStorage.getItem("dshs-cal-view"); if (VIEWS.some(([k]) => k === v)) return v; } catch {}
  return window.innerWidth < 640 ? "3day" : "week";
})();

// 종류마다 한 색: 수행평가 노랑 · 할 일 민트 · 학교 일정 회색 · 신청 파랑. 내 일정은 남은 세 색에서 고릅니다.
const COLORS = ["violet", "pink", "orange"];

// ---------- 유틸 ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(msg, bad) {
  const el = $("studyToast");
  el.textContent = msg;
  el.className = "study-toast show" + (bad ? " bad" : "");
  undoFn = null;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = "study-toast"; }, 3200);
}

// 실행 취소가 붙은 알림. 몇 초 안에 [실행 취소] 또는 ⌘Z / Ctrl+Z 를 누르면 되돌립니다.
let undoFn = null;
// 테두리가 남은 시간만큼 줄어들다가 다 줄면 알림이 사라집니다. 마우스를 올리면 멈춥니다.
const UNDO_MS = 7000;
function undoToast(msg, fn) {
  const el = $("studyToast");
  clearTimeout(toast._t);
  el.innerHTML = `<span>${esc(msg)}</span><button class="toast-undo" type="button">실행 취소</button>
    <svg class="toast-timer" aria-hidden="true"><rect pathLength="100" /></svg>`;
  el.className = "study-toast show has-undo";
  undoFn = fn;
  el.querySelector(".toast-undo").onclick = runUndo;
  // 알림 크기에 맞춰 테두리 사각형을 그립니다. 나타날 때 크기가 잠깐 변하므로(transition) 크기가 바뀔 때마다 다시 맞춥니다.
  // 1px 테두리 한가운데(0.5px 안쪽)를 따라 그리고, 모서리 반지름도 테두리에 맞춥니다.
  const svg = el.querySelector(".toast-timer"), rect = svg.querySelector("rect");
  const fit = () => {
    const w = el.offsetWidth, h = el.offsetHeight;
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 13;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    Object.entries({ x: 0.5, y: 0.5, width: w - 1, height: h - 1, rx: r - 0.5 }).forEach(([k, v]) => rect.setAttribute(k, v));
  };
  fit();
  undoToast._ro?.disconnect();
  undoToast._ro = new ResizeObserver(fit);
  undoToast._ro.observe(el, { box: "border-box" });
  rect.style.animationDuration = `${UNDO_MS}ms`;
  rect.onanimationend = () => { if (undoFn === fn) { el.className = "study-toast"; undoFn = null; } };
}
async function runUndo() {
  const fn = undoFn;
  if (!fn) return;
  undoFn = null;
  clearTimeout(toast._t);
  $("studyToast").className = "study-toast";
  try { (await fn()) === false ? toast("되돌리지 못했어요", true) : toast("되돌렸어요"); }
  catch { toast("되돌리지 못했어요", true); }
}
document.addEventListener("keydown", (e) => {
  if (!undoFn || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
  if (e.target.closest?.("input, textarea, select")) return;   // 입력칸에서는 원래 되돌리기
  e.preventDefault();
  runUndo();
});

function dueInfo(iso) {
  const d = new Date(iso);
  const diff = d - new Date();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  let label, tone;
  if (diff < 0) { label = "마감됨"; tone = "over"; }
  else if (hours < 24) { label = hours <= 0 ? "곧 마감" : `${hours}시간 남음`; tone = "soon"; }
  else if (days < 3) { label = `D-${days}`; tone = "soon"; }
  else { label = `D-${days}`; tone = "ok"; }
  const when = d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
  return { label, tone, when };
}

// 날짜는 모두 기기 시간대 기준으로 다룹니다
function pad(n) { return String(n).padStart(2, "0"); }
function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseDay(key) { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); }
function hm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function md(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }
function dayTitle(key) {
  return parseDay(key).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}
