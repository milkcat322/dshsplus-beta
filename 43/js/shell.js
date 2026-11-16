"use strict";
// dshs43.app — js/shell.js: 밑줄 탭 · 맨 위 메뉴 · 인터넷 연결 · 마감 알림 카드 · 로그인 직후 안내 · 앱 설치 안내
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 밑줄 탭 ----------
// 고른 탭 아래의 밑줄(.tab-ink). 탭을 바꾸면 밑줄이 그 탭으로 미끄러져 갑니다 (움직임은 css 의 .tab-ink transition).
// 선택 버튼 묶음(.seg)에서는 밑줄 대신 고른 버튼 뒤의 바탕(.seg-ink)이 같은 방식으로 움직입니다.
// 탭 묶음을 통째로 다시 그려도(innerHTML) 직전 자리에서 출발하도록, 묶음 이름(key)마다 마지막 자리를 기억합니다.
const inkAt = {};
function moveInk(box, sel, key) {
  if (!box) return;
  box.dataset.ink = `${key}|${sel}`;
  const on = box.querySelector(sel);
  const pill = box.classList.contains("seg");   // 선택 버튼 묶음: 밑줄이 아니라 버튼 크기의 바탕
  let ink = box.querySelector(":scope > .tab-ink, :scope > .seg-ink");
  const fresh = !ink;
  if (fresh) { ink = document.createElement("span"); ink.className = pill ? "seg-ink" : "tab-ink"; box.append(ink); }
  if (pill) box.classList.add("inked");   // 바탕이 생겼으니 고른 버튼 자체의 바탕색은 뺍니다 (css)
  if (!on || !on.offsetWidth) { ink.style.opacity = "0"; return; }   // 고른 탭이 없거나 화면에 안 보임
  const put = (p) => { ink.style.width = `${p.w}px`; if (p.h) ink.style.height = `${p.h}px`; ink.style.transform = `translate(${p.x}px, ${p.y}px)`; };
  const to = pill ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight }
    : { x: on.offsetLeft, y: on.offsetTop + on.offsetHeight - 1, w: on.offsetWidth };
  if (fresh || ink.style.opacity === "0") {   // 새로 만든 밑줄: 직전 자리(없으면 도착 자리)에 먼저 놓고 나서 움직입니다
    ink.style.transition = "none";
    put(inkAt[key] || to);
    void ink.offsetWidth;   // 위 자리를 먼저 그리게 합니다
    ink.style.transition = "";
  }
  ink.style.opacity = "1";
  put(to);
  inkAt[key] = to;
}
// 화면 폭이 바뀌거나 글꼴이 늦게 오면 탭 자리가 달라지므로 밑줄을 다시 맞춥니다 (움직임 없이)
function refitInks() {
  document.querySelectorAll("[data-ink]").forEach((box) => {
    const [key, sel] = box.dataset.ink.split("|");
    delete inkAt[key];
    box.querySelector(":scope > .tab-ink, :scope > .seg-ink")?.remove();
    moveInk(box, sel, key);
  });
}
addEventListener("resize", refitInks);
document.fonts?.addEventListener?.("loadingdone", refitInks);

// 선택 버튼 묶음(.seg — 달력 보기 전환 · 시간표 글자 크기 · 수행평가 정렬 · 공지 범위)은 어디서 그리든 자동으로 맞춥니다:
// 화면이 바뀔 때마다(MutationObserver) 화면에 있는 .seg 를 찾아, 고른 버튼(.seg-btn.on) 뒤로 바탕을 옮깁니다.
// 묶음 이름은 id, 없으면 버튼의 data-* 이름(seg · ttfont · asort …)이라 다시 그려도 직전 자리에서 출발합니다.
let segTick = 0;
function inkSegs() {
  segTick = 0;
  document.querySelectorAll(".seg").forEach((box) => {
    const b = box.querySelector(".seg-btn");
    if (b) moveInk(box, ".seg-btn.on", `seg:${box.id || Object.keys(b.dataset)[0] || "x"}`);
  });
}
new MutationObserver(() => { if (!segTick) segTick = requestAnimationFrame(inkSegs); })
  .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

