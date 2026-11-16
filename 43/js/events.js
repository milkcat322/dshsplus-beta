"use strict";
// dshs43.app — js/events.js: 수행평가 상세 · 일정 추가/수정 · 댓글 · 즐겨찾기 그룹 · 달력의 시간표
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 수행평가 상세 / 개인 일정 추가·수정 ----------
function openSheet(title, inner) {
  const m = $("studyModal");
  m.className = "study-modal show";
  m.innerHTML = `<div class="study-sheet">
    <div class="study-sheet-head"><div class="sheet-title">${title}</div><button class="study-x">✕</button></div>
    ${inner}
  </div>`;
  m.querySelector(".study-x").onclick = closeModal;
  m.onclick = (e) => { if (e.target === m) closeModal(); };
}

function openAsgDetail(a) {
  const done = cache.done.has(a.id);
  const ownOnly = a.created_by === me.id && a.status !== "approved";
  openSheet("수행평가", `${card(a)}
    ${ownOnly ? `<div class="study-foot">${a.status === "pending"
      ? "아직 나만 보여요. 관리자가 승인하면 43기 친구들에게도 보여요."
      : "승인되지 않아 친구들에게는 보이지 않아요. 내 일정에는 그대로 남아 있어요."}</div>` : ""}
    <button class="study-submit${done ? " ghost" : ""}" id="aDone">${done ? "완료 취소" : "완료로 표시"}</button>
    ${canEditAsg(a) ? '<button class="study-submit ghost" id="aEdit">수정</button>' : ""}
    ${canDelAsg(a) ? '<button class="study-submit ghost danger" id="aDel">삭제</button>' : ""}
    <div class="cm-box">
      <div class="study-label">댓글 <small id="cmCount"></small></div>
      <div class="cm-list" id="cmList" data-aid="${a.id}"><div class="cm-empty">불러오는 중…</div></div>
      <div class="cm-new">
        <textarea class="study-input" id="cmText" rows="1" maxlength="500" placeholder="${a.status === "approved"
          ? "댓글 달기 (이 공지를 보는 친구들이 함께 봐요)" : "댓글 달기 (승인 전이라 관리자와 나만 봐요)"}"></textarea>
        <button class="study-btn small" id="cmSend">등록</button>
      </div>
    </div>`);
  $("aDone").onclick = async () => { closeModal(); await toggleDone("asg", a.id); };
  if ($("aEdit")) $("aEdit").onclick = () => { closeModal(); openStudy("notice"); openNewForm(a); };
  if ($("aDel")) $("aDel").onclick = async () => { if (await removeItem(a.id)) closeModal(); };
  $("cmSend").onclick = () => sendComment(a.id);
  $("cmText").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendComment(a.id); }
  };
  loadComments(a.id);
}

// ---------- 수행평가 댓글 (comments.sql: 공지를 볼 수 있는 사람만 읽고 씀) ----------
const cmOpen = (aid) => $("cmList")?.dataset.aid === aid;   // 받는 사이 창을 닫거나 다른 공지를 열었으면 그리지 않음

async function loadComments(aid) {
  if (!sb) await sbWait;
  const { data, error } = await sb.from("assignment_comments")
    .select("id, user_id, author_name, body, created_at")
    .eq("assignment_id", aid).order("created_at");
  if (!cmOpen(aid)) return;
  if (error) { $("cmList").innerHTML = `<div class="cm-empty">댓글을 불러오지 못했어요.</div>`; return; }
  $("cmCount").textContent = data.length || "";
  $("cmList").innerHTML = data.length
    ? data.map((c) => {
        const t = new Date(c.created_at);
        const mine = c.user_id === me?.id;
        return `<div class="cm-item">
          <div class="cm-head"><b>${esc(c.author_name || "알 수 없음")}${mine ? " (나)" : ""}</b><span>${md(t)} ${hm(t)}</span>
            ${mine ? `<button class="cm-del" data-cmdel="${c.id}">삭제</button>` : ""}</div>
          <div class="cm-body">${esc(c.body)}</div>
        </div>`;
      }).join("")
    : `<div class="cm-empty">아직 댓글이 없어요. 궁금한 점이나 알게 된 내용을 남겨 보세요.</div>`;
  $("cmList").querySelectorAll("[data-cmdel]").forEach((b) => b.onclick = async () => {
    if (!confirm("이 댓글을 지울까요?")) return;
    const { error } = await sb.from("assignment_comments").delete().eq("id", b.dataset.cmdel);
    if (error) return toast("지우지 못했어요", true);
    loadComments(aid);
  });
}

async function sendComment(aid) {
  const box = $("cmText"), btn = $("cmSend");
  const body = box.value.trim();
  if (!body || btn.disabled) return;
  if (!sb) await sbWait;
  btn.disabled = true;
  const { error } = await sb.from("assignment_comments").insert({ assignment_id: aid, body });
  if (!cmOpen(aid)) return;
  btn.disabled = false;
  if (error) return toast(isNetErr(error) ? "인터넷 연결을 확인해 주세요" : "댓글을 올리지 못했어요", true);
  box.value = "";
  loadComments(aid);
}

// 길이 버튼: 누르면 끝 = 시작 + 길이
const DURATIONS = [[30, "30분"], [60, "1시간"], [90, "1시간 30분"], [120, "2시간"], [180, "3시간"]];

