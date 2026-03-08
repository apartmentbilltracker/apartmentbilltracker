import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  billingCycleService,
  paymentService,
  settingsService,
} from "../../services/apiService";
import { Spinner, StatusBadge, Alert, EmptyState } from "../../components/ui";
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

    // Auto-attempt deep link the moment the modal opens.
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
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-white/8 last:border-none">
      {Icon && (
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            bgClass || "bg-gray-100 dark:bg-white/8"
          }`}
        >
          <Icon size={16} className={iconClass || "text-gray-500"} />
        </div>
      )}
      <div className="flex-1">
        <span className="text-sm text-gray-700 dark:text-white/70">
          {label}
        </span>
        {note && (
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
            {note}
          </p>
        )}
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white mr-2">
        ₱{Number(amount || 0).toLocaleString()}
      </span>
      {status === "paid" && (
        <CheckCircle size={16} className="text-green-500 shrink-0" />
      )}
      {status === "unpaid" && (
        <XCircle size={16} className="text-red-400 shrink-0" />
      )}
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
      setError(e?.message || "Failed to load bills");
    }
    setLoading(false);
  };

  // Per-category status from room.memberPayments
  const myPayment = room?.memberPayments?.find(
    (mp) => String(mp.member) === String(userId),
  );

  // Per-user share from memberCharges
  const userCharge = cycle?.memberCharges?.find(
    (mc) => String(mc.userId) === String(userId),
  );

  // Payer check
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

  const payorCount =
    cycle?.memberCharges?.filter((mc) => mc.isPayer)?.length || 1;

  const waterBreakdown = userCharge
    ? {
        ownWater: Number(userCharge.waterOwn || 0),
        sharedNonPayorWater: Number(userCharge.waterSharedNonpayor || 0),
      }
    : null;

  const waterNote =
    waterBreakdown &&
    (waterBreakdown.ownWater > 0 || waterBreakdown.sharedNonPayorWater > 0)
      ? `Own: ₱${waterBreakdown.ownWater.toLocaleString()}${
          waterBreakdown.sharedNonPayorWater > 0
            ? ` + Shared: ₱${waterBreakdown.sharedNonPayorWater.toLocaleString()}`
            : ""
        }`
      : null;

  const cycleId = cycle?.id || cycle?._id;
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
    // When room data confirms allPaid but payment transactions aren't available
    // (different API, date mismatch, etc.), trust the room record so the chips
    // display correctly instead of showing ₱0 Paid.
    if (myPayment?.allPaid && fromTx === 0)
      return myShare?.total || fallbackTotal;
    return fromTx;
  })();
  const pendingPayments = myRecentPayments.filter(
    (p) => p.status === "pending" || p.status === "submitted",
  );

  // Auto-refresh room + payments while a payment is awaiting verification
  // so the Paid/Remaining chips and allPaid flag update without a manual reload.
  // eslint-disable-next-line react-hooks/rules-of-hooks
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
  }, [pendingPayments.length, room?.id, room?._id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        My Bills
      </h1>
      {error && <Alert type="error" message={error} />}

      {!room ? (
        <EmptyState
          icon="🏠"
          title="No room joined"
          subtitle="You haven't joined a room yet"
        />
      ) : !cycle ? (
        <EmptyState
          icon="🧾"
          title="No active billing cycle"
          subtitle="Your host hasn't opened a billing cycle yet"
        />
      ) : (
        <>
          {/* Outstanding balance */}
          {outstandingBalance > 0 && (
            <div className="card p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10 flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  Outstanding Balance
                </p>
                <p className="text-xs text-red-600 dark:text-red-300">
                  ₱{Number(outstandingBalance).toLocaleString()} from previous
                  cycles
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

          {/* Pending payment notice */}
          {pendingPayments.length > 0 && (
            <div className="card p-4 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10 flex items-center gap-3">
              <Clock size={18} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {pendingPayments.length} payment
                {pendingPayments.length > 1 ? "s" : ""} awaiting approval.
              </p>
            </div>
          )}

          <div className="card p-4 flex items-center gap-3 bg-accent/5">
            <Calendar size={18} className="text-accent" />
            <div>
              <p className="text-xs text-gray-500 dark:text-white/40">
                Billing Period
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {new Date(
                  cycle.startDate || cycle.start_date,
                ).toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                })}
                {" \u2013 "}
                {new Date(cycle.endDate || cycle.end_date).toLocaleDateString(
                  "en-PH",
                  { month: "long", day: "numeric", year: "numeric" },
                )}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {myPayment?.allPaid && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                  <CheckCircle size={11} /> Paid
                </span>
              )}
              <StatusBadge status={cycle.status} />
            </div>
          </div>

          {/* Bills breakdown — room totals (payers only) */}
          {!isPayer && (
            <div className="card p-5 text-center py-8">
              <p className="text-sm text-gray-500 dark:text-white/40">
                Bill details are only visible to paying members.
              </p>
            </div>
          )}
          {isPayer && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-1">
                Bill Breakdown
              </h2>
              {Number(cycle.rent) > 0 && (
                <BillRow
                  label="Rent"
                  amount={cycle.rent}
                  icon={Home}
                  iconClass="text-orange-500"
                  bgClass="bg-orange-50 dark:bg-orange-900/20"
                  status={myPayment?.rentStatus}
                />
              )}
              {Number(cycle.electricity) > 0 && (
                <BillRow
                  label={`Electricity${cycle.electricity_units ? ` (${cycle.electricity_units} kWh)` : ""}`}
                  amount={cycle.electricity}
                  icon={Zap}
                  iconClass="text-amber-500"
                  bgClass="bg-amber-50 dark:bg-amber-900/20"
                  status={myPayment?.electricityStatus}
                />
              )}
              {Number(cycle.waterBillAmount || cycle.water_bill_amount) > 0 && (
                <BillRow
                  label="Water"
                  amount={cycle.waterBillAmount || cycle.water_bill_amount}
                  icon={Droplets}
                  iconClass="text-blue-500"
                  bgClass="bg-blue-50 dark:bg-blue-900/20"
                  status={myPayment?.waterStatus}
                />
              )}
              {Number(cycle.internet) > 0 && (
                <BillRow
                  label="Internet"
                  amount={cycle.internet}
                  icon={Wifi}
                  iconClass="text-purple-500"
                  bgClass="bg-purple-50 dark:bg-purple-900/20"
                  status={myPayment?.internetStatus}
                />
              )}
              <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-accent/30">
                <span className="font-bold text-gray-900 dark:text-white">
                  Room Total
                </span>
                <span className="text-xl font-extrabold text-accent">
                  ₱{fallbackTotal.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Per-member water usage */}
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
              const name = m.user?.name || m.user?.email || "Member";
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
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <Droplets size={15} className="text-blue-500" />
                  </div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Members' Water Usage
                  </h2>
                </div>
                <div className="space-y-0">
                  {memberRows.map((mr, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/8 last:border-none ${mr.isMe ? "bg-blue-50/50 dark:bg-blue-900/10 -mx-2 px-2 rounded-lg" : ""}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {mr.name}
                          {mr.isMe && (
                            <span className="ml-1 text-xs text-accent">
                              (You)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-white/30">
                          {mr.days} day{mr.days !== 1 ? "s" : ""} × ₱5
                          {!mr.isPayer && " · non-payer"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        ₱{mr.waterAmt.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Your Share — payers only */}
          {isPayer && myShare && (
            <div
              className={`card p-5 border-2 ${myPayment?.allPaid ? "border-green-200 dark:border-green-800/40" : "border-accent/30"}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${myPayment?.allPaid ? "bg-green-500" : "bg-accent"}`}
                >
                  <CreditCard size={15} className="text-white" />
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Your Share
                </h2>
              </div>

              {/* ── ALL BILLS PAID view ── */}
              {myPayment?.allPaid ? (
                <>
                  <div className="flex flex-col items-center text-center py-5 gap-3">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle size={40} className="text-green-500" />
                    </div>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">
                      All Bills Paid!
                    </p>
                    <p className="text-xs text-gray-500 dark:text-white/40 max-w-xs">
                      You have paid all bills for this billing period. Waiting
                      for the admin to start a new billing cycle.
                    </p>
                  </div>

                  {/* Billing Summary */}
                  <div className="rounded-xl border border-green-200 dark:border-green-800/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800/40">
                      <CheckCircle
                        size={14}
                        className="text-green-500 shrink-0"
                      />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
                        Billing Summary
                      </span>
                      <span className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-800/50 px-2 py-0.5 rounded-full">
                        PAID
                      </span>
                    </div>
                    <div className="px-3 py-2 space-y-2">
                      {Number(myShare.rent) > 0 && (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-sm text-gray-700 dark:text-white/70">
                              Rent
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            ₱{myShare.rent.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {Number(myShare.electricity) > 0 && (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-sm text-gray-700 dark:text-white/70">
                              Electricity
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            ₱{myShare.electricity.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {Number(myShare.water) > 0 && (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-sm text-gray-700 dark:text-white/70">
                              Water
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            ₱{myShare.water.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {Number(myShare.internet) > 0 && (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            <span className="text-sm text-gray-700 dark:text-white/70">
                              Internet
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            ₱{myShare.internet.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-green-50 dark:bg-green-900/20">
                      <span className="text-sm font-bold text-green-700 dark:text-green-400">
                        Total Paid
                      </span>
                      <span className="text-base font-extrabold text-green-600 dark:text-green-400">
                        ₱{myShare.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {Number(myShare.rent) > 0 && (
                    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-white/8">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                        <Home size={14} className="text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 dark:text-white/70">
                          Rent
                        </p>
                        <p className="text-xs text-gray-400 dark:text-white/30">
                          ÷ {payorCount} payer{payorCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        ₱{myShare.rent.toLocaleString()}
                      </span>
                      {myPayment?.rentStatus === "paid" ? (
                        <CheckCircle
                          size={15}
                          className="text-green-500 shrink-0"
                        />
                      ) : (
                        <XCircle size={15} className="text-red-400 shrink-0" />
                      )}
                    </div>
                  )}

                  {Number(myShare.electricity) > 0 && (
                    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-white/8">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                        <Zap size={14} className="text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 dark:text-white/70">
                          Electricity
                        </p>
                        <p className="text-xs text-gray-400 dark:text-white/30">
                          ÷ {payorCount} payer{payorCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        ₱{myShare.electricity.toLocaleString()}
                      </span>
                      {myPayment?.electricityStatus === "paid" ? (
                        <CheckCircle
                          size={15}
                          className="text-green-500 shrink-0"
                        />
                      ) : (
                        <XCircle size={15} className="text-red-400 shrink-0" />
                      )}
                    </div>
                  )}

                  {Number(myShare.water) > 0 && (
                    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-white/8">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                        <Droplets size={14} className="text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 dark:text-white/70">
                          Water
                        </p>
                        {waterNote && (
                          <p className="text-xs text-gray-400 dark:text-white/30">
                            {waterNote}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        ₱{myShare.water.toLocaleString()}
                      </span>
                      {myPayment?.waterStatus === "paid" ? (
                        <CheckCircle
                          size={15}
                          className="text-green-500 shrink-0"
                        />
                      ) : (
                        <XCircle size={15} className="text-red-400 shrink-0" />
                      )}
                    </div>
                  )}

                  {Number(myShare.internet) > 0 && (
                    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-white/8">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                        <Wifi size={14} className="text-purple-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 dark:text-white/70">
                          Internet
                        </p>
                        <p className="text-xs text-gray-400 dark:text-white/30">
                          ÷ {payorCount} payer{payorCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        ₱{myShare.internet.toLocaleString()}
                      </span>
                      {myPayment?.internetStatus === "paid" ? (
                        <CheckCircle
                          size={15}
                          className="text-green-500 shrink-0"
                        />
                      ) : (
                        <XCircle size={15} className="text-red-400 shrink-0" />
                      )}
                    </div>
                  )}

                  {/* Total Due */}
                  <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-accent/30">
                    <span className="font-bold text-gray-900 dark:text-white">
                      Total Due
                    </span>
                    <span className="text-2xl font-extrabold text-accent">
                      ₱{myShare.total.toLocaleString()}
                    </span>
                  </div>

                  {/* Paid / Remaining summary */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-center">
                      <p className="text-base font-bold text-green-600">
                        ₱{totalPaid.toLocaleString()}
                      </p>
                      <p className="text-xs text-green-600/70">Paid</p>
                    </div>
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-center">
                      <p className="text-base font-bold text-red-500">
                        ₱
                        {Math.max(
                          0,
                          myShare.total - totalPaid,
                        ).toLocaleString()}
                      </p>
                      <p className="text-xs text-red-500/70">Remaining</p>
                    </div>
                  </div>

                  {!myPayment?.allPaid &&
                    (pendingPayments.length > 0 ? (
                      <div className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
                        <Clock size={16} className="text-amber-500 shrink-0" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                          Awaiting Host Verification
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowPayModal(true)}
                        className="btn-primary w-full text-center flex items-center justify-center gap-2 mt-4"
                      >
                        <CreditCard size={16} /> Pay Now
                      </button>
                    ))}
                </>
              )}
            </div>
          )}

          {/* Payment summary (non-payer / no share data) */}
          {!myShare && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
                Payment Status
              </h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3">
                  <p className="text-lg font-bold text-green-600">
                    ₱{totalPaid.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600/70">Paid</p>
                </div>
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-lg font-bold text-red-500">
                    ₱{Math.max(0, fallbackTotal - totalPaid).toLocaleString()}
                  </p>
                  <p className="text-xs text-red-500/70">Remaining</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
                  <p className="text-lg font-bold text-gray-700 dark:text-white">
                    ₱{fallbackTotal.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-white/40">
                    Total
                  </p>
                </div>
              </div>
              {!myPayment?.allPaid &&
                (pendingPayments.length > 0 ? (
                  <div className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
                    <Clock size={16} className="text-amber-500 shrink-0" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      Awaiting Host Verification
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="btn-primary w-full text-center flex items-center justify-center gap-2 mt-4"
                  >
                    <CreditCard size={16} /> Pay Now
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
