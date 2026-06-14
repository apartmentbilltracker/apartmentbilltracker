import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  billingCycleService,
  paymentService,
  settingsService,
} from "../../services/apiService";
import { Alert, EmptyState } from "../../components/ui";
import {
  Zap,
  Droplets,
  Wifi,
  Home,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Smartphone,
  X,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Activity,
} from "lucide-react";

const APP_DEEP_LINK = "aptbilltracker://bills";

function tryOpenApp() {
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

    tryOpenApp();
    setJustTried(true);
  }, []);

  const handleOpenApp = () => {
    tryOpenApp();
    setJustTried(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 animate-fadeIn"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/50 dark:border-slate-800/50 p-6 shadow-2xl backdrop-blur-xl space-y-6 transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center gap-4 pt-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a7a52]/20 to-[#1a7a52]/5 dark:from-[#7ee8a2]/20 dark:to-transparent flex items-center justify-center shadow-md border border-[#1a7a52]/10 dark:border-[#7ee8a2]/10">
            <Smartphone
              size={28}
              className="text-[#1a7a52] dark:text-[#7ee8a2]"
            />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Pay Safely on Mobile
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 max-w-sm leading-relaxed">
              To process your secure payment, let's head right over to the{" "}
              <span className="font-bold text-[#1a7a52] dark:text-[#7ee8a2]">
                PropFlow
              </span>{" "}
              mobile app.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenApp}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 bg-[#1a7a52] text-white hover:bg-[#135c3d] dark:bg-[#7ee8a2] dark:text-[#02302e] dark:hover:bg-[#64d08b] active:scale-[0.99] shadow-lg shadow-[#1a7a52]/20 dark:shadow-none"
        >
          <ShieldCheck size={16} />
          {justTried ? "Try Opening App Again" : "Open PropFlow App"}
        </button>

        {justTried && (
          <p className="text-xs text-center font-semibold text-slate-400 dark:text-slate-500">
            App didn't open automatically? You can use the links below instead.
          </p>
        )}

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-slate-200/60 dark:bg-slate-800/50" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Official App Stores
          </span>
          <div className="flex-1 h-px bg-slate-200/60 dark:bg-slate-800/50" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40 opacity-50 cursor-not-allowed select-none transition-all"
            title="Google Play availability coming soon!"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 flex-shrink-0 text-slate-400"
              fill="currentColor"
            >
              <path d="M3.18 23.76c.33.18.7.24 1.06.18L14.93 12 4.24.06A1.83 1.83 0 0 0 3 1.83v20.34c0 .6.06 1.18.18 1.59zM16.34 13.4l2.79-2.79-2.79-2.79-1.41 1.41L16.52 12l-1.59 1.59 1.41 1.41zm2.48 5.6-9.43-5.47L11.98 12l1.41-1.53 9.43-5.47c.76.44 1.18 1.18 1.18 2.01v10a2 2 0 0 1-1.18 1.99zM4.24 23.94l10.69-11.94-2.59-2.59L4.24.06" />
            </svg>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                COMING SOON
              </p>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                Google Play
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40 opacity-50 cursor-not-allowed select-none transition-all"
            title="App Store version coming soon!"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 flex-shrink-0 text-slate-400"
              fill="currentColor"
            >
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                COMING SOON
              </p>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                App Store
              </p>
            </div>
          </div>
        </div>

        {apkUrl && (
          <a
            href={apkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-950 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700/90 transition-all shadow-md group"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 flex-shrink-0 text-white group-hover:scale-105 transition-transform"
              fill="currentColor"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <div className="text-left">
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-400 tracking-wide leading-none">
                DIRECT DOWNLOAD
              </p>
              <p className="text-xs font-bold text-white mt-1 leading-none">
                Get the Android APK
              </p>
            </div>
          </a>
        )}

        <button
          onClick={onClose}
          className="w-full text-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

function BillRow({
  label,
  amount,
  icon: Icon,
  iconClass,
  bgClass,
  status,
  note,
}) {
  return (
    <div className="flex items-center justify-between py-3.5 px-2 rounded-xl hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-200 group border-b border-slate-100 dark:border-slate-800/40 last:border-none">
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all group-hover:scale-105 shadow-sm border border-slate-200/10 ${bgClass || "bg-slate-50 dark:bg-slate-800/40"}`}
          >
            <Icon size={16} className={iconClass || "text-slate-400"} />
          </div>
        )}
        <div className="min-w-0">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
            {label}
          </span>
          {note && (
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {note}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight">
          ₱{Number(amount || 0).toLocaleString()}
        </span>
        {status === "paid" && (
          <div className="p-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10">
            <CheckCircle
              size={14}
              className="text-emerald-500 dark:text-emerald-400"
            />
          </div>
        )}
        {status === "unpaid" && (
          <div className="p-0.5 rounded-full bg-rose-500/10 dark:bg-rose-400/10">
            <XCircle size={14} className="text-rose-400" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillsPage() {
  const { state } = useAuth();
  const { user } = state;
  const [showPayModal, setShowPayModal] = useState(false);
  const userId = user?.id || user?._id;

  const [room, setRoom] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [payments, setPayments] = useState([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const roomsRes = await roomService.getClientRooms();
      const rooms = Array.isArray(roomsRes)
        ? roomsRes
        : roomsRes?.rooms || roomsRes?.data || [];
      const joined = rooms[0] || null;
      if (!joined) {
        setLoading(false);
        return;
      }
      setRoom(joined);
      const roomId = joined.id || joined._id;
      const [cycleRes, payRes, balRes] = await Promise.allSettled([
        billingCycleService.getBillingCycles(roomId),
        paymentService.getMyPayments(roomId),
        billingCycleService.getOutstandingBalance(roomId),
      ]);
      if (cycleRes.status === "fulfilled") {
        const cycles = Array.isArray(cycleRes.value)
          ? cycleRes.value
          : cycleRes.value?.billingCycles || cycleRes.value?.data || [];
        const active = cycles.find((c) => c.status === "active") || null;
        setCycle(active);
      }
      if (payRes.status === "fulfilled")
        setPayments(
          payRes.value?.transactions ||
            payRes.value?.payments ||
            payRes.value?.data ||
            [],
        );
      if (balRes.status === "fulfilled")
        setOutstandingBalance(balRes.value?.totalOutstanding || 0);
    } catch (e) {
      setError(
        e?.message ||
          "We couldn't load your billing info. Please give the page a quick refresh.",
      );
    }
    setLoading(false);
  };

  const myPayment = room?.memberPayments?.find(
    (mp) => String(mp.member) === String(userId),
  );
  const userCharge = cycle?.memberCharges?.find(
    (mc) => String(mc.userId) === String(userId),
  );
  const myMember = room?.members?.find(
    (m) => String(m.user?.id || m.user?._id) === String(userId),
  );
  const isPayer =
    myMember?.isPayer ?? myMember?.is_payer ?? userCharge?.isPayer ?? false;

  const myShare = userCharge
    ? {
        rent: Number(userCharge.rentShare || 0),
        electricity: Number(userCharge.electricityShare || 0),
        water: Number(userCharge.waterBillShare || 0),
        internet: Number(userCharge.internetShare || 0),
        total: Number(userCharge.totalDue || 0),
      }
    : null;

  const fallbackTotal = Number(
    cycle?.totalBilledAmount || cycle?.total_billed_amount || 0,
  );

  const waterBreakdown = userCharge
    ? {
        ownWater: Number(userCharge.waterOwn || 0),
        sharedNonPayorWater: Number(userCharge.waterSharedNonpayor || 0),
      }
    : null;

  const waterNote =
    waterBreakdown &&
    (waterBreakdown.ownWater > 0 || waterBreakdown.sharedNonPayorWater > 0)
      ? `Your usage: ₱${waterBreakdown.ownWater.toLocaleString()} + Comm split: ₱${waterBreakdown.sharedNonPayorWater.toLocaleString()}`
      : null;

  const myRecentPayments = cycle
    ? payments.filter((p) => {
        const cycleStart = (cycle.startDate || cycle.start_date || "").slice(
          0,
          10,
        );
        const payStart = (
          p.billingCycleStart ||
          p.billing_cycle_start ||
          ""
        ).slice(0, 10);
        return cycleStart && payStart && cycleStart === payStart;
      })
    : [];

  const totalPaid = (() => {
    const fromTx = myRecentPayments
      .filter((p) => p.status === "approved" || p.status === "settled")
      .reduce((s, p) => s + Number(p.amount), 0);
    if (myPayment?.allPaid && fromTx === 0)
      return myShare?.total || fallbackTotal;
    return fromTx;
  })();

  const pendingPayments = myRecentPayments.filter(
    (p) => p.status === "pending" || p.status === "submitted",
  );

  useEffect(() => {
    if (pendingPayments.length === 0) return;
    const roomId = room?.id || room?._id;
    if (!roomId) return;
    const refresh = async () => {
      try {
        const [roomsRes, payRes] = await Promise.allSettled([
          roomService.getClientRooms(),
          paymentService.getMyPayments(roomId),
        ]);
        if (roomsRes.status === "fulfilled") {
          const rooms = Array.isArray(roomsRes.value)
            ? roomsRes.value
            : roomsRes.value?.rooms || roomsRes.value?.data || [];
          const joined =
            rooms.find((r) => String(r.id || r._id) === String(roomId)) ||
            rooms[0] ||
            null;
          if (joined) setRoom(joined);
        }
        if (payRes.status === "fulfilled")
          setPayments(
            payRes.value?.transactions ||
              payRes.value?.payments ||
              payRes.value?.data ||
              [],
          );
      } catch (_) {}
    };
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [pendingPayments.length, room?.id, room?._id]);

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
          Loading your data...
        </p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 px-4 animate-fadeIn">
      {showPayModal && (
        <MobilePayModal onClose={() => setShowPayModal(false)} />
      )}

      {/* Top Header Row */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 group">
        <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 blur-3xl group-hover:scale-110 transition-transform duration-700" />

        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-xs font-black text-[#1a7a52] dark:text-[#7ee8a2] tracking-wide mb-2 uppercase">
            <Activity size={12} /> Overview
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Billing Statement
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 max-w-xl">
            Check your shared room utilities, tracked rent periods, and safely
            settle your split balances below.
          </p>
        </div>

        {/* Current Active Timeline Card Segment */}
        <div className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-800/50 backdrop-blur-sm self-start md:self-center">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-slate-400 shrink-0 border border-slate-200/20">
            <Calendar
              size={18}
              className="text-[#1a7a52] dark:text-[#7ee8a2]"
            />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase leading-none">
              Billing Period
            </p>
            <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1.5 whitespace-nowrap">
              {new Date(cycle.startDate || cycle.start_date).toLocaleDateString(
                "en-PH",
                { month: "short", day: "numeric" },
              )}
              {" – "}
              {new Date(cycle.endDate || cycle.end_date).toLocaleDateString(
                "en-PH",
                { month: "short", day: "numeric", year: "numeric" },
              )}
            </p>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {!room ? (
        <EmptyState
          icon="🏠"
          title="No property linked"
          subtitle="You aren't assigned to an active rental unit yet. Please reach out to your property manager to link your profile."
        />
      ) : !cycle ? (
        <EmptyState
          icon="🧾"
          title="All caught up!"
          subtitle="No new bills have been posted for this period. We'll notify you as soon as your statement is ready."
        />
      ) : (
        /* Bento Core Dashboard Structure Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT-COLUMN: Primary Breakdown Actions Container */}
          <div className="lg:col-span-7 space-y-6 flex flex-col h-full">
            {/* Conditional Unpaid Balance Alert */}
            {outstandingBalance > 0 && (
              <div className="rounded-3xl p-5 border border-rose-100 dark:border-rose-950/40 bg-gradient-to-r from-rose-50/30 via-white/80 to-transparent dark:from-rose-950/5 dark:via-slate-900/40 backdrop-blur-md flex items-center gap-4 shadow-sm group">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-rose-800 dark:text-rose-400 uppercase tracking-widest">
                    Past Unpaid Balance
                  </p>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    You have an outstanding balance of{" "}
                    <span className="font-black text-rose-600 dark:text-rose-400">
                      ₱{Number(outstandingBalance).toLocaleString()}
                    </span>{" "}
                    from previous months.
                  </p>
                </div>
                <Link
                  to="/billing-history"
                  className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shrink-0 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 px-3.5 py-2 rounded-xl transition-all shadow-sm hover:scale-[1.02]"
                >
                  View History <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {/* Core Personal Split Bento Panel */}
            {isPayer && myShare && (
              <div
                className={`rounded-3xl border p-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm relative overflow-hidden transition-all duration-300 flex-1 flex flex-col justify-between group ${
                  myPayment?.allPaid
                    ? "border-emerald-500/20 shadow-emerald-500/5 dark:shadow-none"
                    : "border-slate-200/80 dark:border-slate-800/80"
                }`}
              >
                <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-gradient-to-br from-[#1a7a52]/5 to-transparent blur-2xl group-hover:scale-125 transition-transform" />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm ${myPayment?.allPaid ? "bg-emerald-500" : "bg-[#1a7a52]"}`}
                      >
                        <CreditCard size={14} />
                      </div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                        Your Share
                      </h2>
                    </div>
                    {myPayment?.allPaid && (
                      <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 px-2 py-0.5 rounded-md">
                        All Settled
                      </span>
                    )}
                  </div>

                  {myPayment?.allPaid ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/10">
                        <CheckCircle size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          Account balance clear
                        </p>
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 max-w-xs leading-relaxed">
                          Awesome! Your share of the bills has been fully paid
                          and confirmed for this period.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 my-4">
                      {Number(myShare.rent) > 0 && (
                        <div className="flex items-center justify-between py-2.5 px-1.5 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Rent
                          </span>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              ₱{myShare.rent.toLocaleString()}
                            </span>
                            {myPayment?.rentStatus === "paid" ? (
                              <CheckCircle
                                size={14}
                                className="text-emerald-500"
                              />
                            ) : (
                              <XCircle size={14} className="text-rose-400" />
                            )}
                          </div>
                        </div>
                      )}
                      {Number(myShare.electricity) > 0 && (
                        <div className="flex items-center justify-between py-2.5 px-1.5 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Electricity
                          </span>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              ₱{myShare.electricity.toLocaleString()}
                            </span>
                            {myPayment?.electricityStatus === "paid" ? (
                              <CheckCircle
                                size={14}
                                className="text-emerald-500"
                              />
                            ) : (
                              <XCircle size={14} className="text-rose-400" />
                            )}
                          </div>
                        </div>
                      )}
                      {Number(myShare.water) > 0 && (
                        <div className="flex items-center justify-between py-2.5 px-1.5 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                          <div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                              Water
                            </span>
                            {waterNote && (
                              <span className="text-[10px] font-semibold text-slate-400 block truncate max-w-xs">
                                {waterNote}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              ₱{myShare.water.toLocaleString()}
                            </span>
                            {myPayment?.waterStatus === "paid" ? (
                              <CheckCircle
                                size={14}
                                className="text-emerald-500"
                              />
                            ) : (
                              <XCircle size={14} className="text-rose-400" />
                            )}
                          </div>
                        </div>
                      )}
                      {Number(myShare.internet) > 0 && (
                        <div className="flex items-center justify-between py-2.5 px-1.5 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Internet
                          </span>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              ₱{myShare.internet.toLocaleString()}
                            </span>
                            {myPayment?.internetStatus === "paid" ? (
                              <CheckCircle
                                size={14}
                                className="text-emerald-500"
                              />
                            ) : (
                              <XCircle size={14} className="text-rose-400" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Total / Action Footing */}
                <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/60 mt-auto">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Total Amount Due
                    </span>
                    <span className="text-xl font-black text-[#1a7a52] dark:text-[#7ee8a2] tracking-tight">
                      ₱{myShare.total.toLocaleString()}
                    </span>
                  </div>

                  {!myPayment?.allPaid &&
                    (pendingPayments.length > 0 ? (
                      <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <Clock
                          size={14}
                          className="text-amber-500 animate-pulse"
                        />
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                          Payment sent! Waiting for manager approval.
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowPayModal(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all duration-300 bg-[#1a7a52] text-white hover:bg-[#135c3d] dark:bg-[#7ee8a2] dark:text-[#02302e] dark:hover:bg-[#64d08b] active:scale-[0.99] shadow-md shadow-[#1a7a52]/10"
                      >
                        <CreditCard size={14} /> Pay Securely via Mobile App
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT-COLUMN: Secondary Summary Cards */}
          <div className="lg:col-span-5 space-y-6 flex flex-col h-full">
            {/* Quick Summary Bento Node */}
            <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 shadow-sm group">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3.5 flex items-center gap-1.5">
                <TrendingUp size={12} /> Quick Summary
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200/20 dark:border-slate-800/40 p-3.5 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                    Total Paid
                  </p>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
                    ₱{totalPaid.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200/20 dark:border-slate-800/40 p-3.5 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                    Remaining
                  </p>
                  <p className="text-base font-black text-rose-500 dark:text-rose-400 mt-1 tracking-tight">
                    ₱
                    {Math.max(
                      0,
                      (myShare?.total || fallbackTotal) - totalPaid,
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Full Collective Room Cost Bento Panel */}
            {isPayer && (
              <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 shadow-sm flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                    Total Household Bills
                  </h2>
                  <div className="divide-y divide-slate-100/80 dark:divide-slate-800/30">
                    {Number(cycle.rent) > 0 && (
                      <BillRow
                        label="House Rent"
                        amount={cycle.rent}
                        icon={Home}
                        iconClass="text-orange-500"
                        bgClass="bg-orange-50 dark:bg-orange-950/20"
                        status={myPayment?.rentStatus}
                      />
                    )}
                    {Number(cycle.electricity) > 0 && (
                      <BillRow
                        label="Electricity Bill"
                        amount={cycle.electricity}
                        icon={Zap}
                        iconClass="text-amber-500"
                        bgClass="bg-amber-50 dark:bg-amber-950/20"
                        status={myPayment?.electricityStatus}
                        note={
                          cycle.electricity_units
                            ? `${cycle.electricity_units} kWh used`
                            : null
                        }
                      />
                    )}
                    {Number(cycle.waterBillAmount || cycle.water_bill_amount) >
                      0 && (
                      <BillRow
                        label="Water Bill"
                        amount={
                          cycle.waterBillAmount || cycle.water_bill_amount
                        }
                        icon={Droplets}
                        iconClass="text-blue-500"
                        bgClass="bg-blue-50 dark:bg-blue-950/20"
                        status={myPayment?.waterStatus}
                      />
                    )}
                    {Number(cycle.internet) > 0 && (
                      <BillRow
                        label="Internet Bill"
                        amount={cycle.internet}
                        icon={Wifi}
                        iconClass="text-purple-500"
                        bgClass="bg-purple-50 dark:bg-purple-950/20"
                        status={myPayment?.internetStatus}
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-200/50 dark:border-slate-800/60 mt-6">
                  <span className="text-xs font-bold text-slate-400">
                    Total Room Bill
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                    ₱{fallbackTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Width Dynamic Presence Grid Block */}
      {(() => {
        const isPresenceBased =
          room.waterBillingMode !== "fixed_monthly" &&
          room.water_billing_mode !== "fixed_monthly";
        const members = room.members || [];
        const billingStart = room.billing?.start
          ? new Date(room.billing.start)
          : null;
        const billingEnd = room.billing?.end
          ? new Date(room.billing.end)
          : null;
        if (!isPresenceBased || members.length === 0) return null;

        const memberRows = members.map((m) => {
          const mId = m.id || m._id;
          const name = m.user?.name || m.user?.email || "Resident Occupant";
          const rawPresence = Array.isArray(m.presence) ? m.presence : [];
          const filteredDays =
            billingStart && billingEnd
              ? rawPresence.filter((d) => {
                  const dt = new Date(d);
                  return dt >= billingStart && dt <= billingEnd;
                })
              : rawPresence;
          const days = filteredDays.length;
          const waterAmt = days * 5;
          const isMe = String(mId) === String(userId);
          return {
            name,
            days,
            waterAmt,
            isMe,
            isPayer: m.isPayer || m.is_payer,
          };
        });

        return (
          <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
                <Droplets size={15} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                  Water Usage by Person
                </h2>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                  Water costs are calculated at ₱5.00 per day for the days you
                  stayed here.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {memberRows.map((mr, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.01] flex flex-col justify-between gap-3 ${
                    mr.isMe
                      ? "bg-gradient-to-br from-[#1a7a52]/5 to-transparent border-[#1a7a52]/20 dark:border-[#7ee8a2]/20"
                      : "bg-slate-50/40 dark:bg-slate-800/10 border-slate-200/40 dark:border-slate-800/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate flex items-center gap-2">
                        {mr.name}
                        {mr.isMe && (
                          <span className="text-[8px] font-black uppercase bg-[#1a7a52] text-white px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                        {mr.days} day{mr.days !== 1 ? "s" : ""} recorded
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/30 dark:border-slate-800/20 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      {!mr.isPayer ? "Not a Payer" : "Total Cost"}
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      ₱{mr.waterAmt.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
