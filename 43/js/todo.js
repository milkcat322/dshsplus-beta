"use strict";
// dshs43.app — js/todo.js: 할 일 탭 · 할 일 그룹
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 할 일 탭 ----------
// 기한 표시: 날짜만 있으므로 오늘 0시 기준으로 셉니다
function todoDue(key) {
  const t = new Date();
  const days = Math.round((parseDay(key) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
  const label = days < 0 ? "지남" : days === 0 ? "오늘" : days === 1 ? "내일" : `D-${days}`;
  const d = parseDay(key);
  const short = `${d.getMonth() + 1}/${d.getDate()} (${"일월화수목금토"[d.getDay()]})`;
  return { label, tone: days < 0 ? "over" : days < 3 ? "soon" : "ok", text: dayTitle(key), short };
}

// 오늘 할 일: '오늘'로 고른 날(today_on)이 오늘인 남은 할 일. 날이 바뀌면 원래 자리로 돌아갑니다.
const isTodayTodo = (t) => !t.done && !!t.today_on && t.today_on === dayKey(new Date());
// 끝낸 할 일은 2일 뒤 서버에서 지워집니다 (todotoday.sql). 그 전이라도 화면에는 2일 안에 끝낸 것만.
const TODO_KEEP_MS = 2 * 86400000;

function todoRow(t, grip = false) {
  const due = t.due_on ? todoDue(t.due_on) : null;
  const today = isTodayTodo(t);
  return `<div class="ev-row c-mint todo-row${t.done ? " done" : ""}" data-tid="${t.id}">
    ${grip ? `<span class="td-grip" data-tgrip="${t.id}" title="끌어서 그룹에 넣기" aria-hidden="true">⠿</span>` : ""}
    <button class="ev-check" data-tchk="${t.id}" aria-label="완료 표시">${t.done ? "✓" : ""}</button>
    <button class="ev-main" data-tedit="${t.id}">
      <span class="ev-title">${esc(t.title)}</span>
    </button>
    ${due ? `<button class="td-due ${t.done ? "" : due.tone}" data-tdue="${t.id}" title="${esc(due.text)}까지 · 눌러서 바꾸기">${due.short}${t.done ? "" : ` · ${due.label}`}</button>` : ""}
    ${t.done ? "" : `<button class="td-today${today ? " on" : ""}" data-ttoday="${t.id}" aria-pressed="${today}"
      title="${today ? "오늘 할 일에서 빼기" : "오늘 할 일로 정하기"}">${today ? "✓ 오늘" : "오늘"}</button>`}
    <button class="td-del" data-tdel="${t.id}" aria-label="삭제">✕</button>
  </div>`;
}

async function toggleTodayTodo(id) {
  const t = cache.todos.find((x) => x.id === id);
  if (!t) return;
  const prev = t.today_on || null;
  const today_on = isTodayTodo(t) ? null : dayKey(new Date());
  const { error } = await sb.from("todos").update({ today_on }).eq("id", id);
  if (error) return toast("저장하지 못했어요", true);
  t.today_on = today_on;
  rerender();
  saveSnap();
  if (today_on) toast("오늘 할 일에 넣었어요");
  else undoToast("오늘 할 일에서 뺐어요", async () => {
    const { error } = await sb.from("todos").update({ today_on: prev }).eq("id", id);
    if (error) return toast("되돌리지 못했어요", true);
    t.today_on = prev;
    rerender();
  });
}

function renderTodo() {
  destroyCal();
  closeDuePop();
  view = "todo";
  const body = $("studyBody");
  if (!cache.todos) {
    body.innerHTML = `<div class="study-empty">할 일을 불러오지 못했어요.</div>`;
    return;
  }
  // 기한 있는 것 먼저(가까운 순), 기한 없는 건 추가한 순
  const sorted = cache.todos.filter((t) => !t.done)
    .sort((a, b) => (!a.due_on - !b.due_on) || (a.due_on || "").localeCompare(b.due_on || "") || a.created_at.localeCompare(b.created_at));
  // 오늘 할 일은 맨 위 칸에 모아 보여 주고, 원래 자리(그룹 · 남은 할 일)에도 그대로 둡니다.
  // 완료하면 두 곳 모두에서 빠져 '완료'로 갑니다.
  const todayList = sorted.filter(isTodayTodo);
  const open = sorted;
  const keepFrom = Date.now() - TODO_KEEP_MS;
  const done = cache.todos.filter((t) => t.done && (!t.done_at || Date.parse(t.done_at) > keepFrom))
    .sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")).slice(0, 30);
  // 그룹: 그룹 없는 할 일이 먼저, 그 아래 그룹마다 접고 펼치는 칸. 끝낸 할 일은 맨 아래 '완료'에 모읍니다.
  const groups = cache.todoGroups;
  const gids = new Set((groups || []).map((g) => g.id));
  const gidOf = (t) => (t.group_id && gids.has(t.group_id) ? t.group_id : "");
  const grip = !!groups?.length;
  const folded = todoFolds();
  const loose = open.filter((t) => !gidOf(t));
  const groupHtml = (groups || []).map((g) => {
    const list = open.filter((t) => gidOf(t) === g.id);
    const shut = folded.has(g.id);
    return `<div class="td-group td-zone${shut ? " shut" : ""}" data-tzone="${g.id}">
      <div class="td-ghead">
        <button class="td-gfold" data-tfold="${g.id}" aria-expanded="${!shut}">
          <span class="td-gchev" aria-hidden="true">▾</span><span class="td-gname">${esc(g.name)}</span><span class="td-gcount">${list.length}</span>
        </button>
        <button class="td-gedit" data-tgedit="${g.id}" aria-label="그룹 수정">⋯</button>
      </div>
      <div class="td-gbody">
        ${list.length ? list.map((t) => todoRow(t, true)).join("") : `<div class="td-gempty">할 일을 끌어다 놓으면 이 그룹에 들어가요</div>`}
      </div>
    </div>`;
  }).join("");
  body.innerHTML = `
    <div class="todo-add">
      <input class="study-input" id="tdTitle" maxlength="200" placeholder="할 일을 적고 Enter">
      <button class="field-btn" id="tdAdd" type="button" aria-label="할 일 추가" title="할 일 추가">${icon("add")}</button>
    </div>
    ${todayList.length || open.length ? `<div class="td-todaybox">
      <div class="study-section td-head">오늘 할 일 ${todayList.length}개</div>
      ${todayList.length ? todayList.map((t) => todoRow(t)).join("")
        : `<div class="td-today-empty">할 일 옆 '오늘'을 누르면 여기에 모여요</div>`}
    </div>` : ""}
    <div class="study-section td-head">남은 할 일 ${open.length}개
      ${groups ? `<button class="study-btn small" id="tdGroupAdd">＋ 그룹</button>` : ""}</div>
    <div class="td-zone td-loose" data-tzone="">
      ${loose.length ? loose.map((t) => todoRow(t, grip)).join("")
        : `<div class="study-empty td-loose-empty">${open.length ? "그룹 밖으로 꺼내려면 여기에 놓으세요" : "남은 할 일이 없어요"}</div>`}
    </div>
    ${groupHtml}
    ${done.length ? `<div class="study-section td-head">완료 ${done.length}개<span class="td-done-note">끝낸 지 2일 뒤 사라져요</span></div>` + done.map((t) => todoRow(t)).join("") : ""}`;
  if (groups) $("tdGroupAdd").onclick = () => openGroupForm();
  body.querySelectorAll("[data-tfold]").forEach((b) => b.onclick = () => {
    const f = todoFolds();
    f.has(b.dataset.tfold) ? f.delete(b.dataset.tfold) : f.add(b.dataset.tfold);
    saveTodoFolds(f);
    const box = b.closest(".td-group");
    box.classList.toggle("shut");
    b.setAttribute("aria-expanded", !box.classList.contains("shut"));
  });
  body.querySelectorAll("[data-tgedit]").forEach((b) => b.onclick = () => openGroupForm(groups.find((g) => g.id === b.dataset.tgedit)));
  body.querySelectorAll("[data-tgrip]").forEach((h) => h.onpointerdown = (e) => startTodoDrag(e, h));
  const add = async () => {
    const title = $("tdTitle").value.trim();
    if (!title) return $("tdTitle").focus();
    $("tdAdd").disabled = true;
    const { data, error } = await sb.from("todos").insert({ title }).select().single();
    $("tdAdd").disabled = false;
    if (error) return toast("추가하지 못했어요", true);
    cache.todos.push(data);
    renderTodo();
    $("tdTitle").focus();
  };
  $("tdAdd").onclick = add;
  $("tdTitle").onkeydown = (e) => { if (e.key === "Enter" && !e.isComposing) add(); };
  body.querySelectorAll("[data-tchk]").forEach((b) => b.onclick = () => toggleTodo(b.dataset.tchk));
  body.querySelectorAll("[data-tedit]").forEach((b) => b.onclick = () => openTodoForm(cache.todos.find((t) => t.id === b.dataset.tedit)));
  body.querySelectorAll("[data-tdel]").forEach((b) => b.onclick = () => removeTodo(b.dataset.tdel));
  body.querySelectorAll("[data-ttoday]").forEach((b) => b.onclick = () => toggleTodayTodo(b.dataset.ttoday));
  body.querySelectorAll("[data-tdue]").forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    openDuePop(b, cache.todos.find((t) => t.id === b.dataset.tdue));
  });
}

