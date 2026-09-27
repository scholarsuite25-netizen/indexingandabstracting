import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getReport } from "@/lib/data/admin";

function escapeCsv(value: string): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to download this report." }, { status: 401 });
  }
  if (!user.roles.includes("admin") && !user.roles.includes("superadmin")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  if (!["learners", "attempts", "grades"].includes(kind)) {
    return NextResponse.json({ error: "Unknown report kind." }, { status: 400 });
  }

  const data = await getReport(kind as "learners" | "attempts" | "grades");
  if (!data) {
    return NextResponse.json({ error: "Report unavailable." }, { status: 503 });
  }

  const row = data.rows[0] as Record<string, unknown> | undefined;
  const columns = row ? Object.keys(row) : [];
  const lines: string[] = [columns.join(",")];

  for (const r of data.rows as Record<string, unknown>[]) {
    lines.push(columns.map((c) => escapeCsv(String(r[c] ?? ""))).join(","));
  }

  const body = lines.join("\n");
  const filename = `lis815-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
