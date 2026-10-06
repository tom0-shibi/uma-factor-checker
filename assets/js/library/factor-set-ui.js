import { createFactorSetDialog } from "./factor-set-dialog.js";
function initializeFactorSetUi(){const host=document.getElementById("common-data-actions");if(!host)return;const dialog=createFactorSetDialog();const button=document.createElement("button");button.type="button";button.className="header-common-action factor-set-open";button.innerHTML='<span aria-hidden="true">▦</span><span>保存済み編成</span>';button.title="保存した6枠の編成を確認・編集";button.onclick=()=>dialog.open().catch(e=>console.error("保存済み編成の読込に失敗しました",e));host.append(button);}
export { initializeFactorSetUi };
