import assert from "node:assert/strict";
import { members, requirements } from "../assets/js/config.js";
import { collectConfirmedFactorData } from "../assets/js/library/confirmed-factor-data.js";
import { createFactorEntry, validateFactorEntry, FACTOR_ENTRY_SCHEMA_VERSION } from "../assets/js/library/factor-entry.js";
import { FACTOR_MASTER_VERSION } from "../assets/js/data/factor-master.js";
import { getFactorMasterEntry } from "../assets/js/matching/candidate-provider.js";

requirements.S = [];
requirements.A = [];
requirements.B = [];
requirements.C = [];

members.parentA.images = [{ id: "image-a" }];
members.parentA.analysisResults = [{
  imageIndex: 0,
  analysis: {
    factorMetadata: {
      blue: { name: "スピード", stars: 3, status: "confirmed" },
      red: { name: "長距離", stars: 2, status: "confirmed" },
      green: { name: "継承固有", stars: 1, status: "confirmed" }
    },
    leftCards: [{ factorType: "white", stars: 3, column: "left", row: 1, ocrText: "末脚", ocrConfidence: 95, finalStatus: "confirmed", factorFinalStatus: "recognized-non-requirement", canonicalName: "末脚", canonicalFactorType: "skill", requirementRank: null }],
    rightCards: [{ factorType: "white", stars: 2, column: "right", row: 2, ocrText: "新因子候補", ocrConfidence: 50, finalStatus: "unresolved", canonicalName: null, requirementRank: null }]
  }
}];

const data = collectConfirmedFactorData("parentA");
assert.equal(data.factors.length, 4, "青赤緑と要件外の確定白因子を保存対象にする");
assert.ok(data.factors.some(item => item.factorId === getFactorMasterEntry("末脚").factorId));
assert.equal(data.factors.find(item => item.nameSnapshot === "末脚").stars, 3);
assert.equal(data.unresolvedFactors.length, 1, "未確定因子を捨てない");
assert.equal(data.unresolvedFactors[0].ocrText, "新因子候補");

const entry = createFactorEntry({ id: "entry_test", displayName: "祖用テスト", factors: data.factors, unresolvedFactors: data.unresolvedFactors, imageRefs: [{ imageId: "img_test", type: "factor-list" }], now: "2026-10-05T00:00:00.000Z" });
assert.equal(entry.dataStatus, "needs-review");
assert.equal(entry.schemaVersion, FACTOR_ENTRY_SCHEMA_VERSION);
assert.equal(entry.masterVersion, FACTOR_MASTER_VERSION);
assert.equal(validateFactorEntry(entry), true);
assert.throws(() => createFactorEntry({ id: "bad", displayName: "", factors: [] }), /displayName/);

const { buildFactorFingerprint } = await import("../assets/js/library/factor-entry.js");
const fpA = buildFactorFingerprint({ characterId: "character_1", variantId: "variant_1", factors: [{ factorId: "factor_b", stars: 2 }, { factorId: "factor_a", stars: 3 }] });
const fpB = buildFactorFingerprint({ characterId: "character_1", variantId: "variant_1", factors: [{ factorId: "factor_a", stars: 3 }, { factorId: "factor_b", stars: 2 }] });
assert.equal(fpA, fpB, "因子順が違っても同一構成として判定する");
assert.notEqual(fpA, buildFactorFingerprint({ characterId: "character_1", variantId: "variant_1", factors: [{ factorId: "factor_a", stars: 2 }, { factorId: "factor_b", stars: 2 }] }), "星数違いは別構成として扱う");
const memoEntry = createFactorEntry({ id: "memo", displayName: "メモテスト", factors: [], memo: "長距離用" });
assert.equal(memoEntry.memo, "長距離用", "FactorEntryは共通ライブラリ用メモを保持する");

