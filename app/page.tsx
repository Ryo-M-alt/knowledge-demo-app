"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { fingerprintTextBrowser } from "./utils/text-fingerprint";
import type { CompletedKnowledgeRecord, DraftRecord, ExperienceType } from "@/lib/knowledge-pipeline";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FileDown,
  FileText,
  Flag,
  Lightbulb,
  Sparkles,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { MaskHitDTO } from "./components/MaskReviewPanel";
import { KnowledgeDbModal } from "./components/KnowledgeDbModal";
import { ContextSettingsModal } from "./components/ContextSettingsModal";
import { LocalReviewModal } from "./components/LocalReviewModal";
import { DraftDetailModal } from "./components/DraftDetailModal";
import { DirectInputModal } from "./components/DirectInputModal";
import { NewTagReviewModal } from "./components/NewTagReviewModal";
import type { TagReviewItem } from "./components/NewTagReviewModal";
import type { RedactorEntityDTO } from "@/lib/knowledge-pipeline";

type ActionPlanItem = {
  who: string;
  what: string;
  how: string;
};

type PendingStructured = {
  topic: string;
  tags: string[];
  summary: string;
  before?: string;
  after?: string;
  insight?: string;
  cause?: string;
  principle?: string;
};

type TagReviewState = {
  origin: "local" | "draft_detail";
  draftId: string;
  experienceType: ExperienceType | undefined;
  reviewedText: string;
  pendingStructured: PendingStructured;
  tagReviewItems: TagReviewItem[];
  qwenUnavailable: boolean;
};

/** 初期表示・API 応答ともに共通するナレッジの形 */
type KnowledgeData = {
  id?: string;
  topic: string;
  tags: string[];
  summary: string;
  before?: string;
  after?: string;
  actionPlan?: ActionPlanItem[];
  logic?: string[];
};

/** 新JSONスキーマに沿ったモック */
const INITIAL_KNOWLEDGE: KnowledgeData = {
  topic: "調整の標準化（タイトル）",
  tags: ["DX", "進捗管理", "会議設計"],
  summary:
    "報告の入口を一本化し、定例は判断に時間を振り向ける。共有シートとダッシュボードで認識のズレを減らす。",
  before: "転記偏り",
  after: "ダッシュ共有",
  actionPlan: [
    { who: "課長補佐", what: "週次数字", how: "金曜17時までにフォーム入力" },
    { who: "情報担当", what: "原本資料", how: "共有ドライブへ格納しリンク記載" },
    { who: "室長", what: "論点一覧", how: "定例は判断のみ／確認は閲覧で済ます" },
    { who: "全係", what: "様式", how: "報告テンプレを1種類に統合" },
  ],
  logic: [
    "入力場所が複数だと抜け・食い違いが起きる",
    "会議前に同じ画面を見れば質問が減る",
    "締切を固定すると後工程が組める",
  ],
};

function buildSnippet(text: string, query: string, ctx = 50) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return { pre: text.slice(0, ctx * 2), match: "", post: "" };
  const start = Math.max(0, idx - ctx);
  const end = Math.min(text.length, idx + query.length + ctx);
  return {
    pre: (start > 0 ? "…" : "") + text.slice(start, idx),
    match: text.slice(idx, idx + query.length),
    post: text.slice(idx + query.length, end) + (end < text.length ? "…" : ""),
  };
}

type EditValues = {
  topic: string;
  tags: string;
  experienceType: ExperienceType | "";
  summary: string;
  cause: string;
  insight: string;
  principle: string;
  before: string;
  after: string;
  logic: string;
  actionPlan: { who: string; what: string; how: string }[];
};


