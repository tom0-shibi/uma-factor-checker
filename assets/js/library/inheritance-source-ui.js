import { members, MEMBER_ORDER } from "../config.js";
import { listFactorEntries } from "./factor-library-storage.js";
import { listFactorSets } from "./factor-set-storage.js";
import { updateImageSummary } from "../ui/ui.js?v=20260921-duplicate-paste-01";
import { getCharacterVariant } from "../data/character-master.js";

const SET_SLOT_TO_MEMBER = { parentA:"parentA", grandparentA1:"grandA1", grandparentA2:"grandA2", parentB:"parentB", grandparentB1:"grandB1", grandparentB2:"grandB2" };
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function clearImages(member) {
  member.images.forEach(image => { if (image.url) URL.revokeObjectURL(image.url); });
  member.images = [];
  member.analysisResults = [];
}
const CONFLICT_PAIRS = [
  ["parentA","parentB"], ["parentA","grandA1"], ["parentA","grandA2"],
  ["parentB","grandB1"], ["parentB","grandB2"], ["grandA1","grandA2"], ["grandB1","grandB2"]
];
function memberCharacterId(member) {
  if (member?.source === "library") return member.libraryEntry?.characterId ?? null;
  const variant = member?.selectedVariantId ? getCharacterVariant(member.selectedVariantId) : null;
  return variant?.characterId ?? null;
}
function conflictMessage(memberId, entry) {
  const candidate = entry?.characterId ?? null;
  if (!candidate) return "";
  for (const [a,b] of CONFLICT_PAIRS) {
    if (memberId !== a && memberId !== b) continue;
    const otherId = memberId === a ? b : a;
    if (memberCharacterId(members[otherId]) === candidate) {
      return `${members[memberId].label}と${members[otherId].label}に同じウマ娘は設定できません`;
    }
  }
  return "";
}
function renderMemberSource(memberId) {
  const panel = document.querySelector(`.member-panel[data-member="${memberId}"]`);
  const action = panel?.querySelector(".inheritance-source-action");
  if (!action) return;
  const member = members[memberId];
  if (member.source === "library" && member.libraryEntry) {
    const entry = member.libraryEntry;
    action.classList.add("is-library-selected");
    const variant = entry.variantId ? getCharacterVariant(entry.variantId) : null;
    const characterName = entry.displayName || entry.nameSnapshot || variant?.displayName || variant?.characterName || entry.characterName || "名称未設定";
    const tags = (entry.tags || []).filter(Boolean);
    action.innerHTML = `<div class="inheritance-source-selection"><div class="inheritance-source-selection-main"><span class="inheritance-source-badge is-library">因子ライブラリ</span><span class="inheritance-source-factor-count">${entry.factors?.length ?? 0}因子</span><strong class="inheritance-source-character-name" title="${esc(characterName)}">${esc(characterName)}</strong></div>${tags.length ? `<div class="inheritance-source-tags" title="${esc(tags.join("・"))}">${tags.map(tag => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}${entry.memo ? `<div class="inheritance-source-memo" title="${esc(entry.memo)}">${esc(entry.memo)}</div>` : ""}<div class="inheritance-source-selection-actions"><button type="button" class="ghost-button inheritance-source-change">変更</button><button type="button" class="danger-button inheritance-source-delete">削除</button></div></div>`;
    action.querySelector(".inheritance-source-change")?.addEventListener("click", event => { event.stopPropagation(); chooseEntry(memberId).catch(console.error); });
    action.querySelector(".inheritance-source-delete")?.addEventListener("click", event => { event.stopPropagation(); clearMemberSource(memberId); });
    return;
  }
  action.classList.remove("is-library-selected");
  action.innerHTML = '<span>または</span><button type="button" class="ghost-button">因子ライブラリから選択</button>';
  action.querySelector("button")?.addEventListener("click", event => { event.stopPropagation(); chooseEntry(memberId).catch(console.error); });
}
function setLibraryEntry(memberId, entry) {
  const member = members[memberId];
  clearImages(member);
  member.source = "library";
  member.libraryEntry = entry;
  member.selectedVariantId = entry.variantId ?? null;
  const preview = document.getElementById(`preview-${memberId}`);
  if (preview) preview.innerHTML = "";
  renderMemberSource(memberId);
  updateImageSummary();
  document.dispatchEvent(new CustomEvent("inheritance-source-changed", { detail:{ memberId, source:"library" } }));
}
function clearMemberSource(memberId) {
  const member = members[memberId];
  clearImages(member); member.source="unset"; member.libraryEntry=null; member.selectedVariantId=null;
  const preview=document.getElementById(`preview-${memberId}`); if(preview) preview.innerHTML="";
  renderMemberSource(memberId);
  updateImageSummary();
  document.dispatchEvent(new CustomEvent("inheritance-source-changed", { detail:{ memberId, source:"unset" } }));
}
function createPicker(title, items, onPick) {
  const backdrop=document.createElement("div"); backdrop.className="inheritance-source-backdrop";
  backdrop.innerHTML=`<section class="inheritance-source-dialog" role="dialog" aria-modal="true"><header><div><h3>${esc(title)}</h3><p>保存済みデータから選択します。</p></div><button type="button" class="inheritance-source-close" aria-label="閉じる">×</button></header><div class="inheritance-source-list"></div></section>`;
  const list=backdrop.querySelector(".inheritance-source-list");
  if (!items.length) list.innerHTML='<p class="factor-set-empty">保存済みデータがありません。</p>';
  items.forEach(item=>{const b=document.createElement("button");b.type="button";b.className="inheritance-source-item";b.innerHTML=item.html;if(item.disabled){b.disabled=true;b.classList.add("is-disabled");b.title=item.disabled;}else{b.onclick=()=>{onPick(item.value);backdrop.remove();};}list.append(b);});
  backdrop.querySelector(".inheritance-source-close").onclick=()=>backdrop.remove(); backdrop.onpointerdown=e=>{if(e.target===backdrop)backdrop.remove();}; document.body.append(backdrop);
}
async function chooseEntry(memberId) {
  const entries=(await listFactorEntries()).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  createPicker(`${members[memberId].label}：因子ライブラリから選択`, entries.map(entry=>{const disabled=conflictMessage(memberId,entry);return {value:entry,disabled,html:`<strong>${esc(entry.displayName)}</strong><span>${entry.factors?.length??0}因子${entry.tags?.length?` / ${esc(entry.tags.join("・"))}`:""}</span>${entry.memo?`<small>${esc(entry.memo)}</small>`:""}${disabled?`<small class="inheritance-source-conflict">${esc(disabled)}</small>`:""}`};}), entry=>setLibraryEntry(memberId,entry));
}
async function chooseFactorSet() {
  const [sets,entries]=await Promise.all([listFactorSets(),listFactorEntries()]); const byId=new Map(entries.map(e=>[e.id,e]));
  createPicker("保存済み編成から読み込む", sets.sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt))).map(set=>({value:set,html:`<strong>${esc(set.name)}</strong><span>${Object.values(set.slots||{}).filter(Boolean).length}/6枠</span>`})), set=>{
    const configured=MEMBER_ORDER.some(id=>members[id].images.length||members[id].analysisResults.length||members[id].libraryEntry);
    if(configured&&!confirm(`現在の継承設定を「${set.name}」で置き換えますか？`))return;
    MEMBER_ORDER.forEach(id=>clearMemberSource(id));
    Object.entries(set.slots||{}).forEach(([slot,entryId])=>{const memberId=SET_SLOT_TO_MEMBER[slot];const entry=byId.get(entryId);if(memberId&&entry)setLibraryEntry(memberId,entry);});
    updateImageSummary();
  });
}
function initializeInheritanceSourceUi() {
  const grid=document.querySelector(".family-grid");
  if(grid){const toolbar=document.createElement("div");toolbar.className="inheritance-source-toolbar";toolbar.innerHTML='<div><strong>保存データを使う</strong><span>画像解析と組み合わせて利用できます。</span></div><button type="button" class="secondary-button">保存済み編成から読み込む</button>';toolbar.querySelector("button").onclick=()=>chooseFactorSet().catch(console.error);grid.before(toolbar);}
  MEMBER_ORDER.forEach(memberId=>{const panel=document.querySelector(`.member-panel[data-member="${memberId}"]`);if(!panel)return;const action=document.createElement("div");action.className="inheritance-source-action";panel.querySelector(".image-drop-zone")?.insertAdjacentElement("afterend",action);renderMemberSource(memberId);});
  document.addEventListener("inheritance-image-source-selected", event => { const memberId=event.detail?.memberId; if(memberId && members[memberId]) renderMemberSource(memberId); });
  updateImageSummary();
}
export { initializeInheritanceSourceUi, setLibraryEntry, clearMemberSource };
