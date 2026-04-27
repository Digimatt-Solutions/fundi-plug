import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import ChatPopup, { ChatPeer } from "@/components/chat/ChatPopup";

interface ConvRow {
  peer_id: string;
  peer_name: string;
  peer_avatar: string | null;
  last_content: string;
  last_at: string;
  last_sender_id: string;
  unread: number;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<ChatPeer | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, created_at, read_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(500);

    const map = new Map<string, ConvRow>();
    (msgs || []).forEach((m: any) => {
      const peerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      const existing = map.get(peerId);
      if (!existing) {
        map.set(peerId, {
          peer_id: peerId,
          peer_name: "",
          peer_avatar: null,
          last_content: m.content,
          last_at: m.created_at,
          last_sender_id: m.sender_id,
          unread: m.recipient_id === user.id && !m.read_at ? 1 : 0,
        });
      } else if (m.recipient_id === user.id && !m.read_at) {
        existing.unread += 1;
      }
    });

    const peerIds = Array.from(map.keys());
    if (peerIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", peerIds);
      (profs || []).forEach((p: any) => {
        const c = map.get(p.id);
        if (c) {
          c.peer_name = p.name || "User";
          c.peer_avatar = p.avatar_url;
        }
      });
    }

    setConvs(Array.from(map.values()).sort((a, b) => +new Date(b.last_at) - +new Date(a.last_at)));
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`chat-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return convs;
    return convs.filter((c) => c.peer_name.toLowerCase().includes(s) || c.last_content.toLowerCase().includes(s));
  }, [convs, q]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Chats</h1>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats..." className="pl-9" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading conversations...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start a chat from a job, booking, or fundi profile.
            </p>
          </div>
        ) : (
          filtered.map((c) => {
            const initials = (c.peer_name || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            const fromMe = c.last_sender_id === user?.id;
            return (
              <button
                key={c.peer_id}
                onClick={() => setActive({ id: c.peer_id, name: c.peer_name, avatar_url: c.peer_avatar })}
                className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-muted/40 transition text-left"
              >
                {c.peer_avatar ? (
                  <img src={c.peer_avatar} alt={c.peer_name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold truncate">{c.peer_name || "User"}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(c.last_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${c.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {fromMe ? "You: " : ""}{c.last_content}
                    </p>
                    {c.unread > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0">
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {active && <ChatPopup peer={active} onClose={() => { setActive(null); load(); }} />}
    </div>
  );
}