// ev: 고칠 일정 (없으면 새 일정) · seed: 새 일정의 { start, end, allDay }
function openEventForm(ev, seed) {
  let start, end, allDay;
  if (ev) {
    start = new Date(ev.starts_at);
    allDay = ev.all_day;
    end = ev.ends_at ? new Date(ev.ends_at) : allDay ? start : new Date(+start + HOUR);
  } else if (seed) {
    ({ start, end, allDay } = seed);
  } else {
    start = new Date();
    start.setHours(Math.min(start.getHours() + 1, 23), 0, 0, 0);
    end = new Date(+start + HOUR);
    allDay = false;
  }
  // 시작을 바꾸면 끝이 이 길이만큼 따라옵니다 (처음엔 1시간)
  let dur = allDay || end <= start ? HOUR : end - start;
  const color = ev?.color || "violet";
  openSheet(ev ? "일정 수정" : "새 일정", `
    <label class="study-label">제목</label>
    <input class="study-input" id="eTitle" maxlength="120" value="${esc(ev?.title || "")}" placeholder="예: 동아리 회의, 학원, 생일">
    <label class="ev-allday"><input type="checkbox" id="eAll"${allDay ? " checked" : ""}> 하루 종일</label>
    <label class="study-label">시작</label>
    <div class="ev-when"><input class="study-input" type="date" id="eSd" value="${dayKey(start)}"><input class="study-input" type="time" id="eSt" step="300" value="${allDay ? "09:00" : hm(start)}"></div>
    <label class="study-label">끝</label>
    <div class="ev-when"><input class="study-input" type="date" id="eEd" value="${dayKey(end)}"><input class="study-input" type="time" id="eEt" step="300" value="${allDay ? "10:00" : hm(end)}"></div>
    <div class="ev-durs">${DURATIONS.map(([m, label]) =>
      `<button type="button" class="ev-dur" data-dur="${m}">${label}</button>`).join("")}</div>
    <label class="study-label">색</label>
    <div class="ev-colors">${COLORS.map((c) =>
      `<button type="button" class="ev-swatch c-${c}${c === color ? " on" : ""}" data-color="${c}" aria-label="${c}"></button>`).join("")}</div>
    <label class="study-label">메모 (선택)</label>
    <textarea class="study-input" id="eMemo" rows="3" maxlength="2000" placeholder="장소, 준비물 등">${esc(ev?.memo || "")}</textarea>
    <label class="study-label">함께하는 친구 (선택)</label>
    <div class="fr-chips" id="frChips"></div>
    <div class="aud-quick" id="frGroups"><span class="aud-label">그룹</span><span class="aud-hint">불러오는 중…</span></div>
    <input class="study-input" id="frQ" autocomplete="off" placeholder="이름·학번으로 찾기 (가입 전 친구는 학번 4자리)">
    <div class="fr-results" id="frRes"></div>
    <div class="study-foot fr-note">넣은 친구 달력에도 이 일정이 생겨요. 고치거나 지우면 친구 달력에도 반영돼요. 가입 전인 친구는 가입하면 바로 생겨요.</div>
    ${ev ? `<label class="ev-allday"><input type="checkbox" id="eDone"${ev.done || isPastEvent(ev) ? " checked" : ""}${isPastEvent(ev) ? " disabled" : ""}> 완료한 일정${
      isPastEvent(ev) ? ' <span class="ev-hint">(지난 일정이라 자동 완료 · 미래로 옮기면 풀려요)</span>' : ""}</label>` : ""}
    <div class="study-err" id="authErr"></div>
    <button class="study-submit" id="eSave">${ev ? "저장" : "추가"}</button>
    ${ev ? '<button class="study-submit ghost danger" id="eDel">일정 삭제</button>' : ""}`);
  const sheet = $("studyModal").querySelector(".study-sheet");
  const at = (d, t) => (d ? new Date(`${d}T${t || "00:00"}`) : null);
  const readStart = () => at($("eSd").value, $("eSt").value);
  const readEnd = () => at($("eEd").value, $("eEt").value);
  const writeEnd = (d) => { $("eEd").value = dayKey(d); $("eEt").value = hm(d); };
  const markDur = () => sheet.querySelectorAll("[data-dur]").forEach((b) =>
    b.classList.toggle("on", +b.dataset.dur * 60000 === dur));
  const syncAll = () => sheet.classList.toggle("allday", $("eAll").checked);

  const onStart = () => {
    const s = readStart();
    if (!s || isNaN(s)) return;
    if ($("eAll").checked) { if (!$("eEd").value || $("eEd").value < $("eSd").value) $("eEd").value = $("eSd").value; }
    else writeEnd(new Date(+s + dur));
  };
  const onEnd = () => {
    const s = readStart(), e = readEnd();
    if (s && e && e > s) dur = e - s;
    markDur();
  };
  $("eSd").onchange = onStart; $("eSt").onchange = onStart;
  $("eEd").onchange = onEnd; $("eEt").onchange = onEnd;
  sheet.querySelectorAll("[data-dur]").forEach((b) => b.onclick = () => {
    dur = +b.dataset.dur * 60000;
    const s = readStart();
    if (s) writeEnd(new Date(+s + dur));
    markDur();
  });
  $("eAll").onchange = () => {
    syncAll();
    if ($("eAll").checked) $("eEd").value = $("eSd").value;
    else onStart();
  };
  syncAll();
  markDur();

  // 함께하는 친구: 가입한 사람은 이름·학번으로 찾고(search_people),
  // 가입 전인 학생은 학번 4자리를 입력하면 넣을 수 있어요 (invites.sql: 가입하는 순간 그 학생 달력에 생김)
  const sidOf = (name) => roster().find((p) => p.name === name)?.sid;   // 그룹으로 저장할 때 쓰는 학번 (이름 → 학번. 43기는 명단이 없어 비어 있음)
  const before = ev ? [
    ...eventPeople(ev).filter((p) => !p.is_owner).map((p) => ({ id: p.user_id, name: p.name, sid: sidOf(p.name) })),
    ...eventInvites(ev).map((sid) => ({ sid, name: rosterName(sid), invite: true })),
  ] : [];
  let friends = [...before];
  const sameFriend = (a, b) => (a.invite ? b.invite && a.sid === b.sid : !b.invite && a.id === b.id);
  const drawChips = () => {
    $("frChips").innerHTML = friends.map((f, i) =>
      `<span class="fr-chip">${esc(f.name)}${f.invite && !f.fromGroup ? "<small>가입 전</small>" : ""}<button type="button" data-rm="${i}" aria-label="${esc(f.name)} 빼기">✕</button></span>`).join("");
    $("frChips").querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { friends.splice(+b.dataset.rm, 1); drawChips(); });
  };
  drawChips();
  // 그룹: 학번으로 넣습니다. 가입한 학생은 저장할 때 DB(invites.sql 트리거)가 바로 함께하는 친구로 바꿔요
  mountGroups("frGroups", () => friends.map((f) => f.sid), (sids) => {
    for (const sid of sids) {
      if (sid === me.student_id || friends.some((f) => f.sid === sid)) continue;
      friends.push({ sid, name: rosterName(sid), invite: true, fromGroup: true });
    }
    drawChips();
  }, false);   // 43기는 분반이 없어 '분반으로 고르기'는 뺍니다
  let qTimer, qSeq = 0;
  // 검색해서 결과 목록을 그립니다. 엔터를 누르면 기다리지 않고 바로 검색해 첫 번째 결과를 넣어요
  let shownQ = "";
  const search = async (q) => {
    const seq = ++qSeq;
    const { data, error } = await sb.rpc("search_people", { p_query: q });
    if (seq !== qSeq) return;   // 더 늦게 친 검색어의 결과만 보여줍니다
    // 같은 DB 를 42기와 함께 쓰므로 43기 학생만 보여 줍니다
    const found = (data || []).filter((p) => inCohort(p.student_id));
    const list = found.filter((p) => !friends.some((f) => !f.invite && f.id === p.id));
    // 가입한 사람 중에 없는 학생 → 가입 전 학생으로 넣기. 43기는 명단 자료가 없어 43기 학번 4자리로만 넣습니다
    const joined = new Set(found.map((p) => p.student_id));
    const fresh = (sid) => !joined.has(sid) && sid !== me.student_id && !friends.some((f) => f.sid === sid);
    const unjoined = roster().filter((p) => (/^\d{4}$/.test(q) ? p.sid === +q : !/^\d+$/.test(q) && p.name.includes(q)) && fresh(p.sid)).slice(0, 5);
    if (/^\d{4}$/.test(q) && inCohort(+q) && fresh(+q) && !unjoined.some((p) => p.sid === +q)) unjoined.push({ sid: +q, name: `학번 ${q}` });
    const rows = [
      ...list.map((p, i) => `<button type="button" class="fr-item" data-add="${i}"><b>${esc(p.name)}</b>${p.student_id ? `<span>${p.student_id}</span>` : ""}</button>`),
      ...unjoined.map((p) => `<button type="button" class="fr-item" data-invite="${p.sid}"><b>${esc(p.name)}</b><span>${p.sid} · 가입 전</span></button>`),
    ];
    $("frRes").innerHTML = error ? `<div class="fr-empty">찾지 못했어요.</div>`
      : rows.length ? rows.join("")
      : `<div class="fr-empty">찾지 못했어요. 가입한 친구는 이름으로, 가입 전 친구는 43기 학번 4자리로 넣을 수 있어요.</div>`;
    const added = () => { drawChips(); $("frQ").value = ""; $("frRes").innerHTML = ""; $("frQ").focus(); };
    $("frRes").querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
      const p = list[+b.dataset.add];
      friends.push({ id: p.id, name: p.name, sid: p.student_id });
      added();
    });
    $("frRes").querySelectorAll("[data-invite]").forEach((b) => b.onclick = () => {
      const s = +b.dataset.invite;
      friends.push({ sid: s, name: rosterName(s), invite: true });
      added();
    });
    shownQ = q;
  };
  $("frQ").oninput = () => {
    clearTimeout(qTimer);
    const q = $("frQ").value.trim();
    shownQ = "";
    if (!q) { $("frRes").innerHTML = ""; return; }
    qTimer = setTimeout(() => search(q), 250);
  };
  $("frQ").onkeydown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // 한글 입력 중 엔터는 글자를 마무리한 뒤에 처리합니다
    setTimeout(async () => {
      const q = $("frQ").value.trim();
      if (!q) return;
      clearTimeout(qTimer);
      if (shownQ !== q) await search(q);
      if ($("frQ").value.trim() === q) $("frRes").querySelector(".fr-item")?.click();
    }, 0);
  };

  let pick = color;
  sheet.querySelectorAll("[data-color]").forEach((b) => b.onclick = () => {
    pick = b.dataset.color;
    sheet.querySelectorAll("[data-color]").forEach((x) => x.classList.toggle("on", x === b));
  });
  $("eSave").onclick = async () => {
    const title = $("eTitle").value.trim();
    const sd = $("eSd").value, ed = $("eEd").value || sd;
    const all = $("eAll").checked;
    if (!title) return showErr("제목을 입력해 주세요.");
    if (!sd) return showErr("시작 날짜를 정해 주세요.");
    let starts, ends;
    if (all) {
      starts = at(sd);
      ends = ed > sd ? at(ed, "23:59") : null;
      if (ed < sd) return showErr("끝나는 날이 시작보다 빨라요.");
    } else {
      starts = readStart();
      ends = readEnd();
      if (!ends) return showErr("끝나는 시간을 정해 주세요.");
      if (ends <= starts) return showErr("끝나는 시간이 시작보다 빨라요.");
    }
    const row = {
      title, memo: $("eMemo").value.trim(), all_day: all, color: pick,
      starts_at: starts.toISOString(), ends_at: ends ? ends.toISOString() : null,
    };
    let reopened = false;
    if (ev) {
      // 지난 일정을 미래로 옮기면 완료를 취소합니다. 지난 일정(체크 잠김)은 원래 값을 유지
      reopened = isPastEvent(ev) && eventEnd(row) > new Date();
      row.done = reopened ? false : $("eDone").disabled ? ev.done : $("eDone").checked;
    }
    $("eSave").disabled = true;
    const { data: saved, error } = ev
      ? await sb.from("events").update(row).eq("id", ev.id).select("id").single()
      : await sb.from("events").insert(row).select("id").single();
    if (error) { $("eSave").disabled = false; return showErr("저장하지 못했어요: " + error.message); }
    // 친구 목록 맞추기: 새로 넣은 친구는 추가, 뺀 친구는 삭제
    const add = friends.filter((f) => !before.some((b) => sameFriend(b, f)));
    const drop = before.filter((b) => !friends.some((f) => sameFriend(b, f)));
    const addM = add.filter((f) => !f.invite), dropM = drop.filter((f) => !f.invite);
    const addI = add.filter((f) => f.invite), dropI = drop.filter((f) => f.invite);
    const results = await Promise.all([
      addM.length && sb.from("event_members").insert(addM.map((f) => ({ event_id: saved.id, user_id: f.id }))),
      dropM.length && sb.from("event_members").delete().eq("event_id", saved.id).in("user_id", dropM.map((f) => f.id)),
      addI.length && sb.from("event_invites").insert(addI.map((f) => ({ event_id: saved.id, student_id: f.sid }))),
      dropI.length && sb.from("event_invites").delete().eq("event_id", saved.id).in("student_id", dropI.map((f) => f.sid)),
    ]);
    closeModal();
    if (results.some((r) => r && r.error)) toast("일정은 저장했지만 친구 목록을 바꾸지 못했어요", true);
    else toast((add.length ? `일정을 ${friends.length}명과 공유했어요` : ev ? "일정을 고쳤어요" : "일정을 추가했어요") +
      (reopened ? " · 완료 취소" : ""));
    await loadAssignments();
    if (fc) fc.gotoDate(starts);
  };
  if (ev) $("eDel").onclick = async () => {
    // 지우기 전 모습을 기억해 두었다가 [실행 취소] 하면 같은 id 로 되살립니다 (함께하는 친구 포함)
    const snap = { id: ev.id, title: ev.title, memo: ev.memo, starts_at: ev.starts_at, ends_at: ev.ends_at,
      all_day: ev.all_day, color: ev.color, done: ev.done };
    const members = eventPeople(ev).filter((p) => !p.is_owner).map((p) => ({ event_id: ev.id, user_id: p.user_id, done: p.done }));
    const invited = eventInvites(ev).map((sid) => ({ event_id: ev.id, student_id: sid }));
    const { error } = await sb.from("events").delete().eq("id", ev.id);
    if (error) return showErr("삭제하지 못했어요.");
    closeModal();
    undoToast(members.length ? `일정을 삭제했어요 · 친구 ${members.length}명 달력에서도` : "일정을 삭제했어요", async () => {
      const { error } = await sb.from("events").insert(snap);
      if (error) return false;
      if (members.length) await sb.from("event_members").insert(members);
      if (invited.length) await sb.from("event_invites").insert(invited);
      await loadAssignments();
    });
    await loadAssignments();
  };
}

