# Geo Base

Geo Baseは、国別・時系列データから、世界地図上の勢力変化を連続アニメーションとして描画するRemotionベースの縦型動画生成エンジンです。

## 現在の動画：世界ブラウザ利用シェアの変化

2009年から2025年まで、主要48か国のブラウザ利用シェアを日本中心の世界地図で表示します。

- 国を1色で塗りつぶさず、国の内部をブラウザ別シェアの複数色で表示
- 年次代表値の間を12か月に補間し、色の境界がじわじわ移動
- SVGのノイズ変形を利用し、境界を直線ではなく侵食するような形で描画
- 日本を世界地図の中央に配置
- 世界ランキングを支配国数ではなく主要48か国の平均利用シェアで表示
- ランキング順位とバーの長さを連続的に入れ替え
- 日本国内の上位3ブラウザと構成比を常時表示
- 動画内の説明、年月、注記、イベントを日本語に統一
- `world-atlas`の50m境界データを使用

### データ上の注意

付属データはStatCounter Global Statsの公開トレンドを基に、主要48か国の年次代表値として再構成した動画制作向けデータです。厳密な調査・報道用途では、公開前に対象年月・対象国の一次データへ差し替えてください。

動画内では、年次代表値の間を月単位で補間して滑らかな変化を生成します。補間値は観測された月次実績そのものではありません。

## 主な機能

- ISO 3166-1 alpha-3国コードと数値コード付きCSVを検証
- 同一年・同一国内の各勢力値を100%へ正規化
- 各国内の複数勢力シェアを保持
- 主要国の平均シェアランキングを算出
- 前年からの首位変化を検出
- 日本中心の世界地図を生成
- 複数色グラデーションと有機的な境界変形を描画
- 年次スナップショット間を月単位で連続補間
- 1080×1920 / H.264 MP4を生成
- タイトル、色、速度、FPS、中央経度などを外部設定化

## GitHub Actionsで動画を生成する

ローカル環境を用意しなくても、GitHub ActionsからMP4を生成してダウンロードできます。

1. GitHubリポジトリ上部の`Actions`を開く
2. 左側から`Render Geo Base Video`を選択する
3. `Run workflow`を押す
4. 実行が完了したら対象のWorkflow Runを開く
5. 画面下部の`Artifacts`から`geobase-browser-share-実行番号`をダウンロードする
6. ZIPを展開し、`geobase.mp4`を取り出す

Artifactの保存期間は14日です。手動レンダリング時にはGitHub Actionsへ`fonts-noto-cjk`を導入し、日本語の文字化けを防止します。

## ローカルセットアップ

```bash
npm install
npm run studio
```

ローカル環境でも日本語フォントが必要です。Noto Sans CJK JP、Noto Sans JP、游ゴシックのいずれかを利用できる環境を推奨します。

## 動画出力

```bash
npm run render
```

出力先は`out/geobase.mp4`です。

## 付属データを再生成する

```bash
npm run generate:sample
```

生成先は`public/data/sample.csv`です。新規のGitHub Actions環境ではファイルが存在しない場合に自動生成されます。

## データ差し替え

次の4ファイルを編集します。

- `public/data/sample.csv`：時系列シェアデータ
- `public/data/entities.json`：勢力名、色、優先順位
- `public/data/config.json`：動画タイトル、期間、速度、中央経度、出典など
- `public/data/events.csv`：重要年に表示するイベント

### CSV必須列

```csv
year,country_code,country_name,numeric_code,entity,value
2009,JPN,Japan,392,Internet Explorer,54.2
2009,JPN,Japan,392,Firefox,24.1
2009,JPN,Japan,392,Chrome,10.5
```

- `country_code`はISO 3166-1 alpha-3を使用します。
- `numeric_code`は世界地図との対応に使用するISO数値コードです。
- `value`は同一年・同一国内で自動的に100%へ正規化されます。
- データのない国はグレー表示され、前年値は自動継承しません。

## ディレクトリ構成

```text
.github/workflows/          GitHub Actionsワークフロー
public/data/                入力CSV・設定
scripts/generate-sample.mjs 付属ブラウザデータ生成
scripts/prepare-data.mjs    検証・正規化・ランキング集計
src/generated/              生成済み動画データ
src/GeoBaseVideo.tsx        地図・ランキング・侵食演出を含む動画本体
```

## 品質確認

```bash
npm run check
```

CSV生成・検証・正規化・集計とTypeScriptの型チェックを実行します。

## 現在の制約

- 歴史的な国境変化には未対応です。
- 音声、BGM、自動ナレーションは未実装です。
- 付属ブラウザデータは動画試作用の年次代表データであり、一次統計CSVそのものではありません。
- 月表示は年次代表値間の補間であり、実測月次値ではありません。
