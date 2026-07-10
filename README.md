# Geo Base

Geo Baseは、国別・年代別のCSVデータから、世界地図上の勢力変化を陣取り合戦のように見せる縦型動画を自動生成するRemotionベースのエンジンです。

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

## セットアップ

```bash
npm install
npm run studio
```

Remotion Studioが起動し、`GeoBase`コンポジションをプレビューできます。

## 動画出力

```bash
npm run render
```

出力先は`out/geobase.mp4`です。

## データ差し替え

次の4ファイルを編集します。

- `public/data/sample.csv`：時系列データ
- `public/data/entities.json`：勢力名、色、同率時優先順位
- `public/data/config.json`：動画タイトル、期間、速度、解像度など
- `public/data/events.csv`：任意のイベント表示

編集後、以下を実行します。

```bash
npm run prepare:data
npm run render
```

### CSV必須列

```csv
year,country_code,country_name,entity,value
2007,JPN,Japan,Apple,35.0
2007,JPN,Japan,Sony,40.0
```

- `country_code`はISO 3166-1 alpha-3を使用します。
- 同一の年・国で`value`が最大の勢力が勝者です。
- データのない国はグレー表示され、前年値は自動継承しません。

## ディレクトリ構成

```text
public/data/              入力CSV・設定
scripts/prepare-data.mjs  検証・勝者判定・ランキング集計
src/generated/            生成済み動画データ
src/components/           地図・ランキング・演出
src/lib/                  タイムライン・色補間
src/GeoBaseVideo.tsx      動画本体
```

## 品質確認

```bash
npm run check
```

CSVの検証・集計とTypeScriptの型チェックを実行します。

## 現在の制約

- 世界地図はNatural Earth由来の`world-atlas`境界データを利用します。
- 歴史的な国境変化には未対応です。
- 音声、BGM、自動ナレーション、複雑な侵食表現はMVP対象外です。