// ---------- 헤더 ----------
function renderNav() {
  const nav = $("studyNav");
  // 로그인 전에는 위쪽 메뉴를 숨깁니다. 시작하기는 시작하기 화면의 버튼 하나뿐이고, 그 아래 작은 관리자 로그인이 있습니다.
  nav.style.display = me ? "flex" : "none";
  const open = $("studyView").style.display === "block";
  // 관리자 계정은 관리자 사이트로, 다른 기수 학생은 그 기수 사이트로 안내하는 버튼 하나만
  const other = otherCohort();
  const tabs = me?.is_admin ? [["moved", "관리자 사이트로"]] : other ? [["other", "42기 사이트로"]] : PAGES;
  const on = (k) => open && page === k;
  nav.innerHTML = me
    ? tabs.map(([k, label]) => {
      const n = k === "notice" && !me.is_admin ? asgSoonCount() : 0;
      return `<button class="study-btn${on(k) ? " primary" : ""}" data-page="${k}">${label}${n ? `<span class="tab-count">${n}</span>` : ""}</button>`;
    }).join("")
    : "";
  nav.classList.toggle("plain", tabs !== PAGES);
  moveInk(nav, ".study-btn.primary", "nav");
  // 설정(알림 · 학교 일정 · 계정)은 업데이트 옆에 늘 보입니다 (로그인 전에는 관리자 로그인을 여는 곳)
  const set = $("btnSettings");
  set.style.display = "";
  set.onclick = openSettings;
  if (me) {
    nav.querySelectorAll("[data-page]").forEach((b) => b.onclick = () =>
      (b.dataset.page === "other" ? openOtherCohort() : b.dataset.page === "moved" ? openAdminMoved() : openStudy(b.dataset.page)));
    if (sb && !me.is_admin && !other) { autoPush(); loadStatus(); }
  }
  applyAccess();
}

// 제목(dshs43.app — 머리글의 h1 과 폰에서 위에 붙는 로고)을 누르면 시간표 탭으로 갑니다.
// 로그인한 43기 학생일 때만 (로그인 전 · 관리자 · 다른 기수 계정은 그대로).
function goTimetable() {
  if (!me || me.is_admin || otherCohort()) return;
  openStudy("tt");
  scrollTo({ top: 0 });
}
document.querySelectorAll(".header h1, .nav-logo").forEach((el) => { el.onclick = goTimetable; el.title = "시간표로"; });

// ---------- 인터넷 연결 · 로그인에 따라 보이는 것 ----------
// 인터넷이 없으면 '연결되어 있지 않아요' 안내만 보여 줍니다 (43기는 오프라인에서 볼 시간표가 아직 없음).
// 인터넷이 있으면 로그인 전에는 시작하기 화면만 보입니다. 화면을 숨기는 규칙은 index.html 의 body.offline · body.need-login.
let netDown = false;   // 와이파이에 붙어 있어도(navigator.onLine) 서버에 닿지 못하면 오프라인으로 봅니다
function applyAccess(guest = !me) {
  const off = !navigator.onLine || netDown;
  document.body.classList.toggle("offline", off);
  document.body.classList.toggle("need-login", !off && guest);
  if (!off && guest && !me) logGate("seen");
}
// ---------- 서버에 정말 닿지 않는지 확인 ----------
// 요청 하나가 실패했다고 바로 오프라인 화면으로 바꾸지 않습니다. 와이파이가 멀쩡해도
//  - 아이폰은 앱을 내렸다 올리면 하던 요청이 'Load failed' 로 끝나고,
//  - 학교 와이파이에서 여럿이 한꺼번에 열면 요청 한도(429)에 걸려 '연결 실패'(authFetch)처럼 보이기 때문입니다.
// 서버에 직접 한 번 물어 응답이 오면(오류 응답이어도) 연결된 것으로 보고, 아무 응답이 없을 때만 오프라인으로 바꿉니다.
// 오프라인이 된 뒤에는 15초부터 최대 1분 간격으로, 그리고 화면으로 돌아올 때마다 다시 확인해 닿으면 바로 돌아옵니다.
// (브라우저의 'online' 이벤트는 와이파이가 붙은 채로 서버만 잠깐 안 닿았던 경우에는 오지 않습니다)
async function serverReachable() {
  if (!navigator.onLine) return false;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    await fetch(`${CFG.SUPABASE_URL}/auth/v1/health`, { headers: { apikey: CFG.SUPABASE_ANON_KEY }, cache: "no-store", signal: ctl.signal });
    return true;
  } catch { return false; } finally { clearTimeout(t); }
}
async function netTrouble() {
  if (netTrouble.busy) return;
  netTrouble.busy = true;
  try {
    if (await serverReachable()) {
      if (netDown) netBack();
      return;
    }
    netDown = true;
    applyAccess();
    watchNet();
  } finally { netTrouble.busy = false; }
}
function watchNet(delay = 15000) {
  clearTimeout(watchNet.t);
  watchNet.t = setTimeout(async () => {
    watchNet.t = null;
    if (!netDown) return;
    if (await serverReachable()) netBack();
    else watchNet(Math.min(Math.max(delay, 15000) * 2, 60000));
  }, delay);
}
function netBack() {
  clearTimeout(watchNet.t);
  watchNet.t = null;
  backOnline();
}
// 로그인 기능을 못 불러온 채 다시 연결되면 새로 엽니다. 라이브러리 서버만 안 되는 경우 계속 새로 열지 않게 한 세션에 3번까지
function reloadForNet() {
  let n = 0;
  try { n = +sessionStorage.getItem("dshs-net-reload") || 0; sessionStorage.setItem("dshs-net-reload", String(n + 1)); } catch {}
  if (n < 3) location.reload();
  else { netDown = true; applyAccess(); }
}

