import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "アーカイブが見つかりません。" }, { status: 404 });
}

export async function PATCH() {
  return NextResponse.json({ error: "アーカイブが見つかりません。" }, { status: 404 });
}
