import { searchCharacterVariants, getCharacterVariant } from "../data/character-master.js";
import { listFactorEntries, listFactorTags, putFactorTag } from "./factor-library-storage.js";

const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const normalize=value=>String(value??"").normalize("NFKC").toLowerCase().replace(/\s+/g,"");

function createCharacterSearch(onSelect, selectedVariantId=null){
  const root=document.createElement("div"); root.className="factor-library-character-search";
  root.innerHTML='<input type="search" placeholder="名前・衣装・通称で検索" autocomplete="off"><div class="factor-library-character-candidates" hidden></div>';
  const input=root.querySelector("input"), list=root.querySelector(".factor-library-character-candidates");
  const initial=getCharacterVariant(selectedVariantId); if(initial){input.value=initial.displayName;onSelect(initial);}
  const close=()=>{list.hidden=true;};
  const render=()=>{const items=searchCharacterVariants(input.value.trim(),30);list.innerHTML="";items.forEach(item=>{const b=document.createElement("button");b.type="button";b.innerHTML=`<strong>${esc(item.displayName)}</strong>${item.aliases.length?`<small>${esc(item.aliases.join(" / "))}</small>`:""}`;b.onclick=()=>{input.value=item.displayName;close();onSelect(item);};list.append(b);});list.hidden=!items.length;};
  input.oninput=render; input.onfocus=render; input.onkeydown=e=>{if(e.key==="Escape")close();};
  root.addEventListener("focusout",()=>setTimeout(()=>{if(!root.contains(document.activeElement))close();},0));
  return root;
}

function createTagPicker(initialTags, knownTags, onMessage){
  const root=document.createElement("div"); root.className="factor-library-tag-picker"; let selected=[...new Set(initialTags||[])];
  root.innerHTML='<div class="factor-library-tag-picker-field"><div class="factor-library-tag-picker-chips"></div><button type="button" class="factor-library-tag-picker-open">タグを追加</button></div><div class="factor-library-tag-picker-menu" hidden><div class="factor-library-tag-picker-options"></div><button type="button" class="text-button create-tag">＋ 新しいタグを作成</button></div>';
  const chips=root.querySelector(".factor-library-tag-picker-chips"),menu=root.querySelector(".factor-library-tag-picker-menu"),options=root.querySelector(".factor-library-tag-picker-options");
  const render=()=>{chips.innerHTML="";selected.forEach(tag=>{const chip=document.createElement("span");chip.className="factor-library-chip";chip.innerHTML=`<span>${esc(tag)}</span><button type="button" aria-label="${esc(tag)}を外す">×</button>`;chip.querySelector("button").onclick=e=>{e.stopPropagation();selected=selected.filter(x=>x!==tag);render();};chips.append(chip);});const available=knownTags().filter(t=>!selected.includes(t));options.innerHTML=available.length?available.map(t=>`<button type="button" data-tag="${esc(t)}">${esc(t)}</button>`).join(""):'<span class="factor-library-empty-inline">追加できる既存タグはありません。</span>';options.querySelectorAll("[data-tag]").forEach(b=>b.onclick=()=>{selected.push(b.dataset.tag);menu.hidden=true;render();});};
  chips.addEventListener("click",e=>e.stopPropagation());
  root.querySelector(".factor-library-tag-picker-field").addEventListener("click",e=>{if(!e.target.closest(".factor-library-tag-picker-open"))e.stopPropagation();});
  root.querySelector(".factor-library-tag-picker-open").onclick=e=>{e.stopPropagation();render();menu.hidden=!menu.hidden;};
  document.addEventListener("pointerdown",e=>{if(!root.contains(e.target))menu.hidden=true;});
  root.querySelector(".create-tag").onclick=()=>{const value=prompt("新しいタグ名を入力してください。");const tag=String(value||"").trim();if(!tag)return;const existing=knownTags().find(x=>normalize(x)===normalize(tag));if(existing){if(!selected.includes(existing))selected.push(existing);onMessage(`「${existing}」は登録済みのため、既存タグを選択しました。`);menu.hidden=true;render();return;}if(confirm(`新しいタグ「${tag}」を作成しますか？`)){putFactorTag(tag).catch(error=>onMessage(`タグを保存できませんでした: ${error.message}`));knownTags().push(tag);selected.push(tag);menu.hidden=true;render();}};
  root.getTags=()=>[...selected]; render(); return root;
}

