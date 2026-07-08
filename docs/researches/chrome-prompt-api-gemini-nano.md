# Research: Chrome Prompt API / Gemini Nano（Yawaragi関連）

| | |
|---|---|
| Date | 2026-07-08 |
| Scope | オンデバイスAI（Yawaragiの心臓）。※GTM/StromaDB系のDeep Researchは別プロダクトの調査なので本プロジェクトには含めない |
| 出典 | developer.chrome.com/docs/ai/prompt-api ／ developer.chrome.com/docs/extensions/ai |

## 結論
- **Prompt API（Gemini Nano）は拡張機能向けに stable**（Chrome 138 で stable 化。公式ドキュメントは現行 148 を表示）。
- **origin trial トークン不要 → Chrome Web Store に公開できる**。※"まだ不可"は **Webページ版**の話（Web版 stable は Chrome 145–150 / 2026末〜2027 見込み）。
- 同世代で Summarizer / Translator も stable、Proofreader は OT。

## API サーフェス（確定）
- グローバル：**`LanguageModel`**
  - `LanguageModel.availability()` … 利用可否/モデル準備状態
  - `LanguageModel.create({ initialPrompts, ... })` … セッション生成
  - `LanguageModel.params()` … `{defaultTopK, maxTopK, defaultTemperature, maxTemperature}`（拡張のみ）
  - `session.prompt()` / `session.promptStreaming()` … 推論
- **構造化出力：対応**。`prompt()` / `promptStreaming()` に **`responseConstraint`（JSON Schema）** を渡せる
  → **4要素(温度/再解釈/文脈/返信)をJSONで安定取得できる**（`safeParse`の負担が減る）

## 動作要件（利用者側）
- OS：Windows 10/11 ／ macOS 13+ ／ Linux ／ ChromeOS(Platform 16389+ / Chromebook Plus)
- ストレージ：**空き 22GB 以上**（モデルは初回に別途DL）
- RAM/GPU：16GB RAM＋4コア、または VRAM 4GB 超
- ネットワーク：初回DLのみ（**利用時は Google へデータ送信なし**）

## 公開（Chrome Web Store）
- デベロッパー登録 **$5**（一度きり）／ **MV3 必須**（本設計は準拠）／ 審査
- **オンデバイス・最小権限・データ収集ゼロ → 審査が通りやすく、データ開示がクリーン**（掲載文の売りにもなる）
- 注意：公開できても利用側が上記要件を満たさないと Nano 不可 → **`availability()` 検知＋グレースフル案内は公開版の必須要件**

## 実装上の未確認（ビルド時に要検証）
- **拡張内のどの実行コンテキストで `LanguageModel` が使えるか**（content script isolated world / service worker / offscreen document）。公式ドキュメント本文では明示されず。
  → **公式サンプル「How to use the Prompt API in a Chrome extension」(GitHub) で確認**。content scriptで直接使えない場合は **offscreen document で実行＋content scriptからメッセージパス**に切替。
- `create()` の `initialPrompts`/`systemPrompt` 指定形式、`responseConstraint` の正確なスキーマ形式。

## 出典
- https://developer.chrome.com/docs/ai/prompt-api
- https://developer.chrome.com/docs/extensions/ai