// ---------- 즐겨찾기 그룹 (groups.sql) ----------
// 일정의 '함께하는 친구'와 관리자 학교 일정 대상에서 함께 씁니다. 학생 그룹은 나만, 관리자 그룹은 관리자끼리 봐요.
// boxId: 그룹 줄을 그릴 칸 · getSids(): 지금 고른 학번들 · addSids(sids): 그룹을 눌렀을 때 학번들을 더하기
// withBan: "분반으로 고르기" 버튼도 둡니다 (과목 · 분반을 고르면 그 분반 학생 모두. 관리자 학교 일정은 따로 분반 줄이 있어 뺌)
function mountGroups(boxId, getSids, addSids, withBan = false) {
  let groups = [];
  const draw = () => {
    const box = $(boxId);
    if (!box) return;
    box.innerHTML = `<span class="aud-label">그룹</span>` +
      groups.map((g, i) => `<span class="aud-group"><button type="button" class="study-btn small" data-group="${i}">${esc(g.name)} <small>${g.student_ids.length}</small></button><button type="button" class="aud-group-x" data-gdel="${i}" aria-label="${esc(g.name)} 그룹 지우기">✕</button></span>`).join("") +
      (withBan ? `<button type="button" class="study-btn small" data-gban>분반으로 고르기</button>` : "") +
      `<button type="button" class="study-btn small" data-gsave>+ 고른 사람을 그룹으로</button>` +
      (withBan ? `<div class="aud-quick ban-pick" hidden>
        <select class="study-input" data-bsubj><option value="">과목 고르기</option>${banSubjects().map((x) => `<option>${esc(x)}</option>`).join("")}</select>
        <select class="study-input" data-bban disabled><option value="">분반</option></select>
        <button type="button" class="study-btn small" data-badd disabled>모두 넣기</button>
      </div>` : "");
    if (withBan) {
      const pick = box.querySelector(".ban-pick"), subj = pick.querySelector("[data-bsubj]"), ban = pick.querySelector("[data-bban]"), go = pick.querySelector("[data-badd]");
      box.querySelector("[data-gban]").onclick = () => { pick.hidden = !pick.hidden; };
      subj.onchange = () => {
        const bans = [...new Set(roster().map((p) => p.classes[subj.value]).filter(Boolean))].sort();
        ban.innerHTML = `<option value="*">전체 분반</option>` + bans.map((x) => `<option>${esc(x)}</option>`).join("");
        ban.disabled = go.disabled = !subj.value;
      };
      go.onclick = () => {
        const s = subj.value, b = ban.value;
        const sids = roster().filter((p) => p.classes[s] && (b === "*" || p.classes[s] === b)).map((p) => p.sid);
        addSids(sids);
        toast(`${s} ${b === "*" ? "전체" : b} ${sids.length}명을 넣었어요`);
      };
    }
    box.querySelectorAll("[data-group]").forEach((b) => b.onclick = () => addSids(groups[+b.dataset.group].student_ids));
    box.querySelectorAll("[data-gdel]").forEach((b) => b.onclick = async () => {
      const g = groups[+b.dataset.gdel];
      if (!confirm(`'${g.name}' 그룹을 지울까요? (이미 넣은 사람은 그대로예요)`)) return;
      const { error } = await sb.from("audience_groups").delete().eq("id", g.id);
      if (error) return toast("그룹을 지우지 못했어요", true);
      groups = groups.filter((x) => x !== g);
      draw();
    });
    box.querySelector("[data-gsave]").onclick = async () => {
      const sids = [...new Set(getSids())].filter(Boolean).sort((a, b) => a - b);
      if (!sids.length) return toast("먼저 그룹에 넣을 사람을 골라 주세요", true);
      const name = prompt(`지금 고른 ${sids.length}명을 어떤 이름의 그룹으로 저장할까요?`, "")?.trim();
      if (!name) return;
      const { data, error } = await sb.from("audience_groups").insert({ name: name.slice(0, 40), student_ids: sids }).select().single();
      if (error) return toast("그룹을 저장하지 못했어요", true);
      groups = [...groups, data].sort((a, b) => a.name.localeCompare(b.name, "ko"));
      draw();
      toast(`'${data.name}' 그룹을 저장했어요`);
    };
  };
  sb.from("audience_groups").select("*").order("name").then(({ data, error }) => {
    groups = error ? [] : data;   // 그룹을 못 불러와도 분반으로 고르기는 쓸 수 있게
    if (error && !withBan) { $(boxId)?.remove(); return; }
    draw();
  });
}
// 분반이 있는 과목 (명단의 수강 정보에서)
const banSubjects = () => [...new Set(roster().flatMap((p) => Object.keys(p.classes)))].sort((a, b) => a.localeCompare(b, "ko"));

