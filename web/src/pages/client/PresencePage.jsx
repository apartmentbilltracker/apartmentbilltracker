import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  presenceService,
  paymentService,
} from "../../services/apiService";
import { Alert, EmptyState } from "../../components/ui";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Info,
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function PresencePage() {
  const { state } = useAuth();
  const { user } = state;
  const userId = user?.id || user?._id;
  const [room, setRoom] = useState(null);
  const [presenceDates, setPresenceDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadRoom = async () => {
    setLoading(true);
    try {
      const roomsRes = await roomService.getClientRooms();
      const rooms = Array.isArray(roomsRes)
        ? roomsRes
        : roomsRes?.rooms || roomsRes?.data || [];
      const joined = rooms[0] || null;
      if (joined) {
        const fullRes = await roomService.getRoomById(joined.id || joined._id);
        const fullRoom = fullRes?.room || fullRes?.data || fullRes || joined;
        setRoom(fullRoom);
        const myMember = fullRoom.members?.find(
          (m) => String(m.user?._id || m.user?.id || m.user) === String(userId),
        );
        setPresenceDates(myMember?.presence || []);

        if (fullRoom.billing?.start) {
          const d = new Date(fullRoom.billing.start);
          setSelectedMonth(d.getMonth());
          setSelectedYear(d.getFullYear());
        }

        const roomId = joined.id || joined._id;
        try {
          const payRes = await paymentService.getMyPayments(roomId);
          const txns =
            payRes?.transactions || payRes?.payments || payRes?.data || [];
          setHasPendingPayment(
            txns.some(
              (p) => p.status === "pending" || p.status === "submitted",
            ),
          );
        } catch (_) {}
      }
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    if (userId) loadRoom();
  }, [userId]);

  const toggleDay = async (dateStr) => {
    if (!room || !canMarkPresence) return;
    const updated = presenceDates.includes(dateStr)
      ? presenceDates.filter((d) => d !== dateStr)
      : [...presenceDates, dateStr];
    setPresenceDates(updated);
    try {
      await presenceService.markPresence(room.id || room._id, {
        presenceDates: updated,
      });
      setSuccess(
        presenceDates.includes(dateStr)
          ? "Removed day from your logs."
          : "Stay logged successfully!",
      );
    } catch (e) {
      setPresenceDates(presenceDates);
      setError(
        e?.data?.message || e?.message || "We couldn't save that adjustment.",
      );
    }
    setTimeout(() => setSuccess(""), 2000);
  };

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const todayMarked = presenceDates.includes(todayISO);

  const hasActiveCycle = Boolean(
    room?.currentCycleId || (room?.billing?.start && room?.billing?.end),
  );
  const isFixedMonthlyWater = room?.waterBillingMode === "fixed_monthly";
  const myPayment = room?.memberPayments?.find(
    (mp) => String(mp.member) === String(userId),
  );
  const userPaidAll = myPayment?.allPaid ?? false;
  const cycleCloseed = room?.cycleStatus === "cycle_closed";
  const canMarkPresence =
    hasActiveCycle &&
    !userPaidAll &&
    !isFixedMonthlyWater &&
    !cycleCloseed &&
    !hasPendingPayment;

  const billingStart = room?.billing?.start
    ? new Date(room.billing.start)
    : null;
  const billingEnd = room?.billing?.end ? new Date(room.billing.end) : null;

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const markedDays = new Set(
    presenceDates
      .filter((d) => {
        const dt = new Date(d);
        return (
          dt.getMonth() === selectedMonth && dt.getFullYear() === selectedYear
        );
      })
      .map((d) => new Date(d).getDate()),
  );

  const billingStartMonth = billingStart
    ? { m: billingStart.getMonth(), y: billingStart.getFullYear() }
    : null;
  const billingEndMonth = billingEnd
    ? { m: billingEnd.getMonth(), y: billingEnd.getFullYear() }
    : null;

  const canGoPrev = billingStartMonth
    ? selectedYear > billingStartMonth.y ||
      (selectedYear === billingStartMonth.y &&
        selectedMonth > billingStartMonth.m)
    : true;

  const canGoNext = billingEndMonth
    ? selectedYear < billingEndMonth.y ||
      (selectedYear === billingEndMonth.y && selectedMonth < billingEndMonth.m)
    : true;

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else setSelectedMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else setSelectedMonth((m) => m + 1);
  };

  const markedInPeriod = presenceDates.filter((d) => {
    if (!billingStart || !billingEnd) return true;
    const dt = new Date(d);
    return dt >= billingStart && dt <= billingEnd;
  }).length;

  /* Signature Premium Homepage Loading Element */
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
          Syncing stay records...
        </p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 px-4 animate-fadeIn">
      {/* Premium Glass Header Block */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex items-center justify-between group">
        <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 blur-3xl group-hover:scale-110 transition-transform duration-700" />

        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-xs font-black text-[#1a7a52] dark:text-[#7ee8a2] tracking-wide mb-2 uppercase">
            <Activity size={12} /> Dynamic Split Tracker
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Stay Calendar
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 max-w-xl">
            Log the specific days you occupy your room to calculate highly
            accurate utility distributions for this term.
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {!room ? (
        <EmptyState
          icon="🏠"
          title="No room links found"
          subtitle="You aren't associated with an active rental unit layout yet. Join a space to begin tracking stays."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Controls Panel Side */}
          <div className="lg:col-span-1 space-y-4">
            {/* Context Guardian Info Blocks */}
            {!hasActiveCycle && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 border-l-4 border-l-slate-400 dark:border-l-slate-600 flex items-start gap-3 shadow-sm">
                <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-normal">
                  No active billing window found right now. Calendar updates
                  will resume automatically once your host configures a new
                  term.
                </p>
              </div>
            )}

            {isFixedMonthlyWater && (
              <div className="rounded-2xl border border-blue-100 dark:border-blue-950/30 bg-blue-50/50 dark:bg-blue-950/10 p-4 border-l-4 border-l-blue-500 flex items-start gap-3 shadow-sm">
                <ShieldCheck
                  size={16}
                  className="text-blue-500 shrink-0 mt-0.5"
                />
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 leading-normal">
                  Your space uses a fixed monthly water flat rate. Daily
                  tracking isn't necessary for your unit bill breakdowns!
                </p>
              </div>
            )}

            {userPaidAll && (
              <div className="rounded-2xl border border-emerald-100 dark:border-emerald-950/30 bg-emerald-50/50 dark:bg-emerald-950/10 p-4 border-l-4 border-l-emerald-500 flex items-start gap-3 shadow-sm">
                <CheckCircle
                  size={16}
                  className="text-emerald-500 shrink-0 mt-0.5"
                />
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 leading-normal">
                  All items are settled! Your logs are officially locked in and
                  finalized for this specific billing statement period.
                </p>
              </div>
            )}

            {cycleCloseed && (
              <div className="rounded-2xl border border-amber-100 dark:border-amber-950/30 bg-amber-50/50 dark:bg-amber-950/10 p-4 border-l-4 border-l-amber-500 flex items-start gap-3 shadow-sm">
                <AlertTriangle
                  size={16}
                  className="text-amber-500 shrink-0 mt-0.5"
                />
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 leading-normal">
                  This billing window is officially wrapped up and archived.
                  Days can no longer be modified.
                </p>
              </div>
            )}

            {hasPendingPayment && (
              <div className="rounded-2xl border border-amber-100 dark:border-amber-950/30 bg-amber-50/50 dark:bg-amber-950/10 p-4 border-l-4 border-l-amber-500 flex items-start gap-3 shadow-sm">
                <Clock
                  size={16}
                  className="text-amber-500 shrink-0 mt-0.5 animate-pulse"
                />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-wide">
                    Reviewing Your Payment
                  </h4>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400/80 leading-normal">
                    Your remittance slip is safely with your host for
                    verification. Interaction handles are locked until verified.
                  </p>
                </div>
              </div>
            )}

            {/* Check-In Row Block */}
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 transition-colors ${
                    todayMarked
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-slate-100 dark:bg-slate-800 border-transparent text-slate-400"
                  }`}
                >
                  {todayMarked ? (
                    <CheckCircle size={20} />
                  ) : (
                    <Clock size={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Today
                  </p>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate mt-0.5">
                    {today.toLocaleDateString("en-PH", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {canMarkPresence && !todayMarked && (
                <button
                  onClick={() => toggleDay(todayISO)}
                  disabled={marking}
                  className="rounded-xl bg-[#1a7a52] text-white hover:bg-[#135c3d] dark:bg-[#7ee8a2] dark:text-[#02302e] dark:hover:bg-[#64d08b] text-xs font-black px-4 py-2.5 transition-all shadow-sm flex items-center gap-1.5"
                >
                  Check In
                </button>
              )}
            </div>

            {/* Period Status Display Block */}
            {billingStart && billingEnd && (
              <div className="rounded-2xl border border-slate-200/50 dark:border-slate-800/50 p-5 bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 relative overflow-hidden group">
                <div className="absolute right-3 top-3 text-[#1a7a52]/10 dark:text-[#7ee8a2]/10 pointer-events-none">
                  <Sparkles size={40} />
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Current Window
                    </span>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">
                      {billingStart.toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                      {" – "}
                      {billingEnd.toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-[#1a7a52] dark:text-[#7ee8a2] tracking-tight">
                      {markedInPeriod}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Logged Days
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Core Grid Side */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header Timeline Navigation */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-3 shadow-sm">
              <button
                onClick={goToPrevMonth}
                disabled={!canGoPrev}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800 disabled:opacity-20 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">
                {MONTHS[selectedMonth]} {selectedYear}
              </h3>
              <button
                onClick={goToNextMonth}
                disabled={!canGoNext}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800 disabled:opacity-20 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Calendar Structure Display */}
            <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 bg-white dark:bg-slate-900 shadow-sm">
              <div className="grid grid-cols-7 gap-y-3 gap-x-2 text-center">
                {/* Week Indicators */}
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <div
                    key={d}
                    className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider pb-1"
                  >
                    {d}
                  </div>
                ))}

                {/* Visual Offset Paddings */}
                {Array.from({
                  length: new Date(selectedYear, selectedMonth, 1).getDay(),
                }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-9 h-9" />
                ))}

                {/* Dynamic Day Engines */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                  (day) => {
                    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const dayDate = new Date(dateStr);
                    const inBillingPeriod =
                      billingStart && billingEnd
                        ? dayDate >= billingStart && dayDate <= billingEnd
                        : true;

                    if (!inBillingPeriod)
                      return <div key={day} className="w-9 h-9" />;

                    const isToday =
                      selectedMonth === today.getMonth() &&
                      selectedYear === today.getFullYear() &&
                      day === today.getDate();
                    const isMarked = markedDays.has(day);
                    const isFuture = dayDate > today;
                    const clickable = canMarkPresence && !isFuture;

                    return (
                      <button
                        key={day}
                        disabled={!clickable}
                        onClick={() => clickable && toggleDay(dateStr)}
                        className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center text-xs font-black transition-all relative
                      ${
                        isMarked
                          ? "bg-[#1a7a52] text-white dark:bg-[#7ee8a2] dark:text-[#02302e] shadow-sm scale-105"
                          : isToday
                            ? "border-2 border-dashed border-[#1a7a52] text-[#1a7a52] dark:border-[#7ee8a2] dark:text-[#7ee8a2]"
                            : clickable
                              ? "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                              : "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                      }`}
                      >
                        <span>{day}</span>
                        {isMarked && !isFuture && (
                          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white dark:bg-[#02302e]" />
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