// 다시 연결되면: 로그인 기능을 못 불러왔으면 새로 열고, 로그인 기록이 있으면 다시 읽어 내 화면으로 돌아갑니다
async function backOnline() {
  netDown = false;
  if (!sb) return reloadForNet();
  const had = me;
  await loadProfile();   // 지난 화면으로 버티던 중이면 새 내용으로 바꿉니다
  if (me && !had) { renderNav(); loadAssignments(); return openHome(); }
  if (me) { renderNav(); loadAssignments(); if (!otherCohort()) loadStatus(true); }
  applyAccess();
}

// ---------- 마감 알림 받기 카드 ----------
// 알림을 아직 안 켠 기기에 한 번 알려 줍니다. 허락 창은 '알림 받기' 버튼을 누른 뒤에만 뜹니다.
// 기억: localStorage 'dshs-push-card' = {n: 닫은 횟수, at: 마지막으로 닫은 시각} 또는 {done: true}
const PUSH_CARD = "dshs-push-card";
const PUSH_CARD_WAIT = 3 * 86400000;   // '나중에' 뒤 다시 보여 주기까지
function pushCardState() {
  try { return JSON.parse(localStorage.getItem(PUSH_CARD)) || {}; } catch { return {}; }
}
function pushCardSave(s) { try { localStorage.setItem(PUSH_CARD, JSON.stringify(s)); } catch {} }

async function maybePushCard() {
  if (!me || !pushPossible() || !pushWanted()) return;
  if (!("Notification" in window) || Notification.permission !== "default") return;
  const st = pushCardState();
  if (st.done || st.n >= 2) return;
  if (st.n === 1 && Date.now() - (st.at || 0) < PUSH_CARD_WAIT) return;
  await refreshPush().catch(() => {});
  if (pushOn || Notification.permission !== "default") return;
  const anchor = $("myStatus");
  if (!anchor || $("pushCard")) return;   // 그 사이 화면이 바뀐 경우
  anchor.insertAdjacentHTML("afterend",
    '<div class="my-status" id="pushCard"><span id="pushCardMsg">' + icon("notifications") + ' 수행평가 마감 1일 · 6시간 전에 알려 드릴까요?</span>' +
    '<span style="margin-left:auto;display:flex;gap:6px"><button class="ms-btn" id="pushCardYes" type="button" aria-label="알림 받기" title="알림 받기">' + icon("notifications_active") + '</button>' +
    '<button class="ms-btn" id="pushCardLater" type="button" aria-label="나중에" title="나중에">' + icon("close") + '</button></span></div>');
  $("pushCardLater").onclick = () => {
    pushCardSave({ n: (st.n || 0) + 1, at: Date.now() });
    $("pushCard")?.remove();
  };
  $("pushCardYes").onclick = async () => {
    const card = $("pushCard");
    const finish = (msg, ms) => {
      if (!card.isConnected) return;
      card.innerHTML = msg;   // msg 는 아래의 고정 문구 (아이콘 포함)
      setTimeout(() => card.remove(), ms);
    };
    $("pushCardYes").disabled = true;
    try { await enablePush(); } catch {}
    if (pushOn) {
      try { localStorage.setItem(PUSH_PREF, "on"); } catch {}
      pushCardSave({ done: true });
      finish(icon("notifications_active") + " 알림이 켜졌어요", 2500);
    } else if (Notification.permission === "denied") {
      pushCardSave({ done: true });
      finish("브라우저 설정에서 알림을 허용해야 해요", 6000);
    } else {
      $("pushCardYes").disabled = false;   // 허락 창을 그냥 닫은 경우 등: 카드는 그대로
    }
  };
}

