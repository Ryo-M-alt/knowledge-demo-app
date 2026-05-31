"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContextBlock, ContextPreset } from "@/lib/knowledge-pipeline";
import { Trash2 } from "lucide-react";

type ContextStore = {
  version: 1;
  blocks: ContextBlock[];
  presets: ContextPreset[];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ContextSettingsModal({ open, onClose }: Props) {
  const [store, setStore] = useState<ContextStore>({ version: 1, blocks: [], presets: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ブロック入力
  const [newBlockText, setNewBlockText] = useState("");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockText, setEditingBlockText] = useState("");

  // プリセット入力
  const [newPresetName, setNewPresetName] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState("");

  const fetchStore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/context-presets");
      const data = await res.json() as ContextStore;
      setStore(data);
    } catch {
      setError("読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void fetchStore();
  }, [open, fetchStore]);

  const saveStore = async (next: ContextStore) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/context-presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("保存に失敗しました。");
      setStore(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  // ---- ブロック操作 ----

  function addBlock() {
    const text = newBlockText.trim();
    if (!text) return;
    const block: ContextBlock = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() };
    void saveStore({ ...store, blocks: [...store.blocks, block] });
    setNewBlockText("");
  }

  function commitEditBlock(id: string) {
    const text = editingBlockText.trim();
    if (!text) return;
    const next = { ...store, blocks: store.blocks.map((b) => b.id === id ? { ...b, text } : b) };
    void saveStore(next);
    setEditingBlockId(null);
  }

  function removeBlock(id: string) {
    const next = {
      ...store,
      blocks: store.blocks.filter((b) => b.id !== id),
      presets: store.presets.map((p) => ({ ...p, blockIds: p.blockIds.filter((bid) => bid !== id) })),
    };
    void saveStore(next);
  }

  // ---- プリセット操作 ----

  function addPreset() {
    const name = newPresetName.trim();
    if (!name) return;
    const preset: ContextPreset = {
      id: crypto.randomUUID(),
      name,
      blockIds: [],
      isDefault: store.presets.length === 0,
      createdAt: new Date().toISOString(),
    };
    void saveStore({ ...store, presets: [...store.presets, preset] });
    setNewPresetName("");
  }

  function commitEditPreset(id: string) {
    const name = editingPresetName.trim();
    if (!name) return;
    void saveStore({ ...store, presets: store.presets.map((p) => p.id === id ? { ...p, name } : p) });
    setEditingPresetId(null);
  }

  function removePreset(id: string) {
    void saveStore({ ...store, presets: store.presets.filter((p) => p.id !== id) });
  }

  function setDefault(id: string) {
    void saveStore({ ...store, presets: store.presets.map((p) => ({ ...p, isDefault: p.id === id })) });
  }

  function toggleBlockInPreset(presetId: string, blockId: string) {
    const preset = store.presets.find((p) => p.id === presetId);
    if (!preset) return;
    const hasBlock = preset.blockIds.includes(blockId);
    const blockIds = hasBlock
      ? preset.blockIds.filter((bid) => bid !== blockId)
      : [...preset.blockIds, blockId];
    void saveStore({ ...store, presets: store.presets.map((p) => p.id === presetId ? { ...p, blockIds } : p) });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-settings-title"
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        style={{ maxHeight: "88vh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="context-settings-title" className="text-base font-semibold text-gray-900">
            Context B 設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-8">
          {loading && <p className="text-sm text-gray-400">読み込み中…</p>}
          {error && <p className="text-xs text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">{error}</p>}

          {/* ブロック管理 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              コンテキストブロック
            </h3>
            <p className="text-[11px] text-gray-400">
              入力者の役割・業界・プロジェクトなどを短文フレーズで登録します。
            </p>

            {/* 追加フォーム */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newBlockText}
                onChange={(e) => setNewBlockText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addBlock(); }}
                placeholder="例：システム開発PM・10年経験"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
              />
              <button
                type="button"
                onClick={addBlock}
                disabled={saving || !newBlockText.trim()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-300"
              >
                追加
              </button>
            </div>

            {/* ブロック一覧 */}
            {store.blocks.length === 0 ? (
              <p className="text-xs text-gray-400">ブロックがまだありません。</p>
            ) : (
              <ul className="space-y-1.5">
                {store.blocks.map((block) => (
                  <li key={block.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    {editingBlockId === block.id ? (
                      <>
                        <input
                          type="text"
                          value={editingBlockText}
                          onChange={(e) => setEditingBlockText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitEditBlock(block.id); if (e.key === "Escape") setEditingBlockId(null); }}
                          autoFocus
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-gray-500"
                        />
                        <button type="button" onClick={() => commitEditBlock(block.id)} className="text-xs font-medium text-gray-900 hover:underline">保存</button>
                        <button type="button" onClick={() => setEditingBlockId(null)} className="text-xs text-gray-500 hover:underline">キャンセル</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-gray-800">{block.text}</span>
                        <button type="button" onClick={() => { setEditingBlockId(block.id); setEditingBlockText(block.text); }} className="text-xs text-gray-500 hover:text-gray-800">編集</button>
                        <button type="button" onClick={() => removeBlock(block.id)} className="text-gray-400 hover:text-red-500" aria-label="削除"><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* プリセット管理 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              プリセット
            </h3>
            <p className="text-[11px] text-gray-400">
              ブロックの組み合わせをプリセットとして保存します。デフォルトが承認時に自動適用されます。
            </p>

            {/* 追加フォーム */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addPreset(); }}
                placeholder="プリセット名（例：開発PM用）"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
              />
              <button
                type="button"
                onClick={addPreset}
                disabled={saving || !newPresetName.trim()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-300"
              >
                作成
              </button>
            </div>

            {/* プリセット一覧 */}
            {store.presets.length === 0 ? (
              <p className="text-xs text-gray-400">プリセットがまだありません。</p>
            ) : (
              <ul className="space-y-3">
                {store.presets.map((preset) => (
                  <li key={preset.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                    {/* プリセットヘッダー */}
                    <div className="flex items-center gap-2">
                      {editingPresetId === preset.id ? (
                        <>
                          <input
                            type="text"
                            value={editingPresetName}
                            onChange={(e) => setEditingPresetName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitEditPreset(preset.id); if (e.key === "Escape") setEditingPresetId(null); }}
                            autoFocus
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none"
                          />
                          <button type="button" onClick={() => commitEditPreset(preset.id)} className="text-xs font-medium text-gray-900 hover:underline">保存</button>
                          <button type="button" onClick={() => setEditingPresetId(null)} className="text-xs text-gray-500 hover:underline">キャンセル</button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium text-gray-900">{preset.name}</span>
                          {preset.isDefault && (
                            <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white">デフォルト</span>
                          )}
                          {!preset.isDefault && (
                            <button type="button" onClick={() => setDefault(preset.id)} className="text-[11px] text-gray-500 hover:text-gray-900">デフォルトに設定</button>
                          )}
                          <button type="button" onClick={() => { setEditingPresetId(preset.id); setEditingPresetName(preset.name); }} className="text-xs text-gray-500 hover:text-gray-800">編集</button>
                          <button type="button" onClick={() => removePreset(preset.id)} className="text-gray-400 hover:text-red-500" aria-label="削除"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>

                    {/* ブロック選択チェックボックス */}
                    {store.blocks.length === 0 ? (
                      <p className="text-[11px] text-gray-400">ブロックを先に追加してください。</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {store.blocks.map((block) => {
                          const checked = preset.blockIds.includes(block.id);
                          return (
                            <label key={block.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${checked ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleBlockInPreset(preset.id, block.id)}
                                className="sr-only"
                              />
                              {block.text}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
