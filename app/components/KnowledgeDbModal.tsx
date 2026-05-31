"use client";

import { Fragment, useState } from "react";
import { Trash2 } from "lucide-react";
import type { CompletedKnowledgeRecord, ExperienceType } from "@/lib/knowledge-pipeline";

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

type Props = {
  open: boolean;
  onClose: () => void;
  knowledge: CompletedKnowledgeRecord[];
  onSave: (id: string, patch: Partial<Pick<CompletedKnowledgeRecord, "topic" | "tags" | "summary" | "cause" | "insight" | "principle" | "experienceType" | "before" | "after" | "actionPlan" | "logic">>) => Promise<void>;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
};

function toEditValues(k: CompletedKnowledgeRecord): EditValues {
  return {
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
  };
}

export function KnowledgeDbModal({ open, onClose, knowledge, onSave, onDelete, onBulkDelete }: Props) {
  const [filterText, setFilterText] = useState("");
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  if (!open) return null;

  const q = filterText.trim().toLowerCase();
  const filtered = q
    ? knowledge.filter(
        (k) =>
          k.topic.toLowerCase().includes(q) ||
          k.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : knowledge;

  const allChecked = filtered.length > 0 && filtered.every((k) => checkedIds.has(k.id));

  async function handleBulkDelete() {
    setBulkDeleting(true);
    setBulkConfirm(false);
    const ids = Array.from(checkedIds);
    await onBulkDelete(ids);
    setCheckedIds(new Set());
    setBulkDeleting(false);
  }

  function startEdit(k: CompletedKnowledgeRecord) {
    setEditTarget(k.id);
    setEditValues(toEditValues(k));
    setSaveError(null);
  }

  function cancelEdit() {
    setEditTarget(null);
    setEditValues(null);
    setSaveError(null);
  }

  async function handleSave(id: string) {
    if (!editValues) return;
    setSaving(true);
    setSaveError(null);
    try {
      const tags = editValues.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const logic = editValues.logic.split("\n").map((l) => l.trim()).filter(Boolean);
      await onSave(id, {
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
      });
      setEditTarget(null);
      setEditValues(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="db-modal-title"
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="db-modal-title" className="text-base font-semibold text-gray-900">
            ナレッジ DB 一覧（{filtered.length} 件{q ? `／全 ${knowledge.length} 件` : ""}）
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            閉じる
          </button>
        </div>

        {/* 検索 + 全選択 */}
        <div className="border-b border-gray-100 px-4 py-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) =>
                setCheckedIds(
                  e.target.checked ? new Set(filtered.map((k) => k.id)) : new Set(),
                )
              }
              disabled={filtered.length === 0}
              className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300"
              aria-label="全て選択"
            />
            <input
              type="search"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="トピック・タグで絞り込み…"
              className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-gray-400 focus:bg-white"
            />
            {checkedIds.size > 0 && !bulkConfirm && (
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => setBulkConfirm(true)}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {checkedIds.size}件削除
              </button>
            )}
          </div>
          {bulkConfirm && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <span className="text-xs text-red-700">
                {checkedIds.size} 件を削除しますか？この操作は取り消せません。
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBulkConfirm(false)}
                  className="text-xs font-medium text-gray-600 hover:text-gray-900"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={bulkDeleting}
                  onClick={() => void handleBulkDelete()}
                  className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {bulkDeleting ? "削除中…" : "削除する"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* テーブル */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">該当するナレッジがありません。</p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">トピック</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">作成日</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">タグ</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => {
                  const isEditing = editTarget === k.id;
                  const dt = new Date(k.createdAt).toLocaleDateString("ja-JP", {
                    month: "2-digit",
                    day: "2-digit",
                  });
                  return (
                    <Fragment key={k.id}>
                      <tr
                        className={`border-b border-gray-100 transition-colors ${isEditing ? "bg-gray-50" : "hover:bg-gray-50/60"}`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={checkedIds.has(k.id)}
                            onChange={(e) =>
                              setCheckedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(k.id);
                                else next.delete(k.id);
                                return next;
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          <div className="flex flex-col gap-0.5">
                            {k.experienceType && (
                              <span className="w-fit rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                                {{ failure: "失敗", success: "成功", decision: "意思決定", insight: "気づき" }[k.experienceType]}
                              </span>
                            )}
                            {k.topic}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">{dt}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {k.tags.map((t, i) => (
                              <span
                                key={i}
                                className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                              >
                                {t.startsWith("#") ? t : `#${t}`}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => (isEditing ? cancelEdit() : startEdit(k))}
                              className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
                            >
                              {isEditing ? "キャンセル" : "編集"}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(k.id)}
                              aria-label="削除"
                              className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-400 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* アコーディオン編集フォーム */}
                      {isEditing && editValues && (
                        <tr key={`${k.id}-edit`} className="border-b border-gray-200 bg-gray-50">
                          <td colSpan={5} className="px-5 py-4">
                            <div className="space-y-3">
                              {saveError && (
                                <p className="text-xs text-red-600">{saveError}</p>
                              )}
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
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-500">トピック</label>
                                  <input
                                    type="text"
                                    value={editValues.topic}
                                    onChange={(e) => setEditValues({ ...editValues, topic: e.target.value })}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-500">タグ（カンマ区切り）</label>
                                  <input
                                    type="text"
                                    value={editValues.tags}
                                    onChange={(e) => setEditValues({ ...editValues, tags: e.target.value })}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500">まとめ</label>
                                <textarea
                                  rows={2}
                                  value={editValues.summary}
                                  onChange={(e) => setEditValues({ ...editValues, summary: e.target.value })}
                                  className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500">なぜそうなったか</label>
                                <textarea
                                  rows={2}
                                  value={editValues.cause}
                                  onChange={(e) => setEditValues({ ...editValues, cause: e.target.value })}
                                  className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500">何を学んだか</label>
                                <textarea
                                  rows={2}
                                  value={editValues.insight}
                                  onChange={(e) => setEditValues({ ...editValues, insight: e.target.value })}
                                  className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500">一般化できる原則</label>
                                <textarea
                                  rows={2}
                                  value={editValues.principle}
                                  onChange={(e) => setEditValues({ ...editValues, principle: e.target.value })}
                                  className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-500">Before</label>
                                  <input
                                    type="text"
                                    value={editValues.before}
                                    onChange={(e) => setEditValues({ ...editValues, before: e.target.value })}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-500">After</label>
                                  <input
                                    type="text"
                                    value={editValues.after}
                                    onChange={(e) => setEditValues({ ...editValues, after: e.target.value })}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500">効果・メリット（1行1項目）</label>
                                <textarea
                                  rows={2}
                                  value={editValues.logic}
                                  onChange={(e) => setEditValues({ ...editValues, logic: e.target.value })}
                                  className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
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
                                        <th className="border-b border-gray-200 px-2 py-1.5 text-left font-medium text-gray-500">誰が</th>
                                        <th className="border-b border-gray-200 px-2 py-1.5 text-left font-medium text-gray-500">何を</th>
                                        <th className="border-b border-gray-200 px-2 py-1.5 text-left font-medium text-gray-500">どうする</th>
                                        <th className="border-b border-gray-200 px-1 py-1.5" />
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
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
                                              aria-label="行を削除"
                                              className="text-gray-400 hover:text-red-600"
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
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={cancelEdit}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150 disabled:opacity-50"
                                >
                                  キャンセル
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void handleSave(k.id)}
                                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:opacity-50"
                                >
                                  {saving ? "保存中…" : "保存"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