// 친구가 공유한 일정: 보기 + 내 완료 체크 + 내 달력에서 빼기
function openSharedEvent(ev) {
  const it = agenda().find((x) => x.kind === "ev" && x.id === ev.id);
  const ppl = eventPeople(ev);
  const owner = ppl.find((p) => p.is_owner);
  const others = ppl.filter((p) => !p.is_owner).map((p) => p.user_id === me.id ? "나" : p.name);
  const done = eventDone(ev);
  openSheet("공유받은 일정", `
    <div class="asg-card c-${ev.color} shared-card">
      <div class="asg-top"><span class="asg-subject">${esc(owner?.name || "친구")}님이 공유</span></div>
      <div class="asg-title">${esc(ev.title)}</div>
      ${ev.memo ? `<div class="asg-body">${esc(ev.memo)}</div>` : ""}
      <div class="asg-due">${dayTitle(dayKey(it.at))} · ${esc(timeLabel(it))}</div>
      <div class="asg-due">함께: ${esc([owner?.name, ...others].filter(Boolean).join(", "))}</div>
    </div>
    <div class="study-foot">시간·내용은 만든 사람만 바꿀 수 있어요.</div>
    ${it.auto ? `<button class="study-submit ghost" disabled>지난 일정 · 자동 완료</button>`
      : `<button class="study-submit${done ? " ghost" : ""}" id="sDone">${done ? "완료 취소" : "완료로 표시"}</button>`}
    <button class="study-submit ghost danger" id="sLeave">내 달력에서 빼기</button>`);
  if ($("sDone")) $("sDone").onclick = async () => { closeModal(); await toggleDone("ev", ev.id); };
  $("sLeave").onclick = async () => {
    if (!confirm("이 일정을 내 달력에서 뺄까요? 다른 사람 달력에는 그대로 남아요.")) return;
    const { error } = await sb.from("event_members").delete().eq("event_id", ev.id).eq("user_id", me.id);
    if (error) return toast("빼지 못했어요", true);
    closeModal();
    toast("내 달력에서 뺐어요");
    await loadAssignments();
  };
}

