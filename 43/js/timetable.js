"use strict";
// dshs43.app — js/timetable.js: 시간표 · 선생님 고르기 · 시간표 검색 · 학점 계산 · 배경화면
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 시간표 ----------
// 반별 시간표 (2학기). 반은 학번 둘째 자리(1203 → 2반). 요일마다 1교시부터 칸을 쉼표로, 빈 칸은 비워 둡니다.
// 칸 이름은 과목 이름(SUBJECTS_43) 그대로, 그 밖은 수업 외 활동(자율 · 동아리 · R&E).
// 선생님은 반마다 같아서 과목별로 TT_TEACHERS 에 모두 적고 칸마다 다 보여 줍니다
// (화학 · 기하와 벡터 · 적분과 통계 · 물리는 격주로 한 교시 · 두 교시 수업 선생님이 바뀌어 두 분 모두 표시).
// 화요일 8 · 9교시 동아리, 목요일 5~7교시 R&E, 월요일 7교시 자율(학급자치)은 모든 반이 같습니다.
// (6반은 받은 시간표대로 월요일 7교시 '나와 우리', 8 · 9교시 '자생탐'까지 넣었습니다)
const TT_CLUB = ",동아리,동아리";
const TIMETABLE_43 = {
  1: {
    월: "생명과학,생명과학,적분과 통계,체육,물리,물리,자율", 화: "프로그래밍,물리,화학,화학,지구과학,한국사,국어" + TT_CLUB,
    수: "진로,기하와 벡터,적분과 통계,적분과 통계,지구과학,국어,영어회화", 목: "국어,영어회화,프로그래밍,한국사,R&E,R&E,R&E",
    금: "프로그래밍,영어회화,지구과학,생명과학,기하와 벡터,기하와 벡터,화학"
  },
  2: {
    월: "국어,진로,지구과학,적분과 통계,기하와 벡터,기하와 벡터,자율", 화: "생명과학,생명과학,물리,기하와 벡터,국어,지구과학,체육" + TT_CLUB,
    수: "지구과학,화학,프로그래밍,한국사,영어회화,물리,물리", 목: "프로그래밍,적분과 통계,적분과 통계,국어,R&E,R&E,R&E",
    금: "영어회화,생명과학,화학,화학,한국사,영어회화,프로그래밍"
  },
  3: {
    월: "한국사,프로그래밍,국어,지구과학,화학,화학,자율", 화: "영어회화,기하와 벡터,한국사,지구과학,국어,적분과 통계,적분과 통계" + TT_CLUB,
    수: "적분과 통계,영어회화,화학,물리,체육,기하와 벡터,기하와 벡터", 목: "프로그래밍,국어,생명과학,진로,R&E,R&E,R&E",
    금: "물리,물리,영어회화,프로그래밍,지구과학,생명과학,생명과학"
  },
  4: {
    월: "물리,물리,프로그래밍,국어,적분과 통계,적분과 통계,자율", 화: "화학,화학,국어,지구과학,프로그래밍,기하와 벡터,진로" + TT_CLUB,
    수: "영어회화,생명과학,기하와 벡터,기하와 벡터,지구과학,화학,한국사", 목: "적분과 통계,생명과학,생명과학,영어회화,R&E,R&E,R&E",
    금: "한국사,프로그래밍,체육,물리,지구과학,영어회화,국어"
  },
  5: {
    월: "진로,한국사,기하와 벡터,기하와 벡터,생명과학,생명과학,자율", 화: "국어,영어회화,국어,프로그래밍,물리,물리,기하와 벡터" + TT_CLUB,
    수: "국어,물리,영어회화,지구과학,적분과 통계,체육,생명과학", 목: "지구과학,화학,화학,프로그래밍,R&E,R&E,R&E",
    금: "프로그래밍,한국사,적분과 통계,적분과 통계,영어회화,화학,지구과학"
  },
  6: {
    월: "생명과학,영어회화,화학,화학,지구과학,프로그래밍,나와 우리,자생탐,자생탐", 화: "물리,체육,적분과 통계,적분과 통계,진로,국어,한국사" + TT_CLUB,
    수: "한국사,생명과학,생명과학,프로그래밍,화학,영어회화,지구과학", 목: "영어회화,기하와 벡터,지구과학,국어,R&E,R&E,R&E",
    금: "프로그래밍,기하와 벡터,기하와 벡터,국어,적분과 통계,물리,물리"
  },
};
const TT_TEACHERS = {
  국어: "김도현 · 정선혜", 영어회화: "한신실 · Nthabiseng", 지구과학: "최원문 · 김진욱 · 김우겸", 화학: "이충섭 · 김정은",
  생명과학: "이민주 · 손희창 · 임재화", 물리: "신대호 · 이주희", "적분과 통계": "조영민 · 전혜진", "기하와 벡터": "김수정 · 남정훈",
  한국사: "이병수", 프로그래밍: "안소희 · 신요셉 · 백경덕", 진로: "최형미", 체육: "최정호",
};
const TT_DAYS = ["월", "화", "수", "목", "금"];
const TT_PERIODS = 9;   // 정규 수업 1~9교시 (야간 자습 10~12교시는 빼고)
// 테스트 계정(학번 1999, 명단에 없는 가짜 학번)은 유준우(1409)와 같은 4반 시간표를 봅니다
const BAN_OVERRIDE = { 1999: 4 };
const myBan = () => (me?.student_id ? BAN_OVERRIDE[me.student_id] ?? Math.floor(me.student_id / 100) % 10 : 0);
// 내 반 시간표: { "월-1": "국어", … }
function myTimetable() {
  return classTimetable(myBan());
}
// 그 반 시간표: { "월-1": "국어", … } (없으면 빈 것)
function classTimetable(ban) {
  const t = TIMETABLE_43[ban];
  const out = {};
  if (t) for (const d of TT_DAYS) (t[d] || "").split(",").forEach((c, i) => { if (c.trim()) out[`${d}-${i + 1}`] = c.trim(); });
  return out;
}
const banOf = (sid) => BAN_OVERRIDE[sid] ?? Math.floor(sid / 100) % 10;
// 1학년은 모든 과목이 필수(보통기본필수)입니다.
const SUBJ_COLORS = ["#a78bfa", "#f472b6", "#34d399", "#60a5fa", "#fb923c", "#facc15", "#6ee7b7", "#c4b5fd", "#fca5a5", "#a5b4fc", "#5eead4", "#fbbf24"];
// 과목 → 색. 수업 외 활동(자율 · 동아리 · R&E)은 회색
const isSubject43 = (name) => SUBJECTS_43.some(([s]) => s === name);
const subjColor = (name) => {
  const i = SUBJECTS_43.findIndex(([s]) => s === name);
  return i < 0 ? "#8888aa" : SUBJ_COLORS[i % SUBJ_COLORS.length];
};
const semesterLabel = () => { const m = new Date().getMonth() + 1; return m >= 3 && m < 8 ? "1학기" : "2학기"; };
// 시간표 글자 크기: s 작게 · m 중간 · l 크게. 이 기기에 기억하고, html 의 data-tt-font 로 CSS(css/timetable.css 의 --tt-scale)에 알립니다.
const TT_FONT_KEY = "dshs-tt-font";
let ttFont = (() => { try { return localStorage.getItem(TT_FONT_KEY); } catch { return null; } })();
if (!["s", "m", "l"].includes(ttFont)) ttFont = "m";
document.documentElement.dataset.ttFont = ttFont;
// 글자 크기 버튼: 같은 Aa 아이콘을 크기만 다르게 세 개 (누르는 동작은 bindTtCells)
function ttFontHtml() {
  return `<div class="seg tt-size" role="group" aria-label="시간표 글자 크기">${[["s", "작게"], ["m", "중간"], ["l", "크게"]].map(([k, label]) =>
    `<button type="button" class="seg-btn${ttFont === k ? " on" : ""}" data-ttfont="${k}" aria-label="글자 ${label}" title="글자 ${label}" aria-pressed="${ttFont === k}">${icon("match_case")}</button>`).join("")}</div>`;
}
let ttTab = "tt";   // 시간표 탭 안의 칸: tt 시간표 · gpa 학점 계산 · wp 배경화면

