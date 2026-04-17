import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/sound";

interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  markRead: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

function showBrowserNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/favicon.png" });
    } catch {
      // ignore (some mobile browsers restrict)
    }
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const pushNotif = (notif: Notification) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      playNotificationSound();
      showBrowserNotification(notif.title, notif.body);
      toast.info(notif.title, { description: notif.body });
    };

    const channel = supabase
      .channel("global-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        (payload: any) => {
          const job = payload.new;
          if (job.customer_id === user.id) return;
          pushNotif({
            id: "job-" + job.id + "-" + Date.now(),
            title: "New Job Posted",
            body: job.title || "A new job is available",
            time: new Date().toLocaleTimeString(),
            read: false,
            link: user.role === "worker" ? "/dashboard/my-jobs" : "/dashboard",
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        (payload: any) => {
          const post = payload.new;
          if (post.author_id === user.id) return;
          pushNotif({
            id: "post-" + post.id + "-" + Date.now(),
            title: "New Community Post",
            body: (post.content || "").slice(0, 80) || "Someone shared a new post",
            time: new Date().toLocaleTimeString(),
            read: false,
            link: "/dashboard/community",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, markRead }}>
      {children}
    </NotificationContext.Provider>
  );
}
