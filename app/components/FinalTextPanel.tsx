"use client";

import { useCallback, useEffect, useState } from "react";
import type { RedactorArchiveDetail } from "@/lib/knowledge-pipeline";

type FinalTextPanelProps = {
  sessionId: string;
  onUpdated?: (archive: RedactorArchiveDetail) => void;
};

export function FinalTextPanel({ sessionId, onUpdated }: FinalTextPanelProps) {
  const [archive, setArchive] = useState<RedactorArchiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/archive/${encodeURIComponent(sessionId)}`);
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "取得に失敗しました";
        throw new Error(msg);
      }
      const detail = data as RedactorArchiveDetail;
      setArchive(detail);
      setDraft(detail.final_text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setArchive(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/archive/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final_text: draft }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "保存に失敗しました";
        throw new Error(msg);
      }
      const detail = data as RedactorArchiveDetail;
      setArchive(detail);
      setDraft(detail.final_text);
      setEditing(false);
      onUpdated?.(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-xs text-gray-500">マスク済みテキストを読み込み中…</p>;
  }

  if (error && !archive) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
        {error}
      </p>
    );
  }

  if (!archive) return null;

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-800">マスク済みテキスト（final_text）</h3>
        <span className="font-mono text-[10px] text-gray-400">{sessionId.slice(0, 8)}…</span>
      </div>

      {archive.draft_id && (
        <p className="text-[11px] text-gray-500">
          元ドラフト ID: <span className="font-mono">{archive.draft_id}</span>
        </p>
      )}
      {archive.knowledge_id && (
        <p className="text-[11px] text-gray-500">
          ナレッジ ID: <span className="font-mono">{archive.knowledge_id}</span>
        </p>
      )}

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          rows={8}
          className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm leading-relaxed text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
        />
      ) : (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-3 font-mono text-sm leading-relaxed text-gray-800">
          {archive.final_text}
        </pre>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setDraft(archive.final_text);
                setError(null);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              キャンセル
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            編集
          </button>
        )}
      </div>
    </section>
  );
}
