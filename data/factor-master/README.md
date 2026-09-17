# Factor Masterデータ

GoogleスプレッドシートをFactor Masterの編集用原本とし、`factor-master.csv`をGitHub上の確定スナップショットとして管理します。

## CSV列

`No.`, `因子名`, `因子色`, `分類`, `備考`

- `No.`: 人間の管理用。実行用データには含めません。
- `因子名`: 必須、重複不可。
- `因子色`: `blue`, `red`, `green`, `white` のいずれか。
- `分類`: `status`, `aptitude`, `unique`, `skill`, `race`, `scenario`, `gene`, `awakening`, `hidden`, `other` のいずれか。
- `備考`: 任意。

## 更新手順

1. Googleスプレッドシートを更新する。
2. CSV形式で出力する。
3. `data/factor-master/factor-master.csv`を置き換える。
4. `node scripts/build-factor-master.mjs`を実行する。
5. Factor Master関連テストを実行する。
6. CSVと生成された`assets/js/data/factor-master.js`を一緒にcommitする。

生成時に因子名、因子色、分類、名称重複を検証します。異常な行は自動補正せず、行番号付きのエラーとして扱います。