// ---------- 로그인 직후 안내: 홈 화면에 추가 · 알림 켜기 ----------
// 로그인하고 돌아온 직후 한 번, 이 기기에서 아직 안 한 것만 보여 줍니다 (기억: localStorage ONBOARD_KEY).
// 아이폰은 홈 화면 앱과 Safari 의 저장소가 따로라, 홈 화면 앱에서 다시 로그인하면 그 앱에서 한 번 더 뜹니다 (그때는 알림 켜기만).
// 안드로이드는 브라우저의 설치 창(index.html 의 __deferredInstall)을 띄우고, 아이폰은 그림 안내(iosGuideHtml)를 보여 줍니다.
const ONBOARD_KEY = "dshs-onboard";
const isAndroid = () => /Android/i.test(navigator.userAgent);
async function maybeOnboard() {
  if (!me || me.is_admin || !me.student_id || otherCohort() || !navigator.onLine) return;
  try { if (localStorage.getItem(ONBOARD_KEY)) return; } catch { return; }
  // 다른 창(자리 공개 동의 등)이 떠 있으면 닫힐 때까지 기다립니다 (최대 3분)
  if ($("studyModal").classList.contains("show")) {
    maybeOnboard.n = (maybeOnboard.n || 0) + 1;
    if (maybeOnboard.n < 120) setTimeout(maybeOnboard, 1500);
    return;
  }
  await refreshPush().catch(() => {});   // 켜져 있는지 확인 + 아이폰이 누르자마자 구독할 수 있게 등록 정보를 받아 둠
  const home = !isStandalone() && (isAppleMobile() || isAndroid()) && !/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
  const push = !pushOn && pushPossible() && "Notification" in window && Notification.permission !== "denied";
  const iosPushLater = isAppleMobile() && !isStandalone();   // 아이폰 · 아이패드는 홈 화면 앱에서만 알림
  if (!home && !push && !iosPushLater) return;
  if ($("studyModal").classList.contains("show")) return;
  try { localStorage.setItem(ONBOARD_KEY, String(Date.now())); } catch {}
  const steps = [];
  if (home) {
    const deferred = window.__deferredInstall;
    steps.push(`<b>홈 화면에 추가하기</b>
      <div class="ev-hint">앱처럼 바로 열리고, 알림도 받을 수 있어요</div>
      ${isAppleMobile() ? iosGuideHtml()
        : deferred ? '<button class="study-btn ok" id="onbInstall">앱 설치</button>'
        : `<div class="onb-text">브라우저 메뉴(<b>⋮</b> 또는 <b>≡</b>)에서 <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러요</div>`}`);
  }
  if (push) {
    steps.push(`<b>알림 켜기</b>
      <div class="ev-hint">수행평가 마감 1일 · 6시간 전, 일정 30분 전에 알려 줘요</div>
      <button class="study-btn ok" id="onbPush">${icon("notifications")} 알림 켜기</button>`);
  } else if (iosPushLater) {
    steps.push(`<b>알림 켜기</b>
      <div class="ev-hint">아이폰은 홈 화면에 추가한 앱에서만 알림을 켤 수 있어요</div>
      <div class="onb-text">홈 화면에 생긴 <b>dshs43</b> 아이콘으로 열고 <b>dshs.app 계정으로 시작하기</b>를 한 번 더 누르면, 여기서 알림을 켤 수 있어요</div>`);
  }
  openSheet("앱처럼 쓰기", `
    <div class="asg-body">로그인했어요! 두 가지만 해 두면 더 편하게 쓸 수 있어요.</div>
    ${steps.map((s, i) => `<div class="onb-step"><div class="ios-num">${i + 1}</div><div class="onb-body">${s}</div></div>`).join("")}
    <button class="study-submit ghost" id="onbLater">나중에 할게요</button>
    <div class="study-foot">설정(${icon("settings")})에서 언제든 알림을 켜고 끌 수 있어요.</div>`);
  $("onbLater").onclick = closeModal;
  if ($("onbInstall")) $("onbInstall").onclick = async () => {
    const d = window.__deferredInstall;
    if (!d) return toast("브라우저 메뉴에서 '홈 화면에 추가'를 눌러 주세요");
    try {
      d.prompt();
      const res = await d.userChoice;
      window.__deferredInstall = null;
      if (res?.outcome === "accepted" && $("onbInstall")) $("onbInstall").outerHTML = '<div class="onb-text">' + icon("check_circle", "ok") + ' 설치했어요</div>';
    } catch { window.__deferredInstall = null; }
  };
  if ($("onbPush")) $("onbPush").onclick = async () => {
    const b = $("onbPush");
    b.disabled = true;
    try { await enablePush(); } catch {}
    if (pushOn) {
      try { localStorage.setItem(PUSH_PREF, "on"); } catch {}
      pushCardSave({ done: true });
      $("pushCard")?.remove();
      if (b.isConnected) b.outerHTML = '<div class="onb-text">' + icon("notifications_active") + ' 알림이 켜졌어요</div>';
      paintPush();
    } else {
      b.disabled = false;
      if ("Notification" in window && Notification.permission === "denied") b.outerHTML = '<div class="onb-text">알림이 차단돼 있어요. 브라우저 설정에서 이 사이트 알림을 허용해 주세요</div>';
    }
  };
}

