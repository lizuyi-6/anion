import type { Viewer } from "@/lib/domain";
import { getDataStore } from "@/lib/server/store/repository";

export async function storeUpload(file: File, viewer: Viewer) {
  const store = await getDataStore({ viewer });
  return store.uploadFile(file);
}
