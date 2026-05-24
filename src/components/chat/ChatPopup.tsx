import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, Minus, Check, CheckCheck, Clock, Paperclip, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface ChatPeer {
  id: string;
  name: string;
  avatar_url?: string | null;
  jobId?: string;
}

interface ChatPopupProps {
  peer: ChatPeer;
  onClose: () => void;
  embedded?: boolean;
  initialDraft?: string;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
}

const SELECT_COLS = "id, sender_id, recipient_id, content, created_at, delivered_at, read_at, attachment_url, attachment_type, attachment_name";

export default function ChatPopup({ peer, onClose, embedded = false, initialDraft }: ChatPopupProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialDraft ?? "");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const markIncoming = async (ids: string[], asRead: boolean) => {
    if (!ids.length || !user) return;
    const now = new Date().toISOString();
    const patch: any = { delivered_at: now };
    if (asRead) patch.read_at = now;
    await supabase.from("messages").update(patch).in("id", ids).eq("recipient_id", user.id);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select(SELECT_COLS)
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      const list = (data as Message[]) || [];
      setMessages(list);
      const incomingIds = list.filter((m) => m.recipient_id === user.id && (!m.read_at || !m.delivered_at)).map((m) => m.id);
      markIncoming(incomingIds, true);
    })();

    const channel = supabase
      .channel(`chat-${[user.id, peer.id].sort().join("-")}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        const involvesPair = (m.sender_id === user.id && m.recipient_id === peer.id) || (m.sender_id === peer.id && m.recipient_id === user.id);
        if (!involvesPair) return;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.recipient_id === user.id) markIncoming([m.id], !minimized);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        const involvesPair = (m.sender_id === user.id && m.recipient_id === peer.id) || (m.sender_id === peer.id && m.recipient_id === user.id);
        if (!involvesPair) return;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, peer.id]);

  useEffect(() => {
    if (minimized || !user) return;
    const ids = messages.filter((m) => m.recipient_id === user.id && !m.read_at).map((m) => m.id);
    if (ids.length) markIncoming(ids, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, minimized]);

  const sendMessage = async (payload: { content?: string; attachment_url?: string; attachment_type?: string; attachment_name?: string }) => {
    if (!user) return;
    const tmpId = `tmp-${Date.now()}`;
    const optimistic: Message = {
      id: tmpId,
      sender_id: user.id,
      recipient_id: peer.id,
      content: payload.content || null,
      created_at: new Date().toISOString(),
      delivered_at: null,
      read_at: null,
      attachment_url: payload.attachment_url || null,
      attachment_type: payload.attachment_type || null,
      attachment_name: payload.attachment_name || null,
    };
    setMessages((prev) => [...prev, optimistic]);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: peer.id,
        content: payload.content || "",
        job_id: peer.jobId || null,
        attachment_url: payload.attachment_url || null,
        attachment_type: payload.attachment_type || null,
        attachment_name: payload.attachment_name || null,
      })
      .select(SELECT_COLS)
      .single();
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error("Failed to send message");
    } else if (data) {
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? (data as Message) : m)));
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    await sendMessage({ content });
    setSending(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type });
    if (upErr) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    await sendMessage({
      attachment_url: pub.publicUrl,
      attachment_type: file.type,
      attachment_name: file.name,
    });
    setUploading(false);
  };

  const initials = peer.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const Body = (
    <>
      {!embedded && (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-primary text-primary-foreground cursor-pointer" onClick={() => setMinimized((m) => !m)}>
          {peer.avatar_url ? (
            <img src={peer.avatar_url} alt={peer.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-primary-foreground/30" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-sm font-semibold">{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] sm:text-sm font-semibold truncate">{peer.name}</p>
            <p className="text-[10px] sm:text-[11px] opacity-80">Direct chat</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }} className="p-1 rounded hover:bg-primary-foreground/15"><Minus className="w-4 h-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 rounded hover:bg-primary-foreground/15"><X className="w-4 h-4" /></button>
        </div>
      )}

      {(embedded || !minimized) && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/30">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground mt-8">No messages yet. Say hello to {peer.name.split(" ")[0]}.</p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === user?.id;
                const pending = mine && m.id.startsWith("tmp-");
                const delivered = mine && !!m.delivered_at;
                const seen = mine && !!m.read_at;
                const isImage = (m.attachment_type || "").startsWith("image/");
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-[12.5px] sm:text-sm break-words leading-snug ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border border-border text-foreground rounded-bl-sm"}`}>
                      {m.attachment_url && (
                        isImage ? (
                          <a href={m.attachment_url} target="_blank" rel="noreferrer">
                            <img src={m.attachment_url} alt={m.attachment_name || "image"} className="rounded-lg max-h-60 object-cover mb-1" />
                          </a>
                        ) : (
                          <a href={m.attachment_url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 ${mine ? "bg-white/15" : "bg-muted"}`}>
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate text-xs">{m.attachment_name || "Document"}</span>
                          </a>
                        )
                      )}
                      {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                      <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${mine ? "opacity-90" : "text-muted-foreground"}`}>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {mine && (pending ? <Clock className="w-3 h-3" /> : seen ? <CheckCheck className="w-3.5 h-3.5 text-sky-300" /> : delivered ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-2 border-t border-border bg-card flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx" className="hidden" onChange={handleFile} />
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach file">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." className="flex-1 h-9" autoFocus />
            <Button type="submit" size="icon" disabled={!input.trim() || sending} className="h-9 w-9 shrink-0"><Send className="w-4 h-4" /></Button>
          </form>
        </>
      )}
    </>
  );

  if (embedded) {
    return <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">{Body}</div>;
  }

  return createPortal(
    <div className="fixed z-[100] bottom-3 right-3 sm:bottom-4 sm:right-4 w-[calc(100vw-1.5rem)] sm:w-[340px] md:w-[360px] rounded-2xl shadow-2xl border border-border bg-card overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in"
      style={{ height: minimized ? 56 : "min(70vh, 520px)" }}>
      {Body}
    </div>,
    document.body
  );
}
