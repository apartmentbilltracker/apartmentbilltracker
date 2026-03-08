import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { notificationService } from "../../services/apiService";
import { Spinner, Alert, EmptyState } from "../../components/ui";
import { Bell, BellOff, Check } from "lucide-react";

const TYPE_COLORS = {
  payment:
    "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300",
  billing: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  announcement:
    "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300",
  default: "bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50",
};

export default function NotificationsPage() {
  const { state } = useAuth();
  const { user } = state;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await notificationService.getNotifications();
      setNotifications(res?.notifications || res?.data || []);
    } catch (e) {
      setError(e?.message || "Failed to load notifications");
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

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Notifications{" "}
          {unreadCount > 0 && (
            <span className="ml-2 text-sm font-normal text-accent">
              ({unreadCount} unread)
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            <Check size={12} />
            Mark all read
          </button>
        )}
      </div>

      {error && <Alert type="error" message={error} />}

      {notifications.length === 0 ? (
        <EmptyState
          icon={
            <BellOff size={36} className="text-gray-300 dark:text-white/20" />
          }
          title="No notifications"
          subtitle="You're all caught up!"
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const id = n.id || n._id;
            const isRead = n.is_read || n.read || n.isRead;
            const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.default;
            return (
              <div
                key={id}
                className={`card p-4 flex items-start gap-3 cursor-pointer transition-all ${isRead ? "opacity-70" : "border-l-4 border-accent"}`}
                onClick={() => !isRead && markRead(id)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
                >
                  <Bell size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${isRead ? "text-gray-600 dark:text-white/50" : "text-gray-900 dark:text-white"}`}
                  >
                    {n.title || n.subject}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5 line-clamp-2">
                    {n.message || n.body || n.content}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
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
                  </p>
                </div>
                {!isRead && (
                  <div className="w-2.5 h-2.5 rounded-full bg-accent mt-1 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
