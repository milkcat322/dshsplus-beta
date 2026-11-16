"use strict";
// dshs43.app — js/feedback.js: 피드백 · 피드백 답장
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 피드백 ----------
// 로그인한 사용자가 보내고 관리자가 읽습니다. 스크린샷은 비공개 버킷 feedback 에 저장합니다.
// 보내기는 업데이트 창의 '피드백' 탭에서, 받은 피드백은 관리자 사이트(admin/)의 관리 탭에서 봅니다.
const FEEDBACK_KINDS = { bug: "오류 제보", notice: "전체 분반 공지 오류", idea: "기능 제안", etc: "기타" };
const FEEDBACK_HINT = {
  bug: "어떤 화면에서 무엇을 했을 때 문제가 생겼는지 적어 주세요",
  notice: "어떤 과목의 전체 분반 공지가 잘못됐는지 적어 주세요",
  idea: "있으면 좋겠는 기능을 적어 주세요",
  etc: "하고 싶은 말을 적어 주세요",
};

// 사진은 긴 변 1600px JPEG 로 줄여서 올립니다 (용량 제한 5MB)
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file);
  const r = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/jpeg", 0.85));
}

// 업데이트 창의 '피드백' 탭 (index.html 이 부릅니다). 머리의 '업데이트 내역' 을 누르면 업데이트 창으로 돌아갑니다.
function openFeedback() {
  const head = window.updTabs ? window.updTabs("fb") : "피드백";
  const back = () => $("studyModal").querySelector('[data-utab="upd"]')?.addEventListener("click", () => { closeModal(); window.openUpdates?.(); });
  if (!me) {
    openSheet(head, `
      <div class="asg-body">로그인하면 피드백을 보낼 수 있어요.</div>
      <button class="study-submit" id="fbLogin">로그인</button>`);
    $("fbLogin").onclick = openAuth;
    return back();
  }
  const mine = '<div id="fbMine"></div>';
  openSheet(head, `${fbUnread ? mine : ""}
    <label class="study-label">유형</label>
    <select class="study-input" id="fbKind">${Object.entries(FEEDBACK_KINDS).map(([k, label]) =>
      `<option value="${k}">${label}</option>`).join("")}</select>
    <label class="study-label">내용</label>
    <textarea class="study-input" id="fbBody" rows="6" maxlength="2000" placeholder="${FEEDBACK_HINT.bug}"></textarea>
    <label class="study-label">스크린샷 (선택)</label>
    <input class="study-input" type="file" id="fbFile" accept="image/*">
    <div class="study-foot">보낸 내용은 관리자만 볼 수 있어요.</div>
    <div class="study-err" id="authErr"></div>
    <button class="study-submit" id="fbSend">보내기</button>${fbUnread ? "" : mine}`);
  back();
  loadMyFeedback();
  $("fbKind").onchange = () => { $("fbBody").placeholder = FEEDBACK_HINT[$("fbKind").value]; };
  $("fbSend").onclick = async () => {
    const body = $("fbBody").value.trim(), file = $("fbFile").files[0];
    if (!body) return showErr("내용을 입력해 주세요.");
    $("fbSend").disabled = true;
    const fail = (msg) => { $("fbSend").disabled = false; showErr(msg); };
    let image_path = null;
    if (file) {
      let blob;
      try { blob = await shrinkImage(file); }
      catch { return fail("이 사진은 읽지 못했어요. 다른 사진을 골라 주세요."); }
      image_path = `${me.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("feedback").upload(image_path, blob, { contentType: "image/jpeg" });
      if (error) return fail("사진을 올리지 못했어요. 사진을 빼고 보내 보세요.");
    }
    const { error } = await sb.from("feedback").insert({ kind: $("fbKind").value, body, image_path });
    if (error) return fail("보내지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    closeModal();
    toast("피드백을 보냈어요. 고마워요!");
  };
}
window.openFeedback = openFeedback;

// ---------- 피드백 답장 (feedbackreply.sql) ----------
// 관리자가 관리자 사이트에서 남긴 답장을 피드백 창의 '내가 보낸 피드백'에서 읽고, 그 아래에서 다시 답합니다.
// 안 읽은 답장이 있으면 업데이트 버튼과 '피드백' 탭에 점을 찍고, 창을 열면 읽음으로 바꿉니다.
let fbUnread = 0, fbCheckedAt = 0;
const fbFromAdmin = (r) => r.from_admin !== false;   // 관리자가 쓴 답장 (false 면 내가 다시 쓴 답글)
function paintFbDot() {
  $("updBtn")?.classList.toggle("has-reply", fbUnread > 0);
}
// 안 읽은 관리자 답장 수 (1분 안에 다시 묻지 않습니다. 표가 아직 없으면 0)
async function checkFbReplies() {
  if (!sb || !me || me.is_admin || Date.now() - fbCheckedAt < 60000) return;
  fbCheckedAt = Date.now();
  const { data, error } = await sb.from("feedback_replies").select("*").is("seen_at", null).order("created_at", { ascending: false }).limit(200);
  if (error) return;
  fbUnread = data.filter(fbFromAdmin).length;
  paintFbDot();
}
// 내가 보낸 피드백마다 관리자 답장과 내 답글을 대화처럼 보여 주고, 관리자 답장이 있으면 다시 답할 수 있습니다
async function loadMyFeedback() {
  if (!sb) await sbWait;
  const uid = me?.id;
  if (!uid) return;
  const [fb, re] = await Promise.all([
    sb.from("feedback").select("id, kind, body, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
    sb.from("feedback_replies").select("*").order("created_at"),
  ]);
  const box = $("fbMine");
  if (!box || fb.error || !fb.data.length) return;
  const replies = re.error ? [] : re.data;
  const at = (s) => { const t = new Date(s); return `${md(t)} ${hm(t)}`; };
  const isNew = (r) => fbFromAdmin(r) && !r.seen_at;
  // 답장이 오간 피드백을 먼저, 그다음 최근에 보낸 순
  const last = (f) => Math.max(0, ...replies.filter((r) => r.feedback_id === f.id).map((r) => Date.parse(r.created_at)));
  const rows = [...fb.data].sort((a, b) => last(b) - last(a));
  box.innerHTML = `<div class="fbm-title">내가 보낸 피드백</div>${rows.map((f) => {
    const thread = replies.filter((r) => r.feedback_id === f.id);
    return `<div class="fbm-item">
      <div class="fbm-head"><span class="adm-chip">${FEEDBACK_KINDS[f.kind] || "기타"}</span><span>${at(f.created_at)}</span></div>
      <div class="fbm-body">${esc(f.body)}</div>
      ${thread.map((r) => `<div class="fbm-reply${fbFromAdmin(r) ? "" : " me"}${isNew(r) ? " new" : ""}">
        <div class="fbm-head"><b>${fbFromAdmin(r) ? "관리자 답장" : "나"}</b>${isNew(r) ? '<span class="fb-new">새 답장</span>' : ""}<span>${at(r.created_at)}</span></div>
        <div class="fbm-body">${esc(r.body)}</div>
      </div>`).join("") || '<div class="fbm-wait">아직 답장이 없어요</div>'}
      ${thread.some(fbFromAdmin) ? `<div class="fbm-write">
        <textarea class="study-input" rows="1" maxlength="2000" placeholder="관리자에게 답장하기" data-fbre="${f.id}"></textarea>
        <button class="study-btn primary small" type="button" data-fbresend="${f.id}">보내기</button>
      </div>` : ""}
    </div>`;
  }).join("")}`;
  box.querySelectorAll("[data-fbresend]").forEach((b) => b.onclick = async () => {
    const ta = box.querySelector(`[data-fbre="${b.dataset.fbresend}"]`), text = ta.value.trim();
    if (!text) return ta.focus();
    b.disabled = true;
    const { error } = await sb.from("feedback_replies").insert({ feedback_id: b.dataset.fbresend, body: text, created_by: uid });
    if (error) { b.disabled = false; return toast("보내지 못했어요. 잠시 뒤 다시 시도해 주세요.", true); }
    toast("답장을 보냈어요");
    loadMyFeedback();
  });
  if (replies.some(isNew)) {
    const { error } = await sb.rpc("mark_feedback_replies_seen");
    if (!error) { fbUnread = 0; fbCheckedAt = Date.now(); paintFbDot(); }
  }
}
