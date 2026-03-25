import { NextResponse } from "next/server";

import { getViewer } from "@/lib/server/auth";
import { storeUpload } from "@/lib/server/services/uploads";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const uploads = await Promise.all(files.map((file) => storeUpload(file, viewer)));

  return NextResponse.json({ uploads });
}
