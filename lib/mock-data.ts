import type { CompletedKnowledgeRecord, DraftRecord } from "./knowledge-pipeline";
import type { ContextBlock, ContextPreset } from "./knowledge-pipeline";

export const MOCK_KNOWLEDGE: CompletedKnowledgeRecord[] = [
  {
    id: "demo-001",
    experienceType: "failure",
    topic: "要件定義を省略して実装を始めた結果、手戻りが発生した",
    tags: ["プロジェクト管理", "要件定義", "反省"],
    summary: "ステークホルダーとの合意なしに実装を進めたため、完成後に仕様変更が発生し工数が2倍になった。",
    before: "「とりあえず作れば方向性が見えるだろう」と考え、ドキュメントを省略して実装を開始した。",
    after: "途中で根本的な設計変更を求められ、ほぼゼロから作り直す羽目になった。",
    insight: "曖昧なまま進めるコストは、丁寧に合意を取るコストより常に大きい。",
    cause: "初期の「早く動かしたい」という焦りが判断を歪めた。",
    principle: "実装前にWHYとWHATを文書化し、関係者の署名（レビュー承認）を得る。",
    createdAt: "2026-04-10T09:00:00.000Z",
    updatedAt: "2026-04-10T09:00:00.000Z",
  },
  {
    id: "demo-002",
    experienceType: "success",
    topic: "週次の振り返りを習慣化したことで、問題の早期発見ができるようになった",
    tags: ["習慣", "振り返り", "チーム"],
    summary: "毎週金曜15分のKPT振り返りを3ヶ月継続した結果、チームの課題解決速度が上がった。",
    before: "問題が大きくなるまで誰も声を上げなかった。",
    after: "小さな違和感を週次で共有する文化ができ、炎上案件がゼロになった。",
    insight: "振り返りは問題が起きてからではなく、問題が起きる前に行うものだ。",
    cause: "継続できたのは15分という短さと、KPTという明確なフォーマットのおかげ。",
    principle: "習慣化のコツは「短く・型を決める・毎回同じ時間に行う」の3つ。",
    createdAt: "2026-04-22T14:30:00.000Z",
    updatedAt: "2026-04-22T14:30:00.000Z",
  },
  {
    id: "demo-003",
    experienceType: "insight",
    topic: "ドキュメントは書く時より読む時のために存在する",
    tags: ["ドキュメント", "チーム開発", "設計"],
    summary: "6ヶ月前に自分が書いたドキュメントを読んで意味が分からなかった体験から、読み手視点の重要性を実感した。",
    insight: "書く時点での「明らか」は、半年後には全く自明でなくなる。コンテキストは常に言語化する必要がある。",
    cause: "当時は「自分しか読まない」と思っていた。",
    principle: "ドキュメントは「未来の自分か、チームの誰かが困ったとき」に読まれる前提で書く。",
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z",
  },
  {
    id: "demo-004",
    experienceType: "decision",
    topic: "技術的負債を返済するためにリファクタリングスプリントを設けた",
    tags: ["技術的負債", "アーキテクチャ", "意思決定"],
    summary: "半年間の機能開発で積み上がった負債に対し、2週間のリファクタリングスプリントを設けることをステークホルダーに提案・承認を得た。",
    before: "新機能の追加のたびに既存コードの影響範囲が読めなくなり、バグが頻発していた。",
    after: "テストカバレッジが40%から80%に向上し、デプロイ頻度が週1回から毎日に改善された。",
    insight: "技術的負債の返済を「ビジネス言語」で説明できれば、ステークホルダーの承認を得やすい。",
    cause: "「バグが減る」より「リリース速度が2倍になる」の方が伝わった。",
    principle: "技術判断をビジネスインパクトに翻訳する能力が、エンジニアの提案力を決める。",
    createdAt: "2026-05-15T11:00:00.000Z",
    updatedAt: "2026-05-15T11:00:00.000Z",
  },
  {
    id: "demo-005",
    experienceType: "failure",
    topic: "レビューを依頼するタイミングが遅すぎてフィードバックを活かせなかった",
    tags: ["コードレビュー", "コミュニケーション", "反省"],
    summary: "実装完了後にレビューを依頼したため、設計レベルの指摘を受けても修正コストが高く、形式的なレビューになってしまった。",
    before: "「完成してからレビューをもらう」という流れを当然だと思っていた。",
    after: "設計段階でのドラフトレビューを依頼するようにしたところ、手戻りが大幅に減った。",
    insight: "レビューは完成品の検査ではなく、方向性を揃えるための対話だ。",
    cause: "「完成前に見せるのは恥ずかしい」という心理的障壁が遅延を生んでいた。",
    principle: "WIP（作業中）のプルリクエストを早めに出す文化が、チームの速度を上げる。",
    createdAt: "2026-05-20T09:30:00.000Z",
    updatedAt: "2026-05-20T09:30:00.000Z",
  },
];

export const MOCK_DRAFTS: DraftRecord[] = [
  {
    id: "draft-demo-001",
    state: "pending_review",
    originalText: "今日のミーティングで気づいたこと。アジェンダなしの会議は結論が出ない。次回からは必ず事前にアジェンダを共有する。",
    reviewedText: "今日のミーティングで気づいたこと。アジェンダなしの会議は結論が出ない。次回からは必ず事前にアジェンダを共有する。",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

export const MOCK_TAGS: string[] = [
  "プロジェクト管理",
  "要件定義",
  "反省",
  "習慣",
  "振り返り",
  "チーム",
  "ドキュメント",
  "チーム開発",
  "設計",
  "技術的負債",
  "アーキテクチャ",
  "意思決定",
  "コードレビュー",
  "コミュニケーション",
];

export const MOCK_CONTEXT_BLOCKS: ContextBlock[] = [
  {
    id: "block-demo-001",
    text: "ソフトウェアエンジニア・実務3年",
    createdAt: "2026-03-01T00:00:00.000Z",
  },
];

export const MOCK_CONTEXT_PRESETS: ContextPreset[] = [
  {
    id: "preset-demo-001",
    name: "デフォルト",
    blockIds: ["block-demo-001"],
    isDefault: true,
    createdAt: "2026-03-01T00:00:00.000Z",
  },
];