// 수행평가 제출처 (고르지 않아도 됩니다. 그 밖의 곳은 폼의 "그 외" 에 직접 적습니다)
const SUBMIT_PLACES = ["클래스룸", "dshs앱", "패들렛", "메일"];

// a: 고칠 수행평가 (없으면 새로 추가). 고칠 때는 과목·분반은 바꿀 수 없고 제목·설명·마감·제출처만 고칩니다.
function openNewForm(a) {
  const body = $("studyBody");
  // 기본 마감: 일주일 뒤 그날 자정 (23:59 — 00:00 으로 두면 달력에서 다음 날로 넘어가 보입니다)
  const dueDay = new Date();
  dueDay.setDate(dueDay.getDate() + 7);
  const dueVal = a ? (a.due_at ? `${dayKey(new Date(a.due_at))}T${hm(new Date(a.due_at))}` : "") : `${dayKey(dueDay)}T23:59`;
  const noDue = !!a && !a.due_at;
  // 고칠 때 제출처: 목록에 있으면 그걸 고르고, 없으면 "그 외" 에 적어 둡니다
  const place = a?.submit_to ? (SUBMIT_PLACES.includes(a.submit_to) ? a.submit_to : "etc") : "";
  // 내 수강 과목만. 과목을 고른 뒤 대상(전체 · 우리 반)을 고릅니다
  const opts = a ? [{ subject: a.subject, ban: a.ban ?? null }] : asgClasses();
  view = "form";
  if (!opts.length) {
    body.innerHTML = `<div class="study-empty">수강 과목 정보를 찾지 못해 수행평가를 추가할 수 없어요.</div>
      <button class="study-btn wide" id="backFeed">← 목록으로</button>`;
    $("backFeed").onclick = renderNotice;
    return;
  }
  body.innerHTML = `
    <div class="study-section">${a ? "수행평가 수정" : "수행평가 추가"}</div>
    <div class="asg-card">
      <label class="study-label">과목</label>
      <select class="study-input" id="nClass"${a ? " disabled" : ""}>
        ${opts.map((o, i) => `<option value="${i}">${esc(subjName(o.subject))}${a && o.ban ? ` · ${esc(o.ban)}` : ""}</option>`).join("")}
      </select>
      ${a || !myBan() ? "" : `<label class="study-label">대상</label>
      <div class="seg" id="nScope">
        <button type="button" class="seg-btn on" data-scope="">전체 (43기 모두)</button>
        <button type="button" class="seg-btn" data-scope="${myBan()}반">우리 반만 (${myBan()}반)</button>
      </div>`}
      <label class="study-label">제목</label>
      <input class="study-input" id="nTitle" maxlength="120" placeholder="예: 3단원 실험 보고서 제출" value="${esc(a?.title ?? "")}">
      <label class="study-label">설명 (선택)</label>
      <textarea class="study-input" id="nBody" rows="3" maxlength="2000" placeholder="범위, 분량, 준비물 등">${esc(a?.body ?? "")}</textarea>
      <label class="study-label">마감 일시</label>
      <input class="study-input" id="nDue" type="datetime-local" value="${dueVal}"${noDue ? " disabled" : ""}>
      <label class="ev-allday"><input type="checkbox" id="nNoDue"${noDue ? " checked" : ""}> 마감 일시 없음 <span class="ev-hint">(아직 안 정해졌으면 · D-? 로 보여요)</span></label>
      <label class="study-label">제출 (선택)</label>
      <select class="study-input" id="nSubmit">
        <option value="">선택 안 함</option>
        ${SUBMIT_PLACES.map((p) => `<option value="${p}"${place === p ? " selected" : ""}>${p}</option>`).join("")}
        <option value="etc"${place === "etc" ? " selected" : ""}>그 외 (입력)</option>
      </select>
      <input class="study-input" id="nSubmitEtc" maxlength="30" placeholder="제출처를 적어 주세요" value="${place === "etc" ? esc(a.submit_to) : ""}" style="display:${place === "etc" ? "block" : "none"};margin-top:8px">
      <div class="study-err" id="nErr"></div>
      <button class="study-submit" id="nSave">${a ? "저장하기" : "추가하기"}</button>
      <div class="study-foot">${a
        ? editsOnlyForMe(a) ? "고친 내용은 내 계정에만 보여요. 친구들에게는 그대로예요."
        : "과목은 바꿀 수 없어요. 바꾸려면 지우고 다시 추가해 주세요."
        : "처음에는 나만 보이고, 관리자가 승인하면 43기 친구들에게도 보여요."}</div>
    </div>
    ${a?.personal ? '<button class="study-btn wide" id="nReset">' + icon("undo") + ' 원래 내용으로 되돌리기</button>' : ""}
    <button class="study-btn wide" id="backFeed">← 목록으로</button>`;
  $("backFeed").onclick = renderNotice;
  if ($("nReset")) $("nReset").onclick = async () => {
    const { error } = await clearPersonal(a.id);
    if (error) return toast("되돌리지 못했어요", true);
    toast("원래 내용으로 되돌렸어요");
    view = "notice";
    await loadAssignments();
  };
  $("nSubmit").onchange = () => {
    $("nSubmitEtc").style.display = $("nSubmit").value === "etc" ? "block" : "none";
  };
  // 대상: 전체(ban 비어 있음) 또는 우리 반('3반'). 반만 고르면 그 반 학생에게만 보여요 (cohort43ban.sql)
  let scope = "";
  document.querySelectorAll("#nScope [data-scope]").forEach((b) => b.onclick = () => {
    scope = b.dataset.scope;
    document.querySelectorAll("#nScope [data-scope]").forEach((x) => x.classList.toggle("on", x === b));
  });
  $("nNoDue").onchange = () => {
    $("nDue").disabled = $("nNoDue").checked;
    if (!$("nNoDue").checked && !$("nDue").value) $("nDue").value = `${dayKey(dueDay)}T23:59`;
  };
  $("nSave").onclick = async () => {
    const { subject } = opts[+$("nClass").value];
    const ban = scope || null;
    const title = $("nTitle").value.trim();
    const noDueNow = $("nNoDue").checked;
    const due = $("nDue").value;
    const placeNow = $("nSubmit").value;
    const submitTo = placeNow === "etc" ? $("nSubmitEtc").value.trim() : placeNow;
    const err = $("nErr");
    if (!title) { err.textContent = "제목을 입력해 주세요."; err.classList.add("show"); return; }
    if (!noDueNow && !due) { err.textContent = "마감 일시를 정하거나 \"마감 일시 없음\" 을 골라 주세요."; err.classList.add("show"); return; }
    if (placeNow === "etc" && !submitTo) { err.textContent = "제출처를 적어 주세요."; err.classList.add("show"); return; }
    $("nSave").disabled = true;
    const fields = { title, body: $("nBody").value.trim(), submit_to: submitTo || null, due_at: noDueNow ? null : new Date(due).toISOString() };
    let error;
    if (a && editsOnlyForMe(a)) {
      ({ error } = await savePersonal(a, fields));
    } else if (a) {
      // RLS 로 막히면 에러 없이 0행이 바뀌므로 바뀐 행을 돌려받아 확인합니다
      const res = await sb.from("assignments").update(fields).eq("id", a.id).select("id");
      error = res.error || (!res.data?.length && { message: "수정 권한이 없어요" });
    } else {
      ({ error } = await sb.from("assignments").insert({ subject, ban, ...fields, created_by: me.id, status: "pending" }));
    }
    $("nSave").disabled = false;
    if (error) {
      // notice.sql 을 아직 실행하지 않은 DB: 마감 없는 수행평가·승인된 수행평가 수정이 막힙니다
      const needSql = /due_at|null value/.test(error.message || "");
      err.textContent = `${a ? "저장하지" : "추가하지"} 못했어요: ${needSql ? "마감 일시 없이 추가하는 기능은 아직 준비 중이에요. 마감 일시를 정해 주세요." : error.message}`;
      err.classList.add("show");
      return;
    }
    toast(a ? editsOnlyForMe(a) ? "내 계정에서만 고쳤어요" : "고쳤어요" : "나만 보이게 추가했어요. 승인되면 43기 친구들에게도 보여요");
    view = "notice";
    await loadAssignments();
  };
}