const fs = await import("node:fs/promises");
const dialogSource = await fs.readFile(new URL("../assets/js/library/factor-library-dialog.js", import.meta.url), "utf8");
assert.match(dialogSource, /const PAGE_SIZE = 10/, "保存済み一覧は10件単位でページングする");
assert.match(dialogSource, /変更を保存/, "編集は明示保存にする");
assert.match(dialogSource, /factor-library-detail-dialog/, "因子一覧は別ダイアログで確認できる");
assert.match(dialogSource, /factor-library-tag-filter/, "タグで絞り込める");
assert.match(dialogSource, /factor-library-factor-mode/, "複数因子をany\/allで絞り込める");
assert.match(dialogSource, /factor-library-uma-filter/, "ウマ娘で絞り込める");
assert.match(dialogSource, /searchCharacterVariants\(input.value.trim\(\), 30\)/, "未入力フォーカス時も育成ウマ娘候補を表示できる");
assert.match(dialogSource, /変更を保存しました。/, "編集完了を通知する");
assert.doesNotMatch(dialogSource, /よみで検索/, "検索欄に『よみで』という説明を出さない");
assert.match(dialogSource, /FACTOR_MASTER/, "因子絞り込み候補はFactor Masterを使う");
assert.match(dialogSource, /ids\.has\(factorId\)/, "因子絞り込みはfactorId完全一致で判定する");
assert.match(dialogSource, /新しいタグ名を入力してください/, "新規タグは明示操作で追加する");
assert.match(dialogSource, /全保存から削除/, "タグを全保存データから削除できる");
assert.match(dialogSource, /青因子/, "詳細で青因子を分類表示する");
assert.match(dialogSource, /遺伝子/, "白因子の主要分類を表示する");
assert.doesNotMatch(dialogSource, /今回の解析結果/, "因子ライブラリ画面は保存済みデータの管理に限定する");
const registrationSource = await fs.readFile(new URL("../assets/js/library/factor-registration-dialog.js", import.meta.url), "utf8");
const resultsSource = await fs.readFile(new URL("../assets/js/result/results.js", import.meta.url), "utf8");
assert.match(registrationSource, /育成ウマ娘/, "確認画面からのLibrary登録で育成ウマ娘を設定できる");
assert.match(registrationSource, /タグ/, "確認画面からのLibrary登録でタグを設定できる");
assert.match(registrationSource, /メモ/, "確認画面からのLibrary登録でメモを設定できる");
assert.match(resultsSource, /因子ライブラリに保存/, "継承プラン確認画面から個別にLibrary登録できる");

assert.match(dialogSource, /検索できるFactor Master候補|searchableTypes/, "因子絞り込み候補を主要白因子に限定する");
assert.match(dialogSource, /軽量バックアップ/, "軽量バックアップを保存できる");
assert.match(dialogSource, /完全バックアップ（画像含む）/, "画像込み完全バックアップを保存できる");
assert.match(dialogSource, /バックアップから復元/, "バックアップから復元できる");
assert.match(dialogSource, /formatDateTime/, "保存日時は共通フォーマッタを使う");
assert.match(dialogSource, /factor-library-tag-picker-field/, "タグ選択は統一入力UIを使う");


// Startup regression: factor-library-ui.js imports this named export.
{
  const storage = await import("../assets/js/library/factor-library-storage.js");
  assert.equal(typeof storage.saveFactorEntryWithImages, "function");
}

