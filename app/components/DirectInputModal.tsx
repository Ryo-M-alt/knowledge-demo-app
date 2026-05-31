"use client";

import { useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
};

export function DirectInputModal({ open, onClose, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePickFile(file: File) {
    const ok =
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md") ||
      file.type === "text/plain" ||
      file.type === "text/markdown";
    if (!ok) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setText(reader.result);
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleSubmit() {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    onClose();
    setText("");
  }

  function handleClose() {
    onClose();
    setText("");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="direct-input-modal-title"
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <h2 id="direct-input-modal-title" className="text-base font-semibold text-gray-900">
            テキストを直接入力
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePickFile(f);
              e.target.value = "";
            }}
          />
          <div
            className={`rounded-lg border-2 border-dashed px-4 py-4 transition-colors ${
              dragOver ? "border-gray-400 bg-gray-50" : "border-gray-200"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handlePickFile(f);
            }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="テキストをここに貼り付けるか、下のボタンでファイルを選んでください (.txt / .md をドロップも可)"
              className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 placeholder:text-gray-400"
            />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
          >
            ファイルから読み込む (.txt / .md)
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={text.trim() === ""}
            className="flex-1 rounded-lg bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-gray-700 hover:shadow-md hover:brightness-150 transition-all duration-150 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            取込
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:brightness-95 transition-all duration-150"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