function createFactorRegistrationDialog({ saveItem }) {
  const backdrop=document.createElement("div"); backdrop.className="factor-library-detail-backdrop factor-registration-backdrop"; backdrop.hidden=true;
  backdrop.innerHTML=`<section class="factor-library-detail-dialog factor-registration-dialog" role="dialog" aria-modal="true" aria-labelledby="factor-registration-title"><header><div><h3 id="factor-registration-title">因子ライブラリに保存</h3><p class="factor-registration-target"></p></div><button type="button" class="factor-library-detail-close" aria-label="閉じる">×</button></header><div class="factor-library-detail-content factor-registration-content"><div class="factor-library-editor-fields"><label><span>育成ウマ娘</span><div class="factor-registration-character"></div></label><div class="factor-library-editor-field"><span>タグ</span><div class="factor-registration-tag-slot"></div></div><label class="memo-field"><span>メモ</span><textarea class="factor-registration-memo" rows="2" placeholder="簡易メモ"></textarea></label></div><p class="factor-registration-status" role="status" aria-live="polite"></p><div class="factor-library-editor-actions"><button type="button" class="ghost-button factor-registration-cancel">キャンセル</button><button type="button" class="primary-button factor-registration-save">保存</button></div></div></section>`;
  document.body.append(backdrop);
  let context=null,selectedVariant=null,resolveOpen=null,tagPicker=null,knownTags=[];
  const target=backdrop.querySelector(".factor-registration-target"),charHost=backdrop.querySelector(".factor-registration-character"),tagSlot=backdrop.querySelector(".factor-registration-tag-slot"),memo=backdrop.querySelector(".factor-registration-memo"),status=backdrop.querySelector(".factor-registration-status");
  const message=text=>{status.textContent=text;};
  function close(result=null){backdrop.hidden=true;document.body.classList.remove("factor-library-modal-open");if(resolveOpen){resolveOpen(result);resolveOpen=null;}}
  backdrop.querySelector(".factor-library-detail-close").onclick=()=>close(null); backdrop.querySelector(".factor-registration-cancel").onclick=()=>close(null);
  backdrop.querySelector(".factor-registration-save").onclick=async()=>{if(!selectedVariant){message("育成ウマ娘を選択してください。");return;}const button=backdrop.querySelector(".factor-registration-save");button.disabled=true;message("保存しています…");try{const result=await saveItem(context.memberId,selectedVariant,memo.value,tagPicker.getTags());message(result.message);if(result.saved)setTimeout(()=>close(result),0);}catch(e){message(`保存できませんでした: ${e.message}`);}finally{button.disabled=false;}};
  return {open:async({memberId,label,selectedVariantId=null})=>{context={memberId,label};selectedVariant=null;target.textContent=`${label} の確定済み因子を保存します。`;memo.value="";status.textContent="";const entries=await listFactorEntries();const storedTags=await listFactorTags();knownTags=[...new Set([...storedTags,...entries.flatMap(e=>e.tags||[])])].sort((a,b)=>a.localeCompare(b,"ja"));charHost.innerHTML="";charHost.append(createCharacterSearch(v=>{selectedVariant=v;message("");},selectedVariantId));tagSlot.innerHTML="";tagPicker=createTagPicker([],()=>knownTags,message);tagSlot.append(tagPicker);backdrop.hidden=false;document.body.classList.add("factor-library-modal-open");return new Promise(resolve=>{resolveOpen=resolve;});}};
}
export { createFactorRegistrationDialog };
