"use client";

import { useMemo } from "react";
import type { RedactorEntityDTO } from "@/lib/knowledge-pipeline";

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export type MaskHitDTO = {
  startOffset: number;
  endOffset: number;
  ruleId: string;
  ruleLabelJa: string;
  matchedLength: number;
};

type Props = {
  previewOriginal: string;
  maskHits: MaskHitDTO[];
  rulesHitCount: number;
  reviewedEdit: string;
  onReviewedEditChange: (value: string) => void;
  loading: boolean;
  /** redactor Stage 1（正規表現 + NER）適用後テキスト */
  redactorStage1MaskedText?: string | null;
  /** redactor 全エンティティ（Stage 1 + Stage 2） */
  redactorEntities?: readonly RedactorEntityDTO[];
};

// ---------------------------------------------------------------------------
// カテゴリ別スタイル  [REDACTED:種別#ID] の「種別」に対応
// ---------------------------------------------------------------------------

const CATEGORY_BADGE: Record<string, string> = {
  人名:         "bg-red-100    border-red-200    text-red-800",
  役職名:       "bg-orange-100 border-orange-200 text-orange-900",
  組織名:       "bg-purple-100 border-purple-200 text-purple-900",
  行政機関:     "bg-indigo-100 border-indigo-200 text-indigo-900",
  住所:         "bg-green-100  border-green-200  text-green-900",
  電話番号:     "bg-cyan-100   border-cyan-200   text-cyan-900",
  メールアドレス:"bg-teal-100   border-teal-200   text-teal-900",
  金額:         "bg-yellow-100 border-yellow-200 text-yellow-900",
};
const CATEGORY_BADGE_DEFAULT = "bg-gray-100 border-gray-300 text-gray-700";

// ---------------------------------------------------------------------------
// [REDACTED:種別#ID] パーサー + バッジレンダラー
// ---------------------------------------------------------------------------

type TextPart =
  | { kind: "text"; content: string }
  | { kind: "redacted"; category: string; entityId: string; raw: string };

function parseRedactedText(text: string): TextPart[] {
  const pattern = /\[REDACTED:([^#\]]+)#([^\]]+)\]/g;
  const parts: TextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({
      kind: "redacted",
      category: match[1]!,
      entityId: match[2]!,
      raw: match[0],
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ kind: "text", content: text.slice(lastIndex) });
  }
  return parts;
}

/** [REDACTED:種別#ID] をカテゴリ別の色バッジで描画する */
function RedactedTextRenderer({ text }: { text: string }) {
  const parts = useMemo(() => parseRedactedText(text), [text]);

  return (
    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-900">
      {parts.map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.content}</span>;
        const badgeClass = CATEGORY_BADGE[p.category] ?? CATEGORY_BADGE_DEFAULT;
        return (
          <span
            key={i}
            title={p.raw}
            className={`mx-0.5 inline-flex items-baseline gap-1 rounded border px-1.5 py-0.5 align-baseline text-[11px] font-medium leading-tight ${badgeClass}`}
          >
            <span className="font-bold">{p.category}</span>
            <span className="opacity-50 text-[10px]">#{p.entityId}</span>
          </span>
        );
      })}
    </p>
  );
}

// ---------------------------------------------------------------------------
// 原文ハイライト
// ---------------------------------------------------------------------------

function buildHighlightedParts(
  text: string,
  hits: readonly MaskHitDTO[],
): { key: string; text: string; highlight: boolean }[] {
  const sorted = [...hits].sort((a, b) => a.startOffset - b.startOffset);
  const parts: { key: string; text: string; highlight: boolean }[] = [];
  let pos = 0;
  let k = 0;
  for (const h of sorted) {
    if (h.startOffset > pos) {
      parts.push({ key: `n-${k++}`, text: text.slice(pos, h.startOffset), highlight: false });
    }
    if (h.endOffset > h.startOffset) {
      parts.push({ key: `h-${k++}`, text: text.slice(h.startOffset, h.endOffset), highlight: true });
    }
    pos = Math.max(pos, h.endOffset);
  }
  if (pos < text.length) {
    parts.push({ key: `n-${k++}`, text: text.slice(pos), highlight: false });
  }
  return parts;
}

// ---------------------------------------------------------------------------
// 検出語チップ（Stage 1 / Stage 2 リスト用）
// ---------------------------------------------------------------------------

const ENTITY_LABEL_JA: Record<string, string> = {
  PERSON: "人名",
  TITLE: "役職名",
  ORG: "組織名",
  GOV: "行政機関",
  ADDRESS: "住所",
  PHONE: "電話番号",
  EMAIL: "メールアドレス",
  AMOUNT: "金額",
};

function EntityChip({
  label,
  word,
  color,
}: {
  label: string;
  word: string;
  color: "amber" | "blue";
}) {
  const badge =
    color === "amber"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : "bg-blue-100 text-blue-900 border-blue-200";
  const wordStyle =
    color === "amber"
      ? "bg-amber-50 text-amber-950 border-amber-200"
      : "bg-blue-50 text-blue-950 border-blue-200";

  return (
    <span className="inline-flex items-center gap-0 overflow-hidden rounded-md border text-xs">
      <span className={`border-r px-1.5 py-0.5 font-semibold ${badge}`}>{label}</span>
      <span className={`px-1.5 py-0.5 font-mono ${wordStyle}`}>{word}</span>
    </span>
  );
}