// ---------- 할 일 그룹 ----------
// 접은 그룹은 기기마다 따로 기억합니다 (기본은 모두 펼침)
const TODO_FOLD_KEY = "dshs-todo-fold";
function todoFolds() {
  try { return new Set(JSON.parse(localStorage.getItem(TODO_FOLD_KEY) || "[]")); } catch { return new Set(); }
}
function saveTodoFolds(s) { try { localStorage.setItem(TODO_FOLD_KEY, JSON.stringify([...s])); } catch {} }

// 손잡이(⠿)를 끌어 그룹 칸(또는 그룹 밖 칸)에 놓으면 그 그룹으로 옮깁니다. 마우스 · 터치 모두 포인터 이벤트로.
function startTodoDrag(e, handle) {
  if (e.button !== 0) return;
  e.preventDefault();
  closeDuePop();
  const body = $("studyBody");
  const row = handle.closest(".todo-row");
  const id = handle.dataset.tgrip;
  const from = row.closest("[data-tzone]")?.dataset.tzone ?? "";
  const r = row.getBoundingClientRect();
  const ghost = row.cloneNode(true);
  ghost.classList.add("td-ghost");
  Object.assign(ghost.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
  document.body.appendChild(ghost);
  row.classList.add("td-dragging");
  body.classList.add("td-drag-on");
  const dy = e.clientY - r.top;
  let x = e.clientX, y = e.clientY, zone = null, raf = 0;
  const pick = () => {
    const z = document.elementFromPoint(x, y)?.closest("#studyBody [data-tzone]") || null;
    if (z !== zone) { zone?.classList.remove("over"); zone = z; zone?.classList.add("over"); }
  };
  const tick = () => {   // 화면 위 · 아래 끝에 가까우면 그쪽으로 스크롤
    const edge = 70;
    const v = y < edge ? -(edge - y) / 4 : y > innerHeight - edge ? (y - innerHeight + edge) / 4 : 0;
    if (v) { scrollBy(0, v); pick(); }
    raf = requestAnimationFrame(tick);
  };
  const move = (ev) => { x = ev.clientX; y = ev.clientY; ghost.style.top = `${y - dy}px`; pick(); };
  const end = (ev) => {
    cancelAnimationFrame(raf);
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
    ghost.remove();
    row.classList.remove("td-dragging");
    body.classList.remove("td-drag-on");
    zone?.classList.remove("over");
    if (ev.type === "pointerup" && zone && zone.dataset.tzone !== from) moveTodoToGroup(id, zone.dataset.tzone || null);
  };
  try { handle.setPointerCapture(e.pointerId); } catch {}
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  raf = requestAnimationFrame(tick);
  pick();
}

async function moveTodoToGroup(id, gid) {
  const t = cache.todos.find((x) => x.id === id);
  if (!t) return;
  const prev = t.group_id || null;
  t.group_id = gid;
  rerender();
  const { error } = await sb.from("todos").update({ group_id: gid }).eq("id", id);
  if (error) {
    t.group_id = prev;
    rerender();
    return toast("옮기지 못했어요", true);
  }
  saveSnap();
  const name = gid ? cache.todoGroups.find((g) => g.id === gid)?.name : "";
  undoToast(gid ? `'${name}' 그룹에 넣었어요` : "그룹에서 뺐어요", async () => {
    const { error } = await sb.from("todos").update({ group_id: prev }).eq("id", id);
    if (error) return toast("되돌리지 못했어요", true);
    t.group_id = prev;
    rerender();
  });
}

// 그룹 만들기 · 수정: 이름과, 지금 남은 할 일 중 넣을 것을 고릅니다
function openGroupForm(g) {
  const open = cache.todos.filter((t) => !t.done);
  const gname = new Map(cache.todoGroups.map((x) => [x.id, x.name]));
  openSheet(g ? "그룹 수정" : "그룹 만들기", `
    <label class="study-label">그룹 이름</label>
    <input class="study-input" id="tgName" maxlength="40" value="${g ? esc(g.name) : ""}" placeholder="예: 물리 실험, 동아리">
    ${open.length ? `<label class="study-label">넣을 할 일 (남은 할 일에서 골라요)</label>
    <div class="tg-picks">${open.map((t) => {
      const other = t.group_id && t.group_id !== g?.id ? gname.get(t.group_id) : "";
      return `<label class="tg-pick"><input type="checkbox" value="${t.id}"${g && t.group_id === g.id ? " checked" : ""}>
        <span class="tg-pick-title">${esc(t.title)}</span>${other ? `<span class="tg-pick-from">${esc(other)}</span>` : ""}</label>`;
    }).join("")}</div>` : ""}
    <div class="study-err" id="authErr"></div>
    <button class="study-submit" id="tgSave">${g ? "저장" : "만들기"}</button>
    ${g ? `<button class="study-submit ghost danger" id="tgDel">그룹 삭제 (할 일은 남아요)</button>` : ""}`);
  if (!g) $("tgName").focus();
  $("tgSave").onclick = async () => {
    const name = $("tgName").value.trim();
    if (!name) return showErr("그룹 이름을 적어 주세요.");
    const picked = [...document.querySelectorAll(".tg-pick input:checked")].map((c) => c.value);
    $("tgSave").disabled = true;
    let gid = g?.id;
    if (!g) {
      const position = Math.max(-1, ...cache.todoGroups.map((x) => x.position || 0)) + 1;
      const { data, error } = await sb.from("todo_groups").insert({ name, position }).select().single();
      if (error) { $("tgSave").disabled = false; return showErr("그룹을 만들지 못했어요."); }
      cache.todoGroups.push(data);
      gid = data.id;
    } else if (name !== g.name) {
      const { error } = await sb.from("todo_groups").update({ name }).eq("id", gid);
      if (error) { $("tgSave").disabled = false; return showErr("저장하지 못했어요."); }
      g.name = name;
    }
    const add = open.filter((t) => picked.includes(t.id) && t.group_id !== gid).map((t) => t.id);
    const out = g ? open.filter((t) => t.group_id === gid && !picked.includes(t.id)).map((t) => t.id) : [];
    const res = await Promise.all([
      add.length ? sb.from("todos").update({ group_id: gid }).in("id", add) : {},
      out.length ? sb.from("todos").update({ group_id: null }).in("id", out) : {},
    ]);
    if (!res[0].error) for (const t of open) if (add.includes(t.id)) t.group_id = gid;
    if (!res[1].error) for (const t of open) if (out.includes(t.id)) t.group_id = null;
    closeModal();
    rerender();
    saveSnap();
    if (res[0].error || res[1].error) toast("할 일 일부를 옮기지 못했어요", true);
    else toast(g ? "그룹을 저장했어요" : `'${name}' 그룹을 만들었어요`);
  };
  if (g) $("tgDel").onclick = async () => {
    if (!confirm(`'${g.name}' 그룹을 삭제할까요? 안에 있던 할 일은 그룹 밖으로 나와요.`)) return;
    const { error } = await sb.from("todo_groups").delete().eq("id", g.id);
    if (error) return showErr("삭제하지 못했어요.");
    cache.todoGroups = cache.todoGroups.filter((x) => x.id !== g.id);
    for (const t of cache.todos) if (t.group_id === g.id) t.group_id = null;
    const f = todoFolds(); if (f.delete(g.id)) saveTodoFolds(f);
    closeModal();
    rerender();
    saveSnap();
  };
}

// 기한 고르기: 버튼 아래에 뜨는 작은 메뉴 (오늘 · 내일 · 이번 주말 · 다음 주 · 날짜 고르기)
function closeDuePop() {
  document.querySelector(".due-pop")?.remove();
  document.removeEventListener("pointerdown", duePopOutside, true);
  document.removeEventListener("keydown", duePopKey);
}
function duePopOutside(e) { if (!e.target.closest(".due-pop")) closeDuePop(); }
function duePopKey(e) { if (e.key === "Escape") closeDuePop(); }

function openDuePop(btn, t) {
  const wasOpen = document.querySelector(".due-pop")?.dataset.id === t.id;
  closeDuePop();
  if (wasOpen) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const plus = (n) => dayKey(new Date(+today + n * 86400000));
  const wd = today.getDay();
  const picks = [
    ["오늘", plus(0)],
    ["내일", plus(1)],
    ["이번 주말", plus(wd === 6 ? 0 : 6 - wd)],
    ["다음 주 월요일", plus(((8 - wd) % 7) || 7)],
  ];
  const pop = document.createElement("div");
  pop.className = "due-pop";
  pop.dataset.id = t.id;
  pop.innerHTML = picks.map(([label, key]) => {
    const d = todoDue(key);
    return `<button class="due-pick${t.due_on === key ? " on" : ""}" data-key="${key}"><span>${label}</span><span class="due-pick-day">${d.short}</span></button>`;
  }).join("") + `
    <label class="due-pick due-cal"><span>날짜 고르기</span><input type="date" value="${t.due_on || ""}"></label>
    ${t.due_on ? `<button class="due-pick due-clear" data-key="">기한 없애기</button>` : ""}`;
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8);
  const top = r.bottom + 6 + h > innerHeight && r.top - 6 - h > 0 ? r.top - 6 - h : r.bottom + 6;
  pop.style.left = `${left + scrollX}px`;
  pop.style.top = `${top + scrollY}px`;

  const set = async (key) => {
    closeDuePop();
    const due_on = key || null;
    if (due_on === t.due_on) return;
    const { error } = await sb.from("todos").update({ due_on }).eq("id", t.id);
    if (error) return toast("저장하지 못했어요", true);
    t.due_on = due_on;
    renderTodo();
    toast(due_on ? `${todoDue(due_on).short}까지로 정했어요` : "기한을 없앴어요");
  };
  pop.querySelectorAll("[data-key]").forEach((b) => b.onclick = () => set(b.dataset.key));
  const cal = pop.querySelector("input[type=date]");
  cal.onchange = () => cal.value && set(cal.value);
  pop.querySelector(".due-cal").onclick = () => { try { cal.showPicker(); } catch {} };
  setTimeout(() => {
    document.addEventListener("pointerdown", duePopOutside, true);
    document.addEventListener("keydown", duePopKey);
  });
}

