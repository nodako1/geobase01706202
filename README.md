# Geo Base

Geo Baseは、国別・年代別のCSVデータから、世界地図上の勢力変化を陣取り合戦のように見せる縦型動画を自動生成するRemotionベースのエンジンです。

## 現在の動画：世界ブラウザ勢力図

2009年から2025年まで、主要48か国で利用率1位となったブラウザを地図上に表示します。

- Internet Explorer帝国からChrome一強時代までを約26秒で表示
- Firefox、Opera Mini、UC Browser、Safariによる地域別の勢力変化
- 日本を常時マークし、国内首位ブラウザと代表値を表示
- 首位交代、獲得国数、イベント、最終比較を自動表示
- 冒頭の問いと最後の二択でYouTube Shorts向けに構成
- `world-atlas`の50m境界データを使用し、海岸線と島国の形状を高精細化

### データ上の注意

付属データはStatCounter Global Statsの公開トレンドを基に、主要48か国の年次代表値として再構成した動画制作向けデータです。厳密な調査・報道用途では、公開前に対象年月・対象国のStatCounter等の一次データへ差し替えてください。動画内にも出典とデータ条件を表示します。

## MVPでできること

- ISO 3166-1 alpha-3国コード付きCSVを検証
- 年・国ごとの最大値を勝者として算出
- 完全同率時は勢力設定の`priority`で決定
- 世界地図を勝者の色で塗り分け
- 前年から変化した国を発光表示
- 支配国数ランキングと前年比を表示
- 首位交代・イベントテキストを表示
- 欠損国をグレー表示
- 1080×1920 / H.264 MP4を生成
- タイトル・色・速度・FPS等を外部設定化

## GitHub Actionsで動画を生成する

ローカル環境を用意しなくても、GitHub ActionsからMP4を生成してダウンロードできます。

1. GitHubリポジトリ上部の`Actions`を開く
2. 左側から`Render Geo Base Video`を選択する
3. `Run workflow`を押す
4. 実行が完了したら対象のWorkflow Runを開く
5. 画面下部の`Artifacts`から`geobase-video-実行番号`をダウンロードする
6. ZIPを展開し、`geobase.mp4`を取り出す

Artifactの保存期間は14日です。ワークフローは手動実行時のみ起動します。

## ローカルセットアップ

```bash
npm install
npm run studio
```

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

- `public/data/sample.csv`：時系列データ
- `public/data/entities.json`：勢力名、色、同率時優先順位
- `public/data/config.json`：動画タイトル、期間、速度、解像度、問い、出典など
- `public/data/events.csv`：重要年に表示するイベント

### CSV必須列

```csv
year,country_code,country_name,numeric_code,entity,value
2009,JPN,Japan,392,Internet Explorer,61.0
2009,JPN,Japan,392,Firefox,18.0
```

- `country_code`はISO 3166-1 alpha-3を使用します。
- `numeric_code`は世界地図との対応に使用するISO数値コードです。
- 同一の年・国で`value`が最大の勢力が勝者です。
- データのない国はグレー表示され、前年値は自動継承しません。

## ディレクトリ構成

```text
.github/workflows/         GitHub Actionsワークフロー
public/data/               入力CSV・設定
scripts/generate-sample.mjs 付属ブラウザデータ生成
scripts/prepare-data.mjs   検証・勝者判定・ランキング集計
src/generated/             生成済み動画データ
src/GeoBaseVideo.tsx       地図・ランキング・演出を含む動画本体
```

## 品質確認

```bash
npm run check
```

CSV生成・検証・集計とTypeScriptの型チェックを実行します。

## 現在の制約

- 歴史的な国境変化には未対応です。
- 音声、BGM、自動ナレーションは未実装です。
- 付属ブラウザデータは動画試作用の年次代表データであり、一次統計CSVそのものではありません。
