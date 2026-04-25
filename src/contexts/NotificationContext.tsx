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

  // App update detection - polls index.html and notifies users when a new build is deployed
  useEffect(() => {
    let initialHash: string | null = null;
    let notified = false;

    const fetchHash = async (): Promise<string | null> => {
      try {
        const res = await fetch("/index.html", { cache: "no-store" });
        const text = await res.text();
        // Hash a slice that contains the bundled script tag (changes per build)
        const match = text.match(/src="\/assets\/[^"]+\.js"/g)?.join("|") || text.slice(0, 500);
        let hash = 0;
        for (let i = 0; i < match.length; i++) hash = (hash * 31 + match.charCodeAt(i)) | 0;
        return String(hash);
      } catch {
        return null;
      }
    };

    const check = async () => {
      const h = await fetchHash();
      if (!h) return;
      if (initialHash === null) { initialHash = h; return; }
      if (h !== initialHash && !notified) {
        notified = true;
        const notif: Notification = {
          id: "app-update-" + Date.now(),
          title: "App update available",
          body: "A new version is ready. Please refresh the page to get the latest features.",
          time: new Date().toLocaleTimeString(),
          read: false,
        };
        setNotifications((prev) => [notif, ...prev].slice(0, 50));
        playNotificationSound();
        showBrowserNotification(notif.title, notif.body);
        toast.info(notif.title, {
          description: notif.body,
          duration: 15000,
          action: { label: "Refresh", onClick: () => window.location.reload() },
        });
      }
    };

    check();
    const interval = setInterval(check, 60_000); // every minute
    return () => clearInterval(interval);
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