const clearPersonal = (id) => sb.from("assignment_personal").delete().eq("user_id", me.id).eq("assignment_id", id);

// 원래 공지와 달라진 칸만 저장합니다. 달라진 게 없으면 저장해 둔 것을 지웁니다.
function savePersonal(a, f) {
  const b = a.shared || a;
  const minute = (t) => (t ? Math.floor(Date.parse(t) / 60000) : null);   // 입력칸에는 초가 없습니다
  const p = {
    title: f.title !== b.title ? f.title : null,
    due_at: f.due_at && minute(f.due_at) !== minute(b.due_at) ? f.due_at : null,
    no_due: !f.due_at && !!b.due_at,
    submit_to: f.submit_to && f.submit_to !== b.submit_to ? f.submit_to : null,
    no_submit: !f.submit_to && !!b.submit_to,
  };
  // 설명은 바꿨을 때만 보냅니다 (안 바꾼 칸이 공지 설명을 따라가도록 · 설명 칸 없는 예전 DB 에서도 다른 칸은 저장되게)
  const changed = (f.body || "") !== (b.body || ""), hadMine = (a.body || "") !== (b.body || "");
  if (changed || hadMine) Object.assign(p, { body: changed ? f.body || null : null, no_body: changed && !f.body });
  if (!Object.values(p).some(Boolean)) return clearPersonal(a.id);
  return sb.from("assignment_personal").upsert({
    ...p, user_id: me.id, assignment_id: a.id, updated_at: new Date().toISOString(),
  });
}

