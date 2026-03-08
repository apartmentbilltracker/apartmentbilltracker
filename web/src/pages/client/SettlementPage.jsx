import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { paymentService, roomService } from "../../services/apiService";
import { Spinner, EmptyState } from "../../components/ui";
import { CheckCircle, Clock, AlertTriangle, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "partial", label: "Partial" },
  { key: "settled", label: "Settled" },
];

function SettlementCard({ item, onSettle, settling }) {
  const debtor = item.debtor?.name || item.debtorName || "Tenant";
  const creditor = item.creditor?.name || item.creditorName || "Payer";
  const amount = Number(item.amount || 0);
  const settled = Number(item.settledAmount || item.settled_amount || 0);
  const progress = amount > 0 ? Math.min((settled / amount) * 100, 100) : 0;
  const status = item.status;

  return (
    <div className="card p-4 space-y-3">
      {/* Parties */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold text-gray-900 dark:text-white">
            {debtor}
          </span>
          <span className="mx-2 text-gray-400">→</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {creditor}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Amounts */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-white/40">Total owed</span>
        <span className="font-bold text-gray-900 dark:text-white">
          ₱{amount.toLocaleString()}
        </span>
      </div>

      {status === "partial" && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-white/40">Settled</span>
            <span className="font-medium text-green-600">
              ₱{settled.toLocaleString()}
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}

      {/* Notes */}
      {item.notes && (
        <p className="text-xs text-gray-400 dark:text-white/30 italic">
          {item.notes}
        </p>
      )}

      {/* Actions */}
      {(status === "pending" || status === "partial") && (
        <button
          onClick={() => onSettle(item)}
          disabled={settling}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2"
        >
          {settling ? <Spinner size="sm" /> : <CheckCircle size={14} />}
          Mark as Settled
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "settled") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
        <CheckCircle size={10} /> Settled
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
        <AlertTriangle size={10} /> Partial
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
      <Clock size={10} /> Pending
    </span>
  );
}

export default function SettlementPage() {
  const { state } = useAuth();
  const { user } = state;
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [settleModal, setSettleModal] = useState(null);
  const [settleForm, setSettleForm] = useState({ amount: "", notes: "" });
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRoom();
  }, []);

  useEffect(() => {
    if (room) loadSettlements(activeTab);
  }, [room, activeTab]);

  const loadRoom = async () => {
    try {
      const roomsRes = await roomService.getClientRooms();
      const rooms = Array.isArray(roomsRes) ? roomsRes : roomsRes?.rooms || [];
      setRoom(rooms[0] || null);
    } catch (_) {}
  };

  const loadSettlements = async (tab) => {
    if (!room) return;
    setLoading(true);
    setError(null);
    const roomId = room.id || room._id;
    try {
      const res = await paymentService.getSettlements(roomId, tab);
      const data = Array.isArray(res)
        ? res
        : res?.settlements || res?.data || [];
      setItems(data);
    } catch (e) {
      setError("Failed to load settlements");
      setItems([]);
    }
    setLoading(false);
  };

  const openSettle = (item) => {
    const remaining =
      Number(item.amount || 0) -
      Number(item.settledAmount || item.settled_amount || 0);
    setSettleForm({ amount: String(remaining), notes: "" });
    setSettleModal(item);
  };

  const confirmSettle = async () => {
    if (!settleModal) return;
    const roomId = room?.id || room?._id;
    const debtorId =
      settleModal.debtor?.id || settleModal.debtor?._id || settleModal.debtorId;
    const creditorId =
      settleModal.creditor?.id ||
      settleModal.creditor?._id ||
      settleModal.creditorId;
    const amount = Number(settleModal.amount || 0);
    const settlementAmt = Number(settleForm.amount);
    if (!settlementAmt || settlementAmt <= 0) return;

    setSettling(true);
    try {
      await paymentService.recordSettlement(
        roomId,
        debtorId,
        creditorId,
        amount,
        settlementAmt,
        settleForm.notes,
      );
      setSettleModal(null);
      loadSettlements(activeTab);
    } catch (e) {
      alert("Failed to record settlement");
    }
    setSettling(false);
  };

  if (!room && !loading)
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-accent"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <EmptyState
          icon="💸"
          title="No room found"
          subtitle="Join a room to view settlements"
        />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-accent"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Settlements
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === t.key
                ? "bg-white dark:bg-white/10 text-accent shadow-sm"
                : "text-gray-500 dark:text-white/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" className="text-accent" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-600">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={activeTab === "settled" ? "✅" : "💸"}
          title={
            activeTab === "settled"
              ? "No settled payments yet"
              : activeTab === "partial"
                ? "No partial payments"
                : "No pending settlements"
          }
          subtitle={
            activeTab === "pending" ? "All debts are resolved" : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <SettlementCard
              key={item.id || item._id || i}
              item={item}
              onSettle={openSettle}
              settling={false}
            />
          ))}
        </div>
      )}

      {/* Mark settled modal */}
      {settleModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-2xl p-6 space-y-4 shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Record Settlement
            </h3>
            <p className="text-sm text-gray-500 dark:text-white/40">
              Total owed:{" "}
              <strong>
                ₱{Number(settleModal.amount || 0).toLocaleString()}
              </strong>
            </p>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-white/70">
                Settlement Amount (₱)
              </label>
              <input
                type="number"
                value={settleForm.amount}
                onChange={(e) =>
                  setSettleForm((f) => ({ ...f, amount: e.target.value }))
                }
                className="input w-full"
                placeholder="Enter amount"
                min={1}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-white/70">
                Notes (optional)
              </label>
              <textarea
                value={settleForm.notes}
                onChange={(e) =>
                  setSettleForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="input w-full resize-none"
                rows={2}
                placeholder="e.g. Paid via GCash"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setSettleModal(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmSettle}
                disabled={settling || !settleForm.amount}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {settling ? <Spinner size="sm" /> : <CheckCircle size={14} />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
