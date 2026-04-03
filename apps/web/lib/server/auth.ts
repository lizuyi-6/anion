import { redirect } from "next/navigation";

import type { Viewer } from "@/lib/domain";
import { fetchViewerSession } from "@/lib/server/api";

export async function getViewer(): Promise<Viewer | null> {
  const { viewer } = await fetchViewerSession();
  return viewer;
}

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/auth/sign-in");
  }
  return viewer;
}
