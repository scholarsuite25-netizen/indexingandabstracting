import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getResourceForDownload } from "@/lib/data/tooling";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Authorised downloads. The row must already be visible to the caller under
 * row-level security, so an examination paper (staff-only) or a locked
 * resource answers 404 - the same as any id that does not exist. The file
 * itself is read from inside the repository, never from a client-supplied path.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const { resourceId } = await params;

  const user = await getSessionUser();
  
  if (!user) {
    const { cookies } = await import("next/headers");
    const guestToken = (await cookies()).get("guest_access_token")?.value;
    if (guestToken !== "granted") {
      return NextResponse.json({ error: "Sign in to download this resource." }, { status: 401 });
    }
  }

  const resource = await getResourceForDownload(resourceId);
  if (!resource) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Examination papers and staff-only files never leave the staff room.
  // Guests and students answer 404, the same as an id that does not exist.
  const staff =
    user?.roles.some((role) => role === "admin" || role === "superadmin") ?? false;
  if ((resource.kind === "exam_paper" || resource.visibility === "staff") && !staff) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Links point at their own URL; this route only serves files.
  if (resource.kind === "link" || (!resource.storagePath && !resource.uploadPath)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Files uploaded from the admin screen live in a private bucket. The row's
  // own policy was already checked above, so a short-lived download URL can be
  // handed out; the bucket is never readable without one.
  if (resource.uploadPath) {
    const admin = createAdminSupabase();
    if (!admin) {
      return NextResponse.json({ error: "Uploads are not configured." }, { status: 404 });
    }
    const { data, error } = await admin.storage
      .from("resources")
      .createSignedUrl(resource.uploadPath, 60 * 5, { download: true });
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "The file is not on the server." }, { status: 404 });
    }
    return NextResponse.redirect(data.signedUrl, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Files live in the repository's docs/ folder. The stored path must point
  // straight at one file there, so a stray row cannot climb out of it.
  const storagePath = resource.storagePath;
  if (!storagePath) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const name = path.basename(storagePath);
  if (path.posix.dirname(storagePath) !== "docs" || !name) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const absolute = path.join(process.cwd(), "docs", name);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolute);
  } catch {
    return NextResponse.json({ error: "The file is not on the server." }, { status: 404 });
  }
  if (!stat.isFile()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = new Uint8Array(fs.readFileSync(absolute));
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": resource.mimeType ?? "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${path.basename(absolute)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