// ---------- 앱으로 설치 안내 ----------
// 휴대폰 · 태블릿 브라우저로 열었으면(홈 화면 앱이 아니면) 하루 한 번 팝업으로 설치(홈 화면에 추가)를 안내합니다.
// 기억: 기기마다 INSTALL_ASK_KEY(본 날짜). 로그인 직후 안내(maybeOnboard)를 오늘 이미 봤으면 띄우지 않습니다.
// 카카오톡 등 앱 안 브라우저에서는 설치가 안 되므로 띄우지 않습니다.
const INSTALL_ASK_KEY = "dshs-install-ask";
function maybeInstallAsk() {
  if (!me || me.is_admin || otherCohort() || isStandalone() || !(isAppleMobile() || isAndroid())) return;
  if (/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent)) return;
  const today = dayKey(new Date());
  try {
    if (localStorage.getItem(INSTALL_ASK_KEY) === today) return;
    const onb = +localStorage.getItem(ONBOARD_KEY);
    if (onb && dayKey(new Date(onb)) === today) return;
  } catch { return; }
  // 다른 창(업데이트 소식 · 자리 공개 동의 등)이 떠 있으면 닫힐 때까지 기다립니다 (최대 3분)
  if (["studyModal", "updModal"].some((id) => $(id)?.classList.contains("show")) || document.hidden) {
    maybeInstallAsk.n = (maybeInstallAsk.n || 0) + 1;
    if (maybeInstallAsk.n < 120) setTimeout(maybeInstallAsk, 1500);
    return;
  }
  try { localStorage.setItem(INSTALL_ASK_KEY, today); } catch {}
  const deferred = window.__deferredInstall;
  openSheet("앱으로 설치하기", `
    <div class="asg-body">아직 브라우저로 열고 있어요. 홈 화면에 추가하면 앱처럼 바로 열리고 알림도 받을 수 있어요.${isAppleMobile() ? " 아이폰은 홈 화면 앱에서만 알림을 받을 수 있어요." : ""}</div>
    ${isAppleMobile() ? iosGuideHtml()
      : deferred ? '<button class="study-submit" id="iaInstall">앱 설치</button>'
      : `<div class="onb-text">브라우저 메뉴(<b>⋮</b> 또는 <b>≡</b>)에서 <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러요</div>`}
    <button class="study-submit ghost" id="iaLater">나중에 할게요</button>`);
  $("iaLater").onclick = closeModal;
  if ($("iaInstall")) $("iaInstall").onclick = async () => {
    const d = window.__deferredInstall;
    if (!d) return toast("브라우저 메뉴에서 '홈 화면에 추가'를 눌러 주세요");
    try {
      d.prompt();
      const res = await d.userChoice;
      window.__deferredInstall = null;
      if (res?.outcome === "accepted") { closeModal(); toast("설치했어요. 홈 화면의 아이콘으로 열어 주세요"); }
    } catch { window.__deferredInstall = null; }
  };
}

