import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { notificationService } from "../../services/apiService";
import { Alert, EmptyState } from "../../components/ui";
import {
  Bell,
  BellOff,
  Check,
  CheckCircle,
  XCircle,
  CreditCard,
  Receipt,
  Megaphone,
  Droplets,
  Activity,
  ChevronDown,
  ChevronUp,
  Layers,
  Inbox,
  SlidersHorizontal,
} from "lucide-react";

const TYPE_META = {
  payment_verified: {
    color:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10",
    icon: CheckCircle,
    category: "finance",
  },
  payment_rejected: {
    color:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10",
    icon: XCircle,
    category: "finance",
  },
  payment_reminder: {
    color:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/10",
    icon: CreditCard,
    category: "finance",
  },
  billing_cycle: {
    color:
      "bg-[#1a7a52]/10 text-[#1a7a52] dark:text-[#7ee8a2] border border-[#1a7a52]/10",
    icon: Receipt,
    category: "finance",
  },
  admin_broadcast: {
    color:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/10",
    icon: Megaphone,
    category: "broadcast",
  },
  presence_reminder: {
    color:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/10",
    icon: Droplets,
    category: "stays",
  },
  presence_confirmation: {
    color:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/10",
    icon: Droplets,
    category: "stays",
  },
  default: {
    color:
      "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/10",
    icon: Bell,
    category: "general",
  },
};

