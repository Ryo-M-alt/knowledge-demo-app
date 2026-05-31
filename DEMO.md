# knowledge-demo-app — デモ用モックアプリ

## このフォルダの目的

`knowledge-legacy-app`（本体）をAI開発スクールの発表用にVercelへデプロイするため、
見た目と動作だけを再現したモック版として作成したプロジェクト。

- 実際のナレッジデータは一切含まない
- ローカルAI（Whisper）・SQLite・Redactorサービスへの依存を完全に除去
- APIはすべてダミーデータを返すモックハンドラに置き換え済み

---

## 開発サーバーの起動

本体（port 3000）と競合しないようにport 3001を使用。

```bash
npm install
npm run dev   # → http://localhost:3001
```

---

## ファイル構成と仕分け方針

### そのままコピーしたファイル（変更なし）

| ファイル/フォルダ | 内容 |
|---|---|
| `app/page.tsx` | `"use client"` のみ。APIをfetchするだけでDB・AI依存なし |
| `app/layout.tsx` | Googleフォント読み込みのみ |
| `app/globals.css` | スタイル |
| `app/favicon.ico` | アイコン |
| `app/components/` | 8ファイル。UI描画のみ |
| `app/utils/text-fingerprint.ts` | 純粋な計算関数 |
| `public/` | 静的アセット |
| `next.config.ts` / `tsconfig.json` 等 | ビルド設定 |
| `lib/knowledge-pipeline/types.ts` | 型定義のみ（ロジックなし） |

### 新規作成したファイル（モック実装）

| ファイル/フォルダ | 内容 |
|---|---|
| `lib/mock-data.ts` | 偽ナレッジ5件・偽ドラフト1件・タグ一覧 |
| `lib/knowledge-pipeline/index.ts` | 型エクスポートのみ（関数エクスポートなし） |
| `lib/knowledge-pipeline/context-types.ts` | `ContextBlock`・`ContextPreset` 型定義 |
| `lib/knowledge-pipeline/redactor-types.ts` | `RedactorEntityDTO` 等の型定義 |
| `app/api/knowledge/route.ts` | モックナレッジ一覧・フィルター |
| `app/api/knowledge/[id]/route.ts` | モック詳細・更新・削除 |
| `app/api/knowledge/search/route.ts` | モック検索 |
| `app/api/search/route.ts` | モック全文検索 |
| `app/api/drafts/route.ts` | モックドラフト一覧・作成 |
| `app/api/drafts/[id]/route.ts` | モックドラフト取得・更新・削除 |
| `app/api/process/route.ts` | ローカル検閲→プレビュー・承認→完了を偽応答 |
| `app/api/upload/route.ts` | `"SUCCESS"` を返すだけ |
| `app/api/ingest/route.ts` | `draft_created` を返すだけ |
| `app/api/tags/route.ts` | モックタグ一覧 |
| `app/api/context-presets/route.ts` | モックコンテキスト設定 |
| `app/api/archive/[sessionId]/route.ts` | 常に404を返す（Redactor機能なし） |
| `package.json` | `@google/generative-ai` を除いた依存構成 |

### 本体から持ち込まなかったもの（除外理由）

| ファイル/フォルダ | 除外理由 |
|---|---|
| `lib/knowledge-pipeline/knowledge-db.ts` | `node:sqlite`（Node.js組み込みSQLite）依存 |
| `lib/knowledge-pipeline/redactor-client.ts` | `localhost:8000`（Redactorサービス）依存 |
| `lib/knowledge-pipeline/draft-store.ts` 等 | ローカルファイルシステム依存 |
| `data/` | 実ナレッジデータ。絶対に含めない |
| `scripts/` / `*.plist` / `logs/` | Mac専用の起動スクリプト |
| `.env.local` | 実APIキー |

---

## APIレスポンス形式（重要）

`page.tsx` が期待するレスポンス形式は配列直接ではなくオブジェクト包み。
モック作成時に形式を誤り修正した箇所。

| エンドポイント | 正しい形式 |
|---|---|
| `GET /api/knowledge` | `{ items: CompletedKnowledgeRecord[] }` |
| `GET /api/drafts` | `{ drafts: DraftRecord[] }` |
| `GET /api/search` | `{ knowledge: CompletedKnowledgeRecord[] }` |

---

## 本体との依存関係の差分

| 依存 | 本体 | デモ |
|---|---|---|
| SQLite | `node:sqlite`（Node.js組み込み） | なし（静的JSONデータ） |
| Whisper | ローカルバイナリ + モデルファイル | なし（ダミー応答） |
| Gemini API | `@google/generative-ai` | なし（削除済み） |
| Redactor | `localhost:8000` への内部HTTP | なし（404返却） |
| ファイルDB | `data/*.json` への読み書き | なし（メモリ上の定数） |

---

## 動作確認済みの機能（2026-05-31）

- ナレッジ一覧の表示（5件のモックデータ）
- 種別フィルター（失敗・反省 / 成功 / 気づき / 意思決定）
- キーワード検索（検索ワードのハイライト含む）
- ナレッジ詳細の右パネル表示
- 処理を追加モーダルの表示
- コンソールエラー：ゼロ件

---

## 次のステップ

1. Vercelへのデプロイ
   - GitHubリポジトリ作成 → Vercel連携
   - 環境変数の設定不要（モックのためAPIキー不要）
