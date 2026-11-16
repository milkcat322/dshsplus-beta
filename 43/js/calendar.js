"use strict";
// dshs43.app — js/calendar.js: 달력(FullCalendar) · 지난 일정 자동 완료 · 공유 일정 · 목록 · 완료 체크
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 달력 (FullCalendar) ----------
const FC_SRC = "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js";
const FC_KO = "https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.15/locales/ko.global.min.js";
const FC_VIEW = { "3day": "threeDays", week: "timeGridWeek", month: "dayGridMonth" };
const HOUR = 3600000;

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
}
let fcReady = null;
function loadFC() {
  if (!fcReady) fcReady = loadScript(FC_SRC).then(() => loadScript(FC_KO));
  return fcReady;
}

function destroyCal() {
  if (fc) { fcDate = fc.getDate(); fc.destroy(); fc = null; }
}

async function mountCal() {
  try { await loadFC(); }
  catch { fcReady = null; $("calHost").innerHTML = `<div class="study-empty">달력을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</div>`; return; }
  const host = $("calHost");
  if (!host || tab === "list") return;   // 불러오는 사이 다른 화면으로 넘어감
  host.innerHTML = "";
  const narrow = window.innerWidth < 640;
  fc = new FullCalendar.Calendar(host, {
    initialView: FC_VIEW[tab],
    initialDate: fcDate || undefined,
    views: { threeDays: { type: "timeGrid", duration: { days: 3 } } },
    locale: "ko",
    headerToolbar: false,
    height: narrow ? Math.max(480, window.innerHeight * 0.72) : 720,
    nowIndicator: true,
    allDaySlot: true,
    allDayText: "종일",
    slotDuration: "01:00:00",
    snapDuration: "00:15:00",
    scrollTime: "08:00:00",
    lazyFetching: false,   // 보기를 바꿀 때마다 새로 그립니다
    expandRows: true,
    dayMaxEvents: 3,
    eventDisplay: "block",
    selectable: true,
    selectMirror: true,
    selectMinDistance: 5,
    longPressDelay: 400,
    eventResizableFromStart: true,
    slotLabelFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
    dayHeaderContent: (arg) => arg.view.type === "dayGridMonth"
      ? arg.text
      : { html: `<span class="fcx-wd">${arg.date.toLocaleDateString("ko-KR", { weekday: "short" })}</span><span class="fcx-daynum">${arg.date.getDate()}</span>` },
    // 월 보기 칸의 "29일" → "29". 주·3일 보기의 종일 칸에는 날짜를 다시 쓰지 않습니다
    dayCellContent: (arg) => arg.view.type === "dayGridMonth" ? String(arg.date.getDate()) : "",
    events: (info, ok) => ok([...ttEvents(info.start, info.end), ...acadEvents(info.start, info.end), ...fcEvents()]),
    eventContent: fcContent,
    datesSet: (arg) => { fcDate = arg.view.currentStart; const t = $("calTitle"); if (t) t.textContent = arg.view.title; },
    dateClick: (arg) => {
      let start = arg.date;
      if (arg.view.type === "dayGridMonth") {   // 월 보기에서 날짜를 누르면 다음 정각 1시간짜리
        start = new Date(arg.date);
        start.setHours(Math.min(new Date().getHours() + 1, 23));
        return openEventForm(null, { start, end: new Date(+start + HOUR), allDay: false });
      }
      openEventForm(null, { start, end: arg.allDay ? start : new Date(+start + HOUR), allDay: arg.allDay });
    },
    select: (arg) => {
      fc.unselect();
      openEventForm(null, { start: arg.start, end: arg.allDay ? new Date(+arg.end - 1) : arg.end, allDay: arg.allDay });
    },
    eventClick: (arg) => {
      const [kind, id] = arg.event.id.split(":");
      if (kind === "todo" && arg.jsEvent.target.closest(".fcx-tchk")) return toggleTodo(id);   // 동그라미 = 체크
      openItem(kind, id);
    },
    eventDrop: (arg) => moveEvent(arg),
    eventResize: (arg) => moveEvent(arg),
  });
  fc.render();
  loadAcademic();
}

