import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    kind: "draft_created",
    draftId: `draft-demo-${Date.now()}`,
    rulesHitCount: 0,
    message: "下書きを作成しました（デモモード）。",
  });
}
