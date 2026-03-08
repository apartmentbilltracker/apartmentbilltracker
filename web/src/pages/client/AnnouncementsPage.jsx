import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { roomService, announcementService } from "../../services/apiService";
import { Spinner, Alert, EmptyState, Avatar } from "../../components/ui";
import { Pin, MessageCircle, ChevronDown, ChevronUp, Send } from "lucide-react";

function AnnouncementCard({ ann, roomId }) {
  const { state } = useAuth();
  const { user } = state;
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(ann.comments || []);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await announcementService.addComment(
        ann.id || ann._id,
        text.trim(),
      );
      const newComment = res?.comment ||
        res?.data || {
          text: text.trim(),
          user: { name: user?.name },
          createdAt: new Date(),
        };
      setComments((c) => [...c, newComment]);
      setText("");
    } catch (_) {}
    setSubmitting(false);
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3">
          {ann.pinned && (
            <Pin size={14} className="text-accent mt-1 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white">
              {ann.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-white/60 mt-1 whitespace-pre-line">
              {ann.content}
            </p>
            <p className="text-xs text-gray-400 dark:text-white/30 mt-2">
              {ann.createdBy?.name || ann.created_by?.name || "Host"} ·{" "}
              {new Date(ann.created_at || ann.createdAt).toLocaleDateString(
                "en-PH",
                { month: "short", day: "numeric", year: "numeric" },
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/40 hover:text-accent transition-colors"
        >
          <MessageCircle size={13} />
          {comments.length} comment{comments.length !== 1 ? "s" : ""}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100 dark:border-white/8 p-4 bg-gray-50/50 dark:bg-white/3 space-y-3">
          {comments.map((c, i) => (
            <div key={c.id || c._id || i} className="flex gap-2 text-sm">
              <Avatar src={null} name={c.user?.name || "?"} size="sm" />
              <div className="flex-1">
                <p className="font-medium text-gray-800 dark:text-white text-xs">
                  {c.user?.name || "User"}
                </p>
                <p className="text-gray-600 dark:text-white/60 text-sm">
                  {c.text || c.content}
                </p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
              placeholder="Write a comment…"
              className="input flex-1 text-sm py-2"
            />
            <button
              onClick={submit}
              disabled={submitting || !text.trim()}
              className="rounded-lg bg-accent text-black px-3 flex items-center justify-center disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnnouncementsPage() {
  const { state } = useAuth();
  const { user } = state;
  const [announcements, setAnnouncements] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
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
        if (!joined) {
          setLoading(false);
          return;
        }
        const id = joined.id || joined._id;
        setRoomId(id);
        const annRes = await announcementService.getRoomAnnouncements(id);
        const all = annRes?.announcements || annRes?.data || [];
        setAnnouncements(
          all.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (
              new Date(b.created_at || b.createdAt) -
              new Date(a.created_at || a.createdAt)
            );
          }),
        );
        // Mark all announcements as read so the badge clears (same as mobile)
        for (const ann of all) {
          announcementService.markAsRead(ann.id || ann._id).catch(() => {});
        }
      } catch (e) {
        setError(e?.message || "Failed to load announcements");
      }
      setLoading(false);
    };
    if (user) load();
  }, [user]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        Announcements
      </h1>
      {error && <Alert type="error" message={error} />}
      {announcements.length === 0 ? (
        <EmptyState
          icon="📢"
          title="No announcements"
          subtitle="Nothing from your host yet"
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <AnnouncementCard key={a.id || a._id} ann={a} roomId={roomId} />
          ))}
        </div>
      )}
    </div>
  );
}
