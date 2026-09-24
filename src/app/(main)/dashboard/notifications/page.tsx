import type { Metadata } from "next";

import { NotificationPreferences } from "./_components/notification-preferences";

export const metadata: Metadata = {
  title: "Notification Preferences",
  description: "Choose which tender alerts you receive and where they are delivered.",
};

export default function NotificationsPage() {
  return <NotificationPreferences />;
}
