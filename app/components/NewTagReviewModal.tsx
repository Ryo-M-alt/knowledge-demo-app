"use client";

import { useState } from "react";
import { AlertTriangle, Check, X, Tag } from "lucide-react";

export type TagReviewItem = {
  tag: string;
  similar: string[];
};

/** tag → null（却下）| string（使うタグ名） */
type Decisions = Record<string, string | null | undefined>;

type Props = {
  open: boolean;
  tagReviewItems: TagReviewItem[];
  qwenUnavailable: boolean;
  /** decisions: 各新タグの最終決定（null=却下, string=使うタグ名）を渡す */
  onConfirm: (decisions: { tag: string; result: string | null }[]) => void;
  onClose: () => void;
};

function isAllDecided(items: TagReviewItem[], decisions: Decisions): boolean {
  return items.every((item) => decisions[item.tag] !== undefined);
}

export function NewTagReviewModal({
  open,
  tagReviewItems,
  qwenUnavailable,
  onConfirm,
  onClose,
}: Props) {
  const [decisions, setDecisions] = useState<Decisions>({});

  if (!open) return null;

  function decide(tag: string, result: string | null) {
    setDecisions((prev) => ({ ...prev, [tag]: result }));
  }

  function handleConfirm() {
    const result = tagReviewItems.map((item) => ({
      tag: item.tag,
      result: decisions[item.tag] ?? null,
    }));
    onConfirm(result);
  }

  const allDecided = isAllDecided(tagReviewItems, decisions);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-tag-review-title"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        style={{ maxHeight: "85vh" }}
      >
        {/* ヘッダー */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-indigo-500" />
            <h2 id="new-tag-review-title" className="text-base font-semibold text-gray-900">
              新しいタグの確認
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>

        {/* Qwen 警告バナー */}
        {qwenUnavailable && (
          <div className="flex shrink-0 items-start gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
            <span>
              類似タグ判定サービスが応答しませんでした。
              既存タグと重複がないか手動で確認してください。
            </span>
          </div>
        )}

        {/* 説明文 */}
        <p className="shrink-0 px-5 pt-4 pb-2 text-sm text-gray-500">
          Gemini が提案した新しいタグです。各タグを承認・却下、または既存タグに置き換えてください。
        </p>

        {/* タグ一覧 */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
          {tagReviewItems.map((item) => {
            const decision = decisions[item.tag];
            const decided = decision !== undefined;

            return (
              <div
                key={item.tag}
                className={`rounded-lg border p-3 transition-colors ${
                  decided ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"
                }`}
              >
                {/* タグ名 + 承認/却下ボタン */}
                <div className="flex items-center gap-2">
                  <span
                    className={`flex-1 rounded-md px-2.5 py-1 text-sm font-medium ${
                      decided
                        ? "bg-gray-100 text-gray-400 line-through"
                        : "bg-indigo-50 text-indigo-800"
                    }`}
                  >
                    {item.tag}
                  </span>

                  {!decided && (
                    <>
                      <button
                        type="button"
                        onClick={() => decide(item.tag, item.tag)}
                        className="flex items-center gap-1 rounded-md bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600"
                      >
                        <Check size={12} />
                        承認
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(item.tag, null)}
                        className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        <X size={12} />
                        却下
                      </button>
                    </>
                  )}

                  {/* 決定済み表示 */}
                  {decided && (
                    <div className="flex items-center gap-1.5">
                      {decision === null ? (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <X size={12} />
                          却下
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          <Check size={12} />
                          {decision}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setDecisions((prev) => {
                            const next = { ...prev };
                            delete next[item.tag];
                            return next;
                          })
                        }
                        className="text-xs text-gray-400 underline hover:text-gray-600"
                      >
                        やり直す
                      </button>
                    </div>
                  )}
                </div>

                {/* 類似タグ候補 */}
                {!decided && item.similar.length > 0 && (
                  <div className="mt-2 pl-1">
                    <p className="mb-1.5 text-xs text-gray-400">💡 似ている既存タグ:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.similar.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => decide(item.tag, s)}
                          className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          → {s} を使う
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* フッター */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-400">
            {tagReviewItems.filter((item) => decisions[item.tag] !== undefined).length} /{" "}
            {tagReviewItems.length} 件処理済み
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!allDecided}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              確定して保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
