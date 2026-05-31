/**
 * レビューゲート付きパイプライン用の型（docs/SPEC-review-pipeline.md §3・§5 に準拠）。
 * 値は実装・DB・ログでこの4つのみ使う。
 */
export type PipelineState =
  | "pending_review"
  | "sending"
  | "completed"
  | "failed_rollback";

/** 経験種別（v3スキーマ） */
export type ExperienceType = "failure" | "success" | "decision" | "insight";

/** 加工済み1件の本文（API の StructuredKnowledge と同じ形） */
export type StructuredKnowledgeBody = {
  topic: string;
  tags: string[];
  summary: string;
  /** 空欄可：経験種別によって自然に埋まる/空になる */
  before?: string;
  /** 空欄可：同上 */
  after?: string;
  /** 廃止（既存レコード互換のため残す・新規書き込みなし） */
  actionPlan?: { who: string; what: string; how: string }[];
  /** 廃止（同上） */
  logic?: string[];
  /** v3: 何を学んだか（核心・1〜3文） */
  insight?: string;
  /** v3: なぜそうなったか・背景（空欄可） */
  cause?: string;
  /** v3: 一般化できる原則・教訓 */
  principle?: string;
};

/**
 * 処理が終わるまでの下書き（原文・検閲後文案・状態など）。
 * 完了したものは加工済み用ストアへ移し、このストアからは消す想定。
 */
export type DraftRecord = {
  id: string;
  state: PipelineState;
  /** 取り込んだそのままのテキスト（仕様では completed まで保持） */
  originalText: string;
  /** クラウドに送ってよいと判断したあとのテキスト */
  reviewedText: string;
  createdAt: string;
  updatedAt: string;
  sourceSessionId?: string;
  /** 類似取り込み判定用。原文そのものではなく指紋（§5.2・§11.4） */
  sourceTextFingerprint?: string;
  /** failed_rollback 後など、直近の失敗表示用（§3.3） */
  lastErrorCode?: string;
  lastErrorMessage?: string;
  failedAt?: string;
  /** redactor マイクロサービスで発行されたセッション ID（ライフサイクル管理用） */
  redactorSessionId?: string;
};

/**
 * 一覧の主となる「加工済み」1件（原文本文は持たない）。
 */
export type CompletedKnowledgeRecord = StructuredKnowledgeBody & {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** 元ドラフト ID（完了後も監査用に保持） */
  sourceSessionId?: string;
  sourceTextFingerprint?: string;
  /** redactor セッション ID（final_text アーカイブとの紐付け） */
  redactorSessionId?: string;
  /** v3: 経験種別（承認ボタン4分割で選択） */
  experienceType?: ExperienceType;
};