/** 両タブ共通：タイトルとタグバッジ */
function KnowledgeTopicHeader({
  topic,
  tags,
  experienceType,
}: {
  topic: string;
  tags: readonly string[];
  experienceType?: string | null;
}) {
  return (
    <div className="pb-4 border-b border-gray-300">
      <h2 className="text-base font-bold leading-snug text-gray-900">
        {topic}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {experienceType && EXP_COLORS[experienceType] && (
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: EXP_COLORS[experienceType]!.lightBg, color: EXP_COLORS[experienceType]!.textDark }}
          >
            {EXPERIENCE_TYPE_LABELS[experienceType]}
          </span>
        )}
        {tags.map((tag, i) => (
          <span
            key={`${i}-${tag}`}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
          >
            {tag.startsWith("#") ? tag : `#${tag}`}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * before/after が「→」連結のときは先頭・末尾だけを取り、単語表示を維持する。
 */
function flowEndpoint(raw: string, end: "first" | "last"): string {
  const parts = raw
    .split(/\s*→\s*|\s*＞\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return raw.trim();
  return end === "first" ? parts[0]! : parts[parts.length - 1]!;
}

/** 月次レポート用：Before・After を短い語だけ矢印で結ぶ */
function ReportBeforeAfterMini({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const b = flowEndpoint(before, "first");
  const a = flowEndpoint(after, "last");

  return (
    <div
      className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6"
      aria-label="改善の対比（短文）"
    >
        <div className="flex flex-col items-start gap-1.5">
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-red-400">
            <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            BEFORE
          </span>
          <span className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-left text-sm font-semibold tracking-tight text-[#991B1B]">
            {b}
          </span>
        </div>

        <ArrowDown
          className="h-5 w-5 shrink-0 text-gray-400 sm:hidden"
          aria-hidden
        />
        <ArrowRight
          className="hidden h-6 w-6 shrink-0 text-gray-400 sm:mt-6 sm:block"
          aria-hidden
        />

        <div className="flex flex-col items-start gap-1.5">
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-green-500">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            AFTER
          </span>
          <span className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2.5 text-left text-sm font-semibold tracking-tight text-[#14532D]">
            {a}
          </span>
        </div>
    </div>
  );
}

const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  failure: "失敗・反省",
  success: "成功",
  decision: "意思決定",
  insight: "気づき",
};

/** 経験タグのブランドカラー（仕様固定） */
const EXP_COLORS: Record<string, { border: string; onBg: string; lightBg: string; textDark: string }> = {
  failure:  { border: "#D85A30", onBg: "#993C1D", lightBg: "#FAECE7", textDark: "#993C1D" },
  success:  { border: "#639922", onBg: "#3B6D11", lightBg: "#EAF3DE", textDark: "#3B6D11" },
  decision: { border: "#378ADD", onBg: "#185FA5", lightBg: "#E6F1FB", textDark: "#185FA5" },
  insight:  { border: "#7F77DD", onBg: "#534AB7", lightBg: "#EEEDFE", textDark: "#534AB7" },
};

function isKnowledgeData(value: unknown): value is KnowledgeData {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  if (typeof o.topic !== "string" || typeof o.summary !== "string") return false;
  if (o.summary.trim().length === 0) return false;
  if (!Array.isArray(o.tags)) return false;
  if (
    o.tags.length < 2 ||
    o.tags.length > 3 ||
    !o.tags.every(
      (t): t is string => typeof t === "string" && t.trim().length > 0,
    )
  ) {
    return false;
  }
  return true;
}

type PreviewResponse = {
  kind: "preview";
  draftId: string;
  reviewedText: string;
  state: string;
  rulesHitCount: number;
  maskHits: MaskHitDTO[];
  registeredProperNounCount: number;
  registeredUniformReplacementGroupCount: number;
  redactorEntities?: RedactorEntityDTO[];
  redactorSessionId?: string | null;
  redactorStage1MaskedText?: string | null;
};

function isMaskHitDTO(value: unknown): value is MaskHitDTO {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.startOffset === "number" &&
    typeof o.endOffset === "number" &&
    typeof o.ruleId === "string" &&
    typeof o.ruleLabelJa === "string" &&
    typeof o.matchedLength === "number"
  );
}

function isPreviewResponse(value: unknown): value is PreviewResponse {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  if (
    o.kind !== "preview" ||
    typeof o.draftId !== "string" ||
    typeof o.reviewedText !== "string" ||
    typeof o.rulesHitCount !== "number"
  ) {
    return false;
  }
  if (!Array.isArray(o.maskHits) || !o.maskHits.every(isMaskHitDTO)) {
    return false;
  }
  if (typeof o.registeredProperNounCount !== "number") {
    return false;
  }
  if (typeof o.registeredUniformReplacementGroupCount !== "number") {
    return false;
  }
  return true;
}

function pipelineStateLabelJa(d: DraftRecord): string {
  if (d.state === "pending_review" && d.lastErrorMessage) {
    return "確認待ち（差し戻し）";
  }
  switch (d.state) {
    case "pending_review":
      return "確認待ち";
    case "sending":
      return "送信中";
    case "failed_rollback":
      return "差し戻し";
    case "completed":
      return "完了";
    default:
      return d.state;
  }
}

export default function Home() {
  const [knowledge, setKnowledge] = useState<KnowledgeData>(INITIAL_KNOWLEDGE);
  const [loading, setLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  /** ローカル検閲後の下書きID（承認リクエストに付与） */
  const [draftId, setDraftId] = useState<string | null>(null);
  /** クラウドに送る前提の文案（必要ならユーザーが編集可） */
  const [reviewedEdit, setReviewedEdit] = useState("");
  /** ローカルルールで伏せた箇所の件数 */
  const [rulesHitCount, setRulesHitCount] = useState<number | null>(null);
  /** プレビュー成功時点の原文（差分・原文表示の基準） */
  const [previewOriginal, setPreviewOriginal] = useState("");
  const [maskHits, setMaskHits] = useState<MaskHitDTO[]>([]);
  const [redactorEntities, setRedactorEntities] = useState<RedactorEntityDTO[]>([]);
  const [redactorStage1MaskedText, setRedactorStage1MaskedText] = useState<string | null>(null);
  const [registeredProperNounCount, setRegisteredProperNounCount] = useState<
    number | null
  >(null);
  const [registeredUniformReplacementGroupCount, setRegisteredUniformReplacementGroupCount] =
    useState<number | null>(null);

  const [workspaceDrafts, setWorkspaceDrafts] = useState<DraftRecord[]>([]);
  const [workspaceKnowledge, setWorkspaceKnowledge] = useState<
    CompletedKnowledgeRecord[]
  >([]);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);
  const [detailKind, setDetailKind] = useState<"none" | "draft" | "knowledge">("none");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchKnowledge, setSearchKnowledge] = useState<CompletedKnowledgeRecord[]>([]);

  /** 原文指紋が他の下書き／加工済みと一致するときの確認（仕様 11.4 相当） */
  const [similarityOpen, setSimilarityOpen] = useState(false);
  const [similarityDrafts, setSimilarityDrafts] = useState<DraftRecord[]>([]);
  const [similarityKnowledge, setSimilarityKnowledge] = useState<
    CompletedKnowledgeRecord[]
  >([]);

  const [deleteDraftTarget, setDeleteDraftTarget] = useState<string | null>(null);
  const [deleteKnowledgeTarget, setDeleteKnowledgeTarget] = useState<string | null>(null);
  const [deletingKnowledge, setDeletingKnowledge] = useState(false);
  const [deleteKnowledgeError, setDeleteKnowledgeError] = useState<string | null>(null);

  const [editingKnowledge, setEditingKnowledge] = useState(false);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [contextSettingsOpen, setContextSettingsOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewApproving, setReviewApproving] = useState(false);
  const [reviewApproveStep, setReviewApproveStep] = useState<string | null>(null);
  const [tagReviewState, setTagReviewState] = useState<TagReviewState | null>(null);

  const [checkedDraftIds, setCheckedDraftIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDraftConfirm, setBulkDeleteDraftConfirm] = useState(false);
  const [bulkDeletingDrafts, setBulkDeletingDrafts] = useState(false);
  const [draftEditMode, setDraftEditMode] = useState(false);
  const [exitingDraftIds, setExitingDraftIds] = useState<Set<string>>(new Set());
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [checkedKnowledgeIds, setCheckedKnowledgeIds] = useState<Set<string>>(new Set());
  const [bulkDeleteKnowledgeConfirm, setBulkDeleteKnowledgeConfirm] = useState(false);
  const [bulkDeletingKnowledge, setBulkDeletingKnowledge] = useState(false);
  const [tagCloudOpen, setTagCloudOpen] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeExperienceTypes, setActiveExperienceTypes] = useState<Set<ExperienceType>>(new Set());
  const [hoveredExpType, setHoveredExpType] = useState<string | null>(null);

  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [directInputOpen, setDirectInputOpen] = useState(false);
  const [draftDetailDraft, setDraftDetailDraft] = useState<DraftRecord | null>(null);
  const [pendingReviewText, setPendingReviewText] = useState("");

  const refreshDrafts = useCallback(async () => {
    const res = await fetch("/api/drafts");
    const j: unknown = await res.json();
    if (!res.ok) {
      const msg =
        typeof j === "object" &&
        j !== null &&
        "error" in j &&
        typeof (j as { error: unknown }).error === "string"
          ? (j as { error: string }).error
          : "下書き一覧の取得に失敗しました";
      throw new Error(msg);
    }
    if (
      typeof j !== "object" ||
      j === null ||
      !("drafts" in j) ||
      !Array.isArray((j as { drafts: unknown }).drafts)
    ) {
      throw new Error("下書き一覧の形式が不正です");
    }
    setWorkspaceDrafts((j as { drafts: DraftRecord[] }).drafts);
  }, []);

  const refreshKnowledge = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeExperienceTypes.size > 0) {
      params.set("experience_type", [...activeExperienceTypes].join(","));
    }
    const url = activeExperienceTypes.size > 0 ? `/api/knowledge?${params.toString()}` : "/api/knowledge";
    const res = await fetch(url);
    const j: unknown = await res.json();
    if (!res.ok) {
      const msg =
        typeof j === "object" &&
        j !== null &&
        "error" in j &&
        typeof (j as { error: unknown }).error === "string"
          ? (j as { error: string }).error
          : "ナレッジ一覧の取得に失敗しました";
      throw new Error(msg);
    }
    if (
      typeof j !== "object" ||
      j === null ||
      !("items" in j) ||
      !Array.isArray((j as { items: unknown }).items)
    ) {
      throw new Error("ナレッジ一覧の形式が不正です");
    }
    setWorkspaceKnowledge((j as { items: CompletedKnowledgeRecord[] }).items);
  }, [activeExperienceTypes]);

  const refreshWorkspace = useCallback(async () => {
    try {
      await Promise.all([refreshDrafts(), refreshKnowledge()]);
      setWorkspaceLoadError(null);
    } catch (e) {
      setWorkspaceLoadError(
        e instanceof Error ? e.message : "一覧の更新に失敗しました",
      );
    }
  }, [refreshDrafts, refreshKnowledge]);

  useEffect(() => {
    startTransition(() => {
      void refreshWorkspace();
    });
  }, [refreshWorkspace]);

  const executeLocalReview = useCallback(async (text: string) => {
    setLoading(true);
    setSandboxError(null);
    setRulesHitCount(null);
    setRedactorStage1MaskedText(null);
    setRedactorEntities([]);
    setMaskHits([]);
    setReviewModalOpen(true);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text, approved: false }),
      });
      const data: unknown = await res.json();

      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `リクエストが失敗しました（${res.status}）`;
        throw new Error(msg);
      }

      if (!isPreviewResponse(data)) {
        throw new Error("ローカル検閲の応答形式が想定と異なります。");
      }

      setDraftId(data.draftId);
      setReviewedEdit(data.reviewedText);
      setRulesHitCount(data.rulesHitCount);
      setPreviewOriginal(text);
      setMaskHits(data.maskHits);
      setRedactorEntities(data.redactorEntities ?? []);
      setRedactorStage1MaskedText(data.redactorStage1MaskedText ?? null);
      setRegisteredProperNounCount(data.registeredProperNounCount);
      setRegisteredUniformReplacementGroupCount(
        data.registeredUniformReplacementGroupCount,
      );
      setSelectedDraftId(data.draftId);
      setSelectedKnowledgeId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "通信または処理中にエラーが発生しました。";
      setSandboxError(message);
      setReviewModalOpen(false);
    } finally {
      setLoading(false);
      void refreshDrafts();
    }
  }, [refreshDrafts]);

  async function handleLocalReviewWithText(text: string) {
    setSandboxError(null);
    try {
      const fp = await fingerprintTextBrowser(text);
      const otherDrafts = workspaceDrafts.filter(
        (d) => d.sourceTextFingerprint === fp,
      );
      const knowledgeHits = workspaceKnowledge.filter((k) => k.sourceTextFingerprint === fp);
      if (otherDrafts.length > 0 || knowledgeHits.length > 0) {
        setSimilarityDrafts(otherDrafts);
        setSimilarityKnowledge(knowledgeHits);
        setSimilarityOpen(true);
        setPendingReviewText(text);
        return;
      }
      await executeLocalReview(text);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "取り込み確認の準備に失敗しました。";
      setSandboxError(message);
    }
  }

  async function confirmSimilarityAndProceed() {
    setSimilarityOpen(false);
    await executeLocalReview(pendingReviewText);
  }

  function cancelSimilarityModal() {
    setSimilarityOpen(false);
  }

  function handlePickImportFile(file: File) {
    const okType =
      file.type === "text/plain" ||
      file.type === "text/markdown" ||
      file.type === "" ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md");
    if (!okType) {
      setSandboxError("テキストファイル（.txt / .md など）を選んでください。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const t = typeof reader.result === "string" ? reader.result : "";
      void handleLocalReviewWithText(t);
    };
    reader.onerror = () => {
      setSandboxError("ファイルの読み込みに失敗しました。");
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleApproveAndStructure(experienceType: ExperienceType) {
    if (!draftId) return;
    setLoading(true);
    setReviewApproving(true);
    setReviewApproveStep("送信準備中…");
    setSandboxError(null);
    try {
      setReviewApproveStep("Gemini 処理中…");
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          approved: true,
          reviewedText: reviewedEdit,
          experienceType,
        }),
      });
      const data: unknown = await res.json();

      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `リクエストが失敗しました（${res.status}）`;
        throw new Error(msg);
      }

      // needs_tag_review: タグ確認モーダルへ
      if (
        typeof data === "object" && data !== null &&
        "kind" in data && (data as { kind: unknown }).kind === "needs_tag_review"
      ) {
        const d = data as unknown as {
          pendingStructured: PendingStructured;
          tagReviewItems: TagReviewItem[];
          qwenUnavailable: boolean;
        };
        setTagReviewState({
          origin: "local",
          draftId: draftId!,
          experienceType,
          reviewedText: reviewedEdit,
          pendingStructured: d.pendingStructured,
          tagReviewItems: d.tagReviewItems,
          qwenUnavailable: d.qwenUnavailable,
        });
        setReviewApproveStep(null);
        return;
      }

      if (!isKnowledgeData(data)) {
        throw new Error(
          "API の応答形式が不正です。topic / tags / summary / before / after / actionPlan / logic を確認してください。",
        );
      }

      const savedId =
        typeof data === "object" &&
        data !== null &&
        "savedKnowledgeId" in data &&
        typeof (data as { savedKnowledgeId: unknown }).savedKnowledgeId === "string"
          ? (data as { savedKnowledgeId: string }).savedKnowledgeId
          : undefined;

      const ext = data as KnowledgeData & {
        kind?: string;
        savedKnowledgeId?: string;
      };
      setKnowledge({
        topic: ext.topic,
        tags: ext.tags,
        summary: ext.summary,
        before: ext.before,
        after: ext.after,
        actionPlan: ext.actionPlan,
        logic: ext.logic,
        id: savedId,
      });

      setDetailKind("knowledge");
      setSelectedKnowledgeId(savedId ?? null);
      setSelectedDraftId(null);

      setDraftId(null);
      setReviewedEdit("");
      setRulesHitCount(null);
      setPreviewOriginal("");
      setMaskHits([]);
      setRedactorEntities([]);
      setRedactorStage1MaskedText(null);
      setRegisteredProperNounCount(null);
      setRegisteredUniformReplacementGroupCount(null);
      setReviewModalOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "通信または処理中にエラーが発生しました。";
      setSandboxError(message);
      setReviewApproveStep(null);
    } finally {
      setLoading(false);
      setReviewApproving(false);
      void refreshWorkspace();
    }
  }

  async function handleTagReviewConfirm(decisions: { tag: string; result: string | null }[]) {
    if (!tagReviewState) return;
    const { origin, draftId: trDraftId, experienceType: trType, reviewedText: trText, pendingStructured } = tagReviewState;

    // decisions に従い tags を再構成（却下=除外、置換=置換後タグ、承認=そのまま）
    const decisionMap = new Map(decisions.map((d) => [d.tag, d.result]));
    const confirmedTags = pendingStructured.tags
      .map((tag) => (decisionMap.has(tag) ? decisionMap.get(tag)! : tag))
      .filter((t): t is string => t !== null && t !== undefined);
    const confirmedStructured: PendingStructured = { ...pendingStructured, tags: confirmedTags };

    setLoading(true);
    setReviewApproving(true);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: trDraftId,
          approved: true,
          reviewedText: trText,
          experienceType: trType,
          confirmedStructured,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `リクエストが失敗しました（${res.status}）`;
        throw new Error(msg);
      }

      setTagReviewState(null);

      if (origin === "local") {
        const savedId =
          typeof data === "object" && data !== null && "savedKnowledgeId" in data &&
          typeof (data as { savedKnowledgeId: unknown }).savedKnowledgeId === "string"
            ? (data as { savedKnowledgeId: string }).savedKnowledgeId
            : undefined;
        const ext = data as PendingStructured & { savedKnowledgeId?: string };
        setKnowledge({
          topic: ext.topic,
          tags: ext.tags,
          summary: ext.summary,
          before: ext.before,
          after: ext.after,
          id: savedId,
        });
        setDetailKind("knowledge");
        setSelectedKnowledgeId(savedId ?? null);
        setSelectedDraftId(null);
        setDraftId(null);
        setReviewedEdit("");
        setRulesHitCount(null);
        setPreviewOriginal("");
        setMaskHits([]);
        setRedactorEntities([]);
        setRedactorStage1MaskedText(null);
        setRegisteredProperNounCount(null);
        setRegisteredUniformReplacementGroupCount(null);
        setReviewModalOpen(false);
      } else {
        handleDraftDetailApproved(data);
        setDraftDetailDraft(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "通信または処理中にエラーが発生しました。";
      setSandboxError(message);
    } finally {
      setLoading(false);
      setReviewApproving(false);
      void refreshWorkspace();
    }
  }

  function selectDraftRow(d: DraftRecord) {
    setDraftDetailDraft(d);
  }

  function handleDraftDetailApproved(data: unknown) {
    const d = data as KnowledgeData & { savedKnowledgeId?: string };
    if (isKnowledgeData(d)) {
      const savedId = (d as { savedKnowledgeId?: string }).savedKnowledgeId;
      setKnowledge({
        topic: d.topic,
        tags: d.tags,
        summary: d.summary,
        before: d.before,
        after: d.after,
        actionPlan: d.actionPlan,
        logic: d.logic,
        id: savedId,
      });
      setDetailKind("knowledge");
      setSelectedKnowledgeId(savedId ?? null);
      setSelectedDraftId(null);
    }
    void refreshWorkspace();
  }

  function selectKnowledgeRow(k: CompletedKnowledgeRecord) {
    if (selectedKnowledgeId === k.id && detailKind === "knowledge") {
      setDetailKind("none");
      setSelectedKnowledgeId(null);
      setEditingKnowledge(false);
      setEditValues(null);
      return;
    }
    setDetailKind("knowledge");
    setSelectedKnowledgeId(k.id);
    setSelectedDraftId(null);
    setKnowledge(k);
    setRecentlyViewedIds((prev) => [k.id, ...prev.filter((id) => id !== k.id)].slice(0, 5));
  }

  async function runKnowledgeSearch() {
    const q = knowledgeSearchQuery.trim();
    if (!q) {
      setSearchActive(false);
      setSearchKnowledge([]);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const searchParams = new URLSearchParams({ q });
      if (activeExperienceTypes.size > 0) {
        searchParams.set("experience_type", [...activeExperienceTypes].join(","));
      }
      const res = await fetch(`/api/search?${searchParams.toString()}`);
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "検索に失敗しました";
        throw new Error(msg);
      }
      const parsed = data as { knowledge?: CompletedKnowledgeRecord[] };
      setSearchKnowledge(Array.isArray(parsed.knowledge) ? parsed.knowledge : []);
      setSearchActive(true);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "検索に失敗しました");
    } finally {
      setSearchLoading(false);
    }
  }

  function clearKnowledgeSearch() {
    setKnowledgeSearchQuery("");
    setSearchActive(false);
    setSearchKnowledge([]);
    setSearchError(null);
  }

  useEffect(() => {
    const q = knowledgeSearchQuery.trim();
    if (q.length === 0) {
      setSearchActive(false);
      setSearchKnowledge([]);
      setSearchError(null);
      return;
    }
    if (q.length < 2) return;
    const timer = setTimeout(() => void runKnowledgeSearch(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeSearchQuery]);

  useEffect(() => {
    if (searchActive) void runKnowledgeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExperienceTypes]);

  async function handleDeleteDraft(id: string) {
    try {
      const res = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data: unknown = await res.json();
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as { error: string }).error
            : "下書きの削除に失敗しました";
        setSandboxError(msg);
        return;
      }
      if (selectedDraftId === id) {
        setSelectedDraftId(null);
        setDetailKind("none");
        setDraftId(null);
        setReviewedEdit("");
        setPreviewOriginal("");
        setMaskHits([]);
        setRedactorEntities([]);
        setRedactorStage1MaskedText(null);
        setRulesHitCount(null);
      }
      await refreshDrafts();
    } catch {
      setSandboxError("下書きの削除に失敗しました");
    }
  }

  async function confirmDeleteDraft() {
    if (!deleteDraftTarget) return;
    setDeleteDraftTarget(null);
    await handleDeleteDraft(deleteDraftTarget);
  }

  function handleHoverDeleteDraft(id: string) {
    setExitingDraftIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      void handleDeleteDraft(id);
      setExitingDraftIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  async function handleBulkDeleteDrafts() {
    setBulkDeletingDrafts(true);
    await Promise.allSettled(
      Array.from(checkedDraftIds).map((id) => fetch(`/api/drafts/${id}`, { method: "DELETE" })),
    );
    if (selectedDraftId && checkedDraftIds.has(selectedDraftId)) {
      setSelectedDraftId(null);
      setDetailKind("none");
      setDraftId(null);
      setReviewedEdit("");
      setPreviewOriginal("");
      setMaskHits([]);
      setRedactorEntities([]);
      setRedactorStage1MaskedText(null);
      setRulesHitCount(null);
    }
    setCheckedDraftIds(new Set());
    setBulkDeletingDrafts(false);
    setDraftEditMode(false);
    await refreshDrafts();
  }

  async function confirmDeleteKnowledge() {
    if (!deleteKnowledgeTarget) return;
    setDeletingKnowledge(true);
    setDeleteKnowledgeError(null);
    try {
      const res = await fetch(`/api/knowledge/${deleteKnowledgeTarget}`, { method: "DELETE" });
      if (!res.ok) {
        const data: unknown = await res.json();
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as { error: string }).error
            : "ナレッジの削除に失敗しました";
        setDeleteKnowledgeError(msg);
        return;
      }
      if (selectedKnowledgeId === deleteKnowledgeTarget) {
        setSelectedKnowledgeId(null);
        setDetailKind("none");
        setEditingKnowledge(false);
        setEditValues(null);
      }
      setDeleteKnowledgeTarget(null);
      await refreshKnowledge();
    } catch {
      setDeleteKnowledgeError("ナレッジの削除に失敗しました");
    } finally {
      setDeletingKnowledge(false);
    }
  }

  function startEditKnowledge() {
    const k = selectedKnowledgeRecord;
    if (!k) return;
    setEditValues({
      topic: k.topic,
      tags: k.tags.join(", "),
      experienceType: k.experienceType ?? "",
      summary: k.summary,
      cause: k.cause ?? "",
      insight: k.insight ?? "",
      principle: k.principle ?? "",
      before: k.before ?? "",
      after: k.after ?? "",
      logic: (k.logic ?? []).join("\n"),
      actionPlan: (k.actionPlan ?? []).map((a) => ({ ...a })),
    });
    setEditingKnowledge(true);
    setEditError(null);
  }

  function cancelEditKnowledge() {
    setEditingKnowledge(false);
    setEditValues(null);
    setEditError(null);
  }

  async function saveEditKnowledge() {
    if (!selectedKnowledgeId || !editValues) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const tags = editValues.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const logic = editValues.logic.split("\n").map((l) => l.trim()).filter(Boolean);
      const body = {
        topic: editValues.topic,
        tags,
        ...(editValues.experienceType ? { experienceType: editValues.experienceType } : {}),
        summary: editValues.summary,
        cause: editValues.cause,
        insight: editValues.insight,
        principle: editValues.principle,
        before: editValues.before,
        after: editValues.after,
        logic,
        actionPlan: editValues.actionPlan,
      };
      const res = await fetch(`/api/knowledge/${selectedKnowledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as { error: string }).error
            : "保存に失敗しました";
        setEditError(msg);
        return;
      }
      const updated = data as CompletedKnowledgeRecord & { id: string };
      setKnowledge(updated);
      setEditingKnowledge(false);
      setEditValues(null);
      await refreshKnowledge();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSavePdf() {
    const el = document.getElementById("knowledge-report-content");
    if (!el || !knowledge) return;

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 12;
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pdfWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    const contentHeight = pageHeight - margin * 2;

    let y = 0;
    while (y < imgHeight) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, margin - y, contentWidth, imgHeight);
      y += contentHeight;
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const topicSlug = (knowledge.topic ?? "レポート").replace(/[/\\:*?"<>|]/g, "_").slice(0, 40);
    const fileName = `知見レポート_${topicSlug}_${date}.pdf`;

    const pdfBlob = pdf.output("blob");

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as Window & typeof globalThis & { showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "PDF ファイル", accept: { "application/pdf": [".pdf"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveMarkdown() {
    if (!knowledge) return;
    const rec = selectedKnowledgeRecord;

    const lines: string[] = [];
    lines.push(`# ${knowledge.topic ?? "レポート"}`);
    lines.push("");
    if (rec?.experienceType) {
      lines.push(`**種別**: ${EXPERIENCE_TYPE_LABELS[rec.experienceType] ?? rec.experienceType}`);
    }
    if (knowledge.tags?.length) {
      lines.push(`**タグ**: ${knowledge.tags.join(", ")}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## 知見のまとめ");
    lines.push("");
    lines.push(knowledge.summary ?? "");
    if (knowledge.before || knowledge.after) {
      lines.push("");
      lines.push("## 課題と成果");
      if (knowledge.before) { lines.push(""); lines.push(`**Before**: ${knowledge.before}`); }
      if (knowledge.after)  { lines.push(""); lines.push(`**After**: ${knowledge.after}`); }
    }
    if (rec?.cause) {
      lines.push("");
      lines.push("## なぜそうなったか");
      lines.push("");
      lines.push(rec.cause);
    }
    if (rec?.insight) {
      lines.push("");
      lines.push("## 何を学んだか");
      lines.push("");
      lines.push(rec.insight);
    }
    if (rec?.principle) {
      lines.push("");
      lines.push("## 一般化できる原則");
      lines.push("");
      lines.push(rec.principle);
    }

    const mdContent = lines.join("\n");
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const topicSlug = (knowledge.topic ?? "レポート").replace(/[/\\:*?"<>|]/g, "_").slice(0, 40);
    const fileName = `知見レポート_${topicSlug}_${date}.md`;
    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as Window & typeof globalThis & { showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "Markdown ファイル", accept: { "text/markdown": [".md"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDbModalSave(
    id: string,
    patch: Partial<Pick<CompletedKnowledgeRecord, "topic" | "tags" | "summary" | "cause" | "insight" | "principle" | "experienceType" | "before" | "after" | "actionPlan" | "logic">>,
  ) {
    const res = await fetch(`/api/knowledge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      const msg =
        typeof data === "object" && data !== null && "error" in data
          ? (data as { error: string }).error
          : "保存に失敗しました";
      throw new Error(msg);
    }
    const updated = data as CompletedKnowledgeRecord;
    if (selectedKnowledgeId === id) {
      setKnowledge(updated);
    }
    await refreshKnowledge();
  }

  async function confirmBulkDeleteDrafts() {
    setBulkDeletingDrafts(true);
    setBulkDeleteDraftConfirm(false);
    await Promise.allSettled(
      Array.from(checkedDraftIds).map((id) => fetch(`/api/drafts/${id}`, { method: "DELETE" })),
    );
    if (selectedDraftId && checkedDraftIds.has(selectedDraftId)) {
      setSelectedDraftId(null);
      setDetailKind("none");
      setDraftId(null);
      setReviewedEdit("");
      setPreviewOriginal("");
      setMaskHits([]);
      setRedactorEntities([]);
      setRedactorStage1MaskedText(null);
      setRulesHitCount(null);
    }
    setCheckedDraftIds(new Set());
    setBulkDeletingDrafts(false);
    await refreshDrafts();
  }

  async function confirmBulkDeleteKnowledge() {
    setBulkDeletingKnowledge(true);
    setBulkDeleteKnowledgeConfirm(false);
    await Promise.allSettled(
      Array.from(checkedKnowledgeIds).map((id) =>
        fetch(`/api/knowledge/${id}`, { method: "DELETE" }),
      ),
    );
    if (selectedKnowledgeId && checkedKnowledgeIds.has(selectedKnowledgeId)) {
      setSelectedKnowledgeId(null);
      setDetailKind("none");
      setEditingKnowledge(false);
      setEditValues(null);
    }
    setCheckedKnowledgeIds(new Set());
    setBulkDeletingKnowledge(false);
    await refreshKnowledge();
  }

  async function handleDbModalBulkDelete(ids: string[]) {
    await Promise.allSettled(
      ids.map((id) => fetch(`/api/knowledge/${id}`, { method: "DELETE" })),
    );
    if (selectedKnowledgeId && ids.includes(selectedKnowledgeId)) {
      setSelectedKnowledgeId(null);
      setDetailKind("none");
      setEditingKnowledge(false);
      setEditValues(null);
    }
    await refreshKnowledge();
  }

  const selectedKnowledgeRecord =
    workspaceKnowledge.find((k) => k.id === selectedKnowledgeId) ??
    searchKnowledge.find((k) => k.id === selectedKnowledgeId);
  const displayKnowledgeList = searchActive ? searchKnowledge : workspaceKnowledge;

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of workspaceKnowledge) {
      for (const tag of k.tags) {
        const normalized = tag.startsWith("#") ? tag.slice(1) : tag;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([tag, count]) => ({ tag, count }));
  }, [workspaceKnowledge]);

  const tagFilteredKnowledgeList = useMemo(() => {
    if (!activeTagFilter) return displayKnowledgeList;
    return displayKnowledgeList.filter((k) =>
      k.tags.some((t) => (t.startsWith("#") ? t.slice(1) : t) === activeTagFilter),
    );
  }, [displayKnowledgeList, activeTagFilter]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 text-gray-900">
      <header className="border-b border-gray-400 bg-white shadow-sm">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <svg className="shrink-0" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="42" width="48" height="7" rx="1.5" fill="none" stroke="#d4b04a" strokeWidth="1.5" opacity="0.4"/>
                <rect x="8" y="32" width="48" height="7" rx="1.5" fill="none" stroke="#d4b04a" strokeWidth="1.5" opacity="0.7"/>
                <rect x="8" y="22" width="48" height="7" rx="1.5" fill="none" stroke="#d4b04a" strokeWidth="2"/>
                <line x1="32" y1="20" x2="32" y2="10" stroke="#d4b04a" strokeWidth="2" strokeLinecap="round"/>
                <polyline points="27,15 32,10 37,15" fill="none" stroke="#d4b04a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
              <div className="flex flex-col gap-1.5">
                <div style={{ fontFamily: "var(--font-barlow), sans-serif", fontWeight: 800, fontSize: "36px", lineHeight: 1, color: "#0d0d0d", letterSpacing: "-0.02em" }}>
                  Knowledge<strong style={{ fontWeight: 800, color: "#8a6510" }}>Legacy</strong> System
                </div>
                <div style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontWeight: 600, fontSize: "13px", letterSpacing: "0.25em", color: "#444", textTransform: "uppercase" }}>
                  Speak it · Stack it · Share it
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setContextSettingsOpen(true)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
              >
                設定
              </button>
              <button
                type="button"
                onClick={() => setDbModalOpen(true)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
              >
                DB編集
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1 min-h-0 flex-col lg:flex-row">
        {/* 左ペイン: 処理一覧 */}
        <aside
          className="flex w-full shrink-0 flex-col border-b border-gray-400 bg-white lg:w-64 xl:w-72 lg:border-b-0 lg:border-r"
          aria-label="下書き一覧と検閲サンドボックス"
        >
          {/* カラムヘッダー */}
          <div className="flex items-start justify-between border-b border-gray-300 px-3 py-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">処理一覧</h2>
            </div>
            <span className="mt-1 text-[11px] text-gray-400">
              {workspaceDrafts.length}件
            </span>
          </div>

          {/* ボタンエリア */}
          <div className="flex items-center gap-2 border-b border-gray-300 px-3 py-2.5">
            <input
              ref={importFileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePickImportFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={loading || draftEditMode}
              onClick={() => setDirectInputOpen(true)}
              className="flex-1 rounded-md bg-gray-900 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-gray-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:opacity-40"
            >
              ＋ 処理を追加
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftEditMode((m) => !m);
                if (draftEditMode) setCheckedDraftIds(new Set());
              }}
              className={`shrink-0 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                draftEditMode
                  ? "text-red-500 hover:text-red-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {draftEditMode ? "✓ 完了" : "✎ 編集"}
            </button>
          </div>

          {/* リスト本体 */}
          <div className="flex-1 overflow-y-auto py-1">
            {workspaceLoadError && (
              <p className="px-3 py-2 text-xs text-red-600">{workspaceLoadError}</p>
            )}

            {/* 編集モード：すべて選択行 */}
            {draftEditMode && workspaceDrafts.length > 0 && (
              <div className="flex items-center gap-2 border-b border-gray-300 px-3 py-1.5">
                <input
                  type="checkbox"
                  ref={(el) => {
                    if (el) {
                      el.indeterminate =
                        checkedDraftIds.size > 0 && checkedDraftIds.size < workspaceDrafts.length;
                    }
                  }}
                  checked={workspaceDrafts.length > 0 && checkedDraftIds.size === workspaceDrafts.length}
                  onChange={(e) =>
                    setCheckedDraftIds(
                      e.target.checked ? new Set(workspaceDrafts.map((d) => d.id)) : new Set(),
                    )
                  }
                  className="h-4 w-4 cursor-pointer rounded border-gray-300"
                />
                <span className="text-xs text-gray-500">すべて選択</span>
              </div>
            )}

            {workspaceDrafts.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">下書きはありません。</p>
            ) : (
              <ul className="flex flex-col gap-1.5 px-2 py-2">
                {workspaceDrafts.map((d, index) => {
                  const sel = selectedDraftId === d.id && detailKind === "draft";
                  const exiting = exitingDraftIds.has(d.id);
                  return (
                    <li
                      key={d.id}
                      className={`group flex items-start gap-2 rounded-md border px-3 py-2.5 transition-all duration-200 ${
                        exiting ? "translate-x-2 opacity-0" : ""
                      } ${sel ? "border-gray-400 bg-gray-100" : "border-gray-200 hover:border-gray-300 hover:bg-gray-100"}`}
                    >
                      {/* 編集モード：チェックボックス */}
                      {draftEditMode && (
                        <input
                          type="checkbox"
                          checked={checkedDraftIds.has(d.id)}
                          onChange={(e) =>
                            setCheckedDraftIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(d.id);
                              else next.delete(d.id);
                              return next;
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300"
                        />
                      )}

                      {/* アイテム本文 */}
                      <button
                        type="button"
                        onClick={() => !draftEditMode && selectDraftRow(d)}
                        className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="shrink-0 text-[11px] font-medium tabular-nums text-gray-400"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            #{index + 1}
                          </span>
                          <span className="line-clamp-2 flex-1 text-xs leading-relaxed text-gray-800">
                            {d.reviewedText}
                          </span>
                          {!draftEditMode && (
                            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300 opacity-30 transition-opacity group-hover:opacity-100" />
                          )}
                        </div>
                      </button>

                      {/* 通常モード：ホバーでゴミ箱 */}
                      {!draftEditMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHoverDeleteDraft(d.id);
                          }}
                          className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-gray-400 hover:text-red-500"
                          aria-label="削除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 編集モード：削除バー */}
          {draftEditMode && checkedDraftIds.size > 0 && (
            <div className="flex items-center justify-between border-t border-red-100 bg-red-50 px-3 py-2">
              <span className="text-xs text-red-600">{checkedDraftIds.size}件を選択中</span>
              <button
                type="button"
                disabled={bulkDeletingDrafts}
                onClick={() => void handleBulkDeleteDrafts()}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                削除
              </button>
            </div>
          )}

        </aside>

        <section
          className="flex w-full shrink-0 flex-col border-b border-gray-400 bg-white lg:w-72 xl:w-80 lg:border-b-0 lg:border-r"
          aria-label="ナレッジベース"
        >
          {/* カラムヘッダー */}
          <div className="border-b border-gray-300 px-3 py-2">
            <h2 className="text-lg font-semibold text-gray-900">ナレッジベース</h2>
          </div>

          {/* 検索バー */}
          <div className="border-b border-gray-300 px-2 py-2">
            <div className="flex gap-1">
              <input
                type="search"
                value={knowledgeSearchQuery}
                onChange={(e) => setKnowledgeSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runKnowledgeSearch();
                }}
                placeholder="検索ワード入力…"
                className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs outline-none focus:border-gray-400 focus:bg-white"
              />
              <button
                type="button"
                disabled={searchLoading}
                onClick={() => void runKnowledgeSearch()}
                className="shrink-0 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:opacity-50"
              >
                検索
              </button>
              {searchActive && (
                <button
                  type="button"
                  onClick={clearKnowledgeSearch}
                  className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
                >
                  解除
                </button>
              )}
            </div>
            {searchError && (
              <p className="mt-1 text-[11px] text-red-600">{searchError}</p>
            )}
          </div>

          {/* 経験タグ（大分類フィルター） */}
          <div className="flex flex-wrap gap-1.5 border-b border-gray-300 px-3 py-2">
            {(
              [
                { type: "failure",  label: "失敗・反省" },
                { type: "success",  label: "成功" },
                { type: "decision", label: "意思決定" },
                { type: "insight",  label: "気づき" },
              ] as { type: ExperienceType; label: string }[]
            ).map(({ type, label }) => {
              const active = activeExperienceTypes.has(type);
              const c = EXP_COLORS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onMouseEnter={() => setHoveredExpType(type)}
                  onMouseLeave={() => setHoveredExpType(null)}
                  onClick={() => {
                    setActiveExperienceTypes((prev) => {
                      const next = new Set(prev);
                      active ? next.delete(type) : next.add(type);
                      return next;
                    });
                  }}
                  className="cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all"
                  style={c ? (active ? {
                    backgroundColor: c.onBg,
                    borderWidth: "1.5px",
                    borderStyle: "solid",
                    borderColor: c.onBg,
                    color: "white",
                    opacity: hoveredExpType === type ? 0.8 : 1,
                  } : {
                    backgroundColor: hoveredExpType === type ? c.lightBg : "transparent",
                    borderWidth: "1.5px",
                    borderStyle: "solid",
                    borderColor: c.border,
                    color: c.border,
                  }) : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* ハッシュタグ（小分類フィルター） */}
          <div className="border-b border-gray-300">
            <button
              type="button"
              onClick={() => setTagCloudOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-gray-50"
              aria-expanded={tagCloudOpen}
            >
              <span className="text-[11px] font-medium text-gray-500">
                {tagCloudOpen ? "▲" : "▼"} タグで絞り込む
              </span>
              <div className="flex items-center gap-1.5">
                {activeTagFilter && (
                  <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    1
                  </span>
                )}
                {tagCloudOpen ? (
                  <ChevronUp className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
                ) : (
                  <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
                )}
              </div>
            </button>
            {tagCloudOpen && tagCounts.length > 0 && (
              <div
                className="flex flex-wrap gap-1.5 overflow-y-auto px-3 pb-2.5 pt-1.5"
                style={{ maxHeight: "160px" }}
              >
                {tagCounts.map(({ tag, count }) => {
                  const active = activeTagFilter === tag;
                  const densityClass =
                    count >= 4
                      ? "text-[12px] border-gray-700 bg-gray-100 text-gray-800"
                      : count >= 2
                      ? "text-[11px] border-gray-400 text-gray-600"
                      : "text-[11px] border-gray-200 text-gray-400";
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTagFilter(active ? null : tag)}
                      className={`flex items-center gap-0.5 rounded-full border px-2.5 py-0.5 font-medium transition-colors ${densityClass} ${
                        active ? "underline decoration-current" : "hover:bg-gray-100"
                      }`}
                    >
                      {active && <span>✓</span>}
                      <span>#{tag}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 件数・クリア */}
          <div className="flex items-center justify-between border-b border-gray-300 px-3 py-1.5">
            <span
              className={`text-[11px] ${
                activeExperienceTypes.size > 0 || activeTagFilter
                  ? "font-medium text-gray-900"
                  : "text-gray-400"
              }`}
            >
              {tagFilteredKnowledgeList.length}件
            </span>
            {(activeExperienceTypes.size > 0 || activeTagFilter) && (
              <button
                type="button"
                onClick={() => {
                  setActiveExperienceTypes(new Set());
                  setActiveTagFilter(null);
                }}
                className="text-[11px] text-red-500 hover:text-red-600"
              >
                ✕ クリア
              </button>
            )}
          </div>

          {/* ナレッジ一覧（左端カラーバー方式） */}
          <div className="flex-1 overflow-y-auto">
            {tagFilteredKnowledgeList.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">
                {searchActive
                  ? "一致する結果がありません。"
                  : activeExperienceTypes.size > 0 || activeTagFilter
                  ? "絞り込み条件に一致するナレッジはありません。"
                  : "加工済みはまだありません。"}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 px-2 py-2">
                {tagFilteredKnowledgeList.map((k) => {
                  const sel = selectedKnowledgeId === k.id && detailKind === "knowledge";
                  const dt = new Date(k.createdAt).toLocaleDateString("ja-JP", { dateStyle: "short" });
                  const barColor = k.experienceType ? (EXP_COLORS[k.experienceType]?.border ?? "#e5e7eb") : "#e5e7eb";
                  return (
                    <li key={k.id} className={`group overflow-hidden rounded-md border ${sel ? "border-gray-400 bg-gray-100" : "border-gray-200 hover:border-gray-300 hover:bg-gray-100"}`}>
                      <button
                        type="button"
                        onClick={() => selectKnowledgeRow(k)}
                        className="flex w-full items-stretch cursor-pointer text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400"
                      >
                        {/* 左端カラーバー */}
                        <div className="w-[3px] shrink-0" style={{ backgroundColor: barColor }} />
                        {/* コンテンツ */}
                        <div className="min-w-0 flex-1 px-2 py-2">
                          <span
                            className="block text-xs font-medium text-gray-900"
                            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                          >
                            {k.topic}
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            {k.experienceType && EXP_COLORS[k.experienceType] && (
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  backgroundColor: EXP_COLORS[k.experienceType]!.lightBg,
                                  color: EXP_COLORS[k.experienceType]!.textDark,
                                }}
                              >
                                {EXPERIENCE_TYPE_LABELS[k.experienceType]}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">{dt}</span>
                          </div>
                          {searchActive && (() => {
                            const q = knowledgeSearchQuery.trim();
                            const field = [k.summary, k.before, k.after]
                              .filter((f): f is string => f != null)
                              .find((f) => f.toLowerCase().includes(q.toLowerCase()));
                            if (!field) return null;
                            const s = buildSnippet(field, q, 40);
                            return (
                              <span className="mt-0.5 line-clamp-2 block text-[10px] text-gray-500">
                                {s.pre}
                                {s.match && (
                                  <mark className="rounded-sm bg-yellow-200 text-yellow-900">{s.match}</mark>
                                )}
                                {s.post}
                              </span>
                            );
                          })()}
                        </div>
                        {/* クリック可能サイン */}
                        <div className="flex shrink-0 items-center pr-1.5 text-gray-300 opacity-30 transition-opacity group-hover:opacity-100">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <main
          className="min-h-0 flex-1 flex flex-col bg-gray-50"
          aria-label="出力"
        >
          {/* スクロール可能なコンテンツ */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">

          {/* カラムヘッダー */}
          <div className="mb-4 flex items-center justify-between border-b border-gray-300 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">出力</h2>
            </div>
            {detailKind === "knowledge" && (
              <div className="flex items-center gap-2">
                {editingKnowledge ? (
                  <>
                    {editError && (
                      <span className="text-xs text-red-600">{editError}</span>
                    )}
                    <button
                      type="button"
                      onClick={cancelEditKnowledge}
                      disabled={savingEdit}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150 disabled:opacity-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEditKnowledge()}
                      disabled={savingEdit}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:opacity-50"
                    >
                      {savingEdit ? "保存中…" : "保存"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleSavePdf()}
                      className="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 hover:shadow-md hover:brightness-150 transition-all duration-150"
                    >
                      <FileDown className="h-3.5 w-3.5" aria-hidden />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveMarkdown()}
                      className="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 hover:shadow-md hover:brightness-150 transition-all duration-150"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      MD
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailKind("none");
                        setSelectedKnowledgeId(null);
                        setEditingKnowledge(false);
                        setEditValues(null);
                      }}
                      className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
                    >
                      閉じる
                    </button>
                    <button
                      type="button"
                      onClick={startEditKnowledge}
                      className="shrink-0 rounded px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      編集
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 未選択時：最近閲覧 */}
          {detailKind === "none" && (() => {
            const recentList = recentlyViewedIds
              .map((id) => workspaceKnowledge.find((k) => k.id === id))
              .filter((k): k is CompletedKnowledgeRecord => k !== undefined);
            return (
              <div>
                {recentList.length > 0 ? (
                  <>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium" style={{ color: "#374151" }}>
                      <Clock className="h-[14px] w-[14px] shrink-0" aria-hidden />
                      最近閲覧
                    </h3>
                    <ul className="space-y-1">
                      {recentList.map((k) => (
                        <li key={k.id}>
                          <button
                            type="button"
                            onClick={() => selectKnowledgeRow(k)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-gray-100"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{k.topic}</span>
                            <span className="ml-3 shrink-0 text-xs text-gray-400">
                              {new Date(k.createdAt).toLocaleDateString("ja-JP", { dateStyle: "short" })}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">ナレッジを選択するとレポートが表示されます</p>
                )}
              </div>
            );
          })()}

          {detailKind === "knowledge" && (
            <>
              {/* 編集フォーム */}
              {editingKnowledge && editValues ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-500">種別</label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: "failure", label: "失敗・反省" },
                        { value: "success", label: "成功" },
                        { value: "decision", label: "意思決定" },
                        { value: "insight", label: "気づき" },
                      ] as const).map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEditValues({ ...editValues, experienceType: value })}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                            editValues.experienceType === value
                              ? "bg-gray-900 text-white"
                              : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">トピック</label>
                    <input
                      type="text"
                      value={editValues.topic}
                      onChange={(e) => setEditValues({ ...editValues, topic: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">タグ（カンマ区切り）</label>
                    <input
                      type="text"
                      value={editValues.tags}
                      onChange={(e) => setEditValues({ ...editValues, tags: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">まとめ</label>
                    <textarea
                      rows={3}
                      value={editValues.summary}
                      onChange={(e) => setEditValues({ ...editValues, summary: e.target.value })}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">なぜそうなったか</label>
                    <textarea
                      rows={3}
                      value={editValues.cause}
                      onChange={(e) => setEditValues({ ...editValues, cause: e.target.value })}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">何を学んだか</label>
                    <textarea
                      rows={3}
                      value={editValues.insight}
                      onChange={(e) => setEditValues({ ...editValues, insight: e.target.value })}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">一般化できる原則</label>
                    <textarea
                      rows={3}
                      value={editValues.principle}
                      onChange={(e) => setEditValues({ ...editValues, principle: e.target.value })}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Before</label>
                      <input
                        type="text"
                        value={editValues.before}
                        onChange={(e) => setEditValues({ ...editValues, before: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">After</label>
                      <input
                        type="text"
                        value={editValues.after}
                        onChange={(e) => setEditValues({ ...editValues, after: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">効果・メリット（1行1項目）</label>
                    <textarea
                      rows={3}
                      value={editValues.logic}
                      onChange={(e) => setEditValues({ ...editValues, logic: e.target.value })}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-500">アクションプラン</label>
                      <button
                        type="button"
                        onClick={() =>
                          setEditValues({
                            ...editValues,
                            actionPlan: [...editValues.actionPlan, { who: "", what: "", how: "" }],
                          })
                        }
                        className="text-[11px] font-medium text-gray-600 hover:text-gray-900"
                      >
                        ＋ 行を追加
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border-b border-gray-300 px-2 py-1.5 text-left font-medium text-gray-500">誰が</th>
                            <th className="border-b border-gray-300 px-2 py-1.5 text-left font-medium text-gray-500">何を</th>
                            <th className="border-b border-gray-300 px-2 py-1.5 text-left font-medium text-gray-500">どうする</th>
                            <th className="border-b border-gray-300 px-1 py-1.5" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300">
                          {editValues.actionPlan.map((row, i) => (
                            <tr key={i}>
                              {(["who", "what", "how"] as const).map((field) => (
                                <td key={field} className="px-1 py-1">
                                  <input
                                    type="text"
                                    value={row[field]}
                                    onChange={(e) => {
                                      const next = editValues.actionPlan.map((r, j) =>
                                        j === i ? { ...r, [field]: e.target.value } : r,
                                      );
                                      setEditValues({ ...editValues, actionPlan: next });
                                    }}
                                    className="w-full rounded border border-gray-200 bg-white px-2 py-1 focus:border-gray-400 focus:outline-none"
                                  />
                                </td>
                              ))}
                              <td className="px-1 py-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditValues({
                                      ...editValues,
                                      actionPlan: editValues.actionPlan.filter((_, j) => j !== i),
                                    })
                                  }
                                  className="text-gray-400 hover:text-red-600"
                                  aria-label="行を削除"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div id="knowledge-report-content" className="space-y-5">
                  <KnowledgeTopicHeader
                    topic={knowledge.topic}
                    tags={knowledge.tags}
                    experienceType={selectedKnowledgeRecord?.experienceType}
                  />

                  {/* 知見のまとめ：経験タグ色に連動 */}
                  {(() => {
                    const expType = selectedKnowledgeRecord?.experienceType;
                    const c = expType ? EXP_COLORS[expType] : null;
                    return (
                      <section className="space-y-2" aria-labelledby="report-summary-heading">
                        <h3
                          id="report-summary-heading"
                          className="flex items-center gap-1.5 text-sm font-medium"
                          style={{ color: c?.textDark ?? "#374151" }}
                        >
                          <Sparkles className="h-[14px] w-[14px] shrink-0 text-amber-400" aria-hidden />
                          知見のまとめ
                        </h3>
                        <div
                          className="rounded-md px-3 py-[9px]"
                          style={{
                            borderLeft: `3px solid ${c?.border ?? "#9ca3af"}`,
                            backgroundColor: c?.lightBg ?? "#f9fafb",
                          }}
                        >
                          <p
                            className="text-sm font-medium leading-relaxed"
                            style={{ color: c?.textDark ?? "#1f2937" }}
                          >
                            {knowledge.summary}
                          </p>
                        </div>
                      </section>
                    );
                  })()}

                  {(knowledge.before || knowledge.after) && (
                    <section className="space-y-2" aria-labelledby="report-issue-outcome-heading">
                      <h3
                        id="report-issue-outcome-heading"
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-900"
                      >
                        <TrendingUp className="h-[14px] w-[14px] shrink-0 text-green-500" aria-hidden />
                        課題と成果
                      </h3>
                      <ReportBeforeAfterMini
                        before={knowledge.before ?? ""}
                        after={knowledge.after ?? ""}
                      />
                    </section>
                  )}

                  {selectedKnowledgeRecord?.cause && (
                    <section className="space-y-2" aria-labelledby="report-cause-heading">
                      <h3
                        id="report-cause-heading"
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-900"
                      >
                        <AlertCircle className="h-[14px] w-[14px] shrink-0 text-orange-400" aria-hidden />
                        なぜそうなったか
                      </h3>
                      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <p className="text-sm leading-relaxed text-gray-800">
                          {selectedKnowledgeRecord.cause}
                        </p>
                      </div>
                    </section>
                  )}

                  {selectedKnowledgeRecord?.insight && (
                    <section className="space-y-2" aria-labelledby="report-insight-heading">
                      <h3
                        id="report-insight-heading"
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-900"
                      >
                        <Lightbulb className="h-[14px] w-[14px] shrink-0 text-blue-400" aria-hidden />
                        何を学んだか
                      </h3>
                      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <p className="text-sm leading-relaxed text-gray-800">
                          {selectedKnowledgeRecord.insight}
                        </p>
                      </div>
                    </section>
                  )}

                  {selectedKnowledgeRecord?.principle && (
                    <section className="space-y-2" aria-labelledby="report-principle-heading">
                      <h3
                        id="report-principle-heading"
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-900"
                      >
                        <Flag className="h-[14px] w-[14px] shrink-0 text-purple-400" aria-hidden />
                        一般化できる原則
                      </h3>
                      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <p className="text-sm leading-relaxed text-gray-800">
                          {selectedKnowledgeRecord.principle}
                        </p>
                      </div>
                    </section>
                  )}

                </div>
              )}
            </>
          )}

          </div>
          </div>

        </main>
      </div>

      {deleteDraftTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onClick={() => setDeleteDraftTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-draft-dialog-title"
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-draft-dialog-title"
              className="text-base font-semibold text-gray-900"
            >
              下書きを削除しますか？
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              削除すると元に戻せません。redactor のセッションも破棄されます。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteDraftTarget(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteDraft()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 hover:shadow-md hover:brightness-150 transition-all duration-150"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteKnowledgeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onClick={() => { if (!deletingKnowledge) setDeleteKnowledgeTarget(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-knowledge-dialog-title"
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-knowledge-dialog-title"
              className="text-base font-semibold text-gray-900"
            >
              ナレッジを削除しますか？
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              削除すると元に戻せません。redactor のアーカイブは削除されません。
            </p>
            {deleteKnowledgeError && (
              <p className="mt-3 text-xs text-red-600">{deleteKnowledgeError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingKnowledge}
                onClick={() => { setDeleteKnowledgeTarget(null); setDeleteKnowledgeError(null); }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={deletingKnowledge}
                onClick={() => void confirmDeleteKnowledge()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:opacity-50"
              >
                {deletingKnowledge ? "削除中…" : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}

      <LocalReviewModal
        open={reviewModalOpen}
        loading={loading && rulesHitCount === null}
        approving={reviewApproving}
        rulesHitCount={rulesHitCount}
        registeredProperNounCount={registeredProperNounCount}
        registeredUniformReplacementGroupCount={registeredUniformReplacementGroupCount}
        redactorStage1MaskedText={redactorStage1MaskedText}
        redactorEntities={redactorEntities}
        previewOriginal={previewOriginal}
        reviewedEdit={reviewedEdit}
        onReviewedEditChange={setReviewedEdit}
        approveError={sandboxError}
        onApprove={(type) => void handleApproveAndStructure(type)}
        approveStep={reviewApproveStep}
        onReject={() => { setReviewModalOpen(false); setSandboxError(null); setReviewApproveStep(null); }}
      />

      <KnowledgeDbModal
        open={dbModalOpen}
        onClose={() => setDbModalOpen(false)}
        knowledge={workspaceKnowledge}
        onSave={(id, patch) => handleDbModalSave(id, patch)}
        onDelete={(id) => { setDbModalOpen(false); setDeleteKnowledgeTarget(id); }}
        onBulkDelete={(ids) => handleDbModalBulkDelete(ids)}
      />

      <DraftDetailModal
        open={draftDetailDraft !== null}
        draft={draftDetailDraft}
        onClose={() => setDraftDetailDraft(null)}
        onApproved={handleDraftDetailApproved}
        onProcessed={() => void refreshDrafts()}
        onNeedsTagReview={(payload) => {
          setTagReviewState({
            origin: "draft_detail",
            draftId: payload.draftId,
            experienceType: payload.experienceType,
            reviewedText: payload.reviewedText,
            pendingStructured: payload.pendingStructured,
            tagReviewItems: payload.tagReviewItems,
            qwenUnavailable: payload.qwenUnavailable,
          });
        }}
      />

      <NewTagReviewModal
        open={tagReviewState !== null}
        tagReviewItems={tagReviewState?.tagReviewItems ?? []}
        qwenUnavailable={tagReviewState?.qwenUnavailable ?? false}
        onConfirm={(decisions) => void handleTagReviewConfirm(decisions)}
        onClose={() => setTagReviewState(null)}
      />

      <DirectInputModal
        open={directInputOpen}
        onClose={() => setDirectInputOpen(false)}
        onSubmit={(text) => void handleLocalReviewWithText(text)}
      />

      <ContextSettingsModal
        open={contextSettingsOpen}
        onClose={() => setContextSettingsOpen(false)}
      />

      {bulkDeleteDraftConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onClick={() => setBulkDeleteDraftConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900">下書きを削除しますか？</h2>
            <p className="mt-2 text-sm text-gray-600">
              {checkedDraftIds.size} 件の下書きをまとめて削除します。この操作は取り消せません。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteDraftConfirm(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={bulkDeletingDrafts}
                onClick={() => void confirmBulkDeleteDrafts()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:opacity-50"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteKnowledgeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onClick={() => setBulkDeleteKnowledgeConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900">ナレッジを削除しますか？</h2>
            <p className="mt-2 text-sm text-gray-600">
              {checkedKnowledgeIds.size} 件のナレッジをまとめて削除します。この操作は取り消せません。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteKnowledgeConfirm(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={bulkDeletingKnowledge}
                onClick={() => void confirmBulkDeleteKnowledge()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:opacity-50"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {similarityOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onClick={cancelSimilarityModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="similarity-dialog-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="similarity-dialog-title"
              className="text-base font-semibold text-gray-900"
            >
              類似する取り込みがあります
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              入力した原文の指紋が、別の下書きまたは加工済みナレッジと一致しました。仕様どおり一旦停止しています。続けて新しい下書きとしてローカル検閲しますか？
            </p>

            {(similarityDrafts.length > 0 || similarityKnowledge.length > 0) && (
              <ul className="mt-4 space-y-2 text-xs text-gray-700">
                {similarityDrafts.map((d) => (
                  <li key={d.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="font-medium">下書き</span>
                    <span className="mt-1 block truncate text-gray-600">
                      {d.reviewedText.slice(0, 96)}
                      {d.reviewedText.length > 96 ? "…" : ""}
                    </span>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-gray-900 underline decoration-gray-400 underline-offset-2 hover:text-gray-700"
                      onClick={() => {
                        selectDraftRow(d);
                        cancelSimilarityModal();
                      }}
                    >
                      この下書きを開く
                    </button>
                  </li>
                ))}
                {similarityKnowledge.map((k) => (
                  <li key={k.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="font-medium">加工済み</span>
                    <span className="mt-1 block truncate text-gray-600">{k.topic}</span>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-gray-900 underline decoration-gray-400 underline-offset-2 hover:text-gray-700"
                      onClick={() => {
                        selectKnowledgeRow(k);
                        cancelSimilarityModal();
                      }}
                    >
                      このナレッジを開く
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelSimilarityModal}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
              >
                いいえ（破棄）
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void confirmSimilarityAndProceed()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                はい、ローカル検閲へ進む
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
