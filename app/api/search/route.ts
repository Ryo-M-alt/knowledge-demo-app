import { NextRequest, NextResponse } from "next/server";
import { MOCK_KNOWLEDGE } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.toLowerCase() ?? "";
  const results = MOCK_KNOWLEDGE.filter(
    (k) =>
      k.topic.toLowerCase().includes(q) ||
      k.summary.toLowerCase().includes(q) ||
      k.tags.some((t) => t.toLowerCase().includes(q))
  );
  return NextResponse.json({ knowledge: results });
}
