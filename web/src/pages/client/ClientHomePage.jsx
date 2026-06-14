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
  Target,
  Shield,
  Activity,
  ArrowUpRight,
  Layers,
  Sparkles,
  ArrowRight,
  Users,
} from "lucide-react";

const r2 = (n) => Math.round((n || 0) * 100) / 100;

const APP_DEEP_LINK = "aptbilltracker://bills";
function tryOpenApp() {
  window.location.href = APP_DEEP_LINK;
}

// ── Palette — Forest Green #02302e theme ─────────────────────────────────────
const C = {
  primary: "#02302e", // deep forest base
  primaryContainer: "#08403c", // slightly lighter forest
  accent: "#1a7a52", // vibrant forest green
  accentDark: "#0f5c3a", // deep emerald
  accentSurface: "#7ee8a2", // fresh mint highlight
  accentLight: "rgba(26,122,82,0.08)",
  accentMid: "rgba(26,122,82,0.14)",
  tintA: "#d0ead9", // soft sage
  tintB: "#a8d8bc", // muted mint
  tintC: "#e4f3eb", // pale green
  tintD: "#bfe6cf", // cool leaf
  electricity: "#7a5900",
  water: "#0e4a47",
  internet: "#0a4a2e",
};

const heroBg = `linear-gradient(135deg, #02302e 0%, #053b38 50%, #032623 100%)`;

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
      className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-md bg-black/60 transition-all duration-300 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden transform scale-100 transition-transform duration-300 border border-white/10 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Banner Header */}
        <div
          className="px-8 pt-10 pb-8 text-center relative overflow-hidden text-white"
          style={{ background: heroBg }}
        >
          <div className="absolute -top-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center transition-all bg-white/10 text-white/80 hover:bg-white/20 hover:text-white active:scale-90"
          >
            <X size={18} />
          </button>

          <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg relative z-10 bg-white/10 border border-white/20 backdrop-blur-sm">
            <Smartphone size={36} color={C.accentSurface} />
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            Pay via Mobile Ecosystem
          </h2>
          <p className="text-xs mt-2 px-4 text-white/70 font-medium leading-relaxed">
            Transactions are encrypted and routed directly to the centralized{" "}
            <span className="font-extrabold text-emerald-300">PropFlow</span>{" "}
            payment gateway.
          </p>
        </div>

        {/* Modal Content / Actions */}
        <div className="p-8 space-y-5 bg-slate-50/50">
          <button
            onClick={handleOpenApp}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-sm text-white transition-all duration-200 hover:opacity-95 shadow-lg shadow-emerald-950/20 active:scale-[0.99]"
            style={{
              background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)`,
            }}
          >
            <Smartphone size={18} />
            {justTried ? "Re-launch Mobile Terminal" : "Launch Mobile App"}
          </button>

          {justTried && (
            <p className="text-[11px] text-center text-slate-400 font-semibold tracking-wide">
              App didn&apos;t clear? Choose a secondary distribution vector
              below.
            </p>
          )}

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Platform Mirrors
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

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
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl opacity-50 bg-slate-100 border border-slate-200 cursor-not-allowed select-none"
                title="Deploying shortly"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 flex-shrink-0 text-slate-500"
                  fill="currentColor"
                >
                  <path d={path} />
                </svg>
                <div>
                  <p className="text-[8px] font-black tracking-widest text-slate-400 leading-none">
                    UPCOMING
                  </p>
                  <p className="text-xs font-bold leading-tight text-slate-700 mt-0.5">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {apkUrl && (
            <a
              href={apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3.5 w-full px-5 py-3.5 rounded-2xl transition-all duration-200 bg-[#02302e] hover:bg-[#05403c] shadow-md active:scale-[0.99]"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 flex-shrink-0 text-white"
                fill="currentColor"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <div className="text-left">
                <p className="text-[8px] font-black tracking-widest text-emerald-400 leading-none">
                  LOCAL DISTRIBUTABLE
                </p>
                <p className="text-xs font-bold text-white mt-0.5">
                  Download Android APK Package
                </p>
              </div>
            </a>
          )}

          <button
            onClick={onClose}
            className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors py-1 tracking-wide"
          >
            Dismiss Verification
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
            setCycle(cycles.find((c) => c.status === "active") || null);
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

  const quickLinkTints = [
    "#e6f4ea",
    "#e0f2f1",
    "#f0f4e8",
    "#eaf6f0",
    "#e1f5fe",
    "#fff3e0",
    "#f3e5f5",
  ];
  const quickLinkIconColors = [
    C.accent,
    C.accentDark,
    "#558b2f",
    "#2e7d32",
    "#0288d1",
    "#e65100",
    "#6a1b9a",
  ];
  const quickLinks = [
    { to: "/bills", icon: FileText, label: "Bills", badge: 0 },
    { to: "/room-details", icon: Home, label: "My Room", badge: 0 },
    { to: "/billing-history", icon: BookOpen, label: "History", badge: 0 },
    {
      to: "/announcements",
      icon: Megaphone,
      label: "Broadcasts",
      badge: badges.unreadAnnouncements,
    },
    { to: "/presence", icon: CheckSquare, label: "Presence", badge: 0 },
    {
      to: "/notifications",
      icon: Bell,
      label: "Alerts",
      badge: badges.unreadNotifications,
    },
    { to: "/profile", icon: User, label: "Profile", badge: 0 },
  ];

  const memberCount = room?.members?.length ?? 0;
  const payorCount = (room?.members || []).filter(
    (m) => m.isPayer || m.is_payer,
  ).length;

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
          Loading your data...
        </p>
      </div>
    );

  return (
    <div className="min-h-screen pb-24 bg-[#f6f9f7] text-slate-800 antialiased">
      {showPayModal && (
        <MobilePayModal onClose={() => setShowPayModal(false)} />
      )}

      {/* ── Membership Allocation Modal ────────────────────────────────────── */}
      {joinPayerChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl bg-white border border-slate-100 animate-slideUp">
            <div
              className="px-8 py-8 text-white relative"
              style={{ background: heroBg }}
            >
              <h3 className="font-black text-xl tracking-tight">
                Configure Ledger Association
              </h3>
              <p className="text-xs mt-2 text-white/70 font-medium leading-relaxed">
                Choose your structural liability model. Assigning as a Payer
                directly inserts your profile into utility pro-rata distribution
                routines.
              </p>
            </div>
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => confirmJoin(false)}
                  className="p-4 rounded-2xl border-2 border-slate-100 text-left hover:border-slate-300 hover:bg-slate-50 transition-all group active:scale-[0.98]"
                >
                  <p className="font-black text-sm text-slate-800">
                    Tenant Profile
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal">
                    Read-only structural access. Not responsible for general
                    bill items.
                  </p>
                </button>
                <button
                  onClick={() => confirmJoin(true)}
                  className="p-4 rounded-2xl text-left border-2 border-transparent text-white transition-all hover:opacity-95 active:scale-[0.98] flex flex-col justify-between"
                  style={{
                    background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)`,
                  }}
                >
                  <div>
                    <p className="font-black text-sm text-emerald-200">
                      Financial Payer
                    </p>
                    <p className="text-[11px] text-emerald-100/80 font-medium mt-1 leading-normal">
                      Active ledger node. Splits property rent, water, power,
                      and data line costs.
                    </p>
                  </div>
                </button>
              </div>
              <button
                onClick={() => setJoinPayerChoice(null)}
                className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors pt-2 uppercase tracking-wider"
              >
                Abort Operational Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — Cinematic Bento Header
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden shadow-2xl shadow-emerald-950/10"
        style={{
          background: heroBg,
          borderBottomLeftRadius: 40,
          borderBottomRightRadius: 40,
        }}
      >
        {/* Dynamic Light Drops */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[100px]"
            style={{
              background:
                "radial-gradient(circle, rgba(126,232,162,0.15) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute bottom-[-30%] right-[10%] w-[600px] h-[600px] rounded-full blur-[120px]"
            style={{
              background:
                "radial-gradient(circle, rgba(234,179,8,0.08) 0%, transparent 60%)",
            }}
          />
        </div>

        {/* Global Structural Header Action Strip */}
        <div className="max-w-7xl mx-auto px-6 pt-6 pb-2 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3.5">
            <div
              className="flex-shrink-0 rounded-2xl p-[2px] shadow-lg shadow-black/20"
              style={{
                background: `linear-gradient(135deg, ${C.accentSurface} 0%, ${C.accent} 100%)`,
              }}
            >
              <Avatar
                src={avatarSrc}
                name={user?.name || ""}
                size="md"
                className="ring-4 ring-[#02302e]"
              />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-emerald-400/80 leading-none">
                {getGreeting()}
              </p>
              <h2 className="text-lg font-black text-white tracking-tight mt-1">
                {user?.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-all bg-white/5 border border-white/10 text-white/90 hover:bg-white/10 hover:text-white active:scale-95"
            >
              <Bell size={18} />
              {badges.unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1.5 bg-rose-500 text-white text-[9px] rounded-full flex items-center justify-center font-black shadow-lg ring-2 ring-[#02302e]">
                  {badges.unreadNotifications > 9
                    ? "9+"
                    : badges.unreadNotifications}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Hero Structural Split Layout */}
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase backdrop-blur-md bg-white/5 border border-white/10">
              {room ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                  <span className="text-emerald-300 font-extrabold">
                    {room.name}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                  <span className="text-amber-300 font-extrabold">
                    Pending Infrastructure Sync
                  </span>
                </>
              )}
            </div>

            {room ? (
              <div className="space-y-4">
                <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.05]">
                  Property Flow <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-mint-100">
                    {room.name}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm leading-relaxed max-w-xl font-medium text-slate-300/80">
                  The all-in-one tool for apartment tenants and landlords to
                  track bills, split costs, and settle payments.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.05]">
                  Centralized <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-200">
                    Propflow Ledger
                  </span>
                </h1>
                <p className="text-xs sm:text-sm leading-relaxed max-w-xl font-medium text-slate-300/80">
                  Initialize terminal telemetry by syncing with a room instance
                  below, or coordinate access with your assigned platform
                  manager.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Link
                to="/bills"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs font-black tracking-wide text-slate-900 bg-emerald-300 hover:bg-emerald-200 shadow-xl shadow-emerald-950/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                View Bills <ArrowUpRight size={14} className="stroke-[3]" />
              </Link>
              {room && (
                <button
                  onClick={() => setShowPayModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs font-black tracking-wide text-white transition-all bg-white/5 border border-white/15 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles size={14} className="text-emerald-400" />
                  Pay Now
                </button>
              )}
            </div>
          </div>

          {/* Right Bento Panel Block */}
          <div className="lg:col-span-5 w-full">
            <div className="rounded-[32px] overflow-hidden backdrop-blur-xl border border-white/10 shadow-2xl bg-gradient-to-b from-white/10 to-white/[0.02]">
              <div className="p-6 flex items-center gap-4 border-b border-white/5 bg-white/[0.02]">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10 shadow-inner">
                  <Target size={20} color={C.accentSurface} />
                </div>
                <div>
                  <p className="text-3xl font-black text-white tracking-tight leading-none">
                    {displayShare
                      ? `₱${Number(displayShare.total).toLocaleString()}`
                      : room
                        ? "—"
                        : "₱0"}
                  </p>
                  <p className="text-[11px] font-bold mt-1.5 text-slate-400 tracking-wide uppercase">
                    {displayShare
                      ? displayShare.exact
                        ? "You owe this cycle"
                        : "Estimated share this cycle"
                      : "No Active billing Data"}
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cycle Allocation Window
                  </span>
                  <span
                    className="text-xs font-black tracking-tight"
                    style={{
                      color: billingCountdown?.overdue
                        ? "#f87171"
                        : billingCountdown
                          ? C.accentSurface
                          : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {billingCountdown?.overdue
                      ? "Overdue"
                      : billingCountdown
                        ? `${Math.round(100 - billingCountdown.percentage)}% Time Unused`
                        : "Inactive Window"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 border border-white/5 p-[1px]">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: billingCountdown
                        ? `${billingCountdown.percentage}%`
                        : "0%",
                      background: billingCountdown?.overdue
                        ? "#f87171"
                        : billingCountdown?.percentage > 80
                          ? "#fbbf24"
                          : `linear-gradient(90deg, ${C.accentSurface}, #10b981)`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 border-b border-white/5 bg-black/10">
                <div className="p-4 text-center border-r border-white/5">
                  <p className="text-2xl font-black text-white tracking-tight">
                    {memberCount || "—"}
                  </p>
                  <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase mt-1">
                    Tenants
                  </p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-black text-white tracking-tight">
                    {payorCount || "—"}
                  </p>
                  <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase mt-1">
                    Payors
                  </p>
                </div>
              </div>

              <div className="p-4 text-center bg-black/20 border-b border-white/5">
                <p className="text-lg font-black text-white tracking-tight flex items-center justify-center gap-2">
                  {allPaid ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle size={16} /> 100% Cleared
                    </span>
                  ) : pendingBills.length > 0 ? (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <Clock size={16} /> {pendingBills.length} Actions Required
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </p>
                <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase mt-1">
                  Account Clearing Status
                </p>
              </div>

              <div className="p-4 flex flex-wrap items-center justify-center gap-2 bg-black/30">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />{" "}
                  Payor
                </span>
                {isPayer && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    🛡️ Bills
                  </span>
                )}
                {hasPendingPayment && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-sky-500/10 border border-sky-500/20 text-sky-400 animate-pulse">
                    ⚡ Verification Pending
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN BODY CONTAINER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-6 -mt-6 relative z-20 space-y-8">
        {/* ── SECTION 1: Critical System Discrepancy Warnings ───────────────── */}
        {outstandingBalance > 0 && (
          <div className="rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border bg-rose-50 border-rose-200/70 shadow-lg shadow-rose-950/5 animate-fadeIn">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest">
                  Arrears Flag Triggered
                </p>
                <h4 className="text-lg font-black text-rose-950 mt-0.5">
                  ₱{r2(outstandingBalance).toLocaleString()} Overdue System
                  Deficit
                </h4>
                <p className="text-xs text-rose-700/80 font-medium">
                  Unsettled outstanding structural items remain on your profile
                  node.
                </p>
              </div>
            </div>
            <Link
              to="/billing-history"
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 rounded-xl font-black text-center shadow-lg shadow-rose-600/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Remediate Arrears
            </Link>
          </div>
        )}

        {/* ── SECTION 2: Settlement & Action Module ────────────────────────── */}
        {room && isPayer && myPayment && (
          <div
            className="rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border bg-white shadow-xl shadow-slate-950/5 transition-all"
            style={{
              borderColor: allPaid
                ? "rgba(22,163,74,0.15)"
                : "rgba(217,119,6,0.15)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform hover:rotate-3"
                style={{
                  background: allPaid
                    ? "rgba(22,163,74,0.06)"
                    : "rgba(217,119,6,0.06)",
                }}
              >
                {allPaid ? (
                  <CheckCircle size={28} style={{ color: C.accent }} />
                ) : (
                  <Clock size={28} className="text-amber-600" />
                )}
              </div>
              <div className="space-y-0.5">
                <h4 className="font-black text-base text-slate-900 tracking-tight">
                  {allPaid
                    ? "Billing Obligations Satisfied"
                    : `${pendingBills.length} Unresolved Invoice Statements`}
                </h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xl">
                  {allPaid
                    ? "Your profile node contains zero pending liabilities for this active accounting loop."
                    : `The active group cycle requires structural collection for: ${pendingBills.join(", ")}.`}
                </p>
              </div>
            </div>

            <div className="shrink-0 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 flex justify-end">
              {!allPaid &&
                (hasPendingPayment ? (
                  <span className="inline-flex items-center justify-center w-full lg:w-auto gap-2 px-5 py-3.5 rounded-xl text-amber-800 bg-amber-50 border border-amber-200 text-xs font-black tracking-wide uppercase">
                    <Activity size={14} className="animate-spin" /> Verification
                    Protocol In Progress
                  </span>
                ) : (
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="w-full lg:w-auto text-xs px-6 py-3.5 rounded-xl font-black tracking-wide uppercase text-white shadow-xl shadow-emerald-950/10 transition-all hover:opacity-95 hover:scale-[1.01] active:scale-[0.99]"
                    style={{
                      background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)`,
                    }}
                  >
                    Pay Now
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* ── SECTION 3: Central Application Control Switchboard ───────────── */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
            Quick Navigations
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
            {quickLinks.map(({ to, icon: Icon, label, badge }, idx) => (
              <Link
                key={to}
                to={to}
                className="relative bg-white border border-slate-100/80 rounded-2xl p-5 flex flex-col items-center justify-center gap-3.5 transition-all duration-300 hover:shadow-xl hover:shadow-slate-950/5 hover:-translate-y-1 group text-center"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-all group-hover:scale-110 group-hover:rotate-3"
                  style={{ background: quickLinkTints[idx] }}
                >
                  <Icon size={20} style={{ color: quickLinkIconColors[idx] }} />
                </div>
                <span className="text-xs font-black text-slate-700 tracking-tight leading-tight group-hover:text-slate-900 transition-colors">
                  {label}
                </span>
                {badge > 0 && (
                  <span className="absolute top-3 right-3 min-w-[20px] h-[20px] px-1.5 bg-rose-600 text-white text-[10px] rounded-full flex items-center justify-center font-black shadow-md ring-2 ring-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* ── SECTION 4: Dual-Column Invoicing & Administration Modules ────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Block: Modern Invoice Breakdown Card */}
          <div className="lg:col-span-7 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-950/[0.03] overflow-hidden flex flex-col justify-between">
            <div>
              <div
                className="px-6 py-5 flex items-center justify-between border-b border-slate-100"
                style={{
                  background: "linear-gradient(to right, #f4f8f5, #ffffff)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-emerald-800 shadow-inner">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 tracking-tight">
                      Active Bill Breakdown
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      Current statement cycle
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {room && (
                    <Link
                      to="/room-details"
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline transition-colors"
                    >
                      Room Info
                    </Link>
                  )}
                  {cycle && <StatusBadge status={cycle.status} />}
                </div>
              </div>

              <div className="p-6">
                {cycleLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-5 bg-slate-100 rounded-lg w-1/4" />
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-4 bg-slate-100 rounded-md w-full"
                        />
                      ))}
                    </div>
                  </div>
                ) : cycle ? (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 border border-slate-100 p-3.5 rounded-2xl gap-2">
                      <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                        Accounting Window
                      </span>
                      <span className="font-black text-slate-800 text-xs sm:text-sm">
                        {new Date(
                          cycle.startDate || cycle.start_date,
                        ).toLocaleDateString("en-PH", {
                          month: "long",
                          day: "numeric",
                        })}
                        <span className="text-slate-400 font-normal px-2">
                          →
                        </span>
                        {new Date(
                          cycle.endDate || cycle.end_date,
                        ).toLocaleDateString("en-PH", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {[
                        {
                          label: "Base Facility Rental",
                          amt: displayShare?.rent ?? cycle.rent,
                          show: Number(cycle.rent) > 0,
                          icon: Home,
                          bg: "bg-amber-50 text-amber-700",
                          desc: "Core fixed structural lease rate",
                        },
                        {
                          label: "Power Grid Utility",
                          amt: displayShare?.electricity ?? cycle.electricity,
                          show: Number(cycle.electricity) > 0,
                          icon: Zap,
                          bg: "bg-orange-50 text-orange-700",
                          desc: "Variable metered electric resource usage",
                        },
                        {
                          label: "Fluid Logistics / Water",
                          amt:
                            displayShare?.water ??
                            (cycle.waterBillAmount || cycle.water_bill_amount),
                          show:
                            Number(
                              cycle.waterBillAmount || cycle.water_bill_amount,
                            ) > 0,
                          icon: Droplets,
                          bg: "bg-teal-50 text-teal-700",
                          desc: "Municipal fluid supply deployment",
                        },
                        {
                          label: "High-Speed Infrastructure",
                          amt: displayShare?.internet ?? cycle.internet,
                          show: Number(cycle.internet) > 0,
                          icon: Wifi,
                          bg: "bg-sky-50 text-sky-700",
                          desc: "Shared high-speed data architecture allocation",
                        },
                      ]
                        .filter((b) => b.show)
                        .map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-3.5 group first:pt-0 last:pb-0"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${item.bg}`}
                              >
                                <item.icon size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-800 leading-tight">
                                  {item.label}
                                </p>
                                <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                            <span className="font-black text-sm text-slate-900 bg-slate-50/50 group-hover:bg-slate-100/80 px-3 py-1.5 rounded-xl transition-colors">
                              ₱
                              {Number(item.amt).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        ))}
                    </div>

                    {!isPayer && (
                      <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/50 text-amber-800">
                        <Shield size={16} className="shrink-0 mt-0.5" />
                        <p className="text-[11px] font-medium leading-relaxed">
                          Account configured under a Tenant Scope. Cost line
                          ledger analytics are hidden; execution authority
                          resides with primary payers.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6">
                    <EmptyState
                      icon="📃"
                      title="No active billing cycle"
                      subtitle="Your host hasn't opened an active accounting loop for this space."
                    />
                  </div>
                )}
              </div>
            </div>

            {cycle && isPayer && (
              <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-black text-slate-800 text-sm tracking-tight">
                    {displayShare
                      ? "Your Total Bill This Cycle"
                      : "Your Estimated Bill This Cycle"}
                  </h4>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    {displayShare
                      ? displayShare.exact
                        ? "Enforced explicit split parameters"
                        : `Equalized division across ${homePayorCount} nodes`
                      : "Aggregate space tracking"}
                  </p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <span
                    className="font-black text-2xl tracking-tighter text-right flex-1 sm:flex-none"
                    style={{ color: C.accentDark }}
                  >
                    ₱
                    {Number(
                      displayShare?.total ||
                        cycle.totalBilledAmount ||
                        cycle.total_billed_amount ||
                        0,
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <Link
                    to="/bills"
                    className="px-5 py-3 rounded-xl font-black text-xs text-white text-center shadow-md shadow-emerald-950/10 transition-all hover:opacity-95"
                    style={{ background: C.accent }}
                  >
                    View Bills
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right Block: Dynamic Broadcast Terminal */}
          <div className="lg:col-span-5 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-950/[0.03] overflow-hidden flex flex-col justify-between">
            <div>
              <div
                className="px-6 py-5 flex items-center justify-between border-b border-slate-100"
                style={{
                  background: "linear-gradient(to right, #f4f8f7, #ffffff)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100/50 flex items-center justify-center text-teal-800 shadow-inner">
                    <Megaphone size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 tracking-tight">
                      Host Announcements
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      Operational Updates
                    </p>
                  </div>
                </div>
                <Link
                  to="/announcements"
                  className="text-xs font-black flex items-center gap-0.5 text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  All Logs <ChevronRight size={14} className="stroke-[3.5]" />
                </Link>
              </div>

              <div className="p-6">
                {annLoading ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-1/3" />
                        <div className="h-3 bg-slate-100 rounded w-full" />
                      </div>
                    ))}
                  </div>
                ) : announcements.length > 0 ? (
                  <div className="space-y-4">
                    {announcements.map((a) => (
                      <div
                        key={a.id || a._id}
                        className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 relative group hover:bg-slate-50 transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-xs font-black text-slate-800 group-hover:text-emerald-900 transition-colors leading-snug">
                            {a.title}
                          </h4>
                          {(a.isPinned || a.is_pinned) && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 shrink-0">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1.5 line-clamp-2 leading-relaxed">
                          {a.content}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-3 border-t border-slate-100/60 pt-2.5">
                          <Clock size={10} />
                          Issued{" "}
                          {new Date(
                            a.created_at || a.createdAt,
                          ).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4">
                    <EmptyState
                      icon="📢"
                      title="Broadcast channel empty"
                      subtitle="No announcements or site directives have been broadcasted yet."
                    />
                  </div>
                )}
              </div>
            </div>

            {announcements.length > 0 && (
              <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
                <Link
                  to="/announcements"
                  className="text-xs font-extrabold text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1"
                >
                  Browse historical archive bulletin <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 5: Immersive Room Membership Status Grid Matrix ───────── */}
        {room?.memberPayments?.length > 0 && cycle && (
          <div className="rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-950/[0.03] overflow-hidden">
            <div
              className="px-6 py-5 flex items-center justify-between border-b border-slate-100"
              style={{
                background: "linear-gradient(to right, #f2f7f4, #ffffff)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-inner">
                  <CheckSquare size={16} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 tracking-tight">
                    Payors Payment Status
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Real-time room payment activity and settlement records for
                    the current cycle
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-xl">
                <Users size={12} /> {room.memberPayments.length} Active Payors
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {room.memberPayments.map((mp, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/30 hover:border-slate-200 transition-all duration-200 gap-3"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-inner tracking-wider shrink-0"
                        style={{
                          background: mp.allPaid
                            ? "linear-gradient(135deg, #7ee8a2, #1a7a52)"
                            : "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
                          color: mp.allPaid ? "#fff" : "#475569",
                        }}
                      >
                        {(mp.memberName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">
                          {mp.memberName || "System Occupant"}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 tracking-wide mt-0.5 uppercase">
                          {mp.isPayer ? "Primary Payor" : "Resident Occupant"}
                        </p>
                      </div>
                    </div>

                    {mp.isPayer ? (
                      <div className="flex flex-wrap gap-1.5 sm:justify-end">
                        {[
                          {
                            label: "Rent",
                            status: mp.rentStatus,
                            show: Number(room.billing?.rent) > 0,
                          },
                          {
                            label: "Power",
                            status: mp.electricityStatus,
                            show: Number(room.billing?.electricity) > 0,
                          },
                          {
                            label: "Water",
                            status: mp.waterStatus,
                            show: Number(room.billing?.water) > 0,
                          },
                          {
                            label: "Net",
                            status: mp.internetStatus,
                            show: Number(room.billing?.internet) > 0,
                          },
                        ]
                          .filter((b) => b.show)
                          .map((b, j) => (
                            <div
                              key={j}
                              className="px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider border shadow-sm"
                              style={{
                                backgroundColor:
                                  b.status === "paid" ? "#f0fdf4" : "#fef2f2",
                                borderColor:
                                  b.status === "paid"
                                    ? "rgba(34,197,94,0.2)"
                                    : "rgba(239,68,68,0.2)",
                                color:
                                  b.status === "paid" ? "#15803d" : "#b91c1c",
                              }}
                            >
                              <span
                                className={`w-1 h-1 rounded-full ${b.status === "paid" ? "bg-emerald-500" : "bg-rose-500"}`}
                              />
                              {b.label}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 border border-slate-200/40 select-none">
                        Exempt Scope
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-black text-slate-400 tracking-widest uppercase">
                <span className="text-slate-500 font-extrabold">
                  Audit Registry Dictionary:
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                  Confirmed Settlement
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{" "}
                  Outstanding Liability
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 6: External Available Network Architectural Spaces ────── */}
        {unjoinedRooms.length > 0 && (
          <div className="space-y-4">
            <div className="px-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {room
                  ? "Companion Facilities Directory"
                  : "Available Spatial Registries"}
              </p>
              <h3 className="text-xl font-black text-slate-900 tracking-tight mt-1">
                Discover More Properties
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {unjoinedRooms.map((r) => {
                const rid = r.id || r._id;
                const isPending = pendingRoomIds.includes(rid);
                return (
                  <div
                    key={rid}
                    className="rounded-3xl bg-white border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl shadow-slate-950/[0.02] transition-all hover:shadow-xl hover:shadow-slate-950/5 group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-50 border border-emerald-100/50 text-emerald-800 shadow-inner group-hover:scale-105 transition-transform duration-200">
                        <Home size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-black text-base text-slate-900 tracking-tight leading-tight group-hover:text-emerald-950 transition-colors">
                          {r.name}
                        </h4>
                        {r.description && (
                          <p className="text-xs text-slate-500 font-medium max-w-2xl leading-relaxed">
                            {r.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-wide text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/30 uppercase">
                            <Users size={11} />{" "}
                            {r.memberCount ?? r.members?.length ?? 0} Tenants
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 shrink-0">
                      <button
                        onClick={() => navigate(`/room/${rid}`)}
                        className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 px-4 py-3 rounded-xl transition-colors"
                      >
                        View Property
                      </button>
                      {isPending ? (
                        <span className="text-xs text-amber-700 bg-amber-50 px-5 py-3 rounded-xl font-black border border-amber-200 text-center tracking-wide uppercase">
                          Awaiting Cryptographic Entry Approval
                        </span>
                      ) : (
                        <button
                          onClick={() => handleJoinRoom(rid)}
                          disabled={joiningRoomId === rid}
                          className="text-xs px-5 py-3 rounded-xl font-black uppercase tracking-wide text-white transition-all shadow-lg hover:opacity-95 disabled:opacity-50 flex items-center gap-2"
                          style={{
                            background: C.accent,
                            boxShadow: "0 10px 15px -3px rgba(26,122,82,0.2)",
                          }}
                        >
                          {joiningRoomId === rid && <Spinner size="sm" />}
                          Inquire
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!room && unjoinedRooms.length === 0 && (
          <div className="py-12 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-950/[0.02]">
            <EmptyState
              icon="🏠"
              title="Zero network registries found"
              subtitle="No room nodes are broadcasting availability. Secure explicit link criteria directly from your system manager."
            />
          </div>
        )}
      </div>
    </div>
  );
}
