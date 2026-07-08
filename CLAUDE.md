# Yawaragi — プロジェクト指針（セッション引き継ぎ用）

Yawaragi（和らぎ）= テキストの"キツさ"から**受け手を守る**、オンデバイスの感情バッファ。Chrome拡張 / Slack web + Backlog コメント。
- 詳細要件: `PRD.md`
- 技術設計・実装計画・事前準備: `docs/ARCHITECTURE.md`
- 研究（未実施のDeep Research計画・Nano調査）: `docs/researches/`

## North Star（絶対に外さない）
1. **オンデバイス完結**。何も外部送信しない。バックエンドなし
2. **感情を否定しない**（validate, not invalidate）。toxic positivity 禁止
3. **人から遠ざけず、関係に"より良い状態で戻す"**道具
4. **受信側・手動トリガーのみ**

## 確定事項（蒸し返さない）
- 器: **Chrome拡張 MV3（純クライアント）**。AI: **オンデバイス Gemini Nano（Prompt API）**
- 対象: **Slack web / Backlog コメント**。**DOM注入方式**（Slack/Backlog の API トークン不要）
- Prompt API は**拡張向け stable（Chrome 138+）＝Web Store 公開可能**。`responseConstraint` でJSON出力可
- **StromaDB / バックエンド / チーム分析ダッシュボードは採らない**（別プロダクト or 倫理的に不採用）
- 出力4要素: 温度 / 善意の再解釈 / 落ちてる文脈 / 冷静な返信ドラフト。文脈は「画面のスレッドを読む(Tier0)＋今日のキャパ(Tier1)」

## 現在地
- 完了: PRD / ARCHITECTURE / research-plan / Nano事前準備（モデルDL・品質チェック済）/ **Deep Research 3本の実施と反映**（`docs/researches/01〜03`。①受信心理 ②臨床感情制御 ③介入安全性 → PRD §7/§12/§13/§15・ARCHITECTURE §3.5/§3.6 に反映済み）
- 未: **実装スキャフォールド**
- **次の一歩**: `docs/SPRINT-PLAN.md` のストーリー順に MV3 拡張を実装（このディレクトリ直下）。設計は `docs/ARCHITECTURE.md` §3〜6

## ビルド時の要検証
- 拡張内の Prompt API **実行コンテキスト**（content script / offscreen / service worker）→ 公式サンプルで確認（`docs/researches/chrome-prompt-api-gemini-nano.md`）
- Slack/Backlog の **DOMセレクタは実画面でライブ調整**（汎用化しない。デモの1パターン死守）

## 進め方
- **GitHub: `katsut/yawaragi`（public）**。main へ直接 push 運用（Issue/PR 無しでOK）。commit は英語・conventional・**Co-Authored-By 無し**・author 名は `katsut`（repo-local 設定済み）
- **LP**: `lp/index.html` → GitHub Pages https://katsut.github.io/yawaragi/ （`.github/workflows/pages.yml` が `lp/**` の push で自動デプロイ）
- 実装は **subagent に明確な受け入れ条件で委譲**、メインは俯瞰＋コミット
