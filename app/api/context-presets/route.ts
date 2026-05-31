import { NextResponse } from "next/server";
import { MOCK_CONTEXT_BLOCKS, MOCK_CONTEXT_PRESETS } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({
    version: 1,
    blocks: MOCK_CONTEXT_BLOCKS,
    presets: MOCK_CONTEXT_PRESETS,
  });
}

export async function PUT() {
  return NextResponse.json({ ok: true });
}
