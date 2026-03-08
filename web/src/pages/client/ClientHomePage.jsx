import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  billingCycleService,
  announcementService,
  badgeService,
  memberService,
  settingsService,
  paymentService,
} from "../../services/apiService";
import { Avatar, Spinner, StatusBadge, EmptyState } from "../../components/ui";
import {
  FileText,
  Megaphone,
  Bell,
  User,
  ChevronRight,
  Zap,
  Droplets,
  Wifi,
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle,
  Home,
  BookOpen,
  Smartphone,
  X,
} from "lucide-react";

const r2 = (n) => Math.round((n || 0) * 100) / 100;

const APP_DEEP_LINK = "aptbilltracker://bills";

function tryOpenApp() {
  // Attempt to open the installed app via its custom URI scheme.
  // If the app is installed the OS will switch to it; if not, the browser
  // ignores the href silently (no error thrown in-page).
  window.location.href = APP_DEEP_LINK;
}

function MobilePayModal({ onClose }) {
  const [apkUrl, setApkUrl] = useState(null);
  const [justTried, setJustTried] = useState(false);

  useEffect(() => {
    settingsService
      .getVersionControl()
      .then((res) => {
        const url =
          res?.data?.versionControl?.updateUrl ||
          res?.versionControl?.updateUrl;
        if (url) setApkUrl(url);
      })
      .catch(() => {});

    // Auto-attempt deep link the moment the modal opens.
    // If the app is installed the OS will switch to it immediately.
    tryOpenApp();
    setJustTried(true);
  }, []);

  const handleOpenApp = () => {
    tryOpenApp();
    setJustTried(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm card p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white/60"
        >
          <X size={18} />
        </button>
        <div className="flex flex-col items-center text-center gap-3 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Smartphone size={28} className="text-accent" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Pay via Mobile App
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/50">
            Payments must be made through the{" "}
            <span className="font-semibold text-gray-700 dark:text-white/80">
              Apartment Bill Tracker
            </span>{" "}
            mobile app.
          </p>
        </div>

        {/* Primary action — open the app if already installed */}
        <button
          onClick={handleOpenApp}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          <Smartphone size={16} />
          {justTried ? "Open App Again" : "Open App"}
        </button>

        {justTried && (
          <p className="text-xs text-center text-gray-400 dark:text-white/30 -mt-1">
            If the app didn&apos;t open, download it below.
          </p>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100 dark:bg-white/8" />
          <span className="text-xs text-gray-400 dark:text-white/30">
            Don&apos;t have the app?
          </span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-white/8" />
        </div>

        {/* Download buttons */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href="https://play.google.com/store"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900 dark:bg-white/10 hover:bg-gray-800 dark:hover:bg-white/15 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 flex-shrink-0"
              fill="currentColor"
            >
              <path
                className="text-white"
                d="M3.18 23.76c.33.18.7.24 1.06.18L14.93 12 4.24.06A1.83 1.83 0 0 0 3 1.83v20.34c0 .6.06 1.18.18 1.59zM16.34 13.4l2.79-2.79-2.79-2.79-1.41 1.41L16.52 12l-1.59 1.59 1.41 1.41zm2.48 5.6-9.43-5.47L11.98 12l1.41-1.53 9.43-5.47c.76.44 1.18 1.18 1.18 2.01v10a2 2 0 0 1-1.18 1.99zM4.24 23.94l10.69-11.94-2.59-2.59L4.24.06"
              />
            </svg>
            <div>
              <p className="text-[9px] text-gray-400 dark:text-white/40 leading-none">
                GET IT ON
              </p>
              <p className="text-xs font-semibold text-white leading-tight">
                Google Play
              </p>
            </div>
          </a>
          <a
            href="https://apps.apple.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900 dark:bg-white/10 hover:bg-gray-800 dark:hover:bg-white/15 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 flex-shrink-0"
              fill="currentColor"
            >
              <path
                className="text-white"
                d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
              />
            </svg>
            <div>
              <p className="text-[9px] text-gray-400 dark:text-white/40 leading-none">
                DOWNLOAD ON THE
              </p>
              <p className="text-xs font-semibold text-white leading-tight">
                App Store
              </p>
            </div>
          </a>
        </div>

        {/* GitHub / direct APK download — synced with superadmin version control */}
        {apkUrl && (
          <a
            href={apkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-gray-900 dark:bg-white/10 hover:bg-gray-800 dark:hover:bg-white/15 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 flex-shrink-0 text-white"
              fill="currentColor"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <div>
              <p className="text-[9px] text-gray-400 dark:text-white/40 leading-none">
                DOWNLOAD APK FROM
              </p>
              <p className="text-xs font-semibold text-white leading-tight">
                GitHub Releases
              </p>
            </div>
          </a>
        )}

        <button
          onClick={onClose}
          className="w-full text-sm text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors py-1"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function ClientHomePage() {
  const { state } = useAuth();
  const { user } = state;
  const userId = user?.id || user?._id;
  const navigate = useNavigate();

  const [showPayModal, setShowPayModal] = useState(false);
  const [room, setRoom] = useState(null);
  const [unjoinedRooms, setUnjoinedRooms] = useState([]);
  const [pendingRoomIds, setPendingRoomIds] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [badges, setBadges] = useState({});
  const [loading, setLoading] = useState(true);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [annLoading, setAnnLoading] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [joinPayerChoice, setJoinPayerChoice] = useState(null);

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  useEffect(() => {
    const refreshBadges = () => {
      badgeService
        .getCounts()
        .then((b) => setBadges(b || {}))
        .catch(() => {});
    };
    window.addEventListener("badge-refresh", refreshBadges);
    return () => window.removeEventListener("badge-refresh", refreshBadges);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [myRoomsRes, availRes] = await Promise.allSettled([
        roomService.getClientRooms(),
        roomService.getAvailableRooms(),
      ]);

      const myRooms =
        myRoomsRes.status === "fulfilled"
          ? Array.isArray(myRoomsRes.value)
            ? myRoomsRes.value
            : myRoomsRes.value?.rooms || []
          : [];
      const joined = myRooms[0] || null;
      setRoom(joined);

      if (availRes.status === "fulfilled") {
        const av = availRes.value;
        const allRooms = Array.isArray(av) ? av : av?.rooms || [];
        const pending = av?.pendingRoomIds || [];
        setPendingRoomIds(pending);
        const myIds = myRooms.map((r) => r.id || r._id);
        setUnjoinedRooms(
          allRooms.filter((r) => !myIds.includes(r.id || r._id)),
        );
      }

      setLoading(false);

      if (joined) {
        const roomId = joined.id || joined._id;
        setCycleLoading(true);
        setAnnLoading(true);
        Promise.allSettled([
          billingCycleService.getBillingCycles(roomId),
          announcementService.getRoomAnnouncements(roomId),
          badgeService.getCounts(),
          billingCycleService.getOutstandingBalance(roomId),
          paymentService.getMyPayments(roomId),
        ]).then(([cycleRes, annRes, badgeRes, balRes, payRes]) => {
          if (cycleRes.status === "fulfilled") {
            const cycles = Array.isArray(cycleRes.value)
              ? cycleRes.value
              : cycleRes.value?.billingCycles || cycleRes.value?.data || [];
            const active = cycles.find((c) => c.status === "active") || null;
            setCycle(active);
          }
          setCycleLoading(false);
          if (annRes.status === "fulfilled")
            setAnnouncements(
              (annRes.value?.announcements || annRes.value?.data || []).slice(
                0,
                3,
              ),
            );
          setAnnLoading(false);
          if (badgeRes.status === "fulfilled") setBadges(badgeRes.value || {});
          if (balRes.status === "fulfilled")
            setOutstandingBalance(balRes.value?.totalOutstanding || 0);
          if (payRes.status === "fulfilled") {
            const txns =
              payRes.value?.transactions ||
              payRes.value?.payments ||
              payRes.value?.data ||
              [];
            setHasPendingPayment(
              txns.some(
                (p) => p.status === "pending" || p.status === "submitted",
              ),
            );
          }
        });
      } else {
        badgeService
          .getCounts()
          .then((b) => setBadges(b || {}))
          .catch(() => {});
      }
    } catch (_) {
      setLoading(false);
    }
  };

  const handleJoinRoom = (roomId) => setJoinPayerChoice({ roomId });

  const confirmJoin = async (isPayer) => {
    if (!joinPayerChoice) return;
    const roomId = joinPayerChoice.roomId;
    setJoinPayerChoice(null);
    setJoiningRoomId(roomId);
    try {
      await memberService.addMember(roomId, { userId, isPayer });
      await load();
    } catch (e) {
      alert(e?.message || "Failed to join room");
    } finally {
      setJoiningRoomId(null);
    }
  };

  // Derived
  const myMember = room?.members?.find(
    (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
  );
  const isPayer = myMember?.isPayer ?? myMember?.is_payer ?? false;
  const myPayment = room?.memberPayments?.find(
    (mp) => String(mp.member) === String(userId),
  );
  const allPaid = myPayment?.allPaid ?? false;
  const pendingBills = [
    myPayment?.rentStatus === "unpaid" && Number(room?.billing?.rent) > 0
      ? "Rent"
      : null,
    myPayment?.electricityStatus === "unpaid" &&
    Number(room?.billing?.electricity) > 0
      ? "Electricity"
      : null,
    myPayment?.waterStatus === "unpaid" && Number(room?.billing?.water) > 0
      ? "Water"
      : null,
    myPayment?.internetStatus === "unpaid" &&
    Number(room?.billing?.internet) > 0
      ? "Internet"
      : null,
  ].filter(Boolean);

  const userCharge = cycle?.memberCharges?.find(
    (mc) => String(mc.userId) === String(userId),
  );

  const homePayorCount = Math.max(
    1,
    (room?.members || []).filter((m) => m.isPayer || m.is_payer).length,
  );

  // Show exact memberCharges share, else estimate (÷ payers) for payers, else null for non-payers
  const displayShare =
    userCharge && isPayer
      ? {
          rent: Number(userCharge.rentShare || 0),
          electricity: Number(userCharge.electricityShare || 0),
          water: Number(userCharge.waterBillShare || 0),
          internet: Number(userCharge.internetShare || 0),
          total: Number(userCharge.totalDue || 0),
          exact: true,
        }
      : isPayer && cycle
        ? {
            rent: r2(Number(cycle.rent || 0) / homePayorCount),
            electricity: r2(Number(cycle.electricity || 0) / homePayorCount),
            water: r2(
              Number(cycle.waterBillAmount || cycle.water_bill_amount || 0) /
                homePayorCount,
            ),
            internet: r2(Number(cycle.internet || 0) / homePayorCount),
            total: r2(
              (Number(cycle.rent || 0) +
                Number(cycle.electricity || 0) +
                Number(cycle.waterBillAmount || cycle.water_bill_amount || 0) +
                Number(cycle.internet || 0)) /
                homePayorCount,
            ),
            exact: false,
          }
        : null;

  const billingCountdown = (() => {
    if (!room?.billing?.end || room?.cycleStatus !== "active") return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(room.billing.end);
    end.setHours(0, 0, 0, 0);
    const diff = Math.ceil((end - today) / 86400000);
    if (diff < 0) return { daysRemaining: 0, overdue: true, percentage: 100 };
    const start = new Date(room.billing.start);
    start.setHours(0, 0, 0, 0);
    const total = Math.ceil((end - start) / 86400000) || 1;
    const passed = total - diff;
    return {
      daysRemaining: diff,
      overdue: false,
      percentage: Math.min(100, (passed / total) * 100),
      billingEnd: end.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      }),
    };
  })();

  const avatarSrc = (() => {
    const a = user?.avatar;
    if (!a) return null;
    if (typeof a === "string")
      return a.startsWith("{") ? JSON.parse(a)?.url : a;
    return a?.url;
  })();

  const quickLinks = [
    { to: "/bills", icon: FileText, label: "Bills", badge: 0 },
    { to: "/room-details", icon: Home, label: "My Room", badge: 0 },
    { to: "/billing-history", icon: BookOpen, label: "History", badge: 0 },
    {
      to: "/announcements",
      icon: Megaphone,
      label: "Announcements",
      badge: badges.unreadAnnouncements,
    },
    { to: "/presence", icon: CheckSquare, label: "Presence", badge: 0 },
    {
      to: "/notifications",
      icon: Bell,
      label: "Notifications",
      badge: badges.unreadNotifications,
    },
    { to: "/profile", icon: User, label: "Profile", badge: 0 },
  ];

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );

  return (
    <div className="space-y-6">
      {showPayModal && (
        <MobilePayModal onClose={() => setShowPayModal(false)} />
      )}
      {/* Join payer-choice modal */}
      {joinPayerChoice && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg">
              Join Room
            </h3>
            <p className="text-sm text-gray-600 dark:text-white/60">
              Will you be a <strong>payer</strong> for this room? Payers are
              responsible for billing cycle payments.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => confirmJoin(false)}
                className="flex-1 btn-secondary text-sm"
              >
                No (Non-payer)
              </button>
              <button
                onClick={() => confirmJoin(true)}
                className="flex-1 btn-primary text-sm"
              >
                Yes (Payer)
              </button>
            </div>
            <button
              onClick={() => setJoinPayerChoice(null)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Greeting */}
      <div className="flex items-center gap-4">
        <Avatar src={avatarSrc} name={user?.name || ""} size="lg" />
        <div>
          <p className="text-gray-500 dark:text-white/50 text-sm">
            {getGreeting()},
          </p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {user?.name}
          </h1>
          {room ? (
            <p className="text-xs text-accent font-medium mt-0.5">
              {room.name}
            </p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
              No room joined yet
            </p>
          )}
        </div>
      </div>

      {/* Outstanding balance banner */}
      {outstandingBalance > 0 && (
        <div className="card p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Outstanding Balance
            </p>
            <p className="text-xs text-red-600 dark:text-red-300">
              You have ₱{r2(outstandingBalance).toLocaleString()} unpaid from
              previous cycles
            </p>
          </div>
          <Link
            to="/billing-history"
            className="text-xs text-red-500 font-medium hover:underline shrink-0"
          >
            View
          </Link>
        </div>
      )}

      {/* Payment status card */}
      {room && isPayer && myPayment && (
        <div
          className={`card p-4 flex items-center gap-4 ${allPaid ? "border-l-4 border-green-500" : "border-l-4 border-amber-400"}`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${allPaid ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-50 dark:bg-amber-900/20"}`}
          >
            {allPaid ? (
              <CheckCircle size={24} className="text-green-600" />
            ) : (
              <Clock size={24} className="text-amber-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">
              {allPaid
                ? "All bills paid!"
                : `${pendingBills.length} bill${pendingBills.length !== 1 ? "s" : ""} pending`}
            </p>
            <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
              {allPaid
                ? "You're up to date for this cycle"
                : `Unpaid: ${pendingBills.join(", ")}`}
            </p>
          </div>
          {!allPaid &&
            (hasPendingPayment ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 text-xs font-medium shrink-0">
                <Clock size={12} />
                Awaiting Verification
              </span>
            ) : (
              <button
                onClick={() => setShowPayModal(true)}
                className="btn-primary text-xs px-3 py-1.5 shrink-0"
              >
                Pay Now
              </button>
            ))}
        </div>
      )}

      {/* Billing countdown */}
      {billingCountdown && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock
                size={15}
                className={
                  billingCountdown.overdue ? "text-red-500" : "text-accent"
                }
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {billingCountdown.overdue
                  ? "Billing cycle overdue!"
                  : `${billingCountdown.daysRemaining} day${billingCountdown.daysRemaining !== 1 ? "s" : ""} remaining`}
              </span>
            </div>
            {billingCountdown.billingEnd && (
              <span className="text-xs text-gray-400 dark:text-white/30">
                Due {billingCountdown.billingEnd}
              </span>
            )}
          </div>
          <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${billingCountdown.overdue ? "bg-red-500" : billingCountdown.percentage > 75 ? "bg-amber-400" : "bg-accent"}`}
              style={{ width: `${billingCountdown.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {quickLinks.map(({ to, icon: Icon, label, badge }) => (
          <Link
            key={to}
            to={to}
            className="card p-3 flex flex-col items-center gap-2 hover:shadow-md transition-shadow text-center relative"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Icon size={18} className="text-accent" />
            </div>
            <span className="text-[11px] font-medium text-gray-700 dark:text-white/70 leading-tight line-clamp-2 w-full">
              {label}
            </span>
            {badge > 0 && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Active Billing Cycle summary */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Current Bill
            </h2>
            <div className="flex items-center gap-2">
              {room && (
                <Link
                  to="/room-details"
                  className="text-xs text-accent hover:underline"
                >
                  Room Info
                </Link>
              )}
              {cycle && <StatusBadge status={cycle.status} />}
            </div>
          </div>
          {cycleLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
              <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-1/2" />
              <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
              <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-1/2" />
              <div className="border-t border-gray-100 dark:border-white/8 pt-3 flex justify-between items-center">
                <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-24" />
                <div className="h-6 bg-gray-200 dark:bg-white/10 rounded w-20" />
              </div>
              <div className="h-9 bg-gray-200 dark:bg-white/10 rounded mt-1" />
            </div>
          ) : cycle ? (
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-white/50">Period</span>
                <span className="font-medium text-gray-900 dark:text-white text-right">
                  {new Date(
                    cycle.startDate || cycle.start_date,
                  ).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                  })}
                  {" – "}
                  {new Date(cycle.endDate || cycle.end_date).toLocaleDateString(
                    "en-PH",
                    { month: "short", day: "numeric", year: "numeric" },
                  )}
                </span>
              </div>
              {isPayer && Number(cycle.rent) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-white/50 flex items-center gap-1">
                    <Home size={13} className="text-orange-500" /> Rent
                  </span>
                  <span className="font-medium">
                    ₱{Number(displayShare?.rent ?? cycle.rent).toLocaleString()}
                  </span>
                </div>
              )}
              {isPayer && Number(cycle.electricity) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-white/50 flex items-center gap-1">
                    <Zap size={13} className="text-amber-500" /> Electricity
                  </span>
                  <span className="font-medium">
                    ₱
                    {Number(
                      displayShare?.electricity ?? cycle.electricity,
                    ).toLocaleString()}
                  </span>
                </div>
              )}
              {isPayer &&
                Number(cycle.waterBillAmount || cycle.water_bill_amount) >
                  0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-white/50 flex items-center gap-1">
                      <Droplets size={13} className="text-blue-500" /> Water
                    </span>
                    <span className="font-medium">
                      ₱
                      {Number(
                        displayShare?.water ??
                          (cycle.waterBillAmount || cycle.water_bill_amount),
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
              {isPayer && Number(cycle.internet) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-white/50 flex items-center gap-1">
                    <Wifi size={13} className="text-purple-500" /> Internet
                  </span>
                  <span className="font-medium">
                    ₱
                    {Number(
                      displayShare?.internet ?? cycle.internet,
                    ).toLocaleString()}
                  </span>
                </div>
              )}
              {isPayer && (
                <div className="border-t border-gray-100 dark:border-white/8 pt-3 flex justify-between">
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {displayShare ? "Your Share" : "Room Total"}
                    </span>
                    {displayShare && !displayShare.exact && (
                      <p className="text-xs text-gray-400 dark:text-white/30">
                        est. ÷ {homePayorCount} payers
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-accent text-lg">
                    ₱
                    {Number(
                      displayShare?.total ||
                        cycle.totalBilledAmount ||
                        cycle.total_billed_amount ||
                        0,
                    ).toLocaleString()}
                  </span>
                </div>
              )}
              {!isPayer && (
                <p className="text-sm text-gray-400 dark:text-white/30 pt-2">
                  Bill amounts are only visible to paying members.
                </p>
              )}
              {isPayer && (
                <Link
                  to="/bills"
                  className="btn-primary w-full text-center text-sm block mt-2"
                >
                  View My Bills
                </Link>
              )}
            </div>
          ) : (
            <EmptyState
              icon="📃"
              title="No active billing cycle"
              subtitle="Your host hasn't opened a billing cycle yet"
            />
          )}
        </div>

        {/* Recent Announcements */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Announcements
            </h2>
            <Link
              to="/announcements"
              className="text-xs text-accent hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {annLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border-l-2 border-gray-200 dark:border-white/15 pl-3 space-y-1.5"
                >
                  <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-4/5" />
                  <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-full" />
                  <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : announcements.length > 0 ? (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div
                  key={a.id || a._id}
                  className={`border-l-2 pl-3 ${a.isPinned || a.is_pinned ? "border-accent" : "border-gray-200 dark:border-white/15"}`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                    {a.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5 line-clamp-2">
                    {a.content}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                    {new Date(a.created_at || a.createdAt).toLocaleDateString(
                      "en-PH",
                      { month: "short", day: "numeric" },
                    )}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📢"
              title="No announcements"
              subtitle="Nothing from your host yet"
            />
          )}
        </div>
      </div>

      {/* Room payment summary */}
      {room?.memberPayments?.length > 0 && cycle && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            Room Payment Summary
          </h2>
          <div className="space-y-2">
            {room.memberPayments.map((mp, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/8 last:border-none"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${mp.allPaid ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/60"}`}
                  >
                    {(mp.memberName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {mp.memberName || "Member"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-white/30">
                      {mp.isPayer ? "Payer" : "Non-payer"}
                    </p>
                  </div>
                </div>
                {mp.isPayer && (
                  <div className="flex gap-1 text-xs">
                    {[
                      {
                        label: "R",
                        status: mp.rentStatus,
                        show: Number(room.billing?.rent) > 0,
                      },
                      {
                        label: "E",
                        status: mp.electricityStatus,
                        show: Number(room.billing?.electricity) > 0,
                      },
                      {
                        label: "W",
                        status: mp.waterStatus,
                        show: Number(room.billing?.water) > 0,
                      },
                      {
                        label: "I",
                        status: mp.internetStatus,
                        show: Number(room.billing?.internet) > 0,
                      },
                    ]
                      .filter((b) => b.show)
                      .map((b, j) => (
                        <span
                          key={j}
                          className={`w-6 h-6 rounded flex items-center justify-center font-semibold ${b.status === "paid" ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-red-100 dark:bg-red-900/20 text-red-500"}`}
                        >
                          {b.label}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-2">
            R=Rent · E=Electricity · W=Water · I=Internet
          </p>
        </div>
      )}

      {/* Available rooms to join */}
      {unjoinedRooms.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {room ? "Other Available Rooms" : "Available Rooms"}
          </h2>
          {unjoinedRooms.map((r) => {
            const rid = r.id || r._id;
            const isPending = pendingRoomIds.includes(rid);
            return (
              <div key={rid} className="card p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Home size={18} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {r.name}
                  </p>
                  {r.description && (
                    <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5 line-clamp-2">
                      {r.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                    {r.memberCount ?? r.members?.length ?? 0} members
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/room/${rid}`)}
                    className="text-xs text-accent hover:underline font-medium"
                  >
                    View
                  </button>
                  {isPending ? (
                    <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg font-medium">
                      Pending
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoinRoom(rid)}
                      disabled={joiningRoomId === rid}
                      className="btn-secondary text-xs flex items-center gap-1"
                    >
                      {joiningRoomId === rid && (
                        <Spinner size="sm" className="mr-1" />
                      )}
                      Join
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!room && unjoinedRooms.length === 0 && (
        <EmptyState
          icon="🏠"
          title="No rooms found"
          subtitle="No rooms are available to join right now. Contact your admin for a room code."
        />
      )}
    </div>
  );
}
