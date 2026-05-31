"use client";

import { type ReactNode } from "react";
import { type ExperienceType, type RedactorEntityDTO } from "@/lib/knowledge-pipeline";

type Props = {
  open: boolean;
  /** true = ローカル検閲 API 呼び出し中 */
  loading: boolean;
  /** true = 承認 API 呼び出し中 */
  approving: boolean;
  rulesHitCount: number | null;
  registeredProperNounCount: number | null;
  registeredUniformReplacementGroupCount: number | null;
  /** 互換性維持のため保持（このレイアウトでは非表示） */
  redactorStage1MaskedText: string | null;
  redactorEntities: RedactorEntityDTO[];
  previewOriginal: string;
  reviewedEdit: string;
  onReviewedEditChange: (v: string) => void;
  approveError: string | null;
  /** 承認ボタンから呼ばれる。選択した経験種別を引数で受け取る */
  onApprove: (type: ExperienceType) => void;
  onReject: () => void;
  /** 承認処理中に表示するステップ文言（例: "Gemini処理中..."）。未指定時は汎用メッセージ */
  approveStep?: string | null;
};

// Stage1 判定: regex / NER / GiNZA 由来のソース
const STAGE1_SOURCES = new Set(["regex", "ner", "ginza", "spacy", "local_rule"]);
function isStage1(e: RedactorEntityDTO): boolean {
  return STAGE1_SOURCES.has(e.source.toLowerCase());
}

function labelColorClass(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("人名") || l === "person") return "bg-red-100 text-red-800 border-red-200";
  if (l.includes("組織") || l === "org") return "bg-blue-100 text-blue-800 border-blue-200";
  if (
    l.includes("日付") || l.includes("日時") || l.includes("時刻") ||
    l === "date" || l === "time"
  )
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (
    l.includes("金額") || l.includes("数値") ||
    l === "money" || l === "cardinal"
  )
    return "bg-green-100 text-green-800 border-green-200";
  if (
    l.includes("電話") || l.includes("メール") || l.includes("連絡先") ||
    l === "mail" || l === "phone" || l === "url" || l === "email"
  )
    return "bg-purple-100 text-purple-800 border-purple-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function EntityBadge({ entity }: { entity: RedactorEntityDTO }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${labelColorClass(entity.label)}`}
    >
      <span className="opacity-70">{entity.label}</span>
      {entity.text && (
        <span className="font-semibold">[{entity.text}]</span>
      )}
      <span className="font-mono text-[10px] opacity-50">#{entity.id}</span>
    </span>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        ▼ {title}
      </h3>
      {children}
    </div>
  );
}

const EXPERIENCE_BUTTONS: { type: ExperienceType; label: string }[] = [
  { type: "failure",  label: "失敗・反省" },
  { type: "success",  label: "成功" },
  { type: "decision", label: "意思決定" },
  { type: "insight",  label: "気づき" },
];

export function LocalReviewModal({
  open,
  loading,
  approving,
  rulesHitCount,
  registeredProperNounCount,
  registeredUniformReplacementGroupCount,
  redactorEntities,
  previewOriginal,
  reviewedEdit,
  onReviewedEditChange,
  approveError,
  onApprove,
  onReject,
  approveStep,
}: Props) {
  if (!open) return null;

  const stage1Entities = redactorEntities.filter(isStage1);
  const stage2Entities = redactorEntities.filter((e) => !isStage1(e));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="local-review-modal-title"
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2
            id="local-review-modal-title"
            className="text-base font-semibold text-gray-900"
          >
            {loading ? "ローカル検閲処理中…" : "ローカル検閲 結果"}
          </h2>
          {!loading && !approving && (
            <button
              type="button"
              onClick={onReject}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="閉じる（下書きを保持）"
            >
              ✕
            </button>
          )}
        </div>

        {/* Loading view */}
        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-gray-200 border-t-gray-800" />
            <p className="text-sm text-gray-500">
              redactor に送信中… しばらくお待ちください
            </p>
          </div>
        )}

        {/* Results view */}
        {!loading && (
          <>
            {/* Step summary */}
            <div className="shrink-0 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-700">
                <span className="flex items-center gap-1.5">
                  <span className="font-bold text-green-600">✓</span>
                  ローカルルール
                  {rulesHitCount !== null && (
                    <span className="text-gray-400">
                      — {rulesHitCount}件ヒット
                      {registeredProperNounCount !== null &&
                        `（固有名詞: ${registeredProperNounCount}語`}
                      {registeredUniformReplacementGroupCount !== null &&
                        `・統一置換: ${registeredUniformReplacementGroupCount}件`}
                      {registeredProperNounCount !== null && "）"}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-bold text-green-600">✓</span>
                  Stage1完了
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-bold text-green-600">✓</span>
                  Stage2完了
                </span>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {/* 入力原文 */}
              <SectionBlock title="入力原文">
                <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-800">
                  {previewOriginal || "（原文なし）"}
                </pre>
              </SectionBlock>

              {/* Stage1 検閲ワード */}
              <SectionBlock title="Stage1 検閲ワード（NER / regex）">
                {stage1Entities.length === 0 ? (
                  <p className="text-xs text-gray-400">検出なし</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stage1Entities.map((e) => (
                      <EntityBadge key={e.id} entity={e} />
                    ))}
                  </div>
                )}
              </SectionBlock>

              {/* Stage2 検閲ワード */}
              <SectionBlock title="Stage2 検閲ワード（ローカル LLM）">
                {stage2Entities.length === 0 ? (
                  <p className="text-xs text-gray-400">検出なし</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stage2Entities.map((e) => (
                      <EntityBadge key={e.id} entity={e} />
                    ))}
                  </div>
                )}
              </SectionBlock>

              {/* final_text 編集 */}
              <SectionBlock title="final_text（承認前に編集可）">
                <p className="text-[11px] text-gray-500">
                  承認前に内容を編集できます。この文案がクラウド AI に送信されます。
                </p>
                <textarea
                  value={reviewedEdit}
                  onChange={(e) => onReviewedEditChange(e.target.value)}
                  rows={10}
                  className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </SectionBlock>
            </div>

            {/* Footer */}
            <div className="shrink-0 space-y-2 border-t border-gray-200 px-5 py-4">
              {approveError && (
                <p className="text-xs text-red-600">{approveError}</p>
              )}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onReject}
                  disabled={approving}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150 disabled:opacity-40"
                >
                  不承認
                </button>

                {approving ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
                    {approveStep ?? "処理中…"}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {EXPERIENCE_BUTTONS.map(({ type, label }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => onApprove(type)}
                        disabled={reviewedEdit.trim() === ""}
                        className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
