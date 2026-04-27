import { useEffect, useRef, useState } from "react";
import { X, Send, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ChatPeer {
  id: string;          // peer user id
  name: string;
  avatar_url?: string | null;
  jobId?: string;      // optional context
}

interface ChatPopupProps {
  peer: ChatPeer;
  onClose: () => void;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

export default function ChatPopup({ peer, onClose }: ChatPopupProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial fetch + subscribe
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, content, created_at, read_at")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled) setMessages((data as Message[]) || []);

      // mark unread incoming as read
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .eq("sender_id", peer.id)
        .is("read_at", null);
    })();

    const channel = supabase
      .channel(`chat-${[user.id, peer.id].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const involvesPair =
            (m.sender_id === user.id && m.recipient_id === peer.id) ||
            (m.sender_id === peer.id && m.recipient_id === user.id);
          if (!involvesPair) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.recipient_id === user.id) {
            supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", m.id);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, peer.id]);

  // Auto scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, minimized]);

  const send = async () => {
    const content = input.trim();
    if (!content || !user || sending) return;
    setSending(true);
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      sender_id: user.id,
      recipient_id: peer.id,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: peer.id,
        content,
        job_id: peer.jobId || null,
      })
      .select("id, sender_id, recipient_id, content, created_at, read_at")
      .single();
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } else if (data) {
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? (data as Message) : m)));
    }
    setSending(false);
  };

  const initials = peer.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      className="fixed z-[100] bottom-3 right-3 sm:bottom-4 sm:right-4 w-[calc(100vw-1.5rem)] sm:w-[360px] rounded-2xl shadow-2xl border border-border bg-card overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in"
      style={{ height: minimized ? 56 : "min(70vh, 520px)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 bg-primary text-primary-foreground cursor-pointer"
        onClick={() => setMinimized((m) => !m)}
      >
        {peer.avatar_url ? (
          <img src={peer.avatar_url} alt={peer.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-primary-foreground/30" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-sm font-semibold">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{peer.name}</p>
          <p className="text-[11px] opacity-80">Direct chat</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }}
          className="p-1 rounded hover:bg-primary-foreground/15"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-1 rounded hover:bg-primary-foreground/15"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/30">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground mt-8">
                No messages yet. Say hello to {peer.name.split(" ")[0]}.
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm break-words ${
                        mine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-background border border-border text-foreground rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <p className={`text-[10px] mt-0.5 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {mine && m.read_at ? " · seen" : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="p-2 border-t border-border bg-card flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 h-9"
              autoFocus
            />
            <Button type="submit" size="icon" disabled={!input.trim() || sending} className="h-9 w-9 shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
