import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  billingCycleService,
  paymentService,
} from "../../services/apiService";
import { Spinner, Alert, EmptyState, StatusBadge } from "../../components/ui";
import { Smartphone, Building2, Banknote, Clock } from "lucide-react";

const METHODS = [
  {
    id: "gcash",
    label: "GCash",
    icon: Smartphone,
    desc: "Pay via GCash e-wallet",
    route: "/payment/gcash",
    color: "text-blue-600",
  },
  {
    id: "bank_transfer",
    label: "Bank Transfer",
    icon: Building2,
    desc: "Transfer to bank account",
    route: "/payment/bank-transfer",
    color: "text-green-600",
  },
  {
    id: "cash",
    label: "Cash",
    icon: Banknote,
    desc: "Submit cash payment record",
    route: "/payment/cash",
    color: "text-amber-600",
  },
];

export default function PaymentMethodPage() {
  const { state } = useAuth();
  const { user } = state;
  const navigate = useNavigate();
  const [cycle, setCycle] = useState(null);
  const [shareAmount, setShareAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const roomsRes = await roomService.getClientRooms();
        const rooms = Array.isArray(roomsRes)
          ? roomsRes
          : roomsRes?.rooms || roomsRes?.data || [];
        const joined = rooms.find((r) =>
          r.members?.some(
            (m) =>
              String(m.user?._id || m.user?.id || m.user) ===
              String(user?.id || user?._id),
          ),
        );
        if (joined) {
          const cycleRes = await billingCycleService.getActiveCycle(
            joined.id || joined._id,
          );
          const c = cycleRes?.billingCycle || cycleRes?.data || cycleRes;
          setCycle(c);
          setShareAmount(
            Number(c?.share_per_member || c?.per_member_share || 0),
          );
        }
      } catch (_) {}
      setLoading(false);
    };
    if (user) load();
  }, [user]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Choose Payment Method
        </h1>
        {cycle && (
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
            Your share:{" "}
            <span className="font-semibold text-accent">
              ₱{shareAmount.toLocaleString()}
            </span>
          </p>
        )}
      </div>

      {!cycle ? (
        <EmptyState
          icon="🧾"
          title="No active billing cycle"
          subtitle="There's nothing to pay right now"
        />
      ) : (
        <div className="space-y-3">
          {METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => navigate(m.route)}
                className="card w-full p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/8 flex items-center justify-center shrink-0">
                  <Icon size={22} className={m.color} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {m.label}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-white/40">
                    {m.desc}
                  </p>
                </div>
                <div className="ml-auto text-gray-300 dark:text-white/20">
                  ›
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center">
        <Link
          to="/payment-history"
          className="text-sm text-accent hover:underline flex items-center gap-1.5"
        >
          <Clock size={14} />
          View Payment History
        </Link>
      </div>
    </div>
  );
}
