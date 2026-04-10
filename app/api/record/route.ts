import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const gasUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRTPT_URL || process.env.GOOGLE_APPS_SCRIPT_URL;

    if (!gasUrl) return NextResponse.json({ error: "No GAS URL" }, { status: 500 });

    const response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "POST failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const gasUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRTPT_URL || process.env.GOOGLE_APPS_SCRIPT_URL;
    if (!gasUrl) return NextResponse.json([]);

    // 구글 스크립트 특유의 리다이렉션을 확실히 처리하기 위해 옵션 추가
    const response = await fetch(gasUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
      redirect: "follow", // 리다이렉션 자동 추적
    });

    if (!response.ok) throw new Error("Network response was not ok");
    
    // 텍스트로 먼저 받아서 비어있는지 혹은 JSON이 아닌지 검증
    const textData = await response.text();
    if (!textData || textData.trim().startsWith("<!DOCTYPE")) {
       console.error("Received HTML instead of JSON from GAS. Check deployment settings.");
       return NextResponse.json([]);
    }

    const data = JSON.parse(textData);
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Leaderboard GET proxy error:", error);
    return NextResponse.json([]);
  }
}
