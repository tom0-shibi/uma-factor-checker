import { createFactorSetDialog } from "./factor-set-dialog.js";

function showCommonDataHelp() {
  const dialog = document.createElement("dialog");
  dialog.className = "header-help-dialog";
  dialog.setAttribute("aria-labelledby", "common-data-help-title");
  dialog.innerHTML = `<header><div><h3 id="common-data-help-title">因子ライブラリ・保存済み編成について</h3><p class="header-help-intro">継承ウマ娘の設定を効率よく管理・再利用するための補助機能です。使用しなくても、画像解析から継承プランを確認できます。</p></div><button type="button" class="header-help-close" aria-label="閉じる">×</button></header><div class="header-help-body"><section><h4>因子ライブラリ</h4><p>確認した親・祖の因子情報を個別に保存し、別の継承設定でも再利用するための機能です。同じウマ娘を何度も画像解析する手間を減らせます。</p></section><section><h4>保存済み編成</h4><p>因子ライブラリに登録した親・祖を組み合わせ、6枠の継承編成として保存・再利用するための機能です。よく使う編成をまとめて呼び出せます。</p></section><section class="header-help-note"><p>どちらも任意の補助機能です。因子ライブラリや保存済み編成を使わず、画像から継承プランを確認することもできます。</p></section></div>`;
  document.body.append(dialog);
  const close = () => { if (dialog.open) dialog.close(); dialog.remove(); };
  dialog.querySelector(".header-help-close").addEventListener("click", close);
  dialog.addEventListener("click", event => { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); });
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.showModal();
}

function initializeFactorSetUi() {
  const host = document.getElementById("common-data-actions");
  if (!host) return;
  const dialog = createFactorSetDialog();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "header-common-action factor-set-open";
  button.innerHTML = '<span aria-hidden="true">▦</span><span>保存済み編成</span>';
  button.title = "保存した6枠の編成を確認・編集";
  button.onclick = () => dialog.open().catch(error => console.error("保存済み編成の読込に失敗しました", error));
  const help = document.createElement("button");
  help.type = "button";
  help.className = "header-shared-help";
  help.textContent = "ライブラリ・編成について";
  help.title = "因子ライブラリと保存済み編成の説明";
  help.addEventListener("click", showCommonDataHelp);
  host.append(button, help);
}

export { initializeFactorSetUi };