async function removeItem(id) {
  const a = findAsg(id);
  if (!confirm(a?.status === "approved"
    ? "이 수행평가를 삭제할까요? 친구들 모두에게서 사라져요."
    : "이 수행평가를 삭제할까요? 내 일정에서도 사라져요.")) return false;
  // RLS 로 막히면 에러 없이 0행이 지워지므로 지운 행을 돌려받아 확인합니다
  const { data, error } = await sb.from("assignments").delete().eq("id", id).select("id");
  if (error || !data?.length) { toast("삭제하지 못했어요", true); return false; }
  toast("삭제했어요");
  await loadAssignments();
  return true;
}

// ---------- 내 일정 달력의 시간표 ----------
// 42기 사이트(myBlocks · ttEvents)처럼 3일 · 주 보기에 내 반 시간표(TIMETABLE_43)를 흐린 배경으로 깝니다.
// 교시 시각은 이 한 곳에서만 관리합니다: 1교시 08:20 시작, 50분 수업 + 10분 쉬는 시간, 점심 12:10–13:10
const PERIOD_TIME = {
  1: ["08:20", "09:10"], 2: ["09:20", "10:10"], 3: ["10:20", "11:10"], 4: ["11:20", "12:10"],
  5: ["13:10", "14:00"], 6: ["14:10", "15:00"], 7: ["15:20", "16:10"], 8: ["16:20", "17:10"], 9: ["17:20", "18:10"],
  10: ["19:00", "19:50"], 11: ["20:00", "20:50"], 12: ["21:00", "21:50"],
};
const DOW = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };
let showTT = (() => { try { return localStorage.getItem("dshs-cal-tt") !== "off"; } catch { return true; } })();