function EntityWordList({
  entities,
  color,
}: {
  entities: readonly RedactorEntityDTO[];
  color: "amber" | "blue";
}) {
  if (entities.length === 0) {
    return <p className="text-xs text-gray-400">検出なし</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {entities.map((e) => (
        <EntityChip
          key={e.id}
          label={ENTITY_LABEL_JA[e.label] ?? e.label}
          word={e.text ?? `(${e.id})`}
          color={color}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// セクションカード
// ---------------------------------------------------------------------------

function SectionCard({
  step,
  title,
  subtitle,
  count,
  accentColor,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  count?: number;
  accentColor: "gray" | "amber" | "blue";
  children: React.ReactNode;
}) {
  const headerBg =
    accentColor === "gray"
      ? "bg-gray-50 border-gray-200 text-gray-700"
      : accentColor === "amber"
        ? "bg-amber-50 border-amber-200 text-amber-900"
        : "bg-blue-50 border-blue-200 text-blue-900";
  const badge =
    accentColor === "gray"
      ? "bg-gray-200 text-gray-600"
      : accentColor === "amber"
        ? "bg-amber-200 text-amber-800"
        : "bg-blue-200 text-blue-800";

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className={`flex items-center gap-2 border-b px-3 py-2 ${headerBg}`}>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${badge}`}>
          {step}
        </span>
        <span className="text-xs font-semibold">{title}</span>
        {subtitle && <span className="text-[10px] text-gray-500">{subtitle}</span>}
        {count !== undefined && (
          <span className="ml-auto text-[11px] font-bold tabular-nums">{count} 件</span>
        )}
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// カテゴリ凡例
// ---------------------------------------------------------------------------

function CategoryLegend() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(CATEGORY_BADGE).map(([label, cls]) => (
        <span
          key={label}
          className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${cls}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export function MaskReviewPanel({
  previewOriginal,
  maskHits,
  rulesHitCount,
  reviewedEdit,
  onReviewedEditChange,
  loading,
  redactorStage1MaskedText,
  redactorEntities,
}: Props) {
  const hasRedactor = Boolean(redactorStage1MaskedText);

  const localSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of maskHits) map.set(h.ruleLabelJa, (map.get(h.ruleLabelJa) ?? 0) + 1);
    return [...map.entries()];
  }, [maskHits]);

  const stage1Entities = useMemo(
    () => (redactorEntities ?? []).filter((e) => e.source !== "llm"),
    [redactorEntities],
  );
  const stage2Entities = useMemo(
    () => (redactorEntities ?? []).filter((e) => e.source === "llm"),
    [redactorEntities],
  );

  const originalParts = useMemo(
    () => buildHighlightedParts(previewOriginal, maskHits),
    [previewOriginal, maskHits],
  );

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-4">

      {/* ====== ① 原文 ====== */}
      <SectionCard
        step="原文"
        title="マスク前テキスト"
        subtitle={rulesHitCount > 0 ? `ローカルルール ${rulesHitCount} 箇所` : undefined}
        accentColor="gray"
      >
        <pre
          className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-900"
          aria-label="取り込み原文"
        >
          {originalParts.map((p) =>
            p.highlight ? (
              <mark key={p.key} className="rounded-sm bg-amber-200 px-0.5 text-gray-900">
                {p.text}
              </mark>
            ) : (
              <span key={p.key}>{p.text}</span>
            ),
          )}
        </pre>
        {localSummary.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {localSummary.map(([label, n]) => (
              <span
                key={label}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
              >
                {label} {n}
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ====== ② Stage 1 ====== */}
      {hasRedactor && (
        <SectionCard
          step="Stage 1"
          title="正規表現 + NER 検出"
          count={stage1Entities.length}
          accentColor="amber"
        >
          <EntityWordList entities={stage1Entities} color="amber" />
        </SectionCard>
      )}

      {/* ====== ③ Stage 2 ====== */}
      {hasRedactor && (
        <SectionCard
          step="Stage 2"
          title="LLM 追加検出"
          subtitle="（Stage 1 にない機密情報）"
          count={stage2Entities.length}
          accentColor="blue"
        >
          <EntityWordList entities={stage2Entities} color="blue" />
        </SectionCard>
      )}

      {/* ====== ④ クラウドAIに渡るテキストのプレビュー ====== */}
      <SectionCard
        step="最終"
        title="クラウドAIに渡るテキスト（プレビュー）"
        subtitle="承認するとこの内容が Gemini に送信されます"
        accentColor={hasRedactor ? "blue" : "amber"}
      >
        <div className="space-y-3">
          {/* 凡例 */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              バッジ凡例
            </p>
            <CategoryLegend />
          </div>

          {/* レンダリングプレビュー */}
          <div
            className="max-h-48 overflow-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5"
            aria-label="マスク済みテキストプレビュー"
          >
            <RedactedTextRenderer text={reviewedEdit} />
          </div>

          {/* 編集エリア */}
          <details>
            <summary className="cursor-pointer select-none text-xs font-medium text-gray-500 hover:text-gray-700">
              テキストを手動編集する
            </summary>
            <div className="mt-2 space-y-1">
              <p className="text-[11px] text-gray-400">
                直接編集した場合、上のプレビューにも即座に反映されます。
              </p>
              <textarea
                id="sandbox-reviewed-text"
                value={reviewedEdit}
                onChange={(e) => onReviewedEditChange(e.target.value)}
                disabled={loading}
                rows={6}
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </details>
        </div>
      </SectionCard>

    </div>
  );
}