const lastPeriod = (tt) => Math.max(7, ...Object.keys(tt).map((k) => +k.split("-")[1]));

// ---------- 시간표 칸의 선생님 고르기 (ttpicks43.sql) ----------
// 선생님이 여러 명인 과목은 관리자가 권한을 준 반 학생(cohort43_tt_editors)이 그 요일 · 교시 수업의 선생님을 고르고(set_tt_teacher),
// 같은 반 친구들 시간표에도 보입니다. 권한은 관리자 사이트 '학생' 칸에서 줍니다.
//  - 보통 과목: 한 번 고르면 매주 같음 (on_date = WEEKLY)
//  - 격주로 선생님이 바뀌는 과목(ALT_SUBJECTS): 기말고사(1학년 지필평가) 전까지 그 요일 · 교시 수업을 날짜마다 고름
const ALT_SUBJECTS = new Set(["화학", "기하와 벡터", "적분과 통계", "물리"]);
const WEEKLY = "2000-01-01";
const teachersOf = (s) => (TT_TEACHERS[s] || "").split(" · ").filter(Boolean);
// 선생님이 세 분 이상인 과목(지구과학 · 생명과학 · 프로그래밍)은 교시가 이어져 있어도 블록수업이 아닙니다:
// 교시마다 다른 선생님이 하는 따로따로의 수업이라, 시간표 · 배경화면 · 달력에서 한 칸으로 묶지 않습니다.
const ttNoBlock = (s) => teachersOf(s).length >= 3;
let ttPicks = new Map(), ttPicksAt = 0;   // "반|요일|교시|날짜" → 선생님
async function loadTtPicks(force = false) {
  if (!sb) await sbWait;
  if (!force && Date.now() - ttPicksAt < 30000) return;
  const { data, error } = await sb.from("cohort43_tt_teachers").select("ban, day, period, on_date, teacher");
  if (error) return;   // 표가 아직 없으면(SQL 실행 전) 선생님을 모두 보여 줍니다
  ttPicksAt = Date.now();
  ttPicks = new Map(data.map((r) => [`${r.ban}|${r.day}|${r.period}|${r.on_date}`, r.teacher]));
}
// 내가 선생님을 고를 수 있는지 (관리자가 준 권한). 표가 아직 없으면(SQL 실행 전) 예전처럼 반 학생 누구나
let ttEditor = null, ttEditorFor = null;   // true · false · null(아직 모름), 누구 것인지(me.id)
const canPickTt = () => !!me && ttEditorFor === me.id && ttEditor === true;
async function loadTtEditor() {
  if (!sb) await sbWait;
  if (!me || (ttEditorFor === me.id && ttEditor !== null)) return;
  const id = me.id;
  const { data, error } = await sb.from("cohort43_tt_editors").select("student_id").limit(1);
  if (error && !(error.code === "42P01" || error.code === "PGRST205")) return;   // 연결 문제 → 다음에 다시
  ttEditorFor = id;
  ttEditor = error ? true : data.length > 0;   // 표가 없으면 예전처럼
}
// 다음 1학년 지필평가 시작일 (학사일정을 못 받았으면 2026-12-14). 그 전까지의 날짜만 고릅니다
function nextExam() {
  const today = dayKey(new Date());
  const exams = (acadList ? acadList.filter((e) => /지필/.test(e.name) && e.grades.includes(1)).map((e) => e.start) : ["2026-12-14"])
    .filter((s) => s >= today).sort();
  return exams[0] || null;
}
// 이번 주부터 기말고사 전까지, 그 요일의 날짜들
function slotDates(d) {
  const end = nextExam();
  if (!end) return [];
  const x = new Date(); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + TT_DAYS.indexOf(d));   // 이번 주 그 요일
  const out = [];
  for (; dayKey(x) < end; x.setDate(x.getDate() + 7)) out.push(dayKey(x));
  return out;
}
// 그 칸의 선생님 (고른 게 없으면 null). 격주 과목은 그 날짜, 아니면 매주 값
function slotTeacher(ban, d, p, date) {
  return ttPicks.get(`${ban}|${d}|${p}|${date || WEEKLY}`) || null;
}
// 이번 주(그 요일)의 날짜
const thisWeekDate = (d) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + TT_DAYS.indexOf(d)); return dayKey(x); };
// 칸을 누르면: 과목 · 교시 · 선생님. 선생님이 여러 명이면 내 반은 고를 수 있어요 (격주 과목은 날짜마다)
async function openTtCell(ban, d, p, to = p) {   // to: 묶인 블록의 마지막 교시 (한 교시면 p)
  const s = classTimetable(ban)[`${d}-${p}`];
  if (!s) return;
  const st = PERIOD_TIME[p][0], en = PERIOD_TIME[to][1];
  const list = teachersOf(s), multi = list.length > 1, alt = ALT_SUBJECTS.has(s) && multi;
  const myClass = multi && ban === myBan();
  let mine = myClass && canPickTt();
  const btns = (date, cur) => `<div class="study-row tt-pick">${list.map((t) =>
    `<button class="study-btn${cur === t ? " primary" : ""}" data-tpick="${esc(t)}" data-tdate="${date}">${esc(t)}</button>`).join("")}</div>`;
  const draw = () => {
    const dates = alt ? slotDates(d) : [];
    const now = alt ? slotTeacher(ban, d, p, thisWeekDate(d)) : slotTeacher(ban, d, p);
    let pick = "";
    if (mine && !alt) {
      pick = `<label class="study-label">이 수업 선생님 고르기 (매주)</label>${btns(WEEKLY, now)}`;
    } else if (mine && alt) {
      pick = dates.length
        ? `<label class="study-label">날짜마다 선생님 고르기 (기말고사 전까지)</label>
          ${dates.map((k) => `<div class="tt-date-row"><span class="tt-date">${md(parseDay(k))} (${d})</span>${btns(k, slotTeacher(ban, d, p, k))}</div>`).join("")}`
        : `<div class="study-foot" style="text-align:left">기말고사 전까지 남은 수업이 없어요.</div>`;
    }
    openSheet(esc(subjName(s)), `
      <div class="asg-body">${ban}반 · ${d}요일 ${p}${to > p ? `–${to}` : ""}교시 (${st}–${en})</div>
      <label class="study-label">선생님${alt ? " (이번 주)" : ""}</label>
      <div class="tt-teacher">${now ? `<b>${esc(now)}</b>` : multi
        ? `${esc(list.join(" · "))} <span class="ev-hint">${alt ? "격주로 바뀌어요 · " : ""}아직 정해지지 않았어요</span>`
        : `<b>${esc(TT_TEACHERS[s] || "정보 없음")}</b>`}</div>
      ${pick}
      ${mine ? `<div class="study-foot" style="text-align:left">고르면 ${ban}반 친구들 시간표에도 적용돼요. 같은 선생님을 다시 누르면 지워져요.</div>`
        : myClass && ttEditorFor === me?.id && ttEditor === false ? `<div class="study-foot" style="text-align:left">선생님은 관리자에게 권한을 받은 학생이 골라요.</div>` : ""}`);
    document.querySelectorAll("[data-tpick]").forEach((b) => b.onclick = async () => {
      const date = b.dataset.tdate, key = `${ban}|${d}|${p}|${date}`;
      const t = ttPicks.get(key) === b.dataset.tpick ? null : b.dataset.tpick;   // 같은 걸 다시 누르면 지움
      b.disabled = true;
      for (let q = p; q <= to; q++) {   // 묶인 블록은 모든 교시에 같은 선생님
        const { error } = await sb.rpc("set_tt_teacher", { p_ban: ban, p_day: d, p_period: q, p_on_date: date, p_teacher: t });
        if (error && /no permission/.test(error.message || "")) { ttEditor = false; mine = false; draw(); return toast("선생님을 고를 권한이 없어요", true); }
        if (error) { b.disabled = false; return toast("저장하지 못했어요. 잠시 뒤 다시 시도해 주세요", true); }
        const k = `${ban}|${d}|${q}|${date}`;
        if (t) ttPicks.set(k, t); else ttPicks.delete(k);
      }
      toast(t ? `${ban}반 친구들 시간표에도 적용했어요` : "선택을 지웠어요");
      const y = $("studyModal").querySelector(".study-sheet")?.scrollTop || 0;
      draw();
      const sheet = $("studyModal").querySelector(".study-sheet"); if (sheet) sheet.scrollTop = y;
    });
  };
  draw();
  if (multi) {
    await Promise.all([loadAcademic(), loadTtPicks(), myClass ? loadTtEditor() : null]);
    mine = myClass && canPickTt();
    if ($("studyModal").classList.contains("show")) draw();
  }
}
// 한 반의 시간표 표. 42기 사이트의 시간표(index.html 의 table.timetable · .class-cell · .color-N · 과목 범례)와 같은 모양입니다.
// 칸 아래 작은 줄은 42기의 분반 자리에 그 과목 선생님을, 수업 외 활동(자율 · 동아리 · R&E)은 '전체'를 씁니다.
const TT_DAY_CLASS = ["mon", "tue", "wed", "thu", "fri"];
const colorIdx43 = (s) => SUBJECTS_43.findIndex(([x]) => x === s) % 13;
// 그 요일 p 교시에서 시작해 같은 수업이 이어지는 마지막 교시. 블록수업 · R&E · 동아리처럼 이어지는 교시는 표에서 한 칸으로 묶습니다.
// 쉬는 시간이 20분을 넘으면(점심을 사이에 둔 4 · 5교시) 이어진 것으로 보지 않습니다. 선생님이 세 분 이상인 과목(ttNoBlock)도 묶지 않습니다.
function ttBlockEnd(tt, d, p, last) {
  if (ttNoBlock(tt[`${d}-${p}`])) return p;
  const min = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
  let to = p;
  while (to < last && tt[`${d}-${to + 1}`] === tt[`${d}-${p}`] && min(PERIOD_TIME[to + 1][0]) - min(PERIOD_TIME[to][1]) <= 20) to++;
  return to;
}
function ttGridHtml(ban = myBan()) {
  const tt = classTimetable(ban);
  if (!Object.keys(tt).length) return `<div class="study-empty">${ban ? `${ban}반 시간표는 아직 없어요` : "시간표가 아직 없어요"}</div>`;
  let rows = "";
  const last = lastPeriod(tt), taken = {};   // taken[요일]: 위에서 묶은 칸이 차지한 마지막 교시
  for (let p = 1; p <= last; p++) {
    rows += `<tr><td class="period-col">${p}</td>` + TT_DAYS.map((d) => {
      if (taken[d] >= p) return "";   // 위 칸(rowspan)이 이 자리까지 차지함
      const s = tt[`${d}-${p}`];
      if (!s) return `<td><div class="empty-cell"></div></td>`;
      const to = taken[d] = ttBlockEnd(tt, d, p, last);
      const span = to > p ? ` rowspan="${to - p + 1}"` : "";
      if (!isSubject43(s)) return `<td class="common-cell"${span}><div class="class-cell"><div class="subj-name">${esc(s)}</div><div class="ban-name">전체</div></div></td>`;
      // 선생님 이름은 칸을 누르면 나옵니다 (openTtCell)
      // 색은 칸(td)에 칠합니다: 묶인 칸도 높이만큼 꽉 차도록 (칸 사이 여백은 css/timetable.css 의 td padding)
      return `<td class="color-${colorIdx43(s)}"${span} data-tcell="${ban}|${d}|${p}|${to}"><div class="class-cell"><div class="subj-name">${esc(subjName(s))}</div></div></td>`;
    }).join("") + "</tr>";
  }
  const used = SUBJECTS_43.map(([s]) => s).filter((s) => Object.values(tt).includes(s));
  const legend = used.map((s) => `<div class="legend-item"><div class="legend-dot color-${colorIdx43(s)}"></div><span>${esc(subjName(s))}</span></div>`).join("");
  return `<div class="timetable-wrap">
      <table class="timetable">
        <thead><tr><th></th>${TT_DAYS.map((d, i) => `<th class="day-header ${TT_DAY_CLASS[i]}">${d}요일</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="tt-under">
      <div class="legend"><div class="legend-items">${legend}</div></div>
      ${ttFontHtml()}
    </div>`;
}

// ---------- 시간표 검색 ----------
// 이름 · 학번 → 그 학생의 반 시간표와 위치, '3반' → 그 반 시간표와 명단. (과목 검색은 없앴습니다)
// ttView 가 null 이면 내 시간표입니다.
let ttView = null;   // { type: "student", sid } | { type: "ban", ban }
function ttFind(q) {
  q = q.trim().replace(/\s+/g, " ");
  if (!q) return [];
  const out = [];
  const ban = q.match(/^([1-6])\s*반?$/);
  if (ban) out.push({ type: "ban", ban: +ban[1], label: `1학년 ${ban[1]}반`, meta: "반 시간표 · 명단" });
  if (/^\d{4}$/.test(q)) {
    const p = roster().find((x) => x.sid === +q);
    if (p) out.push({ type: "student", sid: p.sid, label: p.name, meta: `${p.sid} · ${banOf(p.sid)}반` });
  }
  if (!/^\d+$/.test(q)) for (const p of roster()) if (p.name.includes(q)) out.push({ type: "student", sid: p.sid, label: p.name, meta: `${p.sid} · ${banOf(p.sid)}반` });
  return out.slice(0, 12);
}
// 42기 사이트의 검색 칸과 같은 모양 (index.html 의 .search-section · #nameInput · .btn-search · .suggestions)
function ttSearchHtml() {
  return `<div class="search-section">
      <div class="search-input-wrap">
        <input type="text" id="nameInput" placeholder="이름·학번·반 (예: 유준우, 1409, 3반)" aria-label="학생 · 학번 · 반 검색" autocomplete="off" enterkeyhint="search">
        <button class="btn-search" id="ttGo" type="button" aria-label="시간표 보기" title="시간표 보기">${icon("search")}</button>
        <div class="suggestions" id="ttSugg"></div>
      </div>
    </div>`;
}
function bindTtSearch() {
  const q = $("nameInput"), box = $("ttSugg");
  if (!q) return;
  const tag = (h) => h.type === "student" ? `<span class="suggestion-id">${esc(h.sid)} · ${banOf(h.sid)}반</span>`
    : `<span class="suggestion-tag">반</span>`;
  const show = () => {
    const v = q.value.trim();
    const hits = ttFind(v).slice(0, 8);
    box.innerHTML = hits.map((h, i) => `<div class="suggestion-item" data-hit="${i}"><span>${esc(h.label)}</span>${tag(h)}</div>`).join("")
      || (v ? `<div class="tt-sugg-none">찾는 학생 · 반이 없어요</div>` : "");
    box.classList.toggle("show", !!v);
    box.querySelectorAll("[data-hit]").forEach((b) => b.onclick = () => openTtView(hits[+b.dataset.hit]));
  };
  // 이름이 정확히 같은 학생이 둘 이상이면(동명이인) 고르는 화면으로, 하나뿐이면 바로 그 시간표로
  const go = () => {
    const v = q.value.trim().replace(/\s+/g, " ");
    const hits = ttFind(v);
    const same = hits.filter((h) => h.type === "student" && h.label === v);
    if (same.length > 1) openTtView({ type: "pick", name: v });
    else if (same.length === 1) openTtView(same[0]);
    else if (hits.length === 1 || (hits.length && hits[0].type !== "student")) openTtView(hits[0]);
    else show();   // 여러 명이 걸리면 목록에서 고르게
  };
  q.oninput = show;
  q.onkeydown = (e) => {
    if (e.key === "Enter" && !e.isComposing) go();
    if (e.key === "Escape") box.classList.remove("show");
  };
  $("ttGo").onclick = go;
  // 검색 칸 밖을 누르면 목록을 닫습니다
  if (!bindTtSearch.bound) {
    bindTtSearch.bound = true;
    document.addEventListener("click", (e) => { if (!e.target.closest(".search-input-wrap")) $("ttSugg")?.classList.remove("show"); });
  }
}
function openTtView(v) {
  ttView = v ? { type: v.type, sid: v.sid, ban: v.ban, name: v.name } : null;
  renderTimetable();
  scrollTo({ top: 0 });
}
function ttOtherHtml(v) {
  const back = `<button class="study-btn tt-back" id="ttBack">← 내 시간표</button>`;
  if (v.type === "student") {
    const p = roster().find((x) => x.sid === v.sid) || { sid: v.sid, name: String(v.sid) };
    const ban = banOf(p.sid);
    return `${back}
      <div class="student-profile">
        <div class="student-avatar">${esc(p.name[0])}</div>
        <div class="student-info"><h2>${esc(p.name)}</h2><div class="student-meta">학번 ${p.sid} · 1학년 ${ban}반 <span class="st-loc" data-st="${p.sid}"></span></div></div>
      </div>
      ${ttGridHtml(ban)}`;
  }
  if (v.type === "ban") {
    const list = roster().filter((x) => banOf(x.sid) === v.ban);
    return `${back}
      <div class="student-profile">
        <div class="student-avatar subj-avatar">${v.ban}</div>
        <div class="student-info"><h2>1학년 ${v.ban}반</h2><div class="student-meta">${list.length}명</div></div>
      </div>
      ${ttGridHtml(v.ban)}
      <div class="study-section">${v.ban}반 학생 <span class="tt-hint">— 누르면 시간표</span></div>
      <div class="tt-people">${list.map((x) => `<button class="ban-chip" data-sid="${x.sid}">${esc(x.name)}<small>${x.sid}</small><span class="st-loc" data-st="${x.sid}"></span></button>`).join("")}</div>`;
  }
  if (v.type === "pick") {   // 동명이인: 학번 · 반을 보고 고르기 (42기 사이트의 과목 고르기 목록과 같은 모양)
    const list = roster().filter((x) => x.name === v.name);
    return `${back}
      <div class="student-profile">
        <div class="student-avatar">${esc(v.name[0] || "?")}</div>
        <div class="student-info"><h2>"${esc(v.name)}" 검색 결과</h2><div class="student-meta">같은 이름이 ${list.length}명 있어요. 한 명을 골라 주세요</div></div>
      </div>
      <div class="pick-list">${list.map((x) => `<button class="pick-item" data-sid="${x.sid}">${esc(x.name)}<span class="pick-meta">${x.sid} · ${banOf(x.sid)}반</span></button>`).join("")}</div>`;
  }
  return back;
}

function renderTimetable() {
  if (ttView) {
    $("studyView").innerHTML = ttSearchHtml() + ttOtherHtml(ttView);
    bindTtSearch();
    $("ttBack").onclick = () => openTtView(null);
    $("studyView").querySelectorAll("[data-sid]").forEach((b) => b.onclick = () => openTtView({ type: "student", sid: +b.dataset.sid }));
    bindTtCells();
    paintStatus($("studyView"));
    return;
  }
  const sid = me?.student_id;
  const name = me?.name || "";
  const weekly = Object.values(myTimetable()).filter(isSubject43).length;   // 수업 외 활동은 빼고
  $("studyView").innerHTML = ttSearchHtml() + `
    <div class="student-profile">
      <div class="student-avatar" data-me>${esc(name[0] || "?")}</div>
      <div class="student-info"><h2>${esc(name)}</h2><div class="student-meta">학번 ${esc(sid ?? "")} · 1학년 ${myBan() ? `${myBan()}반 · ` : ""}${semesterLabel()}</div></div>
    </div>
    ${sid ? '<div class="my-status" id="myStatus"></div>' : ""}
    <div class="stats-row">
      <div class="stat-chip"><span class="stat-num">${SUBJECTS_43.length}</span><span class="stat-label">수강 과목</span></div>
      <div class="stat-chip"><span class="stat-num" style="color:var(--accent3)">${TOTAL_CREDITS}</span><span class="stat-label">이수 학점</span></div>
      <div class="stat-chip"><span class="stat-num">${weekly || "–"}</span><span class="stat-label">주간 수업 교시</span></div>
    </div>
    <div class="tabs">
      ${[["tt", icon("calendar_view_week") + " 시간표"], ["gpa", icon("school") + " 학점 계산"], ["wp", icon("wallpaper") + " 배경화면"]].map(([k, l]) =>
    `<button class="tab-btn${ttTab === k ? " active" : ""}" data-ttab="${k}">${l}</button>`).join("")}
    </div>
    <div class="tab-panel${ttTab === "tt" ? " active" : ""}" id="panel-tt">${ttGridHtml()}</div>
    <div class="tab-panel${ttTab === "gpa" ? " active" : ""}" id="panel-gpa"></div>
    <div class="tab-panel${ttTab === "wp" ? " active" : ""}" id="panel-wp">${wpPanelHtml()}</div>`;
  paintAvatar();
  const ttTabs = $("studyView").querySelector(".tabs");
  moveInk(ttTabs, ".tab-btn.active", "tt");
  $("studyView").querySelectorAll("[data-ttab]").forEach((b) => b.onclick = () => {
    ttTab = b.dataset.ttab;
    $("studyView").querySelectorAll("[data-ttab]").forEach((x) => x.classList.toggle("active", x === b));
    moveInk(ttTabs, ".tab-btn.active", "tt");
    $("studyView").querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${ttTab}`));
    if (ttTab === "wp") generateWallpaper();
  });
  bindTtSearch();
  bindTtCells();
  renderGpa();
  bindWallpaper();
  if (ttTab === "wp") generateWallpaper();
  if ($("myStatus")) { paintMyStatus(); maybePushCard(); }
}
// 시간표 칸을 누르면 그 수업의 선생님 (격주 과목은 이번 주 선생님 고르기)
function bindTtCells() {
  $("studyView").querySelectorAll("[data-tcell]").forEach((c) => c.onclick = () => {
    const [ban, d, p, to] = c.dataset.tcell.split("|");
    openTtCell(+ban, d, +p, +to);
  });
  // 글자 크기 버튼: 다시 그리지 않고 html 의 data-tt-font 만 바꿉니다
  $("studyView").querySelectorAll("[data-ttfont]").forEach((b) => b.onclick = () => {
    ttFont = b.dataset.ttfont;
    try { localStorage.setItem(TT_FONT_KEY, ttFont); } catch { }
    document.documentElement.dataset.ttFont = ttFont;
    $("studyView").querySelectorAll("[data-ttfont]").forEach((x) => {
      x.classList.toggle("on", x === b);
      x.setAttribute("aria-pressed", x === b);
    });
  });
}

