import { NextRequest, NextResponse } from "next/server";
import { MOCK_DRAFTS } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ drafts: MOCK_DRAFTS });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const newDraft = {
    id: `draft-demo-${Date.now()}`,
    state: "pending_review",
    originalText: body.originalText ?? "",
    reviewedText: body.reviewedText ?? body.originalText ?? "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(newDraft, { status: 201 });
}
