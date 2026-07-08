# Yawaragi（和らぎ）— 設計書 / 1日ソロ・ハッカソンMVP

> 作業用コードネーム。あとで自由に改名可。

## 0. 一言サマリ
テキストの"キツさ"から**受け手を守る**、オンデバイスの感情バッファ・ボタン。
Slack web / Backlog コメントに 🛡️ を注入。押すと、その場のスレッド文脈を読んで
**①温度 ②善意の再解釈 ③落ちてる文脈 ④冷静な返信ドラフト** を返す。
**全部この端末の中で完結（Gemini Nano）。サーバーなし＝漏れようがない。**

---

## 1. 設計のブレない芯（原則）
1. **オンデバイス完結**：メッセージも感情も端末外に一切出さない。バックエンドなし。
2. **感情を否定しない**（validate, not invalidate）。「気にしすぎ」等の toxic positivity 禁止。
3. **人から遠ざけない**。相手を理解し直し、関係に"より良い状態で戻す"道具。
4. **受信側・手動トリガーのみ**。自動スキャンしない。

---

## 2. アーキテクチャ（Pure Client / MV3）

```
[Slack web / Backlog のDOM]
        │ hover
        ▼
[content script] ── 🛡️注入 / 抽出(対象+スレッド+送信者) / popover(shadow DOM)描画
        │
        ▼
[AI module] ── Gemini Nano (Prompt API, on-device)
        │           └─(devトグル時のみ)→ クラウドfallback ※デモ保険
        ▼
[chrome.storage.local] ── 今日のキャパ / 設定
```

外部ネットワーク権限を**持たない**ことで「漏れようがない」を権限レベルで担保する。

---

## 3. コンポーネント

### 3.1 manifest.json（MV3・最小権限）
```jsonc
{
  "manifest_version": 3,
  "name": "Yawaragi",
  "version": "0.1.0",
  "permissions": ["storage"],
  "host_permissions": [
    "https://app.slack.com/*",
    "https://*.backlog.com/*",
    "https://*.backlog.jp/*"
  ],
  "content_scripts": [{
    "matches": [
      "https://app.slack.com/*",
      "https://*.backlog.com/*",
      "https://*.backlog.jp/*"
    ],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
  // 広域ネットワーク権限は付けない（=送信手段が存在しない）
}
```

### 3.2 content script
- message/comment 要素に **hover で 🛡️** を注入
- click → 抽出 `{ targetText, thread: [直近N件], sender }`
- AI module 呼び出し → popover 描画

### 3.3 DOM抽出（★要ライブ確認・脆い前提で最小に）
実DOMを inspect して調整すること。**動く1パターンに絞る**（汎用化しない）。
- **Slack web**: メッセージ `[data-qa="message_container"]` / 本文 `.c-message_kit__blocks` / 送信者 `[data-qa="message_sender_name"]`。thread = 対象の直近の兄弟 message_container を N件（例5件）
- **Backlog**: 課題コメント要素（`.comment` 等）/ 本文 / 著者ヘッダ。thread = 直近コメント N件
- 注意：セレクタは変わりうる。**デモで使う1画面が動けば良い**。

### 3.4 AI module（Gemini Nano / Prompt API）
```js
// ※API名・必要フラグは現行 Chrome ドキュメントで要確認（Prompt API は進化中）
const avail = await LanguageModel.availability();      // "available" 等
const session = await LanguageModel.create({
  initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
  // 可能なら JSON 出力制約 (responseConstraint / schema) を使う
});
const raw = await session.prompt(buildUserPrompt({ targetText, thread, capacity }));
const result = safeParse(raw);   // 壊れたら素朴パースにフォールバック
```
- **fallback**：Nano が無い/品質不足なら **devトグル時のみ** クラウドAPIへ（本番導線には出さない。デモ保険）

### 3.5 プロンプト（★最重要・品質はここで決まる）

**System prompt（日本語）:**
```
あなたは、テキストコミュニケーションで傷ついた「受け手」を守る感情バッファです。
目的は、相手を美化することでも、受け手の感情を否定することでもありません。
受け手の気持ちを正当なものとして受け止めた上で、
①感情的な誤爆を防ぎ ②相手を寛容かつ現実的に理解し直させ ③関係を守る次の一手を渡すことです。

入力: 受け手が「キツい/嫌だ」と感じたメッセージ、その周辺スレッド(直近の会話)、受け手の今日の心のキャパ(低/普通/高)。

日本語で、短く具体的に、次の4点を返す:
1. temperature: 「体感のキツさ」と「推定される実際の悪意度」を分けて一言。テキストはトーンが落ち、実際よりキツく届くことを踏まえる。
2. reinterpretation: 相手を寛容かつ現実的に読んだ場合の意図。断定せず「〜かもしれない」。
3. missing_context: 周辺スレッドから読み取れる、受け手が見落としている可能性のある背景(例: 相手が全員にそっけない=多忙、別話題への苛立ち)。根拠がなければ「スレッドからは不明」と正直に言う。
4. calm_reply: 受け手が後悔しない、関係を保つ短い返信案。媚びず卑屈にならず率直に。

禁止:
- 受け手の感情を否定しない(「気にしすぎ」等は禁止)
- 相手の内心を根拠なく断定しない
- 過度なポジティブ変換(toxic positivity)をしない
キャパが「低」の日は受け止めを厚く、返信はより安全側に。
```

