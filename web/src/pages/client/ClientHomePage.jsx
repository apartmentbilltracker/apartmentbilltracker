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
  window.location.href = APP_DEEP_LINK;
}

// ── Forest Green palette tokens (mirrors colors.js light theme) ──────────────
const C = {
  primary:         "#002b29",   // headerBg / deepest canvas
  primaryContainer:"#0a4240",   // card (dark)
  accent:          "#036d41",   // secondary / Emerald Green
  accentDark:      "#025535",   // actionPresenceIcon
  accentSurface:   "#9af2bb",   // secondary-container
  accentLight:     "rgba(3,109,65,0.08)",
  accentMid:       "rgba(3,109,65,0.12)",

  // action-card tints
  tintA: "#d6ede3",  // actionPayBillsBg / statPendingBg / breakdownHeaderBg
  tintB: "#b3dece",  // actionPresenceBg / statTotalBillsBg
  tintC: "#e8f5ef",  // actionRoomInfoBg / statMembersBg
  tintD: "#c8e8d8",  // actionChatBg

  // bill-type semantic
  electricity: "#7a5900",
  water:       "#1b4e4c",
  internet:    "#005230",
};

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden"
        style={{ background: "#fff" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header strip */}
        <div
          className="px-6 pt-6 pb-5 text-center"
          style={{ background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryContainer} 100%)` }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
          >
            <X size={14} />
          </button>
          <div
            className="w-14 h-14 rounded-[32px] mx-auto mb-3 flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <Smartphone size={28} color="#9af2bb" />
          </div>
          <h2 className="text-lg font-bold text-white">Pay via Mobile App</h2>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
            Payments are made through the{" "}
            <span className="font-semibold text-white">PropFlow</span> mobile app.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Primary CTA */}
          <button
            onClick={handleOpenApp}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)` }}
          >
            <Smartphone size={16} />
            {justTried ? "Open App Again" : "Open App"}
          </button>

          {justTried && (
            <p className="text-xs text-center text-gray-400 -mt-1">
              If the app didn&apos;t open, download it below.
            </p>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">Don&apos;t have the app?</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Store buttons */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Google Play",
                path: "M3.18 23.76c.33.18.7.24 1.06.18L14.93 12 4.24.06A1.83 1.83 0 0 0 3 1.83v20.34c0 .6.06 1.18.18 1.59zM16.34 13.4l2.79-2.79-2.79-2.79-1.41 1.41L16.52 12l-1.59 1.59 1.41 1.41zm2.48 5.6-9.43-5.47L11.98 12l1.41-1.53 9.43-5.47c.76.44 1.18 1.18 1.18 2.01v10a2 2 0 0 1-1.18 1.99zM4.24 23.94l10.69-11.94-2.59-2.59L4.24.06",
              },
              {
                label: "App Store",
                path: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z",
              },
            ].map(({ label, path }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl opacity-50 cursor-not-allowed select-none"
                style={{ background: C.primaryContainer }}
                title="Coming soon"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="white">
                  <path d={path} />
                </svg>
                <div>
                  <p className="text-[9px] leading-none" style={{ color: C.accentSurface }}>
                    COMING SOON
                  </p>
                  <p className="text-xs font-semibold leading-tight text-white">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {apkUrl && (
            <a
              href={apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl transition-opacity hover:opacity-90"
              style={{ background: C.primary }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 text-white" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <div>
                <p className="text-[9px] leading-none" style={{ color: C.accentSurface }}>
                  DOWNLOAD APK FROM
                </p>
                <p className="text-xs font-semibold text-white leading-tight">GitHub Releases</p>
              </div>
            </a>
          )}

          <button
            onClick={onClose}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Maybe later
          </button>
        </div>
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
              (annRes.value?.announcements || annRes.value?.data || []).slice(0, 3),
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
              txns.some((p) => p.status === "pending" || p.status === "submitted"),
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

  // ── Derived ──────────────────────────────────────────────────────────────────
  const myMember = room?.members?.find(
    (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
  );
  const isPayer = myMember?.isPayer ?? myMember?.is_payer ?? false;
  const myPayment = room?.memberPayments?.find(
    (mp) => String(mp.member) === String(userId),
  );
  const allPaid = myPayment?.allPaid ?? false;
  const pendingBills = [
    myPayment?.rentStatus === "unpaid" && Number(room?.billing?.rent) > 0 ? "Rent" : null,
    myPayment?.electricityStatus === "unpaid" && Number(room?.billing?.electricity) > 0 ? "Electricity" : null,
    myPayment?.waterStatus === "unpaid" && Number(room?.billing?.water) > 0 ? "Water" : null,
    myPayment?.internetStatus === "unpaid" && Number(room?.billing?.internet) > 0 ? "Internet" : null,
  ].filter(Boolean);

  const userCharge = cycle?.memberCharges?.find(
    (mc) => String(mc.userId) === String(userId),
  );
  const homePayorCount = Math.max(
    1,
    (room?.members || []).filter((m) => m.isPayer || m.is_payer).length,
  );
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
              Number(cycle.waterBillAmount || cycle.water_bill_amount || 0) / homePayorCount,
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
      billingEnd: end.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
    };
  })();

  const avatarSrc = (() => {
    const a = user?.avatar;
    if (!a) return null;
    if (typeof a === "string") return a.startsWith("{") ? JSON.parse(a)?.url : a;
    return a?.url;
  })();

  // ── Quick links — assign forest-green tint per slot ──────────────────────────
  const quickLinkTints = [C.tintA, C.tintB, C.tintC, C.tintD, C.tintA, C.tintB, C.tintC];
  const quickLinkIconColors = [C.accent, C.accentDark, C.accent, C.accent, C.accent, C.accentDark, C.accent];
  const quickLinks = [
    { to: "/bills",         icon: FileText,    label: "Bills",         badge: 0 },
    { to: "/room-details",  icon: Home,        label: "My Room",       badge: 0 },
    { to: "/billing-history",icon: BookOpen,   label: "History",       badge: 0 },
    { to: "/announcements", icon: Megaphone,   label: "Announcements", badge: badges.unreadAnnouncements },
    { to: "/presence",      icon: CheckSquare, label: "Presence",      badge: 0 },
    { to: "/notifications", icon: Bell,        label: "Notifications", badge: badges.unreadNotifications },
    { to: "/profile",       icon: User,        label: "Profile",       badge: 0 },
  ];

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" style={{ color: C.accent }} />
      </div>
    );

  return (
    <div className="space-y-6 min-h-screen pb-10" style={{ background: "#F4F7F5" }}>
      {showPayModal && <MobilePayModal onClose={() => setShowPayModal(false)} />}

      {/* ── Join payer-choice modal ─────────────────────────────────────────── */}
      {joinPayerChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl bg-white dark:bg-[#0a4240]">
            {/* Header strip */}
            <div className="px-6 py-5" style={{ background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryContainer} 100%)` }}>
              <h3 className="font-bold text-white text-lg">Join Room</h3>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                Will you be a billing <span className="font-semibold text-white">payer</span> for this room?
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => confirmJoin(false)}
                  className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-700 dark:text-white/80 dark:border-white/15 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  No (Non-payer)
                </button>
                <button
                  onClick={() => confirmJoin(true)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)` }}
                >
                  Yes (Payer)
                </button>
              </div>
              <button
                onClick={() => setJoinPayerChoice(null)}
                className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Greeting card — forest green header ─────────────────────────────── */}
      <div
        className="relative rounded-[32px] overflow-hidden p-5"
        style={{ background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryContainer} 100%)` }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10"
          style={{ background: C.accentSurface }}
        />
        <div
          className="absolute -bottom-10 -left-4 w-28 h-28 rounded-full opacity-10"
          style={{ background: C.accentSurface }}
        />

        <div className="relative flex items-center gap-4">
          <div
            className="flex-shrink-0 rounded-full p-0.5"
            style={{ background: `linear-gradient(135deg, ${C.accentSurface} 0%, ${C.accent} 100%)` }}
          >
            <Avatar src={avatarSrc} name={user?.name || ""} size="lg" className="ring-2 ring-white/20" />
          </div>
          <div className="min-w-0">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.60)" }}>
              {getGreeting()},
            </p>
            <h1 className="text-xl font-bold text-white truncate">{user?.name}</h1>
            {room ? (
              <p className="text-xs font-medium mt-0.5" style={{ color: C.accentSurface }}>
                🏠 {room.name}
              </p>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                No room joined yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Outstanding balance banner ──────────────────────────────────────── */}
      {outstandingBalance > 0 && (
        <div className="rounded-[32px] p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Outstanding Balance
            </p>
            <p className="text-xs text-red-600 dark:text-red-300">
              You have ₱{r2(outstandingBalance).toLocaleString()} unpaid from previous cycles
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

      {/* ── Payment status card ─────────────────────────────────────────────── */}
      {room && isPayer && myPayment && (
        <div
          className="rounded-[32px] bg-white dark:bg-[#0a4240] border p-4 flex items-center gap-4"
          style={{
            borderLeftWidth: 4,
            borderLeftColor: allPaid ? C.accent : "#f59e0b",
            borderColor: allPaid ? C.accent : "#f59e0b",
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: allPaid ? C.tintA : "rgba(245,158,11,0.10)",
            }}
          >
            {allPaid ? (
              <CheckCircle size={24} style={{ color: C.accent }} />
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
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-700 dark:text-amber-400 text-xs font-medium shrink-0 border border-amber-200"
                style={{ background: "rgba(245,158,11,0.08)" }}
              >
                <Clock size={12} />
                Awaiting Verification
              </span>
            ) : (
              <button
                onClick={() => setShowPayModal(true)}
                className="text-xs px-4 py-2 rounded-xl font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)` }}
              >
                Pay Now
              </button>
            ))}
        </div>
      )}

      {/* ── Billing countdown ───────────────────────────────────────────────── */}
      {billingCountdown && (
        <div className="rounded-[32px] bg-white dark:bg-[#0a4240] border border-gray-100 dark:border-white/8 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: billingCountdown.overdue ? "rgba(239,68,68,0.10)" : C.tintA }}
              >
                <Clock
                  size={14}
                  style={{ color: billingCountdown.overdue ? "#ef4444" : C.accent }}
                />
              </div>
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
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${billingCountdown.percentage}%`,
                background: billingCountdown.overdue
                  ? "#ef4444"
                  : billingCountdown.percentage > 75
                    ? "#f59e0b"
                    : `linear-gradient(90deg, ${C.accent} 0%, ${C.accentSurface} 100%)`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Quick links ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {quickLinks.map(({ to, icon: Icon, label, badge }, idx) => (
          <Link
            key={to}
            to={to}
            className="relative bg-white dark:bg-[#0a4240] border border-gray-100 dark:border-white/8 rounded-[32px] p-3 flex flex-col items-center gap-2 hover:shadow-md transition-all text-center hover:-translate-y-0.5 duration-200"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: quickLinkTints[idx] }}
            >
              <Icon size={18} style={{ color: quickLinkIconColors[idx] }} />
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

      {/* ── Two-column main content ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-5">

        {/* Current Bill card */}
        <div className="rounded-[32px] bg-white dark:bg-[#0a4240] border border-gray-100 dark:border-white/8 p-5">
          {/* Card header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: C.tintA }}
              >
                <FileText size={13} style={{ color: C.accent }} />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Current Bill</h2>
            </div>
            <div className="flex items-center gap-2">
              {room && (
                <Link
                  to="/room-details"
                  className="text-xs font-medium hover:underline"
                  style={{ color: C.accent }}
                >
                  Room Info
                </Link>
              )}
              {cycle && <StatusBadge status={cycle.status} />}
            </div>
          </div>

          {cycleLoading ? (
            <div className="animate-pulse space-y-3">
              {[3/4, 1/2, 2/3, 1/2].map((w, i) => (
                <div key={i} className="h-3.5 bg-gray-100 dark:bg-white/10 rounded" style={{ width: `${w * 100}%` }} />
              ))}
              <div className="border-t border-gray-100 dark:border-white/8 pt-3 flex justify-between items-center">
                <div className="h-4 bg-gray-100 dark:bg-white/10 rounded w-24" />
                <div className="h-6 bg-gray-100 dark:bg-white/10 rounded w-20" />
              </div>
              <div className="h-9 bg-gray-100 dark:bg-white/10 rounded" />
            </div>
          ) : cycle ? (
            <div className="space-y-2.5">
              {/* Period row */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-white/50">Period</span>
                <span className="font-medium text-gray-900 dark:text-white text-right">
                  {new Date(cycle.startDate || cycle.start_date).toLocaleDateString("en-PH", {
                    month: "short", day: "numeric",
                  })}
                  {" – "}
                  {new Date(cycle.endDate || cycle.end_date).toLocaleDateString("en-PH", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>

              {/* Bill rows — icons use semantic colors from colors.js */}
              {isPayer && Number(cycle.rent) > 0 && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500 dark:text-white/50 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "rgba(122,89,0,0.10)" }}>
                      <Home size={11} style={{ color: "#7a5900" }} />
                    </span>
                    Rent
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ₱{Number(displayShare?.rent ?? cycle.rent).toLocaleString()}
                  </span>
                </div>
              )}
              {isPayer && Number(cycle.electricity) > 0 && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500 dark:text-white/50 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "rgba(122,89,0,0.10)" }}>
                      <Zap size={11} style={{ color: C.electricity }} />
                    </span>
                    Electricity
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ₱{Number(displayShare?.electricity ?? cycle.electricity).toLocaleString()}
                  </span>
                </div>
              )}
              {isPayer && Number(cycle.waterBillAmount || cycle.water_bill_amount) > 0 && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500 dark:text-white/50 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "rgba(27,78,76,0.10)" }}>
                      <Droplets size={11} style={{ color: C.water }} />
                    </span>
                    Water
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ₱{Number(displayShare?.water ?? (cycle.waterBillAmount || cycle.water_bill_amount)).toLocaleString()}
                  </span>
                </div>
              )}
              {isPayer && Number(cycle.internet) > 0 && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500 dark:text-white/50 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "rgba(0,82,48,0.10)" }}>
                      <Wifi size={11} style={{ color: C.internet }} />
                    </span>
                    Internet
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ₱{Number(displayShare?.internet ?? cycle.internet).toLocaleString()}
                  </span>
                </div>
              )}

              {isPayer && (
                <>
                  <div
                    className="flex justify-between items-end pt-3"
                    style={{ borderTop: `1px solid rgba(3,109,65,0.12)` }}
                  >
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                        {displayShare ? "Your Share" : "Room Total"}
                      </span>
                      {displayShare && !displayShare.exact && (
                        <p className="text-xs text-gray-400 dark:text-white/30">
                          est. ÷ {homePayorCount} payers
                        </p>
                      )}
                    </div>
                    <span
                      className="font-bold text-2xl"
                      style={{ color: C.accent }}
                    >
                      ₱{Number(
                        displayShare?.total ||
                          cycle.totalBilledAmount ||
                          cycle.total_billed_amount ||
                          0,
                      ).toLocaleString()}
                    </span>
                  </div>
                  <Link
                    to="/bills"
                    className="w-full text-center text-sm block py-2.5 rounded-xl font-semibold text-white mt-1 transition-opacity hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)` }}
                  >
                    View My Bills
                  </Link>
                </>
              )}

              {!isPayer && (
                <p className="text-sm text-gray-400 dark:text-white/30 pt-2">
                  Bill amounts are only visible to paying members.
                </p>
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

        {/* Announcements card */}
        <div className="rounded-[32px] bg-white dark:bg-[#0a4240] border border-gray-100 dark:border-white/8 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: C.tintC }}
              >
                <Megaphone size={13} style={{ color: C.accent }} />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Announcements</h2>
            </div>
            <Link
              to="/announcements"
              className="text-xs font-medium hover:underline flex items-center gap-0.5"
              style={{ color: C.accent }}
            >
              View all <ChevronRight size={12} />
            </Link>
          </div>

          {annLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-l-2 border-gray-200 dark:border-white/15 pl-3 space-y-1.5">
                  <div className="h-3.5 bg-gray-100 dark:bg-white/10 rounded w-4/5" />
                  <div className="h-3 bg-gray-100 dark:bg-white/10 rounded w-full" />
                  <div className="h-3 bg-gray-100 dark:bg-white/10 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : announcements.length > 0 ? (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div
                  key={a.id || a._id}
                  className="pl-3"
                  style={{
                    borderLeft: `2px solid ${a.isPinned || a.is_pinned ? C.accent : "#e5e7eb"}`,
                  }}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                    {a.title}
                    {(a.isPinned || a.is_pinned) && (
                      <span
                        className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: C.tintA, color: C.accent }}
                      >
                        Pinned
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5 line-clamp-2">
                    {a.content}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                    {new Date(a.created_at || a.createdAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                    })}
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

      {/* ── Room Payment Summary ─────────────────────────────────────────────── */}
      {room?.memberPayments?.length > 0 && cycle && (
        <div className="rounded-[32px] bg-white dark:bg-[#0a4240] border border-gray-100 dark:border-white/8 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: C.tintB }}
            >
              <CheckSquare size={13} style={{ color: C.accentDark }} />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Room Payment Summary</h2>
          </div>
          <div className="space-y-2">
            {room.memberPayments.map((mp, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 last:border-none"
                style={{ borderBottom: i < room.memberPayments.length - 1 ? `1px solid rgba(3,109,65,0.10)` : "none" }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: mp.allPaid ? C.tintA : "rgba(156,163,175,0.15)",
                      color: mp.allPaid ? C.accent : "#9ca3af",
                    }}
                  >
                    {(mp.memberName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {mp.memberName || "Member"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-white/30">
                      {mp.isPayer ? "Payor" : "Non-payor"}
                    </p>
                  </div>
                </div>
                {mp.isPayer && (
                  <div className="flex gap-1 text-xs">
                    {[
                      { label: "R", status: mp.rentStatus,       show: Number(room.billing?.rent) > 0 },
                      { label: "E", status: mp.electricityStatus, show: Number(room.billing?.electricity) > 0 },
                      { label: "W", status: mp.waterStatus,      show: Number(room.billing?.water) > 0 },
                      { label: "I", status: mp.internetStatus,   show: Number(room.billing?.internet) > 0 },
                    ]
                      .filter((b) => b.show)
                      .map((b, j) => (
                        <span
                          key={j}
                          className="w-6 h-6 rounded flex items-center justify-center font-semibold"
                          style={{
                            background: b.status === "paid" ? C.tintA : "rgba(239,68,68,0.08)",
                            color:  b.status === "paid" ? C.accent : "#ef4444",
                          }}
                        >
                          {b.label}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-3">
            R=Rent · E=Electricity · W=Water · I=Internet
          </p>
        </div>
      )}

      {/* ── Available rooms to join ──────────────────────────────────────────── */}
      {unjoinedRooms.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {room ? "Other Available Rooms" : "Available Rooms"}
          </h2>
          {unjoinedRooms.map((r) => {
            const rid = r.id || r._id;
            const isPending = pendingRoomIds.includes(rid);
            return (
              <div key={rid} className="rounded-[32px] bg-white dark:bg-[#0a4240] border border-gray-100 dark:border-white/8 p-4 flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: C.tintA }}
                >
                  <Home size={18} style={{ color: C.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{r.name}</p>
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
                    className="text-xs font-medium hover:underline"
                    style={{ color: C.accent }}
                  >
                    View
                  </button>
                  {isPending ? (
                    <span className="text-xs text-amber-700 px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: "rgba(245,158,11,0.10)" }}>
                      Pending
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoinRoom(rid)}
                      disabled={joiningRoomId === rid}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                      style={{ background: C.accent }}
                    >
                      {joiningRoomId === rid && <Spinner size="sm" className="mr-1" />}
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
