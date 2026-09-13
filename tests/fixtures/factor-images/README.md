# Factor Image Fixtures

## 目的

画像解析の変更による回帰を、実際にツールへ入力するスクリーンショットで検出するためのFixtureです。

## Fixture分類

- `factor-list-start`: 1人分の因子一覧上部。青・赤・緑因子などが存在する場合があります。
- `factor-list-continuation`: 同一人物の因子一覧途中・末尾。青・赤・緑因子や上部anchorが存在しなくても正常です。
- `composite-type-a`: 親・祖など複数人物を含む正式非対応画像です。
- `unrelated`: 因子一覧ではない画像です。
- `weak-factor-like`: 因子カードに似た要素はあるものの、factor gridとして証拠が不足する画像です。

## `ready`の意味

- `ready: false`: placeholderです。Fixture runnerは画像解析を実行せずskipします。
- `ready: true`: 実画像と正解データが準備済みです。Fixture runnerで解析結果との比較対象にできます。

現時点のPNGはすべてplaceholderであり、OCRや画像解析の成否を評価する画像ではありません。

## 重要ルール

- 青・赤・緑因子が存在しないことだけを理由に、`factor-list-continuation`をunsupportedにしてはいけません。
- supported判定と`factorInfo`取得は別々に評価します。
- `weak-factor-like`を通すためにcontinuation判定を緩めてはいけません。
- 実画像は原則としてリサイズ、圧縮、トリミング、結合、画質補正を行いません。

## 実画像への差し替え方法

1. `supported/`または`unsupported/`内のplaceholder PNGを、同じファイル名の実スクリーンショットで上書きします。
2. `expected.json`の該当項目へ、カード数や因子情報など確認済みの正解値を記入します。
3. 該当項目の`ready`を`true`へ変更します。
4. Fixtureテストを実行し、ファイル名、manifest、期待値を確認します。

## `factorInfo`の記入例

```json
{
  "blue": { "name": "スピード", "stars": 3 },
  "red": { "name": "中距離", "stars": 2 },
  "green": { "name": "継承固有", "stars": 3 }
}
```

青候補は`スピード / スタミナ / パワー / 根性 / 賢さ`、赤候補は`芝 / ダート / 短距離 / マイル / 中距離 / 長距離 / 逃げ / 先行 / 差し / 追込`です。緑の名称は常に`継承固有`、星数は1〜3です。

## 段階的な拡張

Phase 1では`supported`、`layout`、カード数、青・赤・緑因子名、星数を対象にします。将来のPhase 2では、`expected`へ白因子の読み取り結果、`canonicalName`、星数、`confirmed / review / unresolved`などを追加できます。