// ---------- 학점 계산 ----------
// 체육(GPA_SKIP)을 뺀 과목이 평균에 들어갑니다. (과목 학점 × 평점) 합 ÷ 고른 과목 학점 합.
// 고른 등급은 이 기기에 학번별로 저장합니다 (처음엔 모두 A+).
const GRADES = [["A+", 4.3], ["A0", 4.0], ["A-", 3.7], ["B+", 3.3], ["B0", 3.0], ["B-", 2.7], ["C+", 2.3], ["C0", 2.0], ["C-", 1.7], ["F", 0]];
const GRADE_PT = Object.fromEntries(GRADES);
const gpaKey = () => `gpa43:${me?.student_id || "guest"}`;
function gpaLoad() {
  try {
    const raw = localStorage.getItem(gpaKey());
    if (raw != null) return JSON.parse(raw) || {};
  } catch { }
  return Object.fromEntries(GPA_SUBJECTS.map(([s]) => [s, "A+"]));
}
function gpaSave(st) { try { localStorage.setItem(gpaKey(), JSON.stringify(st)); } catch { } }
// P/F 과목: 전원 Pass 라 A+(4.3)로 넣어 계산하고, 학점 계산 칸에는 보이지 않습니다
const PF_43 = new Set(["진로"]);
// 학점 계산에 넣지 않는 과목
const GPA_SKIP = new Set(["체육"]);
const GPA_SUBJECTS = SUBJECTS_43.filter(([s]) => !GPA_SKIP.has(s));
const GPA_CREDITS = GPA_SUBJECTS.reduce((a, [, c]) => a + c, 0);   // 30
// 띠의 막대 자리(--gpa-i)를 숫자로 등록해 둡니다: 손을 뗄 때 이 숫자 하나가 부드럽게 바뀌면서 막대 · 채움 · 글자 색이 함께 움직입니다.
// 등록을 지원하지 않는 브라우저에서는 건너뛰고(html 에 gpa-anim 이 안 붙음), 막대 · 채움만 따로 움직입니다 (css/study.css).
try { CSS.registerProperty({ name: "--gpa-i", syntax: "<number>", inherits: true, initialValue: "0" }); document.documentElement.classList.add("gpa-anim"); } catch { }
// 띠에 늘어놓는 순서: 낮은 등급부터 (왼쪽 F → 오른쪽 A+)
const GPA_ORDER = GRADES.map(([g]) => g).reverse();
// 고른 등급(st)으로 평균 칸과 과목마다의 띠를 다시 칠합니다. 띠를 끄는 동안에도 부르므로 화면을 새로 만들지 않고 값만 바꿉니다.
function gpaPaint(st) {
  const box = $("panel-gpa");
  if (!box || !$("gpaHero")) return;
  for (const s of PF_43) st[s] = "A+";
  let cred = 0, pts = 0;
  for (const [s, c] of GPA_SUBJECTS) if (st[s] in GRADE_PT) { cred += c; pts += c * GRADE_PT[st[s]]; }
  $("gpaHero").innerHTML = `
      <div><div class="gpa-big">${cred ? (pts / cred).toFixed(2) : "–"}</div><div class="gpa-max">/ 4.30</div></div>
      <div class="gpa-hero-tx"><b>평균 학점</b><br>입력한 ${cred}학점 기준 · 전체 ${GPA_CREDITS}학점<br>${cred < GPA_CREDITS
      ? `<span style="color:var(--text-muted)">아직 ${GPA_CREDITS - cred}학점이 미입력이에요</span>` : '<span style="color:var(--accent1)">모든 과목 입력 완료</span>'}</div>`;
  box.querySelectorAll(".gpa-strap").forEach((el) => {
    const g = st[el.dataset.gs], i = GPA_ORDER.indexOf(g);
    el.classList.toggle("none", i < 0);
    el.style.setProperty("--gpa-i", Math.max(i, 0));
    el.setAttribute("aria-valuenow", Math.max(i, 0));
    el.setAttribute("aria-valuetext", i < 0 ? "고르지 않음" : g);
    el.querySelectorAll(".gpa-strap-ticks span").forEach((t, k) => t.classList.toggle("on", k === i));
    const now = el.closest(".gpa-row").querySelector(".gpa-now");
    now.textContent = i < 0 ? "미입력" : GRADE_PT[g].toFixed(1);   // 등급 글자는 아래 띠에 표시되므로 평점만
    now.classList.toggle("none", i < 0);
  });
}
function renderGpa() {
  const box = $("panel-gpa");
  if (!box) return;
  const graded = GPA_SUBJECTS.filter(([s]) => !PF_43.has(s));
  const pfCred = GPA_SUBJECTS.filter(([s]) => PF_43.has(s)).reduce((a, [, c]) => a + c, 0);
  box.innerHTML = `
    <div class="gpa-hero" id="gpaHero"></div>
    <div class="gpa-hint">띠를 끌거나 눌러서 등급을 정해요. 고른 등급을 한 번 더 누르면 지워져요.</div>
    ${graded.map(([s, c]) => `<div class="gpa-row">
      <div class="gpa-head"><span class="gpa-name">${esc(subjName(s))}</span><span class="gpa-cred">${c}학점</span><span class="gpa-now"></span></div>
      <div class="gpa-strap" data-gs="${esc(s)}" role="slider" tabindex="0" aria-label="${esc(subjName(s))} 등급" aria-valuemin="0" aria-valuemax="${GPA_ORDER.length - 1}" style="--n:${GPA_ORDER.length}">
        <div class="gpa-strap-line"><div class="gpa-strap-fill"></div></div>
        <div class="gpa-strap-thumb"></div>
        <div class="gpa-strap-ticks">${GPA_ORDER.map((g, k) => `<span style="--k:${k}">${g}</span>`).join("")}</div>
      </div>
    </div>`).join("")}
    <div class="pf-note">P/F 과목 <b>${[...PF_43].map(subjName).join(" · ")}</b> (${pfCred}학점)은 전원 Pass라서 <b>A+(4.3)</b>로 자동 계산돼요. 따로 고를 필요 없어요.</div>
    <div class="gpa-actions">
      <button class="gpa-act" id="gpaAll">전부 A+로</button>
      <button class="gpa-act" id="gpaClear">전체 해제</button>
    </div>
    <div class="gpa-note"><b>계산 방식</b> — (과목 학점 × 등급 평점)을 모두 더한 뒤, 등급을 고른 과목의 학점 합으로 나눠요. 체육은 계산에 넣지 않고, P/F 과목은 A+로 계산돼요. 등급을 고르지 않은 과목은 계산에서 빠지고, 같은 등급을 다시 누르면 해제돼요. 고른 등급은 이 기기에만 저장돼요.</div>`;
  gpaPaint(gpaLoad());
  box.querySelectorAll(".gpa-strap").forEach(bindGpaStrap);
  $("gpaAll").onclick = () => { gpaSave(Object.fromEntries(GPA_SUBJECTS.map(([s]) => [s, "A+"]))); gpaPaint(gpaLoad()); };
  $("gpaClear").onclick = () => { gpaSave({}); gpaPaint(gpaLoad()); };
}
// 띠 하나: 끌거나 눌러서 등급을 정합니다. 고른 등급을 (끌지 않고) 한 번 더 누르면 지워집니다.
// 끄는 동안에는 화면만 따라가고, 손을 뗄 때 저장합니다. 세로로 넘기다(스크롤) 취소되면 원래대로 돌립니다.
// 키보드: ← → 로 한 칸, Home · End 로 양 끝, Delete 로 지움.
function bindGpaStrap(el) {
  const s = el.dataset.gs, n = GPA_ORDER.length;
  const at = (x) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.floor(((x - r.left) / r.width) * n))); };
  // 끄는 동안의 막대 자리: 칸 사이도 그대로 (0 ~ n-1 사이의 소수). 손을 떼면 가까운 등급(at)으로 붙습니다
  const fine = (x) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, ((x - r.left) / r.width) * n - 0.5)); };
  const set = (i) => { const st = gpaLoad(); if (i < 0) delete st[s]; else st[s] = GPA_ORDER[i]; gpaSave(st); gpaPaint(gpaLoad()); };
  let drag = null;   // { x: 누른 자리, was: 누르기 전 등급 자리, moved: 끌었는지 }
  el.onpointerdown = (e) => {
    if (e.button) return;
    drag = { x: e.clientX, was: GPA_ORDER.indexOf(gpaLoad()[s]), moved: false };
    try { el.setPointerCapture(e.pointerId); } catch {}
  };
  el.onpointermove = (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) > 4) { drag.moved = true; el.classList.add("drag"); }
    if (!drag.moved) return;
    const st = gpaLoad(); st[s] = GPA_ORDER[at(e.clientX)]; gpaPaint(st);   // 저장하지 않고 보여 주기만 (평균 · 글자는 가까운 등급으로)
    el.style.setProperty("--gpa-i", fine(e.clientX).toFixed(3));   // 막대와 채움은 마우스 · 손가락을 끊기지 않고 따라갑니다
  };
  el.onpointerup = (e) => {
    if (!drag) return;
    const i = at(e.clientX), again = !drag.moved && drag.was === i;
    drag = null; el.classList.remove("drag");
    set(again ? -1 : i);
  };
  el.onpointercancel = () => { drag = null; el.classList.remove("drag"); gpaPaint(gpaLoad()); };
  el.onkeydown = (e) => {
    const cur = GPA_ORDER.indexOf(gpaLoad()[s]);
    let i = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") i = cur < 0 ? n - 1 : Math.min(n - 1, cur + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") i = cur < 0 ? n - 1 : Math.max(0, cur - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else if (e.key === "Delete" || e.key === "Backspace") i = -1;
    if (i === null) return;
    e.preventDefault();
    set(i);
  };
}

