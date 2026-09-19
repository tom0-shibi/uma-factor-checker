# 人手確認用の正解データ

同梱の expected.json は空の draft です。正解データではなく、比較は拒否されます。
localhost の Dev で既存10枚をセットし通常解析後、「判定結果」の
「expected候補JSONを保存」で expected.candidate.json を取得してください。
全因子を元画像と照合して訂正し、このディレクトリの expected.json に配置します。
「expected.jsonを再読込・比較」でOCR再実行なしに読み直せます。

## Schema v1

- version: 1、fixtureSet: regression-20260916
- verification: draft → 全件人手確認後のみ verified
- members: parentA / grandA1 / grandA2 / parentB / grandB1 / grandB2
- 各memberの factors: name（正解のcanonical name）、color（white/blue/red/green）、stars（1〜3）、verified（人手確認済みならtrue）、sources
- sources: 同じ因子の画像内位置の配列。imageIndexは枠内画像の0始まり、columnはleft/right、rowは既存解析の行番号（通常1始まり）。これは画像位置注釈であり、OCR内部状態ではありません。欠落因子を追加する際は空配列も許容します。

候補は自動確定分も verified:false です。Review/Unresolved はname:null。
候補のsourcesを使って元画像を確認し、正しい名前を記入してください。
緑因子は現行処理が名前を読まないためname:nullです。正解名を記入しても比較結果はUnresolvedになります。
誤った重複は分離し、同一人物・同一因子は1件にまとめ、sourcesを結合してください。
OCRテキスト、confidence、候補順位、fallback、matching設定等は保存できません。

比較は通常解析直後の自動認識結果を保存して使用し、その後のReview手動修正は採点に反映しません。
既存の白因子集計（正規化名ごと最大星数）、Review重複排除、色因子の最初のmetadataを再利用します。
同名同色を先に対応付け、次に一致する画像位置で対応付けます。曖昧な位置や位置未登録の誤読は推測せず欠落＋余分になります。
一致、Review、Unresolved、誤確定、星数不一致、欠落、余分、色不一致を表示します。
星数・色の不一致は他カテゴリと重複計上します。

画像差し替え後は再解析が必要です。対象判定は既存のファイル名・6枠割当を使います（画像内容のハッシュ照合はしません）。
proではDevモジュールをロードせずUIも作成しません。静的配信先のJSON自体は秘密データではありません。

旧回帰テスト用の部分リストは legacy-expected.json に内容を変えず保存しています。全件正解データには流用しません。
