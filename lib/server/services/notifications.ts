import { toId } from "@/lib/utils";
import type { DataStore } from "@/lib/server/store/repository";

export interface UserNotification {
  id: string;
  userId: string;
  type: "reminder" | "milestone" | "suggestion" | "system";
  title: string;
  body: string;
  actionHref?: string;
  read: boolean;
  createdAt: string;
}

export async function createNotification(
  store: DataStore,
  params: Omit<UserNotification, "id" | "read" | "createdAt">,
): Promise<UserNotification> {
  const notification: UserNotification = {
    id: toId("notif"),
    read: false,
    createdAt: new Date().toISOString(),
    ...params,
  };
  await store.createNotification(notification);
  return notification;
}

export async function listUnreadNotifications(
  store: DataStore,
  userId: string,
): Promise<UserNotification[]> {
  const all = await store.listNotifications(userId, { unreadOnly: true });
  return all;
}

export async function markNotificationRead(
  store: DataStore,
  id: string,
): Promise<void> {
  await store.markNotificationRead(id);
}