// ---------- 배경화면 ----------
// 시간표를 휴대폰 · 태블릿 배경화면 크기의 그림으로 만들어 저장합니다 (42기 사이트와 같은 방식).
// 시간표가 아직 없으면 빈 칸으로 그려집니다.
const WP_DAY_COLORS = ["#a78bfa", "#60a5fa", "#34d399", "#fb923c", "#f472b6"];
const WP_SIZES = [
  ["자동", [["auto", "내 기기 화면 크기"]]],
  ["아이폰", [["1179x2556", "iPhone 14·15·16 (1179×2556)"], ["1290x2796", "iPhone Pro Max (1290×2796)"], ["1170x2532", "iPhone 12·13 (1170×2532)"], ["750x1334", "iPhone SE·7·8 (750×1334)"]]],
  ["아이패드 (세로)", [["2048x2732", "iPad Pro 12.9·13 (2048×2732)"], ["1668x2388", "iPad Pro 11 (1668×2388)"], ["1640x2360", "iPad Air 11 (1640×2360)"], ["1620x2160", "iPad 9·10세대 (1620×2160)"], ["1488x2266", "iPad mini (1488×2266)"]]],
  ["아이패드 (가로)", [["2732x2048", "iPad Pro 12.9·13 가로 (2732×2048)"], ["2388x1668", "iPad Pro 11 가로 (2388×1668)"], ["2360x1640", "iPad Air 11 가로 (2360×1640)"], ["2160x1620", "iPad 9·10세대 가로 (2160×1620)"], ["2266x1488", "iPad mini 가로 (2266×1488)"]]],
  ["안드로이드", [["1080x2340", "Android FHD+ (1080×2340)"], ["1440x3120", "Android QHD+ (1440×3120)"], ["1080x1920", "Android 16:9 (1080×1920)"], ["1600x2560", "Android 태블릿 (1600×2560)"]]],
];
const wp = { size: "auto", layout: "lock", theme: "dark", canvas: null };
function wpPanelHtml() {
  const opts = WP_SIZES.map(([g, items]) => `<optgroup label="${g}">${items.map(([v, l]) => `<option value="${v}"${wp.size === v ? " selected" : ""}>${l}</option>`).join("")}</optgroup>`).join("");
  // 배치 · 테마 고르기: 박스 없는 아이콘 버튼 (이름은 마우스를 올리면 나옵니다)
  const chip = (k, v, ic, l) => `<button class="wp-chip${wp[k] === v ? " on" : ""}" type="button" data-wp="${k}" data-wv="${v}" aria-label="${l}" title="${l}">${icon(ic)}</button>`;
  return `
    <div class="wp-controls">
      <div><div class="wp-group-label">해상도</div><select class="wp-select" id="wpSize">${opts}</select></div>
      <div><div class="wp-group-label">배치</div><div class="wp-chips">${chip("layout", "lock", "lock", "잠금화면 (시계 여백)")}${chip("layout", "home", "smartphone", "홈화면 (꽉 채움)")}</div></div>
      <div><div class="wp-group-label">테마</div><div class="wp-chips">${chip("theme", "dark", "dark_mode", "다크")}${chip("theme", "light", "light_mode", "라이트")}</div></div>
    </div>
    <div class="wp-preview-area">
      <div class="wp-frame"><img id="wpPreview" alt="배경화면 미리보기"></div>
      <div class="wp-size-note" id="wpSizeNote">—</div>
      <button class="wp-save" id="wpSave">${icon("download")} 배경화면 저장하기</button>
    </div>
    <div class="wp-tip">
      <strong>아이폰</strong>이면 저장이 안 될 때 위 미리보기를 <strong>길게 눌러 "사진에 추가"</strong>를 선택하세요.<br>
      저장 후 <strong>설정 → 배경화면</strong>에서 사진을 고르고, 확대되지 않도록 <strong>핀치로 축소</strong>해 원본 크기를 맞추면 글자가 가장 선명합니다.
    </div>`;
}
function bindWallpaper() {
  const v = $("studyView");
  if (!$("wpSize")) return;
  $("wpSize").onchange = (e) => { wp.size = e.target.value; generateWallpaper(); };
  v.querySelectorAll("[data-wp]").forEach((b) => b.onclick = () => {
    wp[b.dataset.wp] = b.dataset.wv;
    v.querySelectorAll(`[data-wp="${b.dataset.wp}"]`).forEach((x) => x.classList.toggle("on", x === b));
    generateWallpaper();
  });
  $("wpSave").onclick = saveWallpaper;
}
function wpDims() {
  if (wp.size !== "auto") return wp.size.split("x").map(Number);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  let w = Math.round((screen.width || 390) * dpr), h = Math.round((screen.height || 844) * dpr);
  if (w > h) [w, h] = [h, w];
  return [w, h];
}
function wpRoundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wpRgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function wpDarken(hex, amt) { const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v * (1 - amt)); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function wpWrap(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return [text];
  for (let cut = text.length - 1; cut > 0; cut--) if (ctx.measureText(text.slice(0, cut)).width <= maxW) return [text.slice(0, cut), text.slice(cut)];
  return [text];
}
// 화면 시간표의 과목 색(css/timetable.css 의 .color-N 과 수업 외 활동 칸)을 그대로 읽어 옵니다.
// 색 · 농도(--tt-alpha)를 css 에서 바꾸면 배경화면도 따라갑니다.
function wpCellColors() {
  const t = document.createElement("table");
  t.className = "timetable";
  t.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  t.innerHTML = `<tbody><tr>${Array.from({ length: 13 }, (_, i) => `<td class="color-${i}"></td>`).join("")}<td class="common-cell"></td></tr></tbody>`;
  document.body.append(t);
  const cs = [...t.querySelectorAll("td")].map((td) => getComputedStyle(td).backgroundColor);
  t.remove();
  return Object.assign(cs.slice(0, 13), { common: cs[13] });
}
function generateWallpaper() {
  const img = $("wpPreview");
  if (!img || !me) return;
  const [W, H] = wpDims(), S = Math.min(W, H), dark = wp.theme === "dark";
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const FONT = "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
  const txt = dark ? "#e8e8f0" : "#1a1a26", dim = dark ? "#8888aa" : "#6b6b85";
  if (dark) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0a0a0f"); g.addColorStop(0.5, "#12121c"); g.addColorStop(1, "#0d0d14");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r1 = ctx.createRadialGradient(W * 0.25, H * 0.15, 0, W * 0.25, H * 0.15, W * 0.9);
    r1.addColorStop(0, "rgba(124,111,224,0.20)"); r1.addColorStop(1, "rgba(124,111,224,0)");
    ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
    const r2 = ctx.createRadialGradient(W * 0.85, H * 0.85, 0, W * 0.85, H * 0.85, W);
    r2.addColorStop(0, "rgba(224,111,158,0.15)"); r2.addColorStop(1, "rgba(224,111,158,0)");
    ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#f7f7fb"); g.addColorStop(1, "#eceaf5");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const padX = W * 0.045, wide = W / H > 1.05;
  const topPad = wp.layout === "lock" ? H * (wide ? 0.17 : 0.215) : H * 0.085;
  const botPad = wp.layout === "lock" ? H * (wide ? 0.09 : 0.115) : H * 0.055;
  const titleSize = S * 0.058;
  const gridTop = topPad + titleSize + S * 0.10, gridBottom = H - botPad;
  const gridW = Math.min(W - padX * 2, S * 0.95), gridX = (W - gridW) / 2;
  const periodW = gridW * 0.072, cellW = (gridW - periodW) / 5;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = `900 ${titleSize}px ${FONT}`; ctx.fillStyle = txt;
  ctx.fillText(me.name || "", gridX, topPad + titleSize);
  ctx.font = `400 ${S * 0.028}px ${FONT}`; ctx.fillStyle = dim;
  ctx.fillText(`대전과학고 1학년 ${myBan() ? `${myBan()}반 ` : ""}${semesterLabel()} · 학번 ${me.student_id ?? ""}`, gridX, topPad + titleSize + S * 0.045);
  const tt = myTimetable();
  const used = Object.keys(tt).map((k) => +k.split("-")[1]);
  const maxPeriod = Math.max(7, ...used);
  const headH = (gridBottom - gridTop) * 0.062, rowH = (gridBottom - gridTop - headH) / maxPeriod;
  ctx.textAlign = "center";
  ctx.font = `700 ${Math.min(rowH * 0.42, cellW * 0.28)}px ${FONT}`;
  TT_DAYS.forEach((d, i) => {
    ctx.fillStyle = dark ? WP_DAY_COLORS[i] : wpDarken(WP_DAY_COLORS[i], 0.35);
    ctx.fillText(d, gridX + periodW + cellW * (i + 0.5), gridTop + headH * 0.75);
  });
  // 칸은 화면의 시간표와 같은 모양입니다: 이어지는 교시는 한 칸으로 묶고(ttBlockEnd), 과목 색은 css 의 것을 그대로 읽어 쓰고(wpCellColors),
  // 글자는 흰색으로 칸의 왼쪽 위에 둡니다.
  const colors = wpCellColors();
  const gap = Math.max(1, S * 0.0025), taken = {};   // taken[요일]: 위에서 묶은 칸이 차지한 마지막 교시
  const nameSize = Math.min(rowH * 0.3, cellW * 0.17), inPad = nameSize * 0.5;
  for (let p = 1; p <= maxPeriod; p++) {
    const y = gridTop + headH + rowH * (p - 1);
    ctx.textAlign = "center";
    ctx.font = `500 ${Math.min(rowH * 0.3, S * 0.026)}px ${FONT}`;
    ctx.fillStyle = dark ? "rgba(136,136,170,0.65)" : "rgba(107,107,133,0.8)";
    ctx.fillText(String(p), gridX + periodW * 0.5, y + rowH * 0.58);
    TT_DAYS.forEach((day, i) => {
      if (taken[day] >= p) return;   // 위 칸이 이 자리까지 차지함
      const subj = tt[`${day}-${p}`];
      const x = gridX + periodW + cellW * i;
      if (!subj) {
        ctx.fillStyle = dark ? "rgba(255,255,255,0.022)" : "rgba(0,0,0,0.03)";
        ctx.fillRect(x + gap, y + gap, cellW - gap * 2, rowH - gap * 2);
        return;
      }
      const to = taken[day] = ttBlockEnd(tt, day, p, maxPeriod);
      const bx = x + gap, by = y + gap, bw = cellW - gap * 2, bh = rowH * (to - p + 1) - gap * 2;
      const real = isSubject43(subj);
      // css 에서 읽은 색을 캔버스가 알아듣지 못하면(오래된 브라우저) 앞에 넣어 둔 예비 색이 그대로 남습니다
      ctx.fillStyle = real ? subjColor(subj) : "#aab2bd";
      ctx.fillStyle = real ? colors[colorIdx43(subj)] : colors.common;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.font = `700 ${nameSize}px ${FONT}`;
      ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = nameSize * 0.15;
      let ty = by + inPad + nameSize * 0.85;
      wpWrap(ctx, real ? subjName(subj) : subj, bw - inPad * 2).forEach((l) => { ctx.fillText(l, bx + inPad, ty); ty += nameSize * 1.18; });
      if (!real) {   // 수업 외 활동(자율 · 동아리 · R&E): 화면처럼 아래에 작게 '전체'
        ctx.font = `500 ${nameSize * 0.8}px ${FONT}`;
        ctx.fillText("전체", bx + inPad, ty - nameSize * 0.08);
      }
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    });
  }
  wp.canvas = canvas;
  img.src = canvas.toDataURL("image/png");
  if ($("wpSizeNote")) $("wpSizeNote").textContent = `${W} × ${H} px`;
}
function saveWallpaper() {
  if (!wp.canvas) generateWallpaper();
  if (!wp.canvas) return;
  const fname = `시간표_${me?.name || "43기"}_1학년${semesterLabel()}.png`;
  const done = (url) => {
    const a = document.createElement("a");
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); }, 4000);
  };
  if (wp.canvas.toBlob) wp.canvas.toBlob((b) => done(b ? URL.createObjectURL(b) : wp.canvas.toDataURL("image/png")), "image/png");
  else done(wp.canvas.toDataURL("image/png"));
}