// agenda() 항목 → FullCalendar 일정. 수행평가는 마감일의 종일 칸에 둡니다.
function fcEvents() {
  return agenda().map((it) => {
    const base = {
      id: `${it.kind}:${it.id}`, title: it.title,
      classNames: [`c-${it.color}`, it.kind === "asg" ? "fcx-asg" : "", it.status && it.status !== "approved" ? "fcx-pend" : "", it.done ? "is-done" : ""],
      extendedProps: { kind: it.kind, at: it.at, done: it.done, shared: it.shared },
    };
    if (it.shared) base.classNames.push("fcx-shared");
    if (it.kind === "todo") return { ...base, classNames: [...base.classNames, "fcx-todo"], start: dayKey(it.at), allDay: true, editable: true, durationEditable: false };
    if (it.kind === "asg") return { ...base, start: dayKey(it.at), allDay: true, editable: false };
    if (it.allDay) {
      const last = it.end || it.at;   // 종일 일정의 끝은 마지막 날 23:59 → FullCalendar 는 다음 날 0시(미포함)
      return { ...base, start: dayKey(it.at), end: dayKey(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)), allDay: true, editable: !!it.owner };
    }
    // 친구가 공유한 일정은 만든 사람만 옮길 수 있습니다
    return { ...base, start: it.at, end: it.end || new Date(+it.at + HOUR / 2), editable: !!it.owner };
  });
}

// 폰의 주·월 보기는 칸이 좁아 시간은 빼고, 제목은 칸에 들어가는 만큼만 보여 줍니다 (눌러서 자세히 봄).
// 폰의 3일 보기는 줄이지 않고 줄바꿈으로 모두 보여 줍니다 (index.html 의 .fc-threeDays-view 규칙).
const compactCal = (arg) => window.innerWidth < 640 && arg.view.type !== "threeDays";

function fcContent(arg) {
  const p = arg.event.extendedProps;
  const compact = compactCal(arg);
  const full = arg.event.title, title = full;
  if (p.kind === "tt") return { html: `<div class="fcx-tt-in"><b>${esc(title)}</b>${compact ? "" : `<span>${esc(p.label)}</span>`}</div>` };
  if (p.kind === "todo") return { html: `<div class="fcx" title="${esc(full)}"><div class="fcx-title"><span class="fcx-tchk" role="checkbox" aria-checked="${p.done}" aria-label="완료 표시">${p.done ? "✓" : ""}</span>${esc(title)}</div></div>` };
  const s = arg.event.start, e = arg.event.end;
  const time = compact ? ""
    : p.kind === "asg" ? `${hm(p.at)} 마감`
    : arg.event.allDay ? "" : `${hm(s)}${e ? ` – ${hm(e)}` : ""}`;
  return { html: `<div class="fcx" title="${esc(full)}">
    ${time ? `<div class="fcx-time">${time}</div>` : ""}
    <div class="fcx-title">${esc(title)}</div>
  </div>` };
}

// 끌어서 옮기거나 늘린 개인 일정 저장
async function moveEvent(arg) {
  const [kind, id] = arg.event.id.split(":");
  const s = arg.event.start, e = arg.event.end;
  let row;
  if (arg.event.allDay) {
    const lastDay = e ? new Date(+e - 1) : s;   // 미포함 끝 → 마지막 날
    row = {
      all_day: true, starts_at: s.toISOString(),
      ends_at: dayKey(lastDay) !== dayKey(s)
        ? new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59).toISOString() : null,
    };
  } else {
    row = { all_day: false, starts_at: s.toISOString(), ends_at: (e || new Date(+s + HOUR)).toISOString() };
  }
  if (kind === "todo") {   // 할 일: 놓은 날짜로 기한만 옮깁니다 (시간 칸에 놓아도 그날 종일로)
    const t = cache.todos.find((x) => x.id === id);
    const prev = t.due_on, due_on = dayKey(s);
    if (due_on === prev) { fc.refetchEvents(); return; }
    const { error } = await sb.from("todos").update({ due_on }).eq("id", id);
    if (error) { arg.revert(); return toast("옮기지 못했어요", true); }
    t.due_on = due_on;
    fc.refetchEvents();
    return undoToast(`할 일 기한을 옮겼어요 · ${todoDue(due_on).short}`, async () => {
      const { error } = await sb.from("todos").update({ due_on: prev }).eq("id", id);
      if (error) return false;
      t.due_on = prev;
      fc?.refetchEvents();
    });
  }
  // 학교 일정 · 학사일정은 학생이 옮길 수 없습니다 (관리자 사이트에서 고침)
  if (kind === "acad" || kind === "sch") { arg.revert(); return; }
  // 지난 일정을 미래로 옮기면 완료를 취소합니다 (함께하는 친구 체크는 DB 트리거가 풉니다).
  // 미래 일정끼리 옮기는 건 완료 여부를 건드리지 않습니다.
  const ev = cache.events.find((x) => x.id === id);
  const prev = { starts_at: ev.starts_at, ends_at: ev.ends_at, all_day: ev.all_day, done: ev.done };
  const reopened = isPastEvent(ev) && eventEnd(row) > new Date();
  if (reopened) row.done = false;
  const { error } = await sb.from("events").update(row).eq("id", id);
  if (error) { arg.revert(); return toast("옮기지 못했어요", true); }
  Object.assign(ev, row);
  fc.refetchEvents();
  undoToast((arg.event.allDay ? "날짜를 옮겼어요"
    : `${md(s)} ${hm(s)} – ${hm(new Date(row.ends_at))}(으)로 옮겼어요`) + (reopened ? " · 완료 취소" : ""), async () => {
    const { error } = await sb.from("events").update(prev).eq("id", id);
    if (error) return false;
    Object.assign(ev, prev);
    fc?.refetchEvents();
  });
}