**出力スキーマ（JSON）:**
```json
{
  "temperature": { "felt": "体感の一言", "actual": "推定の実悪意度の一言" },
  "reinterpretation": "…",
  "missing_context": "…",
  "calm_reply": "…"
}
```

### 3.6 Popover UI（shadow DOM・1画面）
CSS衝突回避のため **shadow DOM** で描画。
```
┌─────────────────────────────┐
│ 🛡️ Yawaragi                 │
│ 温度: 体感キツめ / 実際は低め │
│ ── 善意の再解釈 ──            │
│  〜かもしれません             │
│ ── 落ちてる文脈 ──            │
│  スレッドから: 全員にそっけない… │
│ ── 冷静な返信ドラフト ──      │
│  「…」            [コピー]    │
│ 🔒 端末内で処理・送信なし     │
│ 今日のキャパ: [低][普通][高]  │
└─────────────────────────────┘
```

### 3.7 ローカル状態（chrome.storage.local）
- `capacity`: "低" | "普通" | "高"（デフォルト"普通"）
- `settings.fallback`: bool（デフォルト false）

---

## 4. データフロー
`🛡️click → extract(target, thread, sender) → buildPrompt(+capacity) → Nano → parse → popover描画 → [コピー]で返信欄へ`

---

## 5. スコープ（死守）

**IN（今日作る）**
- 受信側・手動🛡️ボタン / Slack web + Backlog
- 4出力 popover（温度・再解釈・文脈・返信）
- オンデバイス Nano / Tier0スレッド文脈 / 今日のキャパ / 返信コピー

**OUT（今日は絶対やらない）**
- 送信側チェック / ネイティブSlackアプリ / バックエンド / 分析ダッシュボード
- 経時学習・相手別プロファイル / クロスデバイス / StromaDB / クラウド(dev以外) / 自動スキャン

---

## 6. 1日タスク順（リスクの高い順に前倒し）
1. **(前夜) Nano日本語チェック** — 実キツいコメント5件で品質/速度確認。Go/fallback判断
2. manifest + content script 骨組み、対象ドメインで🛡️注入まで（1–2h）
3. **AI module（Nano接続＋プロンプト＋パース）**（2h）← 一番のリスク、早めに
4. DOM抽出（対象＋スレッド＋送信者、1パターンに絞る）（1–2h）
5. Popover（shadow DOM）で4出力＋コピー（2h）
6. キャパtoggle＋local storage（0.5h）/ fallback toggle（0.5h）
7. 仕上げ＋デモ・リハーサル（1–2h）

---

## 7. デモ（3分・別紙台本）
掴み(対話が痩せる why) → 事故(冷たいBacklogコメント) → 🛡️で温度/再解釈/文脈/返信 →
north star(否定しない・関係に戻す) → プライバシー決め台詞(サーバー無し) → ビジョン締め。

---

## 8. リスクと保険
- **Nano日本語品質** → 前夜チェック / タスクを狭く / devトグルでクラウドfallback（器は不変）
- **DOM脆弱** → 汎用化しない。デモで使う1画面が動けばOK
- **CSS衝突** → shadow DOM で隔離
- **JSON崩れ** → safeParse＋素朴パースの二段

---

## 9. 事前準備（Pre-flight）チェックリスト

> **公開可否（2026-07 時点）**：Prompt API は **Chrome 138 以降、"拡張機能向けにはstable"**。
> OTトークン不要で **Chrome Web Store に公開できる**（"まだ不可"はWebページ版の話。Web版のstableは Chrome 145–150 / 2026末〜2027頃見込み）。
> ⇒ この設計は**デモ用ハックではなく、そのまま公開できる本物**。ただし利用側の環境依存あり（下記）。

### 🔴 必須・時間がかかる（前夜に必ず）
- [ ] **Chrome 138+（安定版でOK）**。※拡張向けは stable 化済み＝**Canary不要・OTトークン不要**
- [ ] （モデルDLのperf gateに引っかかる場合のみ）`chrome://flags/#optimization-guide-on-device-model` → "Enabled BypassPerfRequirement"
- [ ] **Gemini Nano モデルDL**：`chrome://components` → "Optimization Guide On Device Model" → Check for update（~2GB。DL完了まで時間がかかるので最優先）
- [ ] 利用側要件：OS = Win10/11・macOS 13+・Linux・ChromeOS ／ 一定のハード要件 ＋ 初回モデルDL
- [ ] ハード要件確認（GPU/RAM＋空きディスク十分か）。ダメなら fallback 前提に
- [ ] `LanguageModel.availability()` で "available" を確認 ＋ 実キツいコメント5件で品質チェック

### 🟡 fallback を使うなら（デモ保険・任意）
- [ ] **Gemini API キー**（aistudio.google.com、無料枠）を取得 → 拡張のオプションに dev-only で保持
      ※本番導線には出さない。オンデバイス purity を守る

### 🟢 不要（＝設計の勝ち）
- Slackアプリ / Slack OAuth / Slack トークン → **不要**（DOM注入なので）
- Backlog API トークン → **不要**（同上）
- Chrome Web Store 開発者アカウント → **不要**（demo は load unpacked）
- バックエンド / ホスティング / DB → **不要**

### 📝 準備（トークンではないが必要）
- [ ] **デモ用のテスト環境**：Slackワークスペース or Backlogスペースに、
      realistic な"キツいコメント"を数件（**実在の同僚メッセージは使わない**。
      Alice/Bob 等の placeholder 名で自作）
- [ ] Slack web / Backlog に**ログイン済み**の状態でテスト