// 내 일정: 수행평가(공지 + 내가 올린 것)와 개인 일정을 한 달력에 모두 보여줍니다. 로그인하면 이 탭으로 시작합니다.
function openStudy(p) {
  if (me?.is_admin) return openAdminMoved();
  if (otherCohort()) return openOtherCohort();
  page = PAGE_VIEW[p] ? p : "cal";
  view = PAGE_VIEW[page];
  destroyCal();
  $("studyView").style.display = "block";
  document.body.classList.add("study-open");
  if (page === "meal") { mealDay = null; renderMeal(); renderNav(); return; }   // 급식은 NEIS 에서 바로 받습니다 (열 때마다 다음 끼니 날로)
  if (page === "tt") { ttView = null; renderTimetable(); renderNav(); return; }   // 시간표는 서버 자료를 쓰지 않습니다
  renderStudy();
  renderNav();
  // 받아 둔 내용(지난 화면 · 앞서 받은 것)이 있으면 '불러오는 중' 없이 바로 그리고, 서버에서 새로 받아 바뀐 것만 다시 그립니다
  if (haveData) rerender();
  loadAssignments({ quiet: true });
}
function closeStudy() {
  destroyCal();
  $("studyView").style.display = "none";
  document.body.classList.remove("study-open");
  if (me) renderNav();
}
// 지금 view 에 맞춰 studyBody 를 다시 그립니다
function rerender() {
  if (view === "meal" || view === "tt") return;   // 급식 · 시간표 탭은 서버 자료를 쓰지 않습니다
  if (view === "notice") renderNotice();
  else if (view === "todo") renderTodo();
  else renderList(view);
}