// ---------- 지난 일정 자동 완료 ----------
// 끝나는 시각이 지나면 완료로 보여줍니다 (DB 에 쓰지 않고 그릴 때 계산).
// 끝이 없으면: 종일 일정은 그날 밤 23:59:59, 시간 일정은 시작 시각.
// e 는 events 행 모양 { starts_at, ends_at, all_day } 이면 됩니다.
function eventEnd(e) {
  if (e.ends_at) return new Date(e.ends_at);
  const s = new Date(e.starts_at);
  return e.all_day ? new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59) : s;
}
const isPastEvent = (e) => eventEnd(e) < new Date();

// ---------- 공유 일정 ----------
const ownsEvent = (e) => e.user_id === me.id;
const eventPeople = (e) => cache.people.get(e.id) || [];
const eventInvites = (e) => cache.invites?.get(e.id) || [];   // 학번 목록 (가입 전이라 아직 달력에 없음)
const rosterName = (sid) => roster().find((p) => p.sid === +sid)?.name || String(sid);   // 43기는 명단이 없어 학번 그대로
// 완료 체크는 사람마다 따로: 만든 사람은 events.done, 참여자는 event_members.done
const eventDone = (e) => ownsEvent(e) ? e.done : !!eventPeople(e).find((p) => p.user_id === me.id)?.done;
function shareLabel(e) {
  const ppl = eventPeople(e);
  if (!ppl.length && !eventInvites(e).length) return "";
  if (!ownsEvent(e)) return `${ppl.find((p) => p.is_owner)?.name || "친구"}님이 공유`;
  const names = [...ppl.filter((p) => !p.is_owner).map((p) => p.name), ...eventInvites(e).map(rosterName)];
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} 외 ${names.length - 2}명과` : `${names.join(", ")}와 함께`;
}

// ---------- 목록 ----------
// 수행평가와 개인 일정을 한 형태로 합칩니다
function agenda() {
  // 내가 올린 수행평가는 승인 전(또는 반려 후)에도 내 일정에는 바로 들어갑니다.
  // 승인은 "분반 전체에 공지할지"만 정합니다.
  const own = (cache.mine || []).filter((a) => a.status !== "approved");
  const now = new Date();
  // 마감 일시가 없는 공지는 날짜가 없어 달력·목록에 놓을 수 없으므로 수행평가 공지 탭에서만 보여 줍니다
  const asgs = [...cache.items, ...own].filter((a) => a.due_at).map((a) => ({
    kind: "asg", id: a.id, title: a.title, at: new Date(a.due_at), end: null, allDay: false,
    color: "asg", done: cache.done.has(a.id) || new Date(a.due_at) < now, status: a.status,
    auto: !cache.done.has(a.id) && new Date(a.due_at) < now,
    tag: `${subjName(a.subject)} · ${banLabel(a.ban)}`,
  }));
  const evs = cache.events.map((e) => ({
    kind: "ev", id: e.id, title: e.title, at: new Date(e.starts_at), end: e.ends_at ? new Date(e.ends_at) : null,
    allDay: e.all_day, color: e.color, done: eventDone(e) || isPastEvent(e), auto: !eventDone(e) && isPastEvent(e),
    owner: ownsEvent(e), shared: eventPeople(e).length > 0,
    tag: [shareLabel(e), e.memo.split("\n")[0]].filter(Boolean).join(" · "),
  }));
  // 학교 일정 (관리자가 관리자 사이트에서 만들고 고침. 숨긴 일정은 빠짐)
  const sch = liveSchool().filter((e) => acadShown(e.category)).map((e) => ({
    kind: "sch", id: e.id, title: e.title, at: new Date(e.starts_at), end: e.ends_at ? new Date(e.ends_at) : null,
    allDay: e.all_day, color: "school", done: false, owner: false,
    tag: [e.no_class && "수업 없음", e.memo.split("\n")[0]].filter(Boolean).join(" · "),
  }));
  // 기한을 정한 할 일은 그날 종일 칸에 체크박스로 둡니다
  const todos = (cache.todos || []).filter((t) => t.due_on).map((t) => ({
    kind: "todo", id: t.id, title: t.title, at: parseDay(t.due_on), end: null, allDay: true,
    color: "mint", done: t.done, owner: true,
  }));
  return [...sch, ...asgs, ...todos, ...evs, ...dshsAgenda()].sort(byAgenda);
}
const byAgenda = (x, y) => (y.allDay - x.allDay) || (x.at - y.at);

function timeLabel(it) {
  const multi = it.end && dayKey(it.end) !== dayKey(it.at);
  if (it.kind === "asg") return `${hm(it.at)} 마감`;
  if (it.allDay) return multi ? `${md(it.at)} – ${md(it.end)} · 하루 종일` : "하루 종일";
  if (!it.end) return hm(it.at);
  return multi ? `${md(it.at)} ${hm(it.at)} – ${md(it.end)} ${hm(it.end)}` : `${hm(it.at)} – ${hm(it.end)}`;
}

// 일정 종류 이름. 모든 일정은 같은 모양이고 색으로만 구분합니다 (범례 · 목록의 회색 글씨)
const KIND_LABEL = { asg: "수행평가", todo: "할 일", ev: "내 일정", sch: "학교 일정", acad: "학교 일정", dshs: "dshs.app 신청" };
function legendHtml() {
  const kinds = [["asg", "c-asg"], ["todo", "c-mint"], ["ev", "c-violet"], ["sch", "c-school"], ["dshs", "c-dshs"]];
  return `<div class="kind-legend">${kinds.map(([k, c]) => `<span class="kl ${c}"><i></i>${KIND_LABEL[k]}</span>`).join("")}</div>`;
}

function row(it) {
  const d = it.kind === "asg" && !it.done ? dueInfo(it.at) : null;
  return `<div class="ev-row c-${it.color}${it.done ? " done" : ""}">
    ${it.kind === "sch" || it.kind === "acad" || it.kind === "dshs" ? `<span class="ev-dot" aria-hidden="true"></span>`
      : `<button class="ev-check" data-chk="${it.kind}:${it.id}" aria-label="완료 표시"${it.auto
      ? ' disabled title="지난 일정은 자동으로 완료돼요"' : ""}>${it.done ? "✓" : ""}</button>`}
    <button class="ev-main" data-open="${it.kind}:${it.id}">
      <span class="ev-title">${esc(it.title)}</span>
      <span class="ev-meta">${KIND_LABEL[it.kind]} · ${esc(timeLabel(it))}${it.tag ? ` · ${esc(it.tag)}` : ""}</span>
    </button>
    ${it.kind === "asg" ? `<span class="asg-badges">${stBadge(it.status)}${d ? `<span class="due-badge ${d.tone}">${d.label}</span>` : ""}</span>` : ""}
  </div>`;
}

function listHtml(list) {
  const today = dayKey(new Date());
  // 이미 시작한 여러 날 일정은 오늘 칸에 묶습니다
  const groups = new Map();
  for (const it of list.filter((it) => dayKey(it.end || it.at) >= today)) {
    const key = dayKey(it.at) < today ? today : dayKey(it.at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const keys = [...groups.keys()].sort();
  const left = list.filter((it) => !it.done && dayKey(it.end || it.at) >= today).length;
  return `<div class="study-section">남은 일정 ${left}건</div>` +
    (keys.length
      ? keys.map((k) => `<div class="day-head">${k === today ? "오늘 · " : ""}${dayTitle(k)}</div>` +
          groups.get(k).map(row).join("")).join("")
      : `<div class="study-empty">다가오는 일정이 없어요.</div>`);
}

// ---------- 완료 체크 ----------
async function toggleDone(kind, id) {
  if (kind === "todo") return toggleTodo(id);
  let error;
  if (kind === "asg") {
    const on = !cache.done.has(id);
    ({ error } = on
      ? await sb.from("assignment_done").insert({ assignment_id: id })
      : await sb.from("assignment_done").delete().eq("assignment_id", id));
    if (!error) on ? cache.done.add(id) : cache.done.delete(id);
  } else {
    const ev = cache.events.find((e) => e.id === id);
    const on = !eventDone(ev);
    if (ownsEvent(ev)) {
      ({ error } = await sb.from("events").update({ done: on }).eq("id", id));
      if (!error) ev.done = on;
    } else {
      ({ error } = await sb.from("event_members").update({ done: on }).eq("event_id", id).eq("user_id", me.id));
      if (!error) eventPeople(ev).find((p) => p.user_id === me.id).done = on;
    }
  }
  if (error) return toast("저장하지 못했어요", true);
  renderNav();   // 수행평가 탭 옆 숫자 갱신
  rerender();
}
