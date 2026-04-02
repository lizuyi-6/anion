import type { ApplicationStore } from "./ports";

export async function storeUpload(file: File, store: Pick<ApplicationStore, "uploadFile">) {
  return store.uploadFile(file);
}
