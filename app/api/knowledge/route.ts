import { NextRequest, NextResponse } from "next/server";
import { MOCK_KNOWLEDGE } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("experience_type");
  const keyword = searchParams.get("keyword")?.toLowerCase() ?? "";

  let results = MOCK_KNOWLEDGE;
  if (type) results = results.filter((k) => k.experienceType === type);
  if (keyword) {
    results = results.filter(
      (k) =>
        k.topic.toLowerCase().includes(keyword) ||
        k.summary.toLowerCase().includes(keyword) ||
        k.tags.some((t) => t.toLowerCase().includes(keyword))
    );
  }

  return NextResponse.json({ items: results });
}
