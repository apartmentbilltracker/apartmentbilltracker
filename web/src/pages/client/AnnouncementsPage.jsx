import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { roomService, announcementService } from "../../services/apiService";
import { Alert, EmptyState, Avatar } from "../../components/ui";
import {
  Pin,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Send,
  Activity,
  Megaphone,
  CornerDownRight,
} from "lucide-react";

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
    <div
      className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
        ann.pinned
          ? "border-amber-200 dark:border-amber-950/40 bg-gradient-to-br from-amber-50/20 via-white/80 to-transparent dark:from-amber-950/5 dark:via-slate-900/60 shadow-sm"
          : "border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 shadow-sm"
      } hover:shadow-md backdrop-blur-xl`}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          {ann.pinned && (
            <div
              className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner"
              title="Pinned notice"
            >
              <Pin size={14} className="rotate-45" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                {ann.title}
              </h3>
              {ann.pinned && (
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/10">
                  Important Note
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-line leading-relaxed">
              {ann.content}
            </p>

            <div className="flex items-center gap-2 mt-4 pt-1 text-xs text-slate-400 dark:text-slate-500 font-semibold">
              <span className="text-slate-700 dark:text-slate-300 font-bold">
                {ann.createdBy?.name || ann.created_by?.name || "Property Host"}
              </span>
              <span>•</span>
              <span>
                {new Date(ann.created_at || ann.createdAt).toLocaleDateString(
                  "en-PH",
                  { month: "short", day: "numeric", year: "numeric" },
                )}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className={`mt-4 flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
            open
              ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              : "bg-transparent text-slate-500 dark:text-slate-400 border-slate-200/40 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <MessageCircle size={14} />
          <span>
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800/60 p-5 bg-slate-50/40 dark:bg-slate-950/30 space-y-4 animate-fadeIn">
          {comments.length > 0 && (
            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
              {comments.map((c, i) => (
                <div
                  key={c.id || c._id || i}
                  className="flex gap-3 text-sm items-start bg-white/50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40"
                >
                  <div className="mt-0.5 shrink-0">
                    <Avatar
                      src={null}
                      name={c.user?.name || "?"}
                      size="sm"
                      className="font-bold bg-slate-100 dark:bg-slate-800"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 dark:text-slate-200 text-xs">
                      {c.user?.name || "Resident Roommate"}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-xs font-medium mt-1 leading-relaxed whitespace-pre-line">
                      {c.text || c.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 items-center">
            <div className="text-slate-400 pl-1 shrink-0 hidden sm:block">
              <CornerDownRight size={14} />
            </div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
              placeholder="Share your thoughts with the room..."
              className="flex-1 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:border-[#1a7a52] dark:focus:border-[#7ee8a2] shadow-inner text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
            <button
              onClick={submit}
              disabled={submitting || !text.trim()}
              className="rounded-xl bg-[#1a7a52] text-white hover:bg-[#135c3d] dark:bg-[#7ee8a2] dark:text-[#02302e] dark:hover:bg-[#64d08b] p-3 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md group shrink-0"
              title="Post comment"
            >
              <Send
                size={14}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
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

        for (const ann of all) {
          announcementService.markAsRead(ann.id || ann._id).catch(() => {});
        }
      } catch (e) {
        setError(
          e?.message ||
            "We couldn't load the bulletin notices. Give the page a quick refresh.",
        );
      }
      setLoading(false);
    };
    if (user) load();
  }, [user]);

  /* Main Glowing Homepage Loading Animation Copy */
  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-48 space-y-4">
        <div className="relative flex items-center justify-center">
          {/* Glassmorphic outer glowing ripple */}
          <div className="absolute w-16 h-16 rounded-2xl bg-[#1a7a52]/20 dark:bg-[#7ee8a2]/10 animate-ping duration-1000" />
          {/* Main spinning element */}
          <div className="w-12 h-12 rounded-2xl border-2 border-slate-200 dark:border-slate-800 border-t-[#1a7a52] dark:border-t-[#7ee8a2] animate-spin" />
          {/* Inner brand identity accent */}
          <div className="absolute w-5 h-5 rounded-xl bg-gradient-to-br from-[#1a7a52] to-[#135c3d] dark:from-[#7ee8a2] dark:to-[#64d08b] shadow-md flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#02302e] animate-pulse" />
          </div>
        </div>
        <p className="text-xs font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase animate-pulse pt-2">
          Syncing new announcements...
        </p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 px-4 animate-fadeIn">
      {/* Top Header Row Panel */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex items-center justify-between group">
        <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 blur-3xl group-hover:scale-110 transition-transform duration-700" />

        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-xs font-black text-[#1a7a52] dark:text-[#7ee8a2] tracking-wide mb-2 uppercase">
            <Activity size={12} /> Live Broadcasts
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Community Notice Board
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 max-w-xl">
            Stay in the loop with live housing updates, scheduled maintenance
            notices, and general announcements from your host.
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {announcements.length === 0 ? (
        <EmptyState
          icon="📢"
          title="All quiet right now"
          subtitle="Your property notice board is currently clear. We'll broadcast any host updates directly here."
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
