"use strict";
// dshs43.app — js/push.js: 웹 푸시
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 웹 푸시 ----------
function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// 켜짐/꺼짐은 기기마다 따로입니다. 이 기기의 구독이 서버에 등록되어 있으면 켜진 것으로 봅니다.
let pushOn = false;

async function deviceSub() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  pushReg = reg || pushReg;
  return reg ? reg.pushManager.getSubscription() : null;
}
// 설정 창을 열 때 받아 둡니다. 아이폰 · 아이패드는 알림 켜기를 누른 그 순간에 바로 구독해야 해서, 누른 뒤에 기다릴 틈이 없습니다.
let pushReg = null;
// 아이패드(iPadOS 13 이상)의 사파리는 자신을 Mac 으로 알려서, 터치가 되는 Mac 은 아이패드로 봅니다
const isAppleMobile = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
// 예전에 다른 키로 만든 구독이면 서버가 보내도 도착하지 않으므로 새로 만듭니다
function sameKey(sub) {
  const k = sub.options?.applicationServerKey;
  if (!k) return true;   // 키를 알려 주지 않는 브라우저는 그대로 씁니다
  const want = urlB64ToUint8Array(CFG.VAPID_PUBLIC_KEY), got = new Uint8Array(k);
  return got.length === want.length && got.every((b, i) => b === want[i]);
}

// 설정의 알림 체크박스
const PUSH_HINT = "수행평가는 1일 · 6시간 전, 일정은 30분 전에 알려 줘요 (이 기기)";
// 설정의 알림 체크박스와, 알림이 꺼져 있으면 설정 아이콘의 빨간 점 · 설정 창 알림 줄 빨간 강조
function paintPush() {
  const b = $("setPush");
  const warn = !!me && paintPush.known && !pushOn && pushPossible();
  if (b) {
    b.checked = pushOn;
    b.closest(".set-row").classList.toggle("warn", warn);   // 설정 창의 알림 줄도 빨갛게
    $("pushHint").textContent = warn ? "알림이 꺼져 있어요. 눌러서 켜 주세요" : PUSH_HINT;
  }
  $("btnSettings").classList.toggle("warn", warn);
}
// 이 기기에서 알림을 켤 수 있는지 (못 켜는 기기에는 빨간 점을 띄우지 않습니다)
function pushPossible() {
  if (!CFG.VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  return !(isAppleMobile() && !isStandalone());
}

// 알림은 기본으로 켜 둡니다: 이 기기에서 끈 적이 없고 브라우저 알림을 이미 허락했으면, 로그인할 때 조용히 등록합니다.
// 아직 허락하지 않았으면 브라우저가 직접 물어야 해서 자동으로 켤 수 없고, 설정에서 알림을 눌러 켭니다.
const PUSH_PREF = "dshs-push";
const pushWanted = () => { try { return localStorage.getItem(PUSH_PREF) !== "off"; } catch { return true; } };
async function autoPush() {
  if (autoPush.done || !me) return;
  autoPush.done = true;
  if (pushWanted() && "Notification" in window && Notification.permission === "granted") {
    try { await enablePush(true); } catch {}
  }
  refreshPush();   // 켜졌는지 확인해서 설정 아이콘의 빨간 점을 맞춥니다
}

async function refreshPush() {
  const sub = await deviceSub().catch(() => null);
  if (!sub) { pushOn = false; paintPush.known = true; return paintPush(); }
  const { data, error } = await sb.from("push_subscriptions").select("endpoint").eq("endpoint", sub.endpoint).maybeSingle();
  if (error) return;
  pushOn = !!data;
  paintPush.known = true;
  paintPush();
}

async function togglePush() {
  const b = $("setPush");
  b.disabled = true;
  try {
    if (pushOn) {
      if (await disablePush()) {
        try { localStorage.setItem(PUSH_PREF, "off"); } catch {}
        toast("알림을 껐어요");
      } else toast("알림을 끄지 못했어요", true);
    } else {
      await enablePush();
      if (pushOn) try { localStorage.setItem(PUSH_PREF, "on"); } catch {}
    }
  } catch {
    toast("알림 설정을 바꾸지 못했어요", true);
  }
  if ($("setPush")) $("setPush").disabled = false;
  paintPush();
}

async function disablePush() {
  const sub = await deviceSub().catch(() => null);
  if (!sub) { pushOn = false; return true; }
  const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  if (error) return false;
  await sub.unsubscribe().catch(() => {});
  pushOn = false;
  return true;
}

// 로그아웃: 서버 등록만 지우고 기기의 구독은 남겨 둡니다.
// 구독까지 지우면 다시 로그인할 때 새로 구독해야 하는데, 폰(특히 아이폰)은 버튼을 누르지 않으면 구독을 막아서 알림이 꺼진 채로 남습니다.
async function forgetPush() {
  const sub = await deviceSub().catch(() => null);
  if (sub) await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  pushOn = false;
}

// quiet: 로그인할 때 자동으로 켜는 경우 (안내를 띄우지 않음)
async function enablePush(quiet = false) {
  const say = quiet ? () => {} : toast;
  if (!CFG.VAPID_PUBLIC_KEY) return say("알림 키가 아직 설정되지 않았어요", true);
  const apple = isAppleMobile();
  const pad = /iPad|Macintosh/.test(navigator.userAgent);
  if (apple && !isStandalone()) return say(`${pad ? "아이패드는" : "아이폰은"} 홈 화면에 추가한 앱에서 알림을 켤 수 있어요`, true);
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return say(apple ? "iOS 16.4 이상으로 업데이트하면 알림을 쓸 수 있어요" : "이 브라우저는 알림을 지원하지 않아요", true);
  }
  const subscribe = (reg) => reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(CFG.VAPID_PUBLIC_KEY),
  });

  let sub = null;
  if (!quiet && apple && Notification.permission === "default" && pushReg) {
    // 아이폰 · 아이패드: 누른 순간 바로 구독하면 허락 창이 함께 뜹니다 (먼저 다른 걸 기다리면 막힘)
    sub = await subscribe(pushReg).catch(() => null);
    if (!sub) return say(Notification.permission === "denied" ? "알림이 차단되어 있어요" : "알림을 켜지 못했어요. 한 번 더 눌러 주세요", true);
  } else {
    // 자동으로 켤 때는 이미 허락된 상태라 다시 묻지 않습니다 (폰은 버튼 없이 물으면 거절로 처리하기도 함)
    const perm = quiet ? Notification.permission : await Notification.requestPermission();
    if (perm !== "granted") return say("알림이 차단되어 있어요", true);
    const reg = pushReg || await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub)) { await sub.unsubscribe().catch(() => {}); sub = null; }
    if (!sub) sub = await subscribe(reg);
  }
  const j = sub.toJSON();
  // 같은 기기가 예전에 다른 계정으로 등록돼 있어도 지금 계정으로 넘겨받습니다 (schema.sql 의 save_push)
  let { error } = await sb.rpc("save_push", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  if (error?.code === "PGRST202") {   // 함수를 아직 만들지 않은 DB
    ({ error } = await sb.from("push_subscriptions").upsert({
      endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: me.id,
    }));
  }
  if (error) return say("알림 등록에 실패했어요", true);
  pushOn = true;
  paintPush();
  say("수행평가는 1일·6시간 전, 일정은 30분 전에 알려드릴게요");
}