// 아이폰 · 아이패드: 홈 화면에 추가하는 방법을 그림으로 (로그인 직후 안내 · 설정 창)
function iosGuideHtml() {
  const fig = (svg, cap, n) => `<figure class="ig-fig"><svg viewBox="0 0 240 92" role="img" aria-label="${esc(cap.replace(/<[^>]+>/g, ""))}">${svg}</svg><figcaption><span class="ios-num">${n}</span><span>${cap}</span></figcaption></figure>`;
  const share = (x, y, cls = "ig-ic") => `<g class="${cls}" transform="translate(${x} ${y})"><path d="M-6 -2 v10 h12 v-10"/><path d="M0 -10 v12 M-4 -6 l4 -4 l4 4"/></g>`;
  const plusBox = (x, y) => `<g class="ig-ic" transform="translate(${x} ${y})"><rect x="-7" y="-7" width="14" height="14" rx="3"/><path d="M0 -4 v8 M-4 0 h8"/></g>`;
  // 1. Safari 아래 막대의 공유 버튼
  const s1 = `<rect class="ig-bg" x="8" y="10" width="224" height="34" rx="17"/><text class="ig-dim" x="120" y="31" text-anchor="middle">dshs43.netlify.app</text>
    <rect class="ig-bg" x="8" y="52" width="224" height="34" rx="10"/>
    <g class="ig-ic"><path d="M36 62 l-6 7 l6 7"/><path d="M76 62 l6 7 l-6 7"/></g>
    ${share(120, 71, "ig-ic ig-hi")}<circle class="ig-ring" cx="120" cy="69" r="15"/>
    <g class="ig-ic"><path d="M158 63 q6 -2 8 1 q2 -3 8 -1 v12 q-6 -2 -8 1 q-2 -3 -8 -1 z"/><rect x="196" y="62" width="12" height="12" rx="2"/><rect x="200" y="58" width="12" height="12" rx="2"/></g>`;
  // 2. 공유 목록의 '홈 화면에 추가'
  const row = (y, t, icon, hi) => `<rect class="${hi ? "ig-hirow" : "ig-bg"}" x="20" y="${y}" width="200" height="24" rx="6"/><text class="${hi ? "ig-t" : "ig-dim"}" x="32" y="${y + 16}">${t}</text>${icon(204, y + 12)}`;
  const s2 = row(6, "복사", (x, y) => `<g class="ig-ic" transform="translate(${x} ${y})"><rect x="-6" y="-4" width="9" height="10" rx="2"/><rect x="-3" y="-7" width="9" height="10" rx="2"/></g>`)
    + row(34, "홈 화면에 추가", plusBox, true)
    + row(62, "즐겨찾기 추가", (x, y) => `<g class="ig-ic" transform="translate(${x} ${y})"><path d="M0 -7 l2 5 h5 l-4 3 l2 6 l-5 -4 l-5 4 l2 -6 l-4 -3 h5 z"/></g>`);
  // 3. 오른쪽 위 '추가'
  const s3 = `<rect class="ig-bg" x="8" y="6" width="224" height="80" rx="12"/>
    <text class="ig-dim" x="22" y="27">취소</text><text class="ig-t" x="120" y="27" text-anchor="middle">홈 화면에 추가</text>
    <text class="ig-hit" x="216" y="27" text-anchor="end">추가</text><rect class="ig-ring" x="186" y="12" width="38" height="22" rx="11"/>
    <rect class="ig-icon" x="22" y="44" width="30" height="30" rx="8"/><text class="ig-icon-t" x="37" y="64" text-anchor="middle">43</text>
    <text class="ig-t" x="62" y="56">dshs43</text><text class="ig-dim" x="62" y="71">https://dshs43.netlify.app</text>`;
  return `<div class="ig">
    ${fig(s1, "Safari 아래쪽의 <b>공유</b> 버튼을 눌러요. 안 보이면 주소창 옆 <b>⋯</b> 를 먼저 눌러요", 1)}
    ${fig(s2, "목록을 아래로 내려 <b>홈 화면에 추가</b>를 눌러요", 2)}
    ${fig(s3, "오른쪽 위 <b>추가</b>를 누르면 끝! 홈 화면의 아이콘으로 열어요", 3)}
    <div class="study-foot">크롬이면 주소창 오른쪽의 공유 버튼에서 같은 순서로 할 수 있어요.</div>
  </div>`;
}
function openIosGuide() { openSheet("홈 화면에 추가하기", iosGuideHtml()); }
// 설정 창: 아이폰 · 아이패드 브라우저에서만 '홈 화면에 추가하는 방법' (안드로이드는 위쪽 설치 막대가 있음)
const homeGuideHtml = () => (isAppleMobile() && !isStandalone()
  ? '<button class="study-btn wide" id="setHomeGuide" type="button">' + icon("install_mobile") + ' 홈 화면에 추가하는 방법</button>' : "");
function bindHomeGuide() { if ($("setHomeGuide")) $("setHomeGuide").onclick = openIosGuide; }
