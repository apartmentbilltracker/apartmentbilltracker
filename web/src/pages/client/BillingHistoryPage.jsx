import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  billingCycleService,
  paymentService,
} from "../../services/apiService";
import { Alert, EmptyState } from "../../components/ui";
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Home,
  Zap,
  Droplets,
  Wifi,
  HelpCircle,
  CheckCircle,
  Clock,
  XCircle,
  Activity,
  History,
  ArrowUpRight,
} from "lucide-react";

// Helper for friendly custom tracking badges
function HumanizedStatus({ status }) {
  const norm = String(status).toLowerCase();
  if (["completed", "verified", "approved", "settled", "paid"].includes(norm)) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
        <CheckCircle size={10} /> Cleared
      </span>
    );
  }
  if (["pending", "submitted", "processing"].includes(norm)) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/10 animate-pulse">
        <Clock size={10} /> Reviewing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
      {status}
    </span>
  );
}

function CycleCard({ cycle, myPayments, userId }) {
  const [open, setOpen] = useState(false);

  const totalPaid = myPayments
    .filter((p) =>
      ["completed", "verified", "approved", "settled"].includes(
        String(p.status).toLowerCase(),
      ),
    )
    .reduce((s, p) => s + Number(p.amount), 0);

  const userCharge = cycle.memberCharges?.find(
    (mc) => String(mc.userId) === String(userId),
  );

  const share = userCharge
    ? Number(userCharge.totalDue || 0)
    : Number(cycle.share_per_member || cycle.per_member_share || 0);

  const balance = Math.max(0, share - totalPaid);
  const isPaid = balance === 0 && share > 0;

  const startDate = cycle.startDate || cycle.start_date;
  const endDate = cycle.endDate || cycle.end_date;
  const waterAmount = cycle.waterBillAmount || cycle.water_bill_amount;
  const totalAmount = cycle.totalBilledAmount || cycle.total_billed_amount;

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
        open
          ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-md scale-[1.01]"
          : "bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-slate-200/60 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full p-5 flex items-center justify-between gap-4 text-left transition-colors group"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors shrink-0 shadow-sm ${
              isPaid
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-[#1a7a52]/10 border-[#1a7a52]/10 text-[#1a7a52] dark:text-[#7ee8a2]"
            }`}
          >
            <Calendar size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight group-hover:text-[#1a7a52] dark:group-hover:text-[#7ee8a2] transition-colors">
              {new Date(startDate).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
              })}
              {" – "}
              {new Date(endDate).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
              Household Total:{" "}
              <span className="font-bold text-slate-700 dark:text-slate-300">
                ₱{Number(totalAmount || 0).toLocaleString()}
              </span>
              {" • "}
              {share > 0 ? (
                <>
                  Your Split:{" "}
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    ₱{share.toLocaleString()}
                  </span>
                </>
              ) : (
                <span className="italic">Room Expense Split Only</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <HumanizedStatus status={isPaid ? "paid" : cycle.status} />
          <div className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800/80 p-6 bg-slate-50/40 dark:bg-slate-950/20 space-y-6 animate-fadeIn">
          {/* Sub-Bento Dynamic Breakdown Cards */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
              Itemized Statement Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Number(cycle.rent) > 0 && (
                <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-900 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                    <Home size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                      House Rent
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      ₱{Number(cycle.rent).toLocaleString()}{" "}
                      {userCharge && (
                        <span className="text-[10px] font-normal text-slate-400">
                          (₱{Number(userCharge.rentShare || 0).toLocaleString()}{" "}
                          yours)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
              {Number(cycle.electricity) > 0 && (
                <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-900 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Zap size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                      Electricity
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      ₱{Number(cycle.electricity).toLocaleString()}{" "}
                      {userCharge && (
                        <span className="text-[10px] font-normal text-slate-400">
                          (₱
                          {Number(
                            userCharge.electricityShare || 0,
                          ).toLocaleString()}{" "}
                          yours)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
              {Number(waterAmount) > 0 && (
                <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-900 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <Droplets size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                      Water Utilities
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      ₱{Number(waterAmount).toLocaleString()}{" "}
                      {userCharge && (
                        <span className="text-[10px] font-normal text-slate-400">
                          (₱
                          {Number(
                            userCharge.waterBillShare || 0,
                          ).toLocaleString()}{" "}
                          yours)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
              {Number(cycle.internet) > 0 && (
                <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-900 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                    <Wifi size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                      Internet Set
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      ₱{Number(cycle.internet).toLocaleString()}{" "}
                      {userCharge && (
                        <span className="text-[10px] font-normal text-slate-400">
                          (₱
                          {Number(
                            userCharge.internetShare || 0,
                          ).toLocaleString()}{" "}
                          yours)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
              {Number(cycle.miscellaneous) > 0 && (
                <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/40 bg-white dark:bg-slate-900 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-500 flex items-center justify-center shrink-0">
                    <HelpCircle size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                      Miscellaneous
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      ₱{Number(cycle.miscellaneous).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Ledger Snapshot */}
          {share > 0 && (
            <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                    ₱{share.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                    Your Split
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50">
                  <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    ₱{totalPaid.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                    Cleared
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50">
                  <p
                    className={`text-xs font-black ${balance > 0 ? "text-rose-500" : "text-emerald-500"}`}
                  >
                    ₱{balance.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                    Remaining
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Past Payments History Sublist */}
          {myPayments.length > 0 && (
            <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                <History size={11} /> Transaction Activity Logs
              </h4>
              <div className="rounded-2xl border border-slate-200/50 dark:border-slate-800/40 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/40">
                {myPayments.map((p) => (
                  <div
                    key={p.id || p._id}
                    className="flex justify-between items-center py-3 px-4 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowUpRight
                        size={14}
                        className="text-slate-400 shrink-0"
                      />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 capitalize truncate">
                        Via{" "}
                        {p.payment_method ||
                          p.paymentMethod ||
                          "Direct Channel"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight">
                        ₱{Number(p.amount).toLocaleString()}
                      </span>
                      <HumanizedStatus status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BillingHistoryPage() {
  const { state } = useAuth();
  const { user } = state;
  const userId = user?.id || user?._id;

  const [cycles, setCycles] = useState([]);
  const [payments, setPayments] = useState([]);
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
        const joined = rooms[0] || null;
        if (!joined) {
          setLoading(false);
          return;
        }
        const roomId = joined.id || joined._id;
        const [cyclesRes, payRes] = await Promise.allSettled([
          billingCycleService.getBillingCycles(roomId),
          paymentService.getMyPayments(roomId),
        ]);
        if (cyclesRes.status === "fulfilled") {
          const data =
            cyclesRes.value?.billingCycles ||
            cyclesRes.value?.data ||
            cyclesRes.value ||
            [];
          setCycles(
            Array.isArray(data)
              ? data.sort(
                  (a, b) =>
                    new Date(b.startDate || b.start_date) -
                    new Date(a.startDate || a.start_date),
                )
              : [],
          );
        }
        if (payRes.status === "fulfilled")
          setPayments(
            payRes.value?.transactions ||
              payRes.value?.payments ||
              payRes.value?.data ||
              [],
          );
      } catch (e) {
        setError(
          e?.message ||
            "We couldn't pull up your billing records. Give the page a quick refresh.",
        );
      }
      setLoading(false);
    };
    if (userId) load();
  }, [userId]);

  /* Signature Homepage Glowing Loading Loop Animation Copy */
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
          Retrieving datas...
        </p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 px-4 animate-fadeIn">
      {/* Dynamic Glassmatic Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex items-center justify-between group">
        <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 blur-3xl group-hover:scale-110 transition-transform duration-700" />

        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-xs font-black text-[#1a7a52] dark:text-[#7ee8a2] tracking-wide mb-2 uppercase">
            <Activity size={12} /> Account Records
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Statement History
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 max-w-xl">
            Take a look back at your room's previous utility statements, cleared
            payments, and historical share distributions.
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {cycles.length === 0 ? (
        <EmptyState
          icon="📋"
          title="All clear here"
          subtitle="No archived billing statements were found for your assigned property room yet."
        />
      ) : (
        <div className="space-y-3.5">
          {cycles.map((cycle) => {
            const cycleId = cycle.id || cycle._id;
            const cycleStart = cycle.startDate || cycle.start_date;
            const cycleEnd = cycle.endDate || cycle.end_date;

            const myP = payments.filter(
              (p) =>
                p.billingCycleStart === cycleStart &&
                p.billingCycleEnd === cycleEnd,
            );

            return (
              <CycleCard
                key={cycleId}
                cycle={cycle}
                myPayments={myP}
                userId={userId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
