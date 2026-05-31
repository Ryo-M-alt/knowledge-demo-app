import { NextResponse } from "next/server";

const MOCK_STRUCTURED = {
  topic: "アジェンダなしの会議：事前共有で結論率が上がる",
  tags: ["会議", "ファシリテーション", "習慣"],
  summary: "アジェンダなしで臨んだ会議で結論が出なかった。事前共有を徹底したところ、議論の質が上がった。",
  before: "アジェンダなし、当日ぶっつけ本番",
  after: "事前アジェンダ共有で結論率が向上",
  insight: "参加者が事前に考えてくる時間があると、会議の密度が変わる。",
  cause: "「その場で決めればいい」という思い込みがあった。",
  principle: "会議は準備した分だけ短くなる。アジェンダは必ず前日までに共有する。",
};

export async function POST(req: Request) {
  const body = await req.json() as Record<string, unknown>;
  const approved = body.approved === true;

  if (!approved) {
    const draftId = `draft-demo-${Date.now()}`;
    const rawText = typeof body.rawText === "string" ? body.rawText : "（デモテキスト）";
    return NextResponse.json({
      kind: "preview",
      draftId,
      reviewedText: rawText,
      state: "pending_review",
      rulesHitCount: 0,
      maskHits: [],
      registeredProperNounCount: 0,
      registeredUniformReplacementGroupCount: 0,
      redactorEntities: [],
      redactorSessionId: null,
      redactorStage1MaskedText: null,
    });
  }

  return NextResponse.json({
    kind: "completed",
    savedKnowledgeId: `demo-saved-${Date.now()}`,
    ...MOCK_STRUCTURED,
  });
}
