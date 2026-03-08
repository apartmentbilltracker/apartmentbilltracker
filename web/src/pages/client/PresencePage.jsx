import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  presenceService,
  paymentService,
} from "../../services/apiService";
import { Spinner, Alert, EmptyState } from "../../components/ui";
import { CheckCircle, Clock, AlertTriangle, Info } from "lucide-react";

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
        // Auto-navigate to billing period start month
        if (fullRoom.billing?.start) {
          const d = new Date(fullRoom.billing.start);
          setSelectedMonth(d.getMonth());
          setSelectedYear(d.getFullYear());
        }
        // Check pending payment
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
    setPresenceDates(updated); // optimistic
    try {
      await presenceService.markPresence(room.id || room._id, {
        presenceDates: updated,
      });
      setSuccess(
        presenceDates.includes(dateStr) ? "Day removed." : "Presence marked!",
      );
    } catch (e) {
      setPresenceDates(presenceDates); // revert
      setError(e?.data?.message || e?.message || "Failed to update presence");
    }
    setTimeout(() => setSuccess(""), 2000);
  };

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const todayMarked = presenceDates.includes(todayISO);

  // Guard conditions (mirror mobile)
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

  // Billing period bounds for disabled days outside range
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

  // Navigation: constrained to billing period months only
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

  // Count marked days within the billing period
  const markedInPeriod = presenceDates.filter((d) => {
    if (!billingStart || !billingEnd) return true;
    const dt = new Date(d);
    return dt >= billingStart && dt <= billingEnd;
  }).length;

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        Presence
      </h1>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {!room ? (
        <EmptyState
          icon="🏠"
          title="No room joined"
          subtitle="Join a room to track presence"
        />
      ) : (
        <>
          {/* Guard warnings */}
          {!hasActiveCycle && (
            <div className="card p-4 border-l-4 border-gray-300 dark:border-white/20 flex items-center gap-3">
              <Info size={18} className="text-gray-400 shrink-0" />
              <p className="text-sm text-gray-600 dark:text-white/50">
                No active billing cycle. Presence tracking is paused.
              </p>
            </div>
          )}
          {isFixedMonthlyWater && (
            <div className="card p-4 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/10 flex items-center gap-3">
              <Info size={18} className="text-blue-500 shrink-0" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Your room uses fixed monthly water billing — presence tracking
                is not required.
              </p>
            </div>
          )}
          {userPaidAll && (
            <div className="card p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/10 flex items-center gap-3">
              <CheckCircle size={18} className="text-green-500 shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-300">
                All bills paid for this cycle. No further presence changes
                needed.
              </p>
            </div>
          )}
          {cycleCloseed && (
            <div className="card p-4 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10 flex items-center gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                The billing cycle is closed. Presence can no longer be updated.
              </p>
            </div>
          )}
          {hasPendingPayment && (
            <div className="card p-4 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10 flex items-center gap-3">
              <Clock size={18} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <span className="font-semibold">
                  Awaiting Payment Verification
                </span>{" "}
                — Your payment is pending host approval. You can only view
                presence; marking and future dates are locked until verified.
              </p>
            </div>
          )}

          {/* Today status */}
          <div className="card p-5 flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center ${todayMarked ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-white/8"}`}
            >
              {todayMarked ? (
                <CheckCircle size={28} className="text-green-600" />
              ) : (
                <Clock size={28} className="text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white">
                {today.toLocaleDateString("en-PH", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p
                className={`text-sm mt-0.5 ${todayMarked ? "text-green-600" : "text-gray-500 dark:text-white/40"}`}
              >
                {todayMarked
                  ? "Marked present today"
                  : canMarkPresence
                    ? "Tap a calendar day to mark presence"
                    : "Presence tracking unavailable"}
              </p>
            </div>
            {canMarkPresence && !todayMarked && (
              <button
                onClick={() => toggleDay(todayISO)}
                disabled={marking}
                className="btn-primary flex items-center gap-2"
              >
                {marking ? <Spinner size="sm" /> : <CheckCircle size={14} />}
                Mark
              </button>
            )}
          </div>

          {/* Billing period info */}
          {billingStart && billingEnd && (
            <div className="card p-4 bg-accent/5 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-white/40">
                  Billing Period
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
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
                <p className="text-2xl font-extrabold text-accent">
                  {markedInPeriod}
                </p>
                <p className="text-xs text-gray-400 dark:text-white/30">
                  days marked
                </p>
              </div>
            </div>
          )}

          {/* Month navigation */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={goToPrevMonth}
              disabled={!canGoPrev}
              className="w-9 h-9 rounded-lg flex items-center justify-center border border-gray-200 dark:border-white/15 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              ‹
            </button>
            <p className="flex-1 text-center font-semibold text-gray-900 dark:text-white">
              {MONTHS[selectedMonth]} {selectedYear}
            </p>
            <button
              onClick={goToNextMonth}
              disabled={!canGoNext}
              className="w-9 h-9 rounded-lg flex items-center justify-center border border-gray-200 dark:border-white/15 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              ›
            </button>
          </div>

          {/* Calendar grid */}
          <div className="card p-5">
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div
                  key={d}
                  className="text-xs font-semibold text-gray-400 dark:text-white/30 pb-2"
                >
                  {d}
                </div>
              ))}
              {Array.from({
                length: new Date(selectedYear, selectedMonth, 1).getDay(),
              }).map((_, i) => (
                <div key={`e${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                (day) => {
                  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayDate = new Date(dateStr);
                  const inBillingPeriod =
                    billingStart && billingEnd
                      ? dayDate >= billingStart && dayDate <= billingEnd
                      : true;

                  // Render blank for days outside billing period
                  if (!inBillingPeriod) return <div key={day} />;

                  const isToday =
                    selectedMonth === today.getMonth() &&
                    selectedYear === today.getFullYear() &&
                    day === today.getDate();
                  const isMarked = markedDays.has(day);
                  // When payment is pending, block future dates (only today and past allowed)
                  const isFuture = dayDate > today;
                  const clickable =
                    canMarkPresence && !(hasPendingPayment && isFuture);

                  return (
                    <button
                      key={day}
                      disabled={!clickable}
                      onClick={() => clickable && toggleDay(dateStr)}
                      className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-medium transition-colors
                      ${
                        isMarked
                          ? "bg-green-500 text-white"
                          : isToday
                            ? "ring-2 ring-accent text-accent"
                            : clickable
                              ? "hover:bg-accent/20 text-gray-700 dark:text-white/70 cursor-pointer"
                              : "text-gray-400 dark:text-white/30 cursor-default"
                      }`}
                    >
                      {day}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