export default function NotificationsPage() {
  const { state } = useAuth();
  const { user } = state;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await notificationService.getNotifications();
      setNotifications(res?.notifications || res?.data || []);
    } catch (e) {
      setError(
        e?.message ||
          "We couldn't pull up your recent updates. Give the page a quick refresh.",
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const markRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((n) =>
        n.map((notif) =>
          (notif.id || notif._id) === id
            ? { ...notif, is_read: true, read: true }
            : notif,
        ),
      );
      window.dispatchEvent(new CustomEvent("badge-refresh"));
    } catch (_) {}
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((n) =>
        n.map((notif) => ({ ...notif, is_read: true, read: true })),
      );
      window.dispatchEvent(new CustomEvent("badge-refresh"));
    } catch (_) {}
  };

  const unreadCount = notifications.filter(
    (n) => !n.is_read && !n.read && !n.isRead,
  ).length;
  const financeCount = notifications.filter(
    (n) => TYPE_META[n.type]?.category === "finance",
  ).length;
  const broadcastCount = notifications.filter(
    (n) => TYPE_META[n.type]?.category === "broadcast",
  ).length;

  const filteredNotifications = notifications.filter((n) => {
    const isRead = n.is_read || n.read || n.isRead;
    const category = TYPE_META[n.type]?.category || "general";

    if (activeFilter === "unread") return !isRead;
    if (activeFilter === "finance") return category === "finance";
    if (activeFilter === "broadcast") return category === "broadcast";
    return true;
  });

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
          Syncing activity logs...
        </p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 px-4 animate-fadeIn">
      {/* Dynamic Glassmorphic Masthead */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 group">
        <div className="absolute -right-20 -top-20 w-52 h-52 rounded-full bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 blur-3xl group-hover:scale-110 transition-transform duration-700" />

        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-xs font-black text-[#1a7a52] dark:text-[#7ee8a2] tracking-wide uppercase">
            <Activity size={12} /> Live Operations Hub
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Activity Timeline
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 max-w-xl">
            Your centralized feed for lease changes, shared ledger balances,
            utility tracking milestones, and house management bulletins.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="self-start md:self-center text-xs font-black text-[#1a7a52] dark:text-[#7ee8a2] border border-[#1a7a52]/20 dark:border-[#7ee8a2]/20 bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 hover:bg-[#1a7a52] hover:text-white dark:hover:bg-[#7ee8a2] dark:hover:text-[#02302e] px-4 py-3 rounded-xl transition-all flex items-center gap-2 shrink-0 shadow-sm"
          >
            <Check size={14} />
            Catch up on all logs
          </button>
        )}
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Overview Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/40">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Attention Required
          </p>
          <p className="text-xl font-black text-[#1a7a52] dark:text-[#7ee8a2] mt-1">
            {unreadCount} unread
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/40">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Lease & Statements
          </p>
          <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">
            {financeCount} items
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/40">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Broadcasting Logs
          </p>
          <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">
            {broadcastCount} alerts
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/40 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Inbox Integrity
            </p>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              Healthy
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Interaction Filters Segment */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {[
            { id: "all", label: "All Activity", icon: Layers },
            {
              id: "unread",
              label: `Fresh Updates (${unreadCount})`,
              icon: Inbox,
            },
            { id: "finance", label: "Payments & Invoices", icon: CreditCard },
            { id: "broadcast", label: "Announcements", icon: Megaphone },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveFilter(tab.id);
                  setExpandedId(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-[#1a7a52] text-white dark:bg-[#7ee8a2] dark:text-[#02302e] shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <TabIcon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <SlidersHorizontal size={11} />
          <span>Refining Views</span>
        </div>
      </div>

      {/* Notification Stream */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={
            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center text-slate-400">
              <BellOff size={24} />
            </div>
          }
          title={
            activeFilter === "all" ? "All clear here" : "No isolated logs found"
          }
          subtitle={
            activeFilter === "all"
              ? "Your timeline is fully updated. We will ping you the split-second actions take place."
              : "No notification parameters match this layout toggle right now."
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n) => {
            const id = n.id || n._id;
            const isRead = n.is_read || n.read || n.isRead;
            const meta = TYPE_META[n.type] || TYPE_META.default;
            const Icon = meta.icon;
            const isExpanded = expandedId === id;

            return (
              <div
                key={id}
                className={`group rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isExpanded
                    ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-md scale-[1.002]"
                    : isRead
                      ? "bg-white/40 dark:bg-slate-900/20 border-slate-200/40 dark:border-slate-800/40 opacity-60 hover:opacity-95"
                      : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                } cursor-pointer p-5 flex items-start gap-4`}
                onClick={() => {
                  if (!isRead) markRead(id);
                  setExpandedId(isExpanded ? null : id);
                }}
              >
                {/* Structural Icon Vault */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-sm ${meta.color}`}
                >
                  <Icon size={18} />
                </div>

                {/* Content Canvas */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={`text-sm tracking-tight leading-snug ${isRead ? "font-bold text-slate-600 dark:text-slate-400" : "font-black text-slate-900 dark:text-white"}`}
                    >
                      {n.title || n.subject}
                    </p>

                    {/* Timestamp Pill */}
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap bg-slate-100/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md">
                      {(() => {
                        const d = new Date(
                          n.sentAt || n.created_at || n.createdAt,
                        );
                        return isNaN(d)
                          ? ""
                          : d.toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                      })()}
                    </span>
                  </div>

                  <p
                    className={`text-xs leading-relaxed font-medium transition-all ${
                      isRead
                        ? "text-slate-400 dark:text-slate-500"
                        : "text-slate-600 dark:text-slate-300"
                    } ${isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}`}
                  >
                    {n.message || n.body || n.content}
                  </p>

                  {/* Micro-Interaction Hint */}
                  <div className="flex items-center gap-1 pt-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:opacity-100 transition-opacity">
                    <span>{isExpanded ? "Minimize logs" : "Read fully"}</span>
                    {isExpanded ? (
                      <ChevronUp size={10} />
                    ) : (
                      <ChevronDown size={10} />
                    )}
                  </div>
                </div>

                {/* Animated Unread Pulse Indicator */}
                {!isRead && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1a7a52] dark:bg-[#7ee8a2] mt-2 shrink-0 animate-pulse ring-4 ring-[#1a7a52]/10 dark:ring-[#7ee8a2]/10" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
