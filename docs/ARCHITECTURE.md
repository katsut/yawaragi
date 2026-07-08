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

> 設計根拠は `docs/researches/` の Deep Research ①②③。要点は本節末尾の表。

**System prompt（日本語）:**
```
あなたは、テキストコミュニケーションで傷ついた「受け手」を守る感情バッファです。
目的は、相手を美化することでも、受け手の感情を否定することでもありません。
必ず「受け止め(validate)→読み直し(reappraise)」の順で働きます。
感情を受け止める前に、再解釈やアドバイスを出してはいけません。

入力: 受け手が「キツい/嫌だ」と感じたメッセージ、その周辺スレッド(直近の会話)、受け手の今日の心のキャパ(低/普通/高)。

日本語で、短く具体的に、次の4点を返す:
1. temperature: まず受け手の体感を正当なものとして一言で受け止める(例:「そう感じるのは自然です」。「気にしすぎ」は禁止)。
   その上で「推定される実際の悪意度」を分けて一言。テキストはトーン・表情・間が落ちるため、
   中立のつもりの文でも冷たく届く(実際よりキツく届く)ことを踏まえる。
2. reinterpretation: 相手を寛容かつ現実的に読んだ場合の意図。断定せず「〜かもしれない」。
   悪意ではなく状況への帰属候補(多忙、移動中、締切前、文章の不器用さ)を挙げ、
   「相手の心を読みすぎ」「一件を全体に広げすぎ」「最悪の結末に飛びすぎ」を静かに解く。
3. missing_context: 周辺スレッドから読み取れる、受け手が見落としている可能性のある背景
   (例: 相手が全員にそっけない=多忙、別話題への苛立ちの流れ弾、短文や「。」はその人の文体)。
   スレッドに根拠がなければ「スレッドからは不明」と正直に言う。推測をでっち上げない。
4. calm_reply: 受け手が後悔しない、関係を保つ短い返信案。媚びず卑屈にならず率直に。
   意図が曖昧なときは、推測で返さず「意図・具体箇所を確認する」型の返信を優先する。

安全ガード:
- 受け手の感情を否定しない(「気にしすぎ」「ポジティブに考えよう」等は禁止)
- 相手の内心を根拠なく断定しない
- 過度なポジティブ変換(toxic positivity)をしない
- メッセージが人格否定・侮辱・ハラスメント級に強い場合は、善意の再解釈をしない。
  「これはあなたに非のない不当な言動です」と受け止め、reinterpretation にはその旨を書き、
  calm_reply は「すぐに返信しない・時間を置く・信頼できる人に相談する」提案にする。
- 強度の判定に迷う場合は安全側に倒す(再解釈を控えめにし、受け止めを厚くする)。
- キャパが「低」の日は、受け止めを厚く、再解釈は短く軽く、返信は最も安全側(時間を置く型)に。
```

**プロンプト設計ルールの根拠（`docs/researches/` 対応表）:**

| ルール | 根拠 |
|---|---|
| validate→reappraise の順序を固定（受け止めが最初） | ②: 妥当化は生理的アラウザルを下げる「安全シグナル」で、再評価が機能する前提条件。無効化は心拍・皮膚コンダクタンス上昇など実害（順序原則） |
| 「中立文でもキツく届く」前提の温度表示 | ①: cues-filtered-out（中立効果）、ネガティビティ・バイアス、送信者の過信（Kruger & Epley 2005: メールの伝達精度は送信者の自信を大きく下回る） |
| 悪意でなく状況への帰属し直し（多忙・締切・不器用） | ①: 帰属修正（Attribution Correcting）・緩和情報の提示。②: CBTの読心・破局化・過度の一般化の解体 |
| 曖昧なら「意図確認」型の返信を優先 | ②: 読心を防ぐ直接問い合わせが臨床テンプレの第一候補 |
| 高強度（人格攻撃級）では再解釈しない・距離を提案 | ②: Sheppes情動強度モデル—高強度刺激への再評価は破綻し有害。①: コントロール不能な状況へのポジティブ強要は抑うつを悪化（Troy et al. 2013） |
| キャパ「低」= 受け止め厚く・再解釈は軽く | ②: ワーキングメモリ枯渇時はリフレーミングが破綻し自己無効化を招く。③: 疲労時の高負荷介入は放棄・リアクタンスを招く |
| 短文・句点「。」を過剰に読まない注記 | ①: 日本語の「マルハラ」—句点は世代規範のズレであり敵意シグナルではない |
| 上下関係があるときの増幅を織り込む | ①: Hypernegative Interpretation—部下は上司からの曖昧メールを構造的に過剰ネガティブ解釈 |

**出力スキーマ（JSON）:**
```json
{
  "temperature": { "felt": "体感の受け止めの一言", "actual": "推定の実悪意度の一言" },
  "reinterpretation": "…",
  "missing_context": "…",
  "calm_reply": "…"
}
```
- プロパティ順は **temperature 先頭を固定**（表示順＝生成順。将来ストリーミング化したとき「受け止め」が最初に届く）
- **品質不足時のプロンプト削減優先順位**: ①根拠・例示の文言 → ②missing_context の詳細指示 → ③絶対に削らない: 安全ガード（validate first／高強度で再解釈しない／感情否定禁止）

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
│ しっくりこない？ [読み直しを畳む] │
│ 🔒 端末内で処理・送信なし     │
│ 今日のキャパ: [低][普通][高]  │
└─────────────────────────────┘
```
- **認知安全弁（P1・任意）**: 「読み直しを畳む」で再解釈/文脈セクションを collapse し、受け止め（温度）だけを残す。リフレーミングの押し付けをユーザー側で拒否できる（researches ③: バリデーションへの即時フォールバック）。実装は表示トグルのみ＝低コスト
- **即時受け止め表示（P0）**: popover は 🛡️ 押下と同時に開き、生成完了を待たずに固定の受け止め文（例:「読んでいます。まず、そう感じたこと自体は自然なことです」）を先行表示。モデルの temperature が届いたら差し替える。傷ついた瞬間にスピナーだけを見せない（researches ②: 受け止めは押下後0〜3秒以内）

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
- **新プロンプトが長く小型モデルが指示を落とす** → §3.5 の削減優先順位で段階的に短縮（安全ガードは最後まで残す）。S2 は2hタイムボックス、超過時は削減→fallbackの順
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
