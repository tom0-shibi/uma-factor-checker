import { searchCharacterVariants, getCharacterVariant } from "../data/character-master.js";
import { listFactorEntries, deleteFactorEntry, putFactorEntry, listFactorImages, importFactorLibraryRecords, listFactorTags, putFactorTag, deleteFactorTag } from "./factor-library-storage.js";
import { FACTOR_MASTER } from "../data/factor-master.js";

const PAGE_SIZE = 10;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const normalize = value => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)).replace(/\s+/g, "");
const formatDateTime = value => { if(!value) return ""; const d=new Date(value); if(Number.isNaN(d.getTime())) return ""; const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const blobToDataUrl = blob => new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=()=>reject(r.error); r.readAsDataURL(blob); });
const dataUrlToBlob = data => { const [head,body]=String(data).split(",",2); const type=(head.match(/data:([^;]+)/)||[])[1]||"application/octet-stream"; const bytes=atob(body||""); const arr=new Uint8Array(bytes.length); for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i); return new Blob([arr],{type}); };

function characterSearch(onSelect, selectedVariantId = null) {
  const root = document.createElement("div");
  root.className = "factor-library-character-search";
  root.innerHTML = `<input type="search" placeholder="名前・衣装・通称で検索" autocomplete="off"><div class="factor-library-character-candidates" hidden></div>`;
  const input = root.querySelector("input");
  const list = root.querySelector(".factor-library-character-candidates");
  let selected = getCharacterVariant(selectedVariantId);
  if (selected) input.value = selected.displayName;
  const close = () => { list.hidden = true; };
  const render = () => {
    const items = searchCharacterVariants(input.value.trim(), 30);
    list.innerHTML = "";
    items.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<strong>${escapeHtml(item.displayName)}</strong>${item.aliases.length ? `<small>${escapeHtml(item.aliases.join(" / "))}</small>` : ""}`;
      button.onclick = () => { input.value = item.displayName; selected = item; close(); onSelect(item); };
      list.appendChild(button);
    });
    list.hidden = !items.length;
  };
  input.addEventListener("input", () => { if (!input.value.trim() && selected) { selected = null; close(); onSelect(null); return; } render(); });
  input.addEventListener("focus", render);
  input.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  root.addEventListener("focusout", () => setTimeout(() => { if (!root.contains(document.activeElement)) close(); }, 0));
  document.addEventListener("pointerdown", event => { if (!root.contains(event.target)) close(); });
  root.closeCandidates = close;
  root.resetSelection = () => { selected = null; input.value = ""; close(); };
  return root;
}

function createFactorLibraryDialog() {
  const backdrop = document.createElement("div");
  backdrop.className = "factor-library-modal-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = `<section class="factor-library-modal" role="dialog" aria-modal="true" aria-labelledby="factor-library-title" tabindex="-1">
    <header><div><h2 id="factor-library-title">因子ライブラリ</h2><p>保存した因子データを共通で管理します。</p></div><button type="button" class="factor-library-close" aria-label="閉じる">×</button></header>
    <div class="factor-library-modal-body">
      <section>
        <div class="factor-library-toolbar"><div><h3>保存済み</h3><span class="factor-library-count"></span></div><div class="factor-library-toolbar-actions"><button type="button" class="ghost-button factor-library-backup-toggle">バックアップ</button></div></div><div class="factor-library-backup-panel" hidden><div><strong>バックアップ</strong><span>ブラウザデータを削除しても復元できるファイルを保存します。</span></div><div class="factor-library-backup-actions"><button type="button" class="ghost-button backup-light">軽量バックアップ</button><button type="button" class="ghost-button backup-full">完全バックアップ（画像含む）</button><button type="button" class="ghost-button backup-restore">バックアップから復元</button><input type="file" class="backup-file" accept="application/json,.json" hidden></div></div>
        <div class="factor-library-searchbar"><input type="search" class="factor-library-quick-search" placeholder="ウマ娘名・タグ・メモで検索" aria-label="ウマ娘名・タグ・メモで検索"><button type="button" class="ghost-button factor-library-detail-toggle" aria-expanded="false">詳細条件 ▾</button></div><div class="factor-library-filters" hidden>
          <label><span>タグ</span><div class="factor-library-tag-picker-filter"><input type="search" class="factor-library-tag-search" placeholder="タグを検索・追加" autocomplete="off"><div class="factor-library-tag-candidates" hidden></div></div><div class="factor-library-tag-chips"></div></label>
          <label><span>因子</span><div class="factor-library-factor-filter-row"><div class="factor-library-factor-search"><input class="factor-library-factor-filter-input" type="search" placeholder="因子マスタから検索" autocomplete="off"><div class="factor-library-factor-candidates" hidden></div></div></div><div class="factor-library-factor-chips"></div><select class="factor-library-factor-mode"><option value="any">選択した因子を1つでも含む</option><option value="all">選択した因子をすべて含む</option></select></label>
          <label><span>ウマ娘</span><div class="factor-library-uma-filter"></div></label>
          <div class="factor-library-filter-actions"><button type="button" class="ghost-button factor-library-filter-reset">絞り込みを解除</button></div>
        </div>
        <div class="factor-library-list"></div><nav class="factor-library-pagination" aria-label="因子ライブラリのページ"></nav>
      </section>
    </div>
    <div class="factor-library-toast" role="status" aria-live="polite" hidden></div>
    <div class="factor-library-detail-backdrop" hidden><section class="factor-library-detail-dialog" role="dialog" aria-modal="true"><header><div><h3 class="factor-library-detail-title"></h3><p class="factor-library-detail-meta"></p></div><button type="button" class="factor-library-detail-close" aria-label="詳細を閉じる">×</button></header><div class="factor-library-detail-content"></div></section></div>
    <div class="factor-library-restore-backdrop" hidden><section class="factor-library-restore-dialog" role="dialog" aria-modal="true"><h3>バックアップから復元</h3><p class="restore-summary"></p><p class="restore-kind"></p><div class="factor-library-restore-help"><strong>復元方法</strong><p><b>現在のデータに追加</b>：今ある保存データを残したまま、バックアップのデータを追加します。同じIDのデータはバックアップ側の内容で更新されます。</p><p><b>現在のデータを置き換える</b>：今ある因子ライブラリを削除し、バックアップ時点の内容に戻します。</p><p class="restore-image-note"></p></div><div class="factor-library-restore-actions"><button type="button" class="ghost-button restore-cancel">キャンセル</button><button type="button" class="ghost-button restore-merge">現在のデータに追加</button><button type="button" class="primary-button restore-replace">現在のデータを置き換える</button></div></section></div>
  </section>`;
  document.body.appendChild(backdrop);
  const modal = backdrop.querySelector(".factor-library-modal");
  const list = backdrop.querySelector(".factor-library-list");
  const count = backdrop.querySelector(".factor-library-count");
  const pagination = backdrop.querySelector(".factor-library-pagination");
  const toast = backdrop.querySelector(".factor-library-toast");
  const filters = backdrop.querySelector(".factor-library-filters");
  const quickSearch = backdrop.querySelector(".factor-library-quick-search");
  const tagInput = backdrop.querySelector(".factor-library-tag-search");
  const tagCandidates = backdrop.querySelector(".factor-library-tag-candidates");
  const tagChips = backdrop.querySelector(".factor-library-tag-chips");
  const factorInput = backdrop.querySelector(".factor-library-factor-filter-input");
  const factorChips = backdrop.querySelector(".factor-library-factor-chips");
  const factorMode = backdrop.querySelector(".factor-library-factor-mode");
  const factorCandidates = backdrop.querySelector(".factor-library-factor-candidates");

  const detailBackdrop = backdrop.querySelector(".factor-library-detail-backdrop");
  const restoreBackdrop = backdrop.querySelector(".factor-library-restore-backdrop");
  let entries = [], persistentTags = [], page = 1, highlightId = null, toastTimer = null, selectedUma = null, factorFilters = [], selectedTags = [], pickerMode = null;
  const allTags = () => [...new Set([...persistentTags, ...entries.flatMap(e => e.tags || [])])].sort((a,b) => a.localeCompare(b,"ja"));
  const factorById = new Map(FACTOR_MASTER.map(f => [f.factorId, f]));

  const showToast = message => { clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false; toastTimer = setTimeout(() => { toast.hidden = true; }, 2200); };
  const closeDetail = () => { detailBackdrop.hidden = true; };
  const close = () => { closeDetail(); backdrop.hidden = true; pickerMode = null; resetFilters(); document.body.classList.remove("factor-library-modal-open"); };
  backdrop.querySelector(".factor-library-close").onclick = close;
  backdrop.addEventListener("pointerdown", event => { if (event.target === backdrop) close(); });
  detailBackdrop.addEventListener("pointerdown", event => { if (event.target === detailBackdrop) closeDetail(); });
  backdrop.querySelector(".factor-library-detail-close").onclick = closeDetail;
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !detailBackdrop.hidden) closeDetail(); else if (event.key === "Escape" && !backdrop.hidden) close(); });

  const umaSearch = characterSearch(variant => { selectedUma = variant; page = 1; renderSaved(); });
  backdrop.querySelector(".factor-library-uma-filter").append(umaSearch);
  backdrop.querySelector(".factor-library-detail-toggle").onclick = event => { filters.hidden = !filters.hidden; event.currentTarget.setAttribute("aria-expanded", String(!filters.hidden)); event.currentTarget.textContent = filters.hidden ? "詳細条件 ▾" : "詳細条件 ▴"; };
  quickSearch.addEventListener("input", () => { page = 1; renderSaved(); });
  function resetFilters() {
    selectedTags = []; factorFilters = []; selectedUma = null;
    quickSearch.value = ""; tagInput.value = ""; factorInput.value = "";
    umaSearch.resetSelection(); tagCandidates.hidden = true; factorCandidates.hidden = true;
    factorMode.value = "any"; filters.hidden = true;
    const toggle = backdrop.querySelector(".factor-library-detail-toggle");
    toggle.setAttribute("aria-expanded", "false"); toggle.textContent = "詳細条件 ▾";
    renderTagChips(); renderFactorChips(); page = 1;
  }
  backdrop.querySelector(".factor-library-filter-reset").onclick = () => { resetFilters(); renderSaved(); };
  function renderTagChips() {
    tagChips.innerHTML = "";
    selectedTags.forEach(tag => { const chip = document.createElement("button"); chip.type="button"; chip.className="factor-library-chip"; chip.textContent=`${tag} ×`; chip.setAttribute("aria-label", `${tag}の絞り込みを解除`); chip.onclick=()=>{selectedTags=selectedTags.filter(x=>x!==tag);renderTagChips();page=1;renderSaved();};tagChips.append(chip); });
  }
  function renderTagCandidates() {
    const q=normalize(tagInput.value); const tags=allTags().filter(t=>!selectedTags.includes(t)&&(!q||normalize(t).includes(q)));
    tagCandidates.innerHTML=""; tags.forEach(tag=>{const button=document.createElement("button");button.type="button";button.textContent=tag;button.onclick=()=>{selectedTags.push(tag);tagInput.value="";tagCandidates.hidden=true;renderTagChips();page=1;renderSaved();};tagCandidates.append(button);});tagCandidates.hidden=!tags.length;
  }
  tagInput.addEventListener("focus",renderTagCandidates);tagInput.addEventListener("input",renderTagCandidates);
  tagInput.addEventListener("keydown",event=>{if(event.key==="Escape")tagCandidates.hidden=true;});
  tagInput.addEventListener("focusout",()=>setTimeout(()=>{if(!tagInput.parentElement.contains(document.activeElement))tagCandidates.hidden=true;},0));
  factorMode.addEventListener("change", () => { page = 1; renderSaved(); });
  const backupPanel=backdrop.querySelector(".factor-library-backup-panel"), backupFile=backdrop.querySelector(".backup-file");
  backdrop.querySelector(".factor-library-backup-toggle").onclick=()=>{backupPanel.hidden=!backupPanel.hidden;};
  const downloadJson=(data,name)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);};
  const makeBackup=async full=>{const backupEntries=await listFactorEntries();const tags=await listFactorTags();const images=full?await listFactorImages():[];const imageData=[];for(const image of images){imageData.push({...image,blob:undefined,dataUrl:await blobToDataUrl(image.blob)});}const now=new Date();const stamp=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;downloadJson({format:"uma-factor-library-backup",backupVersion:1,kind:full?"full":"light",createdAt:now.toISOString(),entries:backupEntries,tags,images:imageData},`UmaTool_因子ライブラリ_${full?"完全":"軽量"}_${stamp}.json`);showToast("バックアップを保存しました。");};
  backdrop.querySelector(".backup-light").onclick=()=>makeBackup(false); backdrop.querySelector(".backup-full").onclick=()=>makeBackup(true); backdrop.querySelector(".backup-restore").onclick=()=>backupFile.click();
  let pendingRestore=null;
  const closeRestore=()=>{restoreBackdrop.hidden=true;pendingRestore=null;};
  restoreBackdrop.querySelector(".restore-cancel").onclick=closeRestore;
  restoreBackdrop.addEventListener("pointerdown",e=>{if(e.target===restoreBackdrop)closeRestore();});
  const runRestore=async replace=>{if(!pendingRestore)return;const data=pendingRestore;const images=(data.images||[]).map(i=>({...i,blob:dataUrlToBlob(i.dataUrl)}));await importFactorLibraryRecords(data.entries,images,{replace,tags:data.tags||[]});closeRestore();showToast(`${data.entries.length}件を復元しました。`);page=1;await renderSaved();};
  restoreBackdrop.querySelector(".restore-merge").onclick=()=>runRestore(false);
  restoreBackdrop.querySelector(".restore-replace").onclick=()=>runRestore(true);
  backupFile.onchange=async()=>{const file=backupFile.files?.[0];backupFile.value="";if(!file)return;try{const data=JSON.parse(await file.text());if(data?.format!=="uma-factor-library-backup"||!Array.isArray(data.entries))throw new Error("対応していないバックアップです");pendingRestore=data;const when=formatDateTime(data.createdAt)||"日時不明";const full=data.kind==="full";restoreBackdrop.querySelector(".restore-summary").textContent=`${when} / ${data.entries.length}件`;restoreBackdrop.querySelector(".restore-kind").textContent=full?`完全バックアップ：因子データと元画像 ${(data.images||[]).length}件を復元します。`:`軽量バックアップ：因子データ・タグ・メモを復元します（元画像は含みません）。`;restoreBackdrop.querySelector(".restore-image-note").textContent=full?"このバックアップに保存画像が含まれている場合、復元後に各Entryの［詳細］から確認できます。":"軽量バックアップには元画像が入っていないため、復元しても保存画像は追加されません。";restoreBackdrop.hidden=false;restoreBackdrop.querySelector(".factor-library-restore-dialog").scrollTop=0;}catch(e){showToast(`バックアップを復元できません: ${e.message}`);}};

  function renderFactorChips() {
    factorChips.innerHTML = "";
    factorFilters.forEach(factorId => { const factor = factorById.get(factorId); if (!factor) return; const chip = document.createElement("button"); chip.type = "button"; chip.className = "factor-library-chip"; chip.innerHTML = `${escapeHtml(factor.name)} <span aria-hidden="true">×</span>`; chip.onclick = () => { factorFilters = factorFilters.filter(x => x !== factorId); renderFactorChips(); page = 1; renderSaved(); }; factorChips.append(chip); });
  }
  function closeFactorCandidates(){ factorCandidates.hidden = true; }
  function renderFactorCandidates(){
    const q = normalize(factorInput.value);
    const searchableTypes = new Set(["gene","awakening","skill","scenario"]);
    const items = FACTOR_MASTER.filter(f => f.color === "white" && searchableTypes.has(f.type) && !factorFilters.includes(f.factorId) && (!q || normalize(f.name).includes(q))).slice(0, 40);
    factorCandidates.innerHTML = "";
    items.forEach(f => { const b=document.createElement("button"); b.type="button"; b.textContent=f.name; b.onclick=()=>{ factorFilters.push(f.factorId); factorInput.value=""; closeFactorCandidates(); renderFactorChips(); page=1; renderSaved(); }; factorCandidates.append(b); });
    factorCandidates.hidden = !items.length;
  }
  factorInput.addEventListener("focus", renderFactorCandidates);
  factorInput.addEventListener("input", renderFactorCandidates);
  factorInput.addEventListener("keydown", event => { if(event.key === "Escape") closeFactorCandidates(); });
  factorInput.addEventListener("focusout", () => setTimeout(() => { if (!factorInput.parentElement.contains(document.activeElement)) closeFactorCandidates(); }, 0));

  function renderPagination(total) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE)); page = Math.min(page, pages); pagination.innerHTML = ""; if (pages <= 1) return;
    const prev = document.createElement("button"); prev.type = "button"; prev.className = "ghost-button"; prev.textContent = "前へ"; prev.disabled = page === 1; prev.onclick = () => { page--; renderSaved(); };
    const label = document.createElement("span"); label.textContent = `${page} / ${pages}`;
    const next = document.createElement("button"); next.type = "button"; next.className = "ghost-button"; next.textContent = "次へ"; next.disabled = page === pages; next.onclick = () => { page++; renderSaved(); };
    pagination.append(prev, label, next);
  }

  function factorGroup(f){
    if(f.color === "blue") return ["blue","青因子"]; if(f.color === "red") return ["red","赤因子"]; if(f.color === "green") return ["green","緑因子"];
    const labels={gene:"遺伝子",awakening:"目覚め",skill:"スキル",scenario:"シナリオ",race:"レース",hidden:"隠し",other:"その他"}; return [`white-${f.type || "other"}`, labels[f.type] || "その他"];
  }
  async function openDetails(entry, title = entry.displayName) {
    backdrop.querySelector(".factor-library-detail-title").textContent = title;
    const date = entry.createdAt ? formatDateTime(entry.createdAt) : "";
    backdrop.querySelector(".factor-library-detail-meta").textContent = `${entry.factors.length}因子${date ? ` / 保存 ${date}` : ""}${entry.memo ? ` / ${entry.memo}` : ""}`;
    const groups = new Map();
    (entry.factors || []).forEach(saved => { const master=factorById.get(saved.factorId) || {factorId:saved.factorId,name:saved.nameSnapshot||saved.factorId,color:saved.color||"white",type:saved.type||"other"}; const [key,label]=factorGroup(master); if(!groups.has(key)) groups.set(key,{key,label,items:[]}); groups.get(key).items.push({name:saved.nameSnapshot||master.name,stars:saved.stars}); });
    const order=["blue","red","green","white-gene","white-awakening","white-skill","white-scenario","white-race","white-hidden","white-other"];
    const html=order.filter(k=>groups.has(k)).map(k=>{const g=groups.get(k); return `<section class="factor-library-detail-group is-${g.key}"><h4>${escapeHtml(g.label)}</h4><ul>${g.items.map(x=>`<li><span>${escapeHtml(x.name)}</span><strong>${"★".repeat(Math.max(1,Math.min(3,Number(x.stars)||1)))}</strong></li>`).join("")}</ul></section>`;}).join("");
    const unresolved=(entry.unresolvedFactors||[]).length ? `<section class="factor-library-detail-group is-unresolved"><h4>要確認</h4><ul>${entry.unresolvedFactors.map(f=>`<li><span>${escapeHtml(f.ocrText||"未確定因子")}</span><strong>要確認</strong></li>`).join("")}</ul></section>` : "";
    const detailContent=backdrop.querySelector(".factor-library-detail-content");
    let imageHtml = "";
    if (entry.id && Array.isArray(entry.imageRefs)) {
      const wanted = new Set(entry.imageRefs.map(ref => ref.imageId).filter(Boolean));
      const savedImages = (await listFactorImages()).filter(image => wanted.has(image.imageId) && image.blob);
      if (savedImages.length) {
        const items = savedImages.map((image, index) => { const url=URL.createObjectURL(image.blob); return `<figure><img src="${url}" alt="保存画像 ${index+1}"><figcaption>保存画像 ${index+1}</figcaption></figure>`; }).join("");
        imageHtml = `<section class="factor-library-saved-images"><h4>保存画像</h4><div>${items}</div></section>`;
      } else if (entry.createdAt) imageHtml = `<section class="factor-library-saved-images"><h4>保存画像</h4><p>保存画像なし</p></section>`;
    }
    detailContent.innerHTML = `<div class="factor-library-detail-groups">${html}${unresolved}</div>${imageHtml}`;
    detailBackdrop.hidden=false;
    const detailDialog=backdrop.querySelector(".factor-library-detail-dialog");
    detailBackdrop.scrollTop=0; detailDialog.scrollTop=0; detailContent.scrollTop=0;
    requestAnimationFrame(()=>{ detailBackdrop.scrollTop=0; detailDialog.scrollTop=0; detailContent.scrollTop=0; });
  }

  function createTagPicker(initialTags = []) {
    const root=document.createElement("div"); root.className="factor-library-tag-picker"; let selected=[...new Set(initialTags)];
    root.innerHTML='<div class="factor-library-tag-picker-field"><div class="factor-library-tag-picker-chips"></div><button type="button" class="factor-library-tag-picker-open">タグを追加</button></div><div class="factor-library-tag-picker-menu" hidden><div class="factor-library-tag-picker-options"></div><button type="button" class="text-button create-tag">＋ 新しいタグを作成</button></div>';
    const chips=root.querySelector(".factor-library-tag-picker-chips"), menu=root.querySelector(".factor-library-tag-picker-menu"), options=root.querySelector(".factor-library-tag-picker-options");
    const render=()=>{ chips.innerHTML=""; selected.forEach(tag=>{const chip=document.createElement("span");chip.className="factor-library-chip";chip.innerHTML=`<span>${escapeHtml(tag)}</span><button type="button" aria-label="${escapeHtml(tag)}を外す">×</button>`;chip.querySelector("button").onclick=e=>{e.stopPropagation();selected=selected.filter(x=>x!==tag);render();};chips.append(chip);}); const available=allTags().filter(t=>!selected.includes(t)); options.innerHTML=available.length?available.map(t=>`<button type="button" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join(""):'<span class="factor-library-empty-inline">追加できる既存タグはありません。</span>'; options.querySelectorAll("[data-tag]").forEach(b=>b.onclick=()=>{selected.push(b.dataset.tag);menu.hidden=true;render();}); };
    chips.addEventListener("click", event => event.stopPropagation());
    root.querySelector(".factor-library-tag-picker-field").addEventListener("click", event => { if (!event.target.closest(".factor-library-tag-picker-open")) event.stopPropagation(); });
    root.querySelector(".factor-library-tag-picker-open").onclick=event=>{event.stopPropagation();render();menu.hidden=!menu.hidden;};
    document.addEventListener("pointerdown", event => { if (!root.contains(event.target)) menu.hidden = true; });
    root.querySelector(".create-tag").onclick=()=>{const value=prompt("新しいタグ名を入力してください。");const tag=String(value||"").trim();if(!tag)return;const existing=allTags().find(x=>normalize(x)===normalize(tag));if(existing){if(!selected.includes(existing))selected.push(existing);showToast(`「${existing}」は登録済みのため、既存タグを選択しました。`);menu.hidden=true;render();return;}if(confirm(`新しいタグ「${tag}」を作成しますか？`)){putFactorTag(tag).catch(error=>showToast(`タグを保存できませんでした: ${error.message}`));persistentTags.push(tag);selected.push(tag);menu.hidden=true;render();}};
    root.getTags=()=>[...selected]; render(); return root;
  }

  async function renderSaved() {
    entries = (await listFactorEntries()).sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))); persistentTags = await listFactorTags();
    const q = normalize(quickSearch.value);
    const shown = entries.filter(entry => {
      if (q) {
        const textMatch = [entry.displayName, entry.characterNameSnapshot, entry.variantNameSnapshot, entry.memo, ...(entry.tags||[])].some(v=>normalize(v).includes(q));
        const characterMatch = !!entry.characterId && searchCharacterVariants(quickSearch.value.trim(), 500).some(v=>v.characterId===entry.characterId);
        if (!textMatch && !characterMatch) return false;
      }
      if (selectedTags.length && !selectedTags.some(tag => (entry.tags || []).includes(tag))) return false;
      if (selectedUma && entry.characterId !== selectedUma.characterId) return false;
      if (factorFilters.length) {
        const ids = new Set((entry.factors || []).map(f => f.factorId));
        const hits = factorFilters.map(factorId => ids.has(factorId));
        if (factorMode.value === "all" ? !hits.every(Boolean) : !hits.some(Boolean)) return false;
      }
      return true;
    });
    count.textContent = `${entries.length}件${shown.length !== entries.length ? `（該当${shown.length}件）` : ""}`;
    const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE)); page = Math.min(page, pages); const pageItems = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE); list.innerHTML = "";
    if (!pageItems.length) { list.innerHTML = '<p class="factor-library-empty">該当する保存データはありません。</p>'; renderPagination(shown.length); return; }
    pageItems.forEach(entry => {
      const card = document.createElement("article"); card.className = "factor-library-card"; if (entry.id === highlightId) card.classList.add("is-highlighted");
      const memoText = entry.memo?.trim() || "メモなし"; const tags = (entry.tags || []).map(tag => `<span class="factor-library-tag">${escapeHtml(tag)}</span>`).join("");
      card.innerHTML = `<div class="factor-library-card-summary"><div class="factor-library-card-title"><strong>${escapeHtml(entry.displayName)}</strong><span>${entry.factors.length}因子${entry.unresolvedFactors?.length ? ` / 要確認${entry.unresolvedFactors.length}件` : ""}</span><div class="factor-library-card-tags">${tags}</div><small>${escapeHtml(memoText)}</small><small>${entry.createdAt ? `保存 ${escapeHtml(formatDateTime(entry.createdAt))}` : ""}</small></div><div class="factor-library-card-actions"><button type="button" class="ghost-button details">詳細</button><button type="button" class="ghost-button edit">編集</button><button type="button" class="danger-button delete">削除</button></div></div><div class="factor-library-edit-slot"></div>`;
      if (pickerMode) {
        card.classList.add("is-picker");
        const disabled = pickerMode.conflict?.(entry) || "";
        const actions = card.querySelector(".factor-library-card-actions");
        actions.innerHTML = `<button type="button" class="primary-button select" ${disabled?"disabled":""}>選択</button>${disabled?`<small class="factor-library-picker-conflict">${escapeHtml(disabled)}</small>`:""}`;
        actions.querySelector(".select").onclick = () => { pickerMode.onSelect(entry); close(); };
        if (!disabled) card.querySelector(".factor-library-card-title").style.cursor="pointer";
        if (!disabled) card.querySelector(".factor-library-card-title").onclick=()=>{pickerMode.onSelect(entry);close();};
        list.appendChild(card); return;
      }
      card.querySelector(".details").onclick = () => openDetails(entry);
      card.querySelector(".delete").onclick = async () => { if (confirm(`「${entry.displayName}」を因子ライブラリから削除しますか？`)) { await deleteFactorEntry(entry.id); showToast("削除しました。"); await renderSaved(); } };
      card.querySelector(".edit").onclick = () => {
        const slot = card.querySelector(".factor-library-edit-slot"); if (slot.childElementCount) { slot.innerHTML = ""; card.classList.remove("is-editing"); return; } let selectedVariant = getCharacterVariant(entry.variantId);
        const editor = document.createElement("div"); editor.className = "factor-library-editor";
        editor.innerHTML = `<div class="factor-library-editor-fields"><label><span>育成ウマ娘</span><div class="character-slot"></div></label><div class="factor-library-editor-field"><span>タグ</span><div class="tag-slot"></div></div><label class="memo-field"><span>メモ</span><textarea rows="2" placeholder="簡易メモ">${escapeHtml(entry.memo || "")}</textarea></label></div><div class="factor-library-editor-actions"><button type="button" class="ghost-button cancel">キャンセル</button><button type="button" class="primary-button save">変更を保存</button></div>`;
        const search = characterSearch(variant => { selectedVariant = variant; }, entry.variantId); editor.querySelector(".character-slot").append(search); const tagPicker=createTagPicker(entry.tags||[]); editor.querySelector(".tag-slot").append(tagPicker);
        editor.querySelector(".cancel").onclick = () => { slot.innerHTML = ""; card.classList.remove("is-editing"); };
        editor.querySelector(".save").onclick = async () => { if (!selectedVariant) return; entry.characterId = selectedVariant.characterId; entry.variantId = selectedVariant.variantId; entry.characterNameSnapshot = selectedVariant.characterName; entry.variantNameSnapshot = selectedVariant.variantName; entry.displayName = selectedVariant.displayName; entry.tags = tagPicker.getTags(); entry.memo = editor.querySelector("textarea").value; entry.updatedAt = new Date().toISOString(); await putFactorEntry(entry); highlightId = entry.id; showToast("変更を保存しました。"); await renderSaved(); };
        card.classList.add("is-editing"); slot.append(editor);
      };
      list.appendChild(card);
    });
    renderPagination(shown.length); if (highlightId) setTimeout(() => list.querySelector(".is-highlighted")?.scrollIntoView({ block: "nearest" }), 0);
  }

  const openDialog = async (picker = null) => {
    resetFilters(); pickerMode = picker; page = 1;
    backdrop.querySelector("#factor-library-title").textContent = picker ? `${picker.label}：因子ライブラリから選択` : "因子ライブラリ";
    backdrop.querySelector(".factor-library-modal header p").textContent = picker ? "保存済みデータから選択します。" : "保存した因子データを共通で管理します。";
    backdrop.querySelector(".factor-library-backup-toggle").hidden = !!picker;
    backdrop.querySelector(".factor-library-backup-panel").hidden = true;
    await renderSaved(); backdrop.hidden = false; document.body.classList.add("factor-library-modal-open"); modal.focus();
  };
  return { open: () => openDialog(), openPicker: options => openDialog(options), close, refresh: renderSaved };
}
export { PAGE_SIZE, createFactorLibraryDialog };
