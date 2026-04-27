import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatPopup, { ChatPeer } from "./ChatPopup";
import { useAuth } from "@/contexts/AuthContext";

interface ChatButtonProps {
  peer: ChatPeer;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  label?: string;
  className?: string;
  fullWidth?: boolean;
}

export default function ChatButton({
  peer,
  size = "sm",
  variant = "outline",
  label = "Chat",
  className,
  fullWidth,
}: ChatButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user || !peer?.id || peer.id === user.id) return null;

  return (
    <>
      <Button
        size={size}
        variant={variant}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`${fullWidth ? "w-full" : ""} ${className || ""}`}
      >
        <MessageCircle className="w-4 h-4 mr-1" /> {label}
      </Button>
      {open && <ChatPopup peer={peer} onClose={() => setOpen(false)} />}
    </>
  );
}
