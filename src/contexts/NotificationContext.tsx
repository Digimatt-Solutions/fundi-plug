import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
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

const notificationSound = new Audio("/notification.wav");
notificationSound.volume = 0.5;

function playNotificationSound() {
  notificationSound.currentTime = 0;
  notificationSound.play().catch(() => {});
}

function showBrowserNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        (payload: any) => {
          const job = payload.new;
          // Don't notify the person who posted the job
          if (job.customer_id === user.id) return;

          const notif: Notification = {
            id: job.id + "-" + Date.now(),
            title: "New Job Posted",
            body: job.title || "A new job is available",
            time: new Date().toLocaleTimeString(),
            read: false,
          };
          setNotifications((prev) => [notif, ...prev].slice(0, 50));
          playNotificationSound();
          showBrowserNotification(notif.title, notif.body);
          toast.info(notif.title, { description: notif.body });
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
