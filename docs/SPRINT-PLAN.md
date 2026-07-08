# Yawaragi — Sprint Plan（BMAD: ストーリー分解）

| | |
|---|---|
| Date | 2026-07-08 |
| フェーズ | Implementation（PRD v0.2 / ARCHITECTURE 反映済みを前提） |
| 運用 | ローカル Git のみ（GitHub Issue/PR 無し）。1ストーリー = 1コミット以上、英語 conventional commits |
| 実装方針 | 各ストーリーは subagent に受け入れ条件ごと委譲。メインは俯瞰・レビュー・コミット |

リスクの高い順（ARCHITECTURE §6）。S2（AI module）が最大リスクなので S1 直後に置く。

---

## S1. 拡張スキャフォールド＋🛡️注入 — 2pt
manifest（MV3・最小権限）と content script の骨組みを作り、対象ドメインで 🛡️ が出るところまで。

**受け入れ条件**
- [ ] `manifest.json` が ARCHITECTURE §3.1 と一致（permissions は `storage` のみ、host は slack/backlog のみ、リモートコードなし）
- [ ] `chrome://extensions` で load unpacked が警告なしで通る
- [ ] Slack web / Backlog のメッセージ hover で 🛡️ ボタンが表示される（クリックはまだ console.log で可）

## S2. AI module（Nano 接続＋プロンプト＋パース）— 3pt ★最大リスク
`LanguageModel.availability()` → session 作成 → ARCHITECTURE §3.5 の system prompt で4要素 JSON を得る。

**受け入れ条件**
- [ ] availability 判定と「利用不可時の丁寧な案内」がある（FR7）
- [ ] §3.5 の system prompt を使い、`{temperature{felt,actual}, reinterpretation, missing_context, calm_reply}` が返る
- [ ] `responseConstraint`（JSON schema）を試し、不可なら safeParse＋素朴パースの二段（§8）
- [ ] キャパ(低/普通/高)がプロンプトに反映される（FR6）
- [ ] 実行コンテキスト（content script / offscreen / service worker）を公式サンプルで確認し、動いた構成を ARCHITECTURE に追記
- [ ] テスト用キツいコメント（placeholder 名）で、安全ガード（validate が先・高強度で再解釈しない）が出力に効いていることを目視確認

## S3. DOM 抽出（Slack / Backlog 各1パターン）— 2pt
クリックした対象の本文・直近スレッド（〜5件）・送信者名を DOM から取る。汎用化しない。

**受け入れ条件**
- [ ] Slack web: デモで使うチャンネル/スレッド画面で `{targetText, thread, sender}` が取れる
- [ ] Backlog: デモで使う課題コメント画面で同上
- [ ] 外部送信ゼロ（fetch 等が存在しない。FR8）

## S4. Popover UI（shadow DOM・4出力＋コピー＋認知安全弁）— 3pt
§3.6 のレイアウト。CSS 衝突回避のため shadow DOM。

**受け入れ条件**
- [ ] 表示順固定: 温度（受け止めが先）→ 再解釈 → 文脈 → 返信ドラフト（validate→reappraise）
- [ ] [コピー] で calm_reply がクリップボードに入る（FR5）
- [ ] 「読み直しを畳む」で再解釈/文脈が collapse し受け止めだけ残る（認知安全弁・P1）
- [ ] 🔒「端末内で処理・送信なし」表示がある

## S5. キャパ toggle＋ローカル状態 — 1pt
**受け入れ条件**
- [ ] [低][普通][高] の切替が `chrome.storage.local` に保存され、次回生成に反映（FR6）
- [ ] dev 用 fallback トグル（デフォルト OFF・本番導線に出さない）（FR7）

## S6. 仕上げ＋デモリハーサル — 2pt
**受け入れ条件**
- [ ] デモ台本（ARCHITECTURE §7）どおり Slack→Backlog の流れが通しで動く
- [ ] テストデータは placeholder 名（Alice/Bob 等）のみ。実在の同僚メッセージ不使用
- [ ] ネットワークタブで外部送信ゼロを実演できる

---

## Definition of Done（全ストーリー共通）
- North Star 4原則（PRD §7）に反していない
- 実画面で動作確認済み（DOM セレクタはライブ調整）
- コミット済み（feat/fix/docs、英語、Co-Authored-By 無し）
