"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftRecord, ExperienceType, RedactorEntityDTO } from "@/lib/knowledge-pipeline";

const STAGE1_SOURCES = new Set(["regex", "ner", "ginza", "spacy", "local_rule"]);

const EXPERIENCE_BUTTONS: { type: ExperienceType; label: string }[] = [
  { type: "failure",  label: "失敗・反省" },
  { type: "success",  label: "成功" },
  { type: "decision", label: "意思決定" },
  { type: "insight",  label: "気づき" },
];

type ApproveStep = "preparing" | "processing" | "done";

function labelColorClass(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("人名") || l === "person") return "bg-red-100 text-red-800 border-red-200";
  if (l.includes("組織") || l === "org") return "bg-blue-100 text-blue-800 border-blue-200";
  if (l.includes("日付") || l.includes("日時") || l.includes("時刻") || l === "date" || l === "time")
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (l.includes("金額") || l.includes("数値") || l === "money" || l === "cardinal")
    return "bg-green-100 text-green-800 border-green-200";
  if (
    l.includes("電話") || l.includes("メール") || l.includes("連絡先") ||
    l === "mail" || l === "phone" || l === "url" || l === "email"
  )
    return "bg-purple-100 text-purple-800 border-purple-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

type ProcessResult = {
  draftId: string;
  reviewedText: string;
  rulesHitCount: number;
  redactorEntities?: RedactorEntityDTO[];
  redactorStage1MaskedText?: string | null;
};

type NeedsTagReviewPayload = {
  draftId: string;
  experienceType: ExperienceType;
  reviewedText: string;
  pendingStructured: {
    topic: string; tags: string[]; summary: string;
    before?: string; after?: string; insight?: string; cause?: string; principle?: string;
  };
  tagReviewItems: { tag: string; similar: string[] }[];
  qwenUnavailable: boolean;
};

type Props = {
  open: boolean;
  draft: DraftRecord | null;
  onClose: () => void;
  onApproved: (data: unknown) => void;
  onProcessed?: () => void;
  onNeedsTagReview?: (payload: NeedsTagReviewPayload) => void;
};