assert.match(dialogSource, /UmaTool_因子ライブラリ_/, "バックアップ名を一般ユーザー向け日本語名にする");
assert.match(dialogSource, /factor-library-restore-dialog/, "復元方法は独自ダイアログで選択する");
assert.match(dialogSource, /軽量バックアップ：因子データ・タグ・メモ/, "軽量復元は画像を含まないことを説明する");
assert.match(dialogSource, /完全バックアップ：因子データと元画像/, "完全復元は画像を含むことを説明する");
assert.match(dialogSource, /!root\.contains\(event\.target\).*menu\.hidden = true/, "タグ候補は外側クリックで閉じる");
assert.match(dialogSource, /sort\(\(a,b\).*createdAt/, "保存済みは保存日時の新しい順に表示する");
assert.doesNotMatch(dialogSource, /start-save[\s\S]{0,220}\.focus\(\)/, "保存フォームを開いただけで育成ウマ娘候補を自動表示しない");
assert.match(dialogSource, /現在のデータに追加/, "復元の追加動作をユーザー向けに説明する");
assert.match(dialogSource, /同じIDのデータはバックアップ側の内容で更新/, "復元時の重複処理を説明する");
assert.match(dialogSource, /保存画像なし/, "Entry詳細で保存画像の有無を確認できる");
assert.match(dialogSource, /requestAnimationFrame\(\(\)=>\{ detailBackdrop\.scrollTop=0; detailDialog\.scrollTop=0; detailContent\.scrollTop=0;/, "詳細を開くたび実スクロール要素を先頭へ戻す");
assert.match(dialogSource, /factor-library-filter-subaction/, "タグ削除とウマ娘指定解除を同一UIにする");

assert.match(dialogSource, /factor-library-tag-delete-all/, "全保存から削除は専用の統一ボタンUIを使う");
assert.match(registrationSource, /factor-library-tag-picker-field/, "確認画面からの登録もLibrary編集と同じタグ選択UIを使う");
assert.match(registrationSource, /新しいタグ名を入力してください/, "確認画面からも既存Libraryと同じ新規タグ作成導線を使う");
assert.match(resultsSource, /因子ライブラリ登録済/, "登録済み表示は正式名称に統一する");
assert.match(dialogSource, /is-editing/, "編集中の因子カードを視覚的に識別できる状態クラスを付ける");

assert.match(registrationSource, /input\.onfocus=render/, "育成ウマ娘欄へフォーカスしたら未入力でも候補を表示する");
assert.doesNotMatch(registrationSource, /charHost\.querySelector\(\"input\"\)\?\.focus\(\)/, "登録ダイアログを開いただけでは育成ウマ娘候補を表示しない");
assert.match(registrationSource, /<div class=\"factor-library-editor-field\"><span>タグ<\/span>/, "登録ダイアログのタグUIをlabelで包まず、タグ本体クリックによる×ボタンの代理クリックを防ぐ");
assert.match(dialogSource, /<div class=\"factor-library-editor-field\"><span>タグ<\/span>/, "既存Library編集のタグUIもlabel代理クリックを起こさない構造にする");
assert.match(resultsSource, /result-library-save-summary-content/, "確認画面の因子ライブラリ見出しと登録件数を二段表示できる構造にする");
assert.match(resultsSource, /未登録 \${targets\.length - registeredCount}件 \/ 登録済 \${registeredCount}件/, "未登録・登録済件数を現在のLibrary状態から再計算する");
assert.match(resultsSource, /FACTOR_LIBRARY_CHANGED_EVENT/, "Library変更時に確認画面の登録状態を再評価する");
const storageSource = await fs.readFile(new URL("../assets/js/library/factor-library-storage.js", import.meta.url), "utf8");
assert.match(storageSource, /factor-library-changed/, "Library保存・編集・削除を画面へ通知する変更イベントを定義する");
assert.match(storageSource, /deleteFactorEntry[\s\S]{0,420}notifyFactorLibraryChanged\(\)/, "Library削除後も確認画面へ変更を通知する");
assert.match(resultsSource, /document\.removeEventListener\(FACTOR_LIBRARY_CHANGED_EVENT/, "破棄済み確認画面のLibrary変更リスナーを残さない");

// v5: registration metadata and tags must not be coupled to entry lifetime.
const uiSource = await fs.readFile(new URL("../assets/js/library/factor-library-ui.js", import.meta.url), "utf8");
assert.match(uiSource, /stillRegistered/, "削除済みLibrary登録の育成ウマ娘を再登録フォームへ持ち越さない");
assert.match(uiSource, /selectedVariantId=null/, "Library登録が現存しない場合は育成ウマ娘を未選択で開く");
assert.match(storageSource, /const TAG_STORE = "factorTags"/, "タグを因子Entryとは独立した永続ストアで管理する");
assert.match(storageSource, /DB_VERSION = 2/, "既存IndexedDBへタグストアを安全に追加するためDBを更新する");
assert.match(storageSource, /listFactorTags[\s\S]{0,900}entries\.flatMap\(entry=>entry\.tags\|\|\[\]\)/, "既存Entryのタグをタグストアへ移行できる");
assert.match(storageSource, /saveFactorEntryWithImages[\s\S]{0,700}TAG_STORE/, "新規保存時にタグをEntryとは別に永続化する");
assert.match(dialogSource, /persistentTags/, "因子削除後もタグ候補を独立して保持する");
assert.match(dialogSource, /deleteFactorTag\(tag\)/, "タグ自体の削除は明示的なタグ削除操作だけで行う");
assert.match(dialogSource, /entries:backupEntries,tags,images:imageData/, "バックアップに独立タグを含める");
