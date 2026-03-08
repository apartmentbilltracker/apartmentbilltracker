import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { roomService, chatService } from "../../services/apiService";
import { Spinner, Alert, EmptyState, Avatar } from "../../components/ui";
import { Send } from "lucide-react";

const POLL_MS = 6000;

function MessageBubble({ msg, isOwn }) {
  const avatarSrc = msg.sender?.avatar
    ? typeof msg.sender.avatar === "string" && msg.sender.avatar.startsWith("{")
      ? JSON.parse(msg.sender.avatar)?.url
      : msg.sender.avatar?.url || msg.sender.avatar
    : null;

  return (
    <div
      className={`flex gap-2 items-end ${isOwn ? "flex-row-reverse" : ""} mb-3`}
    >
      {!isOwn && (
        <Avatar src={avatarSrc} name={msg.sender?.name || "?"} size="sm" />
      )}
      <div
        className={`max-w-xs lg:max-w-md ${isOwn ? "items-end" : "items-start"} flex flex-col`}
      >
        {!isOwn && (
          <p className="text-xs text-gray-500 dark:text-white/40 mb-1 ml-1">
            {msg.sender?.name || "User"}
          </p>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
            isOwn
              ? "bg-accent text-black rounded-br-sm"
              : "bg-white dark:bg-dark-card text-gray-800 dark:text-white rounded-bl-sm border border-gray-100 dark:border-white/8"
          }`}
        >
          {msg.message || msg.content || msg.text}
        </div>
        <p className="text-xs text-gray-400 dark:text-white/25 mt-1 mx-1">
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
        setError(e?.message || "Failed to load chat");
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
      setError(e?.message || "Failed to send");
    }
    setSending(false);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  if (!room)
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Chat
        </h1>
        <EmptyState
          icon="💬"
          title="No room joined"
          subtitle="Join a room to chat"
        />
      </div>
    );

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      {/* Header */}
      <div className="card p-4 mb-3 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
          {room.name?.[0]?.toUpperCase() || "R"}
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {room.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-white/40">
            {room.members?.length || 0} members
          </p>
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} className="mb-2 shrink-0" />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-0 min-h-0">
        {messages.length === 0 && (
          <EmptyState
            icon="💬"
            title="No messages yet"
            subtitle="Be the first to say something!"
          />
        )}
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
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="card p-3 mt-3 flex gap-2 shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())
          }
          placeholder="Type a message…"
          className="input flex-1 text-sm py-2.5"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="w-10 h-10 rounded-xl bg-accent text-black flex items-center justify-center disabled:opacity-50 hover:bg-accent-dark transition-colors"
        >
          {sending ? <Spinner size="sm" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
