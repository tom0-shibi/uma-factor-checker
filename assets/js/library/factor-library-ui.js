import { members, MEMBER_ORDER } from "../config.js";
import { collectConfirmedFactorData } from "./confirmed-factor-data.js";
import { createFactorEntry, buildFactorFingerprint } from "./factor-entry.js";
import { saveFactorEntryWithImages, listFactorEntries } from "./factor-library-storage.js";
import { createFactorLibraryDialog } from "./factor-library-dialog.js";

function uid(prefix){const value=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(16).slice(2)}`;return`${prefix}_${value}`;}
function currentItems(){return MEMBER_ORDER.filter(id=>members[id].analysisResults.length>0).map(id=>({id,label:members[id].label,factorCount:collectConfirmedFactorData(id).factors.length,selectedVariantId:members[id].selectedVariantId||null}));}
async function saveCurrent(memberId,variant,memo="",tags=[]){
  const confirmed=collectConfirmedFactorData(memberId); const fp=buildFactorFingerprint({characterId:variant.characterId,variantId:variant.variantId,factors:confirmed.factors}); const existing=(await listFactorEntries()).find(e=>buildFactorFingerprint(e)===fp); if(existing)return{saved:false,message:`同じ育成ウマ娘・因子構成は登録済みです（${existing.displayName}）。`};
  const entryId=uid("factor_entry"); const images=members[memberId].images.map((image,index)=>({imageId:uid("factor_image"),entryId,index,blob:image.file,name:image.file.name,type:image.file.type,lastModified:image.file.lastModified})); const entry=createFactorEntry({id:entryId,displayName:variant.displayName,characterId:variant.characterId,variantId:variant.variantId,characterNameSnapshot:variant.characterName,variantNameSnapshot:variant.variantName,factors:confirmed.factors,unresolvedFactors:confirmed.unresolvedFactors,imageRefs:images.map(x=>({imageId:x.imageId,index:x.index})),memo,tags}); await saveFactorEntryWithImages(entry,images); members[memberId].selectedVariantId=variant.variantId; return{saved:true,message:"保存しました。"};
}
function initializeFactorLibraryUi(){const results=document.getElementById("results");if(!results)return; const dialog=createFactorLibraryDialog({getCurrentItems:currentItems,saveCurrentItem:saveCurrent}); const entry=document.createElement("div");entry.className="factor-library-entry";entry.innerHTML='<button type="button" class="secondary-button factor-library-open"><span class="factor-library-open-mark" aria-hidden="true">✦</span><span>因子ライブラリ</span></button><span>保存した因子を確認・編集</span>'; entry.querySelector("button").onclick=()=>dialog.open().catch(e=>console.error("因子ライブラリの読込に失敗しました",e)); results.insertBefore(entry,document.getElementById("analysis-debug"));}
export { initializeFactorLibraryUi };
