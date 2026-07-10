# Geo Base

Geo Baseは、国別・時系列データから、世界地図上の勢力変化を連続アニメーションとして描画するRemotionベースの縦型動画生成エンジンです。

## 現在の動画：世界の生成AI勢力図

2024年1月から2026年6月まで、主要48か国のAIチャットボット利用シェアを日本中心の世界地図で表示します。

- ChatGPT、Gemini、Perplexity、Claude、Copilot、DeepSeekを比較
- 国を単色で塗らず、国内シェアを複数色の割合で表示
- 月次スナップショット間を連続補間し、地図の色境界を滑らかに変化
- 日本中心の世界地図と日本列島の拡大窓を常設
- 主要48か国の平均利用シェアランキングを連続表示
- 日本国内の上位3サービスと構成比を常時表示
- DeepSeekの急伸、Gemini・Perplexity・Claude・Copilotの追撃をイベント表示
- 最終画面に学び、コメントテーマ、次回候補を表示
- 動画内の言語は日本語を基本とする
- `world-atlas`の50m境界データを使用

### データ上の注意

2026年6月の世界、日本、米国、中国、インド、韓国の構成は、StatCounter Global Statsの公開値を基準点として使用しています。

付属CSVは、公開値と公開トレンドを基に動画制作向けに再構成した月次データです。StatCounterから取得した全期間・全対象国の生CSVそのものではありません。調査・報道用途では、公開前に一次データへ差し替えてください。

## 主な機能

- `YYYY-MM`形式の月次データを検証
- ISO 3166-1 alpha-3国コードと数値コードを検証
- 同一期間・同一国内の各勢力値を100%へ正規化
- 各国内の複数勢力シェアを保持
- 主要国の平均シェアランキングを算出
- 前月からの首位変化を検出
- 日本中心の世界地図と日本拡大図を生成
- 複数色グラデーションと有機的な境界変形を描画
- 月次スナップショット間を連続補間
- 学びとコメント促進文を設定ファイルから表示
- 1080×1920 / H.264 MP4を生成

## 出力ファイル名

```text
GeoBase_<動画タイトル>_<開始期間>-<終了期間>.mp4
```

現在の設定では次のファイル名になります。

```text
GeoBase_世界の生成AI勢力図_2024-01-2026-06.mp4
```

## GitHub Actionsで動画を生成する

### マージ後の自動生成

Pull Requestを`main`へマージすると、`main`へのpushを検知してGitHub Actionsが自動的に起動します。

1. CSV生成・データ検証・TypeScript型検査
2. 日本語フォントのインストール
3. Remotionブラウザの準備
4. MP4レンダリング
5. Artifactへのアップロード

実行完了後、対象のWorkflow Runを開き、`Artifacts`から`GeoBase-video-実行番号`をダウンロードしてください。ZIP内に正式なファイル名のMP4が入っています。

### 手動で再生成する

同じ動画を再生成したい場合は、次の手順でも実行できます。

1. GitHubリポジトリ上部の`Actions`を開く
2. `Render Geo Base Video`を選択する
3. `Run workflow`を押す
4. 実行完了後、`Artifacts`から動画をダウンロードする

Pull Request作成時は、無駄なレンダリングを避けるため検証だけを実行します。Artifactの保存期間は14日です。

## ローカルセットアップ

```bash
npm install
npm run studio
```

ローカル環境でもNoto Sans CJK JP、Noto Sans JP、游ゴシックなどの日本語フォントを利用できる状態を推奨します。

## 動画出力

```bash
npm run render
```

出力先は`out/GeoBase_<動画タイトル>_<開始期間>-<終了期間>.mp4`です。

## 付属データを再生成する

```bash
npm run generate:sample
```

生成先は`public/data/sample.csv`です。新規のGitHub Actions環境ではファイルが存在しない場合に自動生成されます。

## データ差し替え

編集対象は次の4ファイルです。

- `public/data/sample.csv`：月次シェアデータ
- `public/data/entities.json`：勢力名、色、優先順位
- `public/data/config.json`：タイトル、期間、速度、学び、コメントテーマなど
- `public/data/events.csv`：重要月に表示するイベント

### CSV必須列

```csv
period,country_code,country_name,numeric_code,entity,value
2024-01,JPN,Japan,392,ChatGPT,86.0
2024-01,JPN,Japan,392,Google Gemini,5.0
2024-01,JPN,Japan,392,Microsoft Copilot,5.0
```

- `period`は`YYYY-MM`形式です。
- `country_code`はISO 3166-1 alpha-3を使用します。
- `numeric_code`は世界地図との対応に使うISO数値コードです。
- `value`は同一期間・同一国内で自動的に100%へ正規化されます。
- データのない国はグレー表示されます。

## ディレクトリ構成

```text
.github/workflows/           GitHub Actionsワークフロー
public/data/                 入力CSV・設定
scripts/generate-sample.mjs  付属生成AIデータ生成
scripts/prepare-data.mjs     月次検証・正規化・ランキング集計
scripts/render-video.mjs     動画ファイル名生成・Remotion実行
src/generated/               生成済み動画データ
src/GeoBaseVideoV3.tsx       汎用地図・ランキング・日本拡大・最終画面
```

## 品質確認

```bash
npm run check
```

CSV生成・検証・正規化・集計とTypeScriptの型チェックを実行します。

## 現在の制約

- 音声、BGM、自動ナレーションは未実装です。
- 歴史的な国境変化には未対応です。
- 付属データは動画試作用の再構成データであり、StatCounterの全生CSVではありません。
