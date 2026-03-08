import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  billingCycleService,
  paymentService,
} from "../../services/apiService";
import { Spinner, StatusBadge, Alert, EmptyState } from "../../components/ui";
import { ChevronDown, ChevronRight, Calendar } from "lucide-react";

function CycleCard({ cycle, myPayments, userId }) {
  const [open, setOpen] = useState(false);
  const totalPaid = myPayments
    .filter(
      (p) =>
        p.status === "completed" ||
        p.status === "verified" ||
        p.status === "approved" ||
        p.status === "settled",
    )
    .reduce((s, p) => s + Number(p.amount), 0);
  // Use memberCharges for accurate per-user share if available
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
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <Calendar size={16} className="text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {new Date(startDate).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
            })}
            {" \u2013 "}
            {new Date(endDate).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
            Total: ₱{Number(totalAmount || 0).toLocaleString()} •{" "}
            {share > 0 ? `Your share: ₱${share.toLocaleString()}` : "Non-payer"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={isPaid ? "paid" : cycle.status} />
          {open ? (
            <ChevronDown size={14} className="text-gray-400" />
          ) : (
            <ChevronRight size={14} className="text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-white/8 p-4 bg-gray-50/50 dark:bg-white/3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Number(cycle.rent) > 0 && (
              <div>
                <span className="text-gray-500 dark:text-white/40">Rent</span>
                <p className="font-medium">
                  ₱{Number(cycle.rent).toLocaleString()}
                  {userCharge
                    ? ` (₱${Number(userCharge.rentShare || 0).toLocaleString()} yours)`
                    : ""}
                </p>
              </div>
            )}
            {Number(cycle.electricity) > 0 && (
              <div>
                <span className="text-gray-500 dark:text-white/40">
                  Electricity
                </span>
                <p className="font-medium">
                  ₱{Number(cycle.electricity).toLocaleString()}
                  {userCharge
                    ? ` (₱${Number(userCharge.electricityShare || 0).toLocaleString()} yours)`
                    : ""}
                </p>
              </div>
            )}
            {Number(waterAmount) > 0 && (
              <div>
                <span className="text-gray-500 dark:text-white/40">Water</span>
                <p className="font-medium">
                  ₱{Number(waterAmount).toLocaleString()}
                  {userCharge
                    ? ` (₱${Number(userCharge.waterBillShare || 0).toLocaleString()} yours)`
                    : ""}
                </p>
              </div>
            )}
            {Number(cycle.internet) > 0 && (
              <div>
                <span className="text-gray-500 dark:text-white/40">
                  Internet
                </span>
                <p className="font-medium">
                  ₱{Number(cycle.internet).toLocaleString()}
                  {userCharge
                    ? ` (₱${Number(userCharge.internetShare || 0).toLocaleString()} yours)`
                    : ""}
                </p>
              </div>
            )}
            {Number(cycle.miscellaneous) > 0 && (
              <div>
                <span className="text-gray-500 dark:text-white/40">Misc</span>
                <p className="font-medium">
                  ₱{Number(cycle.miscellaneous).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          {share > 0 && (
            <div className="border-t border-gray-200 dark:border-white/10 pt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  ₱{share.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 dark:text-white/30">
                  Your Share
                </p>
              </div>
              <div>
                <p className="font-semibold text-green-600">
                  ₱{totalPaid.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 dark:text-white/30">Paid</p>
              </div>
              <div>
                <p
                  className={`font-semibold ${balance > 0 ? "text-red-500" : "text-green-600"}`}
                >
                  ₱{balance.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 dark:text-white/30">
                  Balance
                </p>
              </div>
            </div>
          )}
          {myPayments.length > 0 && (
            <div className="border-t border-gray-200 dark:border-white/10 pt-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-white/40 mb-2">
                PAYMENT HISTORY
              </p>
              <div className="space-y-2">
                {myPayments.map((p) => (
                  <div
                    key={p.id || p._id}
                    className="flex justify-between text-xs"
                  >
                    <span className="text-gray-600 dark:text-white/60 capitalize">
                      {p.payment_method || p.paymentMethod || "unknown"}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ₱{Number(p.amount).toLocaleString()}
                    </span>
                    <StatusBadge status={p.status} />
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
        setError(e?.message || "Failed to load billing history");
      }
      setLoading(false);
    };
    if (userId) load();
  }, [userId]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        Billing History
      </h1>
      {error && <Alert type="error" message={error} />}
      {cycles.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No billing history"
          subtitle="No billing cycles found for your room"
        />
      ) : (
        <div className="space-y-3">
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