// 내 반 시간표 → 요일별 수업 블록. 같은 과목이 이어지는 교시는 한 블록으로 합칩니다 (예: 3·4교시).
let ttMemo = null;
function myBlocks() {
  const ban = myBan();
  if (ttMemo?.ban === ban) return ttMemo.blocks;
  const tt = myTimetable(), blocks = {};
  for (const [day, dow] of Object.entries(DOW)) {
    blocks[dow] = [];
    for (let p = 1; p <= TT_PERIODS; p++) {
      const s = tt[`${day}-${p}`];
      if (!s) continue;
      const last = blocks[dow][blocks[dow].length - 1];
      if (last && last.subject === s && last.to === p - 1 && !ttNoBlock(s)) last.to = p;   // 블록수업이 아닌 과목(js/timetable.js 의 ttNoBlock)은 합치지 않음
      else blocks[dow].push({ subject: s, from: p, to: p });
    }
  }
  ttMemo = { ban, blocks };
  return blocks;
}

// 학교 일정 중 "수업 없음" 으로 표시된 날짜들 + 학사일정의 공휴일·휴업일(방학 포함)·지필평가
// 학사일정은 달력에서 꺼 두어도 그날 시간표는 깔지 않습니다.
function noClassDays() {
  const days = new Set();
  for (const e of liveSchool().filter((x) => x.no_class)) {
    const d = new Date(e.starts_at); d.setHours(0, 0, 0, 0);
    const last = new Date(e.ends_at || e.starts_at);
    for (; d <= last; d.setDate(d.getDate() + 1)) days.add(dayKey(d));
  }
  for (const e of myAcad().filter((x) => x.type === "공휴일" || x.type === "휴업일" || x.name.includes("지필평가"))) {
    for (const d = parseDay(e.start); dayKey(d) <= e.end; d.setDate(d.getDate() + 1)) days.add(dayKey(d));
  }
  return days;
}

// 귀가일 날짜들 (학사일정 + 관리자가 추가한 학교 일정)
function homeDays() {
  const days = new Set(myAcad().filter((e) => e.name.includes("귀가")).map((e) => e.start));
  for (const e of liveSchool()) if (e.title.includes("귀가")) days.add(dayKey(new Date(e.starts_at)));
  return days;
}

// 보이는 범위의 평일마다 수업을 흐린 배경 블록으로 깝니다. 월 보기에는 깔지 않습니다.
// R&E 는 목요일 수업이라, 귀가일이 목요일이면 그날은 깔지 않습니다.
function ttEvents(from, to) {
  if (!me?.student_id || !showTT || to - from > 8 * 86400000) return [];
  const blocks = myBlocks(), off = noClassDays(), homes = homeDays(), out = [];
  for (const d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d);
    if (off.has(key)) continue;
    (blocks[d.getDay()] || []).filter((b) => !(b.subject === "R&E" && homes.has(key))).forEach((b, i) => {
      out.push(ttBlock(`tt:${key}:${i}`, b, periodTime(key, b.from, 0), periodTime(key, b.to, 1)));
    });
  }
  return out;
}

function periodTime(key, period, end) {
  const [h, m] = PERIOD_TIME[period][end].split(":");
  const d = parseDay(key); d.setHours(+h, +m);
  return d;
}
const periodLabel = (b) => (b.from === b.to ? `${b.from}교시` : `${b.from}–${b.to}교시`);

function ttBlock(id, block, start, end) {
  return {
    id, title: subjName(block.subject), display: "background", classNames: ["fcx-tt"], start, end,
    extendedProps: { kind: "tt", label: periodLabel(block) },
  };
}
