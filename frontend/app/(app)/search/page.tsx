"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  Sparkles,
  Send,
  Plus,
  MessageSquare,
  Trash2,
  PanelLeft,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  ChatMessage,
  Conversation,
  ConversationDetail,
  Property,
  SendResponse,
} from "@/lib/api";
import PropertyCard from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const EXAMPLES = [
  "3 bed apartments in Dubai Marina under 5M with a pool",
  "Is 2.4M fair for a 1200 sqft 2-bed in Dubai Marina?",
  "What fees does my buyer pay on a 2M off-plan purchase?",
  "Cheapest 1 bedroom in JVC",
];

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Every property seen in the thread, keyed by id — messages store only ids.
  const [propsById, setPropsById] = useState<Record<number, Property>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.get<Conversation[]>("/api/chat/conversations"));
    } catch {
      /* sidebar is non-critical — a failure here shouldn't block chatting */
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Keep the newest turn in view as the thread grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function openConversation(id: number) {
    setActiveId(id);
    setSidebarOpen(false);
    setLoadingThread(true);
    try {
      const d = await api.get<ConversationDetail>(`/api/chat/conversations/${id}`);
      setMessages(d.messages);
      setPropsById(Object.fromEntries(d.properties.map((p) => [p.id, p])));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open that chat");
    } finally {
      setLoadingThread(false);
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setPropsById({});
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  async function send(text: string) {
    const body = text.trim();
    if (!body || busy) return;
    setInput("");
    setBusy(true);

    // Optimistic user turn: the AI call takes seconds, and watching your own
    // message sit in the box until it returns feels broken. The negative id is
    // replaced by the server's real one on response.
    const optimistic: ChatMessage = {
      id: -Date.now(),
      role: "user",
      content: body,
      property_ids: [],
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const res = await api.post<SendResponse>(
        `/api/chat/conversations/${activeId ?? 0}/messages`,
        { message: body }
      );
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        res.user_message,
        res.assistant_message,
      ]);
      setPropsById((p) => ({
        ...p,
        ...Object.fromEntries(res.properties.map((x) => [x.id, x])),
      }));
      if (activeId === null) setActiveId(res.conversation_id);
      loadConversations();
    } catch (e) {
      // Roll the optimistic turn back and hand the text to the user rather
      // than losing what they typed.
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(body);
      toast.error(e instanceof Error ? e.message : "Message failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    const prev = conversations;
    setConversations((c) => c.filter((x) => x.id !== id));
    if (activeId === id) newChat();
    try {
      await api.del(`/api/chat/conversations/${id}`);
    } catch {
      setConversations(prev);
      toast.error("Could not delete that chat");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter breaks the line — the convention every chat
    // client uses, so typing here needs no explanation.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const empty = messages.length === 0 && !loadingThread;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 lg:h-[calc(100vh-6rem)]">
      {/* ── Conversation list ── */}
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onOpen={openConversation}
        onNew={newChat}
        onDelete={remove}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Thread ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Show chats"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white lg:hidden"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-xl font-bold tracking-tight text-slate-50">
              <Sparkles className="h-5 w-5 shrink-0 text-brand" /> AI Search
            </h1>
            <p className="truncate text-xs text-slate-500">
              Inventory, market prices, comparables, and fees — ask follow-ups, it remembers.
            </p>
          </div>
        </div>

        <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loadingThread ? (
              <div className="space-y-3">
                <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
                <Skeleton className="h-24 w-5/6 rounded-2xl" />
                <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
              </div>
            ) : empty ? (
              <Welcome onPick={send} />
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <Bubble key={m.id} message={m} propsById={propsById} />
                ))}
                {busy && <Thinking />}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* ── Composer ── */}
          <div className="border-t border-white/10 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask about inventory, prices, comparables, or fees…"
                className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm outline-none transition focus:border-brand/50"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <Button type="submit" size="icon" disabled={busy || !input.trim()} className="h-11 w-11 shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <p className="mt-1.5 px-1 text-[10px] text-slate-600">
              Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationList({
  conversations, activeId, onOpen, onNew, onDelete, open, onClose,
}: {
  conversations: Conversation[];
  activeId: number | null;
  onOpen: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  open: boolean;
  onClose: () => void;
}) {
  const body = (
    <>
      <Button onClick={onNew} variant="secondary" className="mb-3 w-full justify-start">
        <Plus className="h-4 w-4" /> New chat
      </Button>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-xs text-slate-600">
            Your saved chats appear here.
          </p>
        )}
        {conversations.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                active
                  ? "bg-brand/15 text-slate-100 ring-1 ring-brand/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${active ? "text-brand" : ""}`} />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Delete ${c.title}`}
                onClick={(e) => onDelete(c.id, e)}
                onKeyDown={(e) => e.key === "Enter" && onDelete(c.id, e as unknown as React.MouseEvent)}
                className="shrink-0 rounded p-1 text-slate-600 opacity-0 transition hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 flex-col lg:flex">{body}</aside>

      {/* Mobile drawer — same list, so the two can't drift apart */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute inset-y-0 left-0 flex w-[min(17rem,85vw)] flex-col border-r border-white/10 bg-ink-800 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">Your chats</span>
                <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {body}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({
  message, propsById,
}: {
  message: ChatMessage;
  propsById: Record<number, Property>;
}) {
  const isUser = message.role === "user";
  const cards = (message.property_ids || []).map((id) => propsById[id]).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={isUser ? "flex justify-end" : "space-y-3"}
    >
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-md bg-brand/15 px-4 py-2.5 text-sm text-slate-100 ring-1 ring-brand/25"
            : "max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-slate-200"
        }
      >
        {message.content}
      </div>

      {cards.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((p) => (
            <PropertyCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin text-brand" />
      Searching your inventory and the market…
    </div>
  );
}

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 py-8 text-center">
      <div className="rounded-2xl bg-brand/10 p-3 ring-1 ring-brand/25">
        <Sparkles className="h-6 w-6 text-brand" />
      </div>
      <div>
        <p className="font-semibold text-slate-200">Ask me anything about your market</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
          I can search your inventory, check what things actually sold for in DLD records, pull
          comparables to back a price, and look up fees and process. Ask follow-ups — I remember
          the conversation.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => onPick(ex)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-brand/40 hover:text-brand"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
