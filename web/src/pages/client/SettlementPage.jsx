import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { paymentService, roomService } from "../../services/apiService";
import { Spinner, EmptyState } from "../../components/ui";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ArrowRight,
  DollarSign,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* Friendly, community-focused tab labels */
const TABS = [
  { key: "pending", label: "To Pay" },
  { key: "partial", label: "Partially Paid" },
  { key: "settled", label: "Fully Settled" },
];

function SettlementCard({ item, onSettle, settling }) {
  const debtor = item.debtor?.name || item.debtorName || "Tenant"; //
  const creditor = item.creditor?.name || item.creditorName || "Payer"; //
  const amount = Number(item.amount || 0); //
  const settled = Number(item.settledAmount || item.settled_amount || 0); //[cite: 11]
  const progress = amount > 0 ? Math.min((settled / amount) * 100, 100) : 0; //[cite: 11]
  const status = item.status; //[cite: 11]

  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-5 bg-white dark:bg-slate-900 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 animate-fadeIn">
      {/* Involved Roommates */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400">
            {debtor}
          </span>
          <ArrowRight size={14} className="text-slate-400 shrink-0" />
          <span className="bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 px-2.5 py-1 rounded-lg text-xs font-bold text-[#1a7a52] dark:text-[#7ee8a2]">
            {creditor}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Bill Overview Matrix */}
      <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-xl p-3 border border-slate-100 dark:border-slate-800/60 space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-slate-400 dark:text-slate-500">
            Total Share Owed
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            ₱{amount.toLocaleString()}
          </span>
        </div>

        {status === "partial" && ( //[cite: 11]
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/40">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-400 dark:text-slate-500">
                Amount Paid So Far
              </span>
              <span className="font-bold text-[#1a7a52] dark:text-[#7ee8a2]">
                ₱{settled.toLocaleString()}
              </span>
            </div>
            {/* Smooth Tracking Bar */}
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1a7a52] dark:bg-[#7ee8a2] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Attached Room Memo */}
      {item.notes && ( //[cite: 11]
        <div className="flex items-start gap-1.5 text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50/30 dark:bg-slate-900 px-2 py-1.5 rounded-lg">
          <FileText size={12} className="mt-0.5 shrink-0 text-slate-300" />
          <p className="line-clamp-2">{item.notes}</p>
        </div>
      )}

      {/* Primary Settlement Actions */}
      {(status === "pending" || status === "partial") && ( //[cite: 11]
        <button
          onClick={() => onSettle(item)} //[cite: 11]
          disabled={settling} //[cite: 11]
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a7a52] hover:bg-[#156342] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-all transform active:scale-[0.99] disabled:opacity-50"
        >
          {settling ? <Spinner size="sm" /> : <CheckCircle size={14} />}
          Record a Payment
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "settled") {
    //[cite: 11]
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#1a7a52] bg-[#1a7a52]/10 dark:text-[#7ee8a2] dark:bg-[#7ee8a2]/10 px-2.5 py-1 rounded-full border border-[#1a7a52]/10">
        <CheckCircle
          size={10}
          fill="currentColor"
          className="text-white dark:text-[#02302e]"
        />{" "}
        Settled
      </span>
    );
  }
  if (status === "partial") {
    //[cite: 11]
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 px-2.5 py-1 rounded-full border border-amber-500/10">
        <AlertTriangle size={10} /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:text-slate-400 dark:bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-200/40 dark:border-slate-700/40">
      <Clock size={10} /> Unpaid
    </span>
  );
}

export default function SettlementPage() {
  const { state } = useAuth(); //[cite: 11]
  const { user } = state; //[cite: 11]
  const navigate = useNavigate(); //[cite: 11]

  const [room, setRoom] = useState(null); //[cite: 11]
  const [activeTab, setActiveTab] = useState("pending"); //[cite: 11]
  const [items, setItems] = useState([]); //[cite: 11]
  const [loading, setLoading] = useState(true); //[cite: 11]
  const [settling, setSettling] = useState(false); //[cite: 11]
  const [settleModal, setSettleModal] = useState(null); //[cite: 11]
  const [settleForm, setSettleForm] = useState({ amount: "", notes: "" }); //[cite: 11]
  const [error, setError] = useState(null); //[cite: 11]

  useEffect(() => {
    loadRoom(); //[cite: 11]
  }, []);

  useEffect(() => {
    if (room) loadSettlements(activeTab); //[cite: 11]
  }, [room, activeTab]); //[cite: 11]

  const loadRoom = async () => {
    try {
      const roomsRes = await roomService.getClientRooms(); //[cite: 11]
      const rooms = Array.isArray(roomsRes) ? roomsRes : roomsRes?.rooms || []; //[cite: 11]
      setRoom(rooms[0] || null); //[cite: 11]
    } catch (_) {}
  };

  const loadSettlements = async (tab) => {
    if (!room) return; //[cite: 11]
    setLoading(true); //[cite: 11]
    setError(null); //[cite: 11]
    const roomId = room.id || room._id; //[cite: 11]
    try {
      const res = await paymentService.getSettlements(roomId, tab); //[cite: 11]
      const data = Array.isArray(res) //[cite: 11]
        ? res
        : res?.settlements || res?.data || []; //[cite: 11]
      setItems(data); //[cite: 11]
    } catch (e) {
      setError("We had trouble loading the balances. Please try refreshing."); //[cite: 11]
      setItems([]); //[cite: 11]
    }
    setLoading(false); //[cite: 11]
  };

  const openSettle = (item) => {
    const remaining =
      Number(item.amount || 0) - //[cite: 11]
      Number(item.settledAmount || item.settled_amount || 0); //[cite: 11]
    setSettleForm({ amount: String(remaining), notes: "" }); //[cite: 11]
    setSettleModal(item); //[cite: 11]
  };

  const confirmSettle = async () => {
    if (!settleModal) return; //[cite: 11]
    const roomId = room?.id || room?._id; //[cite: 11]
    const debtorId =
      settleModal.debtor?.id || settleModal.debtor?._id || settleModal.debtorId; //[cite: 11]
    const creditorId =
      settleModal.creditor?.id || //[cite: 11]
      settleModal.creditor?._id ||
      settleModal.creditorId; //[cite: 11]
    const amount = Number(settleModal.amount || 0); //[cite: 11]
    const settlementAmt = Number(settleForm.amount); //[cite: 11]
    if (!settlementAmt || settlementAmt <= 0) return; //[cite: 11]

    setSettling(true); //[cite: 11]
    try {
      await paymentService.recordSettlement(
        //[cite: 11]
        roomId,
        debtorId,
        creditorId,
        amount,
        settlementAmt,
        settleForm.notes,
      );
      setSettleModal(null); //[cite: 11]
      loadSettlements(activeTab); //[cite: 11]
    } catch (e) {
      alert("We couldn't save this payment record. Please check your inputs.");
    }
    setSettling(false); //[cite: 11]
  };

  if (!room && !loading)
    //[cite: 11]
    return (
      <div className="space-y-6 max-w-2xl mx-auto px-4 animate-fadeIn">
        <button
          onClick={() => navigate(-1)} //[cite: 11]
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-[#1a7a52] dark:hover:text-[#7ee8a2] transition-colors"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <EmptyState
          icon="🏡"
          title="No room active"
          subtitle="You'll need to be checked into a room to manage group expenses."
        />
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-6 pb-12 animate-fadeIn">
      {/* Glassmorphic Navigation Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-5 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigate(-1)} //[cite: 11]
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Shared Expenses
          </h1>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            Keep track of who paid for what in your home
          </p>
        </div>
      </div>

      {/* Premium Segmented Navigation Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/60 border border-slate-200/30 dark:border-slate-800/40 rounded-2xl p-1.5 shadow-2xs">
        {TABS.map((t) => (
          <button
            key={t.key} //[cite: 11]
            onClick={() => setActiveTab(t.key)} //[cite: 11]
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 ${
              activeTab === t.key //[cite: 11]
                ? "bg-white dark:bg-slate-800 text-[#1a7a52] dark:text-[#7ee8a2] shadow-xs"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Stream Area */}
      {loading ? ( //[cite: 11]
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <div className="w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-800 border-t-[#1a7a52] dark:border-t-[#7ee8a2] animate-spin" />
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase animate-pulse">
            Gathering expense logs...
          </p>
        </div>
      ) : error ? ( //[cite: 11]
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-900/30 rounded-2xl text-xs font-semibold text-red-600 dark:text-red-400">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : items.length === 0 ? ( //[cite: 11]
        <EmptyState
          icon={activeTab === "settled" ? "🎉" : "☕"}
          title={
            activeTab === "settled" //[cite: 11]
              ? "No history yet"
              : activeTab === "partial" //[cite: 11]
                ? "No partial entries"
                : "Clean slate!"
          }
          subtitle={
            activeTab === "pending" //[cite: 11]
              ? "All shared balances are fully square. Beautifully done!"
              : "No expense cards match this category right now."
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map(
            (
              item,
              i, //[cite: 11]
            ) => (
              <SettlementCard
                key={item.id || item._id || i} //[cite: 11]
                item={item} //[cite: 11]
                onSettle={openSettle} //[cite: 11]
                settling={false} //[cite: 11]
              />
            ),
          )}
        </div>
      )}

      {/* Mark payment modal (Bottom Drawer Frame) */}
      {settleModal && ( //[cite: 11]
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200/60 dark:border-slate-800 p-6 space-y-5 shadow-2xl transform transition-transform duration-300">
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                Record a Payment
              </h3>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Update the running total balance for this shared item.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/60 flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400">
                Total remaining balance:
              </span>
              <strong className="font-bold text-slate-800 dark:text-white text-sm">
                ₱{Number(settleModal.amount || 0).toLocaleString()}
              </strong>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Payment Amount (₱)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-bold text-slate-400">
                  ₱
                </span>
                <input
                  type="number"
                  value={settleForm.amount} //[cite: 11]
                  onChange={
                    (e) =>
                      setSettleForm((f) => ({ ...f, amount: e.target.value })) //[cite: 11]
                  }
                  className="w-full pl-7 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/80 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
                  placeholder="0.00"
                  min={1} //[cite: 11]
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Add a short note
              </label>
              <textarea
                value={settleForm.notes} //[cite: 11]
                onChange={
                  (e) => setSettleForm((f) => ({ ...f, notes: e.target.value })) //[cite: 11]
                }
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all resize-none"
                rows={2} //[cite: 11]
                placeholder="e.g. Sent via online bank transfer"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSettleModal(null)} //[cite: 11]
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSettle} //[cite: 11]
                disabled={settling || !settleForm.amount} //[cite: 11]
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-[#1a7a52] hover:bg-[#156342] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-colors disabled:opacity-40"
              >
                {settling ? <Spinner size="sm" /> : <CheckCircle size={14} />}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
