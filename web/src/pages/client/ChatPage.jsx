import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { roomService, chatService } from "../../services/apiService";
import { Alert, EmptyState, Avatar } from "../../components/ui";
import {
  Send,
  Activity,
  MessageSquare,
  Users,
  Hash,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

const POLL_MS = 6000;

function MessageBubble({ msg, isOwn }) {
  const avatarSrc = msg.sender?.avatar
    ? typeof msg.sender.avatar === "string" && msg.sender.avatar.startsWith("{")
      ? JSON.parse(msg.sender.avatar)?.url
      : msg.sender.avatar?.url || msg.sender.avatar
    : null;

  return (
    <div
      className={`flex gap-3 items-end ${isOwn ? "flex-row-reverse" : ""} mb-4 animate-fadeIn`}
    >
      {!isOwn && (
        <div className="shrink-0 mb-1 transition-transform hover:scale-105">
          <Avatar src={avatarSrc} name={msg.sender?.name || "?"} size="sm" />
        </div>
      )}

      <div
        className={`max-w-xs sm:max-w-md md:max-w-lg ${isOwn ? "items-end" : "items-start"} flex flex-col`}
      >
        {!isOwn && (
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 ml-1">
            {msg.sender?.name || "Resident"}
          </p>
        )}

        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed font-medium shadow-sm transition-all duration-200 ${
            isOwn
              ? "bg-[#1a7a52] text-white dark:bg-[#7ee8a2] dark:text-[#02302e] rounded-br-sm selection:bg-white/20"
              : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-200/60 dark:border-slate-800/80"
          }`}
        >
          {msg.message || msg.content || msg.text}
        </div>

        <p className="text-[9px] font-bold tracking-tight text-slate-400 dark:text-slate-500 mt-1 mx-1.5 uppercase">
          {new Date(
            msg.created_at || msg.createdAt || msg.timestamp,
          ).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { state } = useAuth();
  const { user } = state;
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const lastIdRef = useRef(null);
  const pollRef = useRef(null);

  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  const fetchMessages = useCallback(async (roomId, initial = false) => {
    try {
      if (initial) {
        const res = await chatService.getMessages(roomId, { limit: 50 });
        const msgs = res?.messages || res?.data || [];
        setMessages(msgs);
        if (msgs.length)
          lastIdRef.current =
            msgs[msgs.length - 1]?.id || msgs[msgs.length - 1]?._id;
      } else if (lastIdRef.current) {
        const res = await chatService.getNewMessages(roomId, lastIdRef.current);
        const newMsgs = res?.messages || res?.data || [];
        if (newMsgs.length) {
          setMessages((prev) => [...prev, ...newMsgs]);
          lastIdRef.current =
            newMsgs[newMsgs.length - 1]?.id || newMsgs[newMsgs.length - 1]?._id;
          scrollToBottom();
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const roomsRes = await roomService.getClientRooms();
        const rooms = Array.isArray(roomsRes)
          ? roomsRes
          : roomsRes?.rooms || roomsRes?.data || [];
        const joined = rooms.find((r) =>
          r.members?.some(
            (m) =>
              String(m.user?._id || m.user?.id || m.user) ===
              String(user?.id || user?._id),
          ),
        );
        if (joined) {
          setRoom(joined);
          await fetchMessages(joined.id || joined._id, true);
        }
      } catch (e) {
        setError(
          e?.message ||
            "We encountered a temporary interruption pulling up your community lounges.",
        );
      }
      setLoading(false);
    };
    if (user) init();
  }, [user, fetchMessages]);

  useEffect(() => {
    if (!room) return;
    const roomId = room.id || room._id;
    pollRef.current = setInterval(() => fetchMessages(roomId, false), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [room, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || !room || sending) return;
    const content = text.trim();
    setText("");
    setSending(true);
    try {
      const res = await chatService.sendMessage(room.id || room._id, content);
      const msg = res?.message ||
        res?.data || {
          message: content,
          sender: { name: user?.name, _id: user?.id || user?._id },
          createdAt: new Date(),
        };
      setMessages((prev) => [...prev, msg]);
      lastIdRef.current = msg.id || msg._id || lastIdRef.current;
      scrollToBottom();
    } catch (e) {
      setError(
        e?.message ||
          "That message didn't make it to the channel log. Let's try sending it again.",
      );
    }
    setSending(false);
  };

  /* Premium Dual-Ring Core Synchronizer */
  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-48 space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-16 h-16 rounded-2xl bg-[#1a7a52]/20 dark:bg-[#7ee8a2]/10 animate-ping duration-1000" />
          <div className="w-12 h-12 rounded-2xl border-2 border-slate-200 dark:border-slate-800 border-t-[#1a7a52] dark:border-t-[#7ee8a2] animate-spin" />
          <div className="absolute w-5 h-5 rounded-xl bg-gradient-to-br from-[#1a7a52] to-[#135c3d] dark:from-[#7ee8a2] dark:to-[#64d08b] shadow-md flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#02302e] animate-pulse" />
          </div>
        </div>
        <p className="text-xs font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase animate-pulse pt-2">
          Syncing community channels...
        </p>
      </div>
    );

  if (!room)
    return (
      <div className="space-y-6 max-w-5xl mx-auto px-4 animate-fadeIn">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Community Channels
          </h1>
        </div>
        <EmptyState
          icon={
            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center text-slate-400">
              <MessageSquare size={24} />
            </div>
          }
          title="No active lounge found"
          subtitle="You haven't been assigned to a property lounge or staff desk chat stream yet."
        />
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 flex flex-col h-[calc(100vh-8.5rem)] md:h-[calc(100vh-9rem)] animate-fadeIn">
      {/* Premium Glassmorphic Channel Masthead */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-4 mb-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4 group shrink-0">
        <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 blur-3xl group-hover:scale-110 transition-transform duration-700" />

        <div className="flex items-center gap-3.5 z-10">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1a7a52] to-[#135c3d] dark:from-[#7ee8a2] dark:to-[#64d08b] text-white dark:text-[#02302e] flex items-center justify-center font-black text-base shadow-sm shrink-0">
            {room.name?.[0]?.toUpperCase() || <Hash size={18} />}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="font-black text-slate-900 dark:text-white text-sm tracking-tight leading-none">
                {room.name}
              </p>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wide">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />{" "}
                Live Feed
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Users size={12} className="text-slate-300 dark:text-slate-600" />
              <span>
                {room.members?.length || 0} household members connected
              </span>
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40 px-2.5 py-1 rounded-lg">
          <Activity size={11} className="text-emerald-500" />
          <span>Secured Sync</span>
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} className="mb-3 shrink-0" />
      )}

      {/* Messages Canvas Frame */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-1 min-h-0 custom-scrollbar rounded-xl bg-slate-50/30 dark:bg-slate-950/10 border border-slate-200/30 dark:border-slate-800/20 shadow-inner">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center py-12">
            <EmptyState
              icon={
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center text-slate-400 shadow-sm animate-bounce duration-1000">
                  <Sparkles size={22} className="text-amber-500" />
                </div>
              }
              title="The floor is yours"
              subtitle="This channel is quiet right now. Start the conversation with your roommates or property staff below."
            />
          </div>
        )}

        <div className="pb-1">
          {messages.map((msg, i) => {
            const senderId = msg.sender?._id || msg.sender?.id || msg.sender;
            const isOwn = String(senderId) === String(user?.id || user?._id);
            return (
              <MessageBubble
                key={msg.id || msg._id || i}
                msg={msg}
                isOwn={isOwn}
              />
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Luxury Interaction Transmission Box */}
      <div className="p-4 mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3 shrink-0 group focus-within:border-slate-300 dark:focus-within:border-slate-700 focus-within:shadow-md transition-all duration-300">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())
          }
          placeholder="Share something with the house..."
          className="flex-1 text-sm py-2 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-medium"
        />

        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="w-10 h-10 rounded-xl bg-[#1a7a52] hover:bg-[#135c3d] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] flex items-center justify-center disabled:opacity-40 shadow-sm transition-all duration-200 shrink-0 transform active:scale-95 group-focus-within:rotate-0"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={15} className="ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