export function DraftDetailModal({ open, draft, onClose, onApproved, onProcessed, onNeedsTagReview }: Props) {
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveStep, setApproveStep] = useState<ApproveStep | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lastDraftId = useRef<string | null>(null);
  useEffect(() => {
    if (open && draft && draft.id !== lastDraftId.current) {
      lastDraftId.current = draft.id;
      setResult(null);
      setFinalText("");
      setError(null);
      setApproveStep(null);
    }
    if (!open) {
      lastDraftId.current = null;
      setResult(null);
      setFinalText("");
      setError(null);
      setApproveStep(null);
    }
  }, [open, draft]);

  const handleStartReview = useCallback(async () => {
    if (!draft) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: draft.originalText,
          approved: false,
          draftId: draft.id,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as { error: string }).error
            : `処理に失敗しました（${res.status}）`;
        throw new Error(msg);
      }
      const r = data as ProcessResult;
      setResult(r);
      setFinalText(r.reviewedText);
      onProcessed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理中にエラーが発生しました");
    } finally {
      setProcessing(false);
    }
  }, [draft, onProcessed]);

  const handleApprove = useCallback(async (experienceType: ExperienceType) => {
    const effectiveDraftId = result?.draftId ?? draft?.id;
    if (!effectiveDraftId) return;
    setApproving(true);
    setApproveStep("preparing");
    setError(null);
    try {
      setApproveStep("processing");
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: effectiveDraftId,
          approved: true,
          reviewedText: finalText,
          experienceType,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as { error: string }).error
            : `承認処理に失敗しました（${res.status}）`;
        throw new Error(msg);
      }

      // needs_tag_review: タグ確認モーダルへ委譲
      if (
        typeof data === "object" && data !== null &&
        "kind" in data && (data as { kind: unknown }).kind === "needs_tag_review"
      ) {
        const d = data as unknown as {
          pendingStructured: NeedsTagReviewPayload["pendingStructured"];
          tagReviewItems: { tag: string; similar: string[] }[];
          qwenUnavailable: boolean;
        };
        onNeedsTagReview?.({
          draftId: effectiveDraftId,
          experienceType,
          reviewedText: finalText,
          pendingStructured: d.pendingStructured,
          tagReviewItems: d.tagReviewItems,
          qwenUnavailable: d.qwenUnavailable,
        });
        return;
      }

      setApproveStep("done");
      onApproved(data);
      onClose();
    } catch (e) {
      setApproveStep(null);
      setError(e instanceof Error ? e.message : "承認処理中にエラーが発生しました");
    } finally {
      setApproving(false);
    }
  }, [result, draft, finalText, onApproved, onClose]);

  if (!open || !draft) return null;

  const entities = result?.redactorEntities ?? [];
  const stage1Entities = entities.filter((e) => STAGE1_SOURCES.has(e.source?.toLowerCase?.() ?? ""));
  const stage2Entities = entities.filter((e) => !STAGE1_SOURCES.has(e.source?.toLowerCase?.() ?? ""));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={() => { if (!processing && !approving) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-detail-modal-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <h2 id="draft-detail-modal-title" className="text-base font-semibold text-gray-900">
            ドラフト確認
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={processing || approving}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* 原文 */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              ▼ 原文
            </h3>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-800">
              {draft.originalText || "（原文なし）"}
            </pre>
          </section>

          {/* ローカル検閲開始 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleStartReview()}
              disabled={processing || approving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-100 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
                  処理中...
                </>
              ) : (
                "ローカル検閲開始"
              )}
            </button>
            {result && !processing && (
              <span className="text-xs text-green-600 font-medium">✓ 検閲完了</span>
            )}
          </div>

          {/* Stage1 */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              ▼ Stage1 検閲（NER / regex）
            </h3>
            {result ? (
              stage1Entities.length === 0 ? (
                <p className="text-xs text-gray-400">検出なし</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stage1Entities.map((e) => (
                    <span
                      key={e.id}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${labelColorClass(e.label)}`}
                    >
                      <span className="opacity-70">{e.label}</span>
                      {e.text && <span className="font-semibold">[{e.text}]</span>}
                      <span className="font-mono text-[10px] opacity-50">#{e.id}</span>
                    </span>
                  ))}
                </div>
              )
            ) : (
              <p className="text-xs text-gray-300">検閲後に表示されます</p>
            )}
          </section>

          {/* Stage2 */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              ▼ Stage2 検閲（ローカル LLM）
            </h3>
            {result ? (
              stage2Entities.length === 0 ? (
                <p className="text-xs text-gray-400">検出なし</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stage2Entities.map((e) => (
                    <span
                      key={e.id}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${labelColorClass(e.label)}`}
                    >
                      <span className="opacity-70">{e.label}</span>
                      {e.text && <span className="font-semibold">[{e.text}]</span>}
                      <span className="font-mono text-[10px] opacity-50">#{e.id}</span>
                    </span>
                  ))}
                </div>
              )
            ) : (
              <p className="text-xs text-gray-300">検閲後に表示されます</p>
            )}
          </section>

          {/* final_text */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              ▼ final_text（承認前に編集可）
            </h3>
            {result ? (
              <textarea
                value={finalText}
                onChange={(e) => setFinalText(e.target.value)}
                rows={8}
                disabled={approving}
                className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
              />
            ) : (
              <p className="text-xs text-gray-300">検閲後に表示されます</p>
            )}
          </section>

          {error && (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 space-y-2 border-t border-gray-200 px-5 py-4">
          {/* ステップ表示 */}
          {approving && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
              {approveStep === "preparing" && "送信準備中…"}
              {approveStep === "processing" && "Gemini 処理中…"}
              {approveStep === "done" && "完了"}
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* 承認ボタン 4分割（検閲完了後のみ有効） */}
            {approving ? null : (
              <>
                {EXPERIENCE_BUTTONS.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => void handleApprove(type)}
                    disabled={processing || result === null || finalText.trim() === ""}
                    className="flex-1 rounded-lg bg-gray-900 px-2 py-2 text-xs font-semibold text-white hover:bg-gray-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {label}
                  </button>
                ))}
              </>
            )}

            <button
              type="button"
              onClick={() => void handleStartReview()}
              disabled={processing || approving}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150 disabled:opacity-50"
            >
              再試行
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={approving}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150 disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
