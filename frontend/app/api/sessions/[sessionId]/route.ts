import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/sessions/${sessionId}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      return NextResponse.json({ error: "Backend error" }, { status: response.status });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to connect" }, { status: 502 });
  }
}