async function toggleTodo(id) {
  const t = cache.todos.find((x) => x.id === id);
  const patch = { done: !t.done, done_at: t.done ? null : new Date().toISOString() };
  const { error } = await sb.from("todos").update(patch).eq("id", id);
  if (error) return toast("저장하지 못했어요", true);
  Object.assign(t, patch);
  rerender();
}

async function removeTodo(id) {
  if (!confirm("이 할 일을 삭제할까요?")) return false;
  const { error } = await sb.from("todos").delete().eq("id", id);
  if (error) { toast("삭제하지 못했어요", true); return false; }
  cache.todos = cache.todos.filter((t) => t.id !== id);
  rerender();
  return true;
}

function openTodoForm(t) {
  openSheet("할 일 수정", `
    <label class="study-label">할 일</label>
    <input class="study-input" id="tfTitle" maxlength="200" value="${esc(t.title)}">
    <label class="study-label">기한 (없어도 돼요 · 정하면 달력에도 떠요)</label>
    <input class="study-input" type="date" id="tfDue" value="${t.due_on || ""}">
    ${cache.todoGroups?.length ? `<label class="study-label">그룹</label>
    <select class="study-input" id="tfGroup">
      <option value="">그룹 없음</option>
      ${cache.todoGroups.map((g) => `<option value="${g.id}"${t.group_id === g.id ? " selected" : ""}>${esc(g.name)}</option>`).join("")}
    </select>` : ""}
    <div class="study-err" id="authErr"></div>
    <button class="study-submit" id="tfSave">저장</button>
    <button class="study-submit ghost danger" id="tfDel">삭제</button>`);
  $("tfSave").onclick = async () => {
    const patch = { title: $("tfTitle").value.trim(), due_on: $("tfDue").value || null };
    if ($("tfGroup")) patch.group_id = $("tfGroup").value || null;
    if (!patch.title) return showErr("할 일을 입력해 주세요.");
    const { error } = await sb.from("todos").update(patch).eq("id", t.id);
    if (error) return showErr("저장하지 못했어요.");
    Object.assign(t, patch);
    closeModal();
    rerender();
  };
  $("tfDel").onclick = async () => { if (await removeTodo(t.id)) closeModal(); };
}
