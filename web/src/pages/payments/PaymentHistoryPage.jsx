import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roomService, paymentProcessingService } from '../../services/apiService';
import { Spinner, Alert, EmptyState, StatusBadge } from '../../components/ui';
import { ArrowLeft, Smartphone, Building2, Banknote, ChevronDown, ChevronUp } from 'lucide-react';

const METHOD_ICONS = {
  gcash: { icon: Smartphone, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  bank_transfer: { icon: Building2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  cash: { icon: Banknote, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
};

function TransactionCard({ txn }) {
  const [open, setOpen] = useState(false);
  const method = txn.payment_method || txn.paymentMethod || 'cash';
  const meta = METHOD_ICONS[method] || METHOD_ICONS.cash;
  const Icon = meta.icon;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
          <Icon size={18} className={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate capitalize">
            {method.replace(/_/g, ' ')}
          </p>
          <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
            {new Date(txn.created_at || txn.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="font-bold text-gray-900 dark:text-white">₱{Number(txn.amount).toLocaleString()}</p>
          <StatusBadge status={txn.status} />
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-white/8 p-4 bg-gray-50/50 dark:bg-white/3 space-y-2 text-sm">
          {txn.referenceNumber && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Reference</span>
              <span className="font-mono font-medium">{txn.referenceNumber}</span>
            </div>
          )}
          {txn.receiptNumber && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Receipt #</span>
              <span className="font-medium">{txn.receiptNumber}</span>
            </div>
          )}
          {txn.mobileNumber && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Mobile</span>
              <span className="font-medium">{txn.mobileNumber}</span>
            </div>
          )}
          {txn.bank && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Bank</span>
              <span className="font-medium">{txn.bank}</span>
            </div>
          )}
          {txn.receiverName && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Receiver</span>
              <span className="font-medium">{txn.receiverName}</span>
            </div>
          )}
          {txn.notes && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Notes</span>
              <span className="font-medium">{txn.notes}</span>
            </div>
          )}
          {txn.verifiedBy && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Verified by</span>
              <span className="font-medium">{txn.verifiedBy?.name || 'Host'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PaymentHistoryPage() {
  const { state } = useAuth();
  const { user } = state;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const roomsRes = await roomService.getClientRooms();
        const rooms = Array.isArray(roomsRes) ? roomsRes : roomsRes?.rooms || roomsRes?.data || [];
        const joined = rooms.find(r =>
          r.members?.some(m => String(m.user?._id || m.user?.id || m.user) === String(user?.id || user?._id))
        );
        if (joined) {
          const res = await paymentProcessingService.getTransactions(joined.id || joined._id);
          const txns = res?.transactions || res?.data || [];
          setTransactions(txns.filter(t => t.status !== 'cancelled').sort((a, b) =>
            new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
          ));
        }
      } catch (e) { setError(e?.message || 'Failed to load'); }
      setLoading(false);
    };
    if (user) load();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" className="text-accent" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/bills" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/8">
          <ArrowLeft size={18} className="text-gray-600 dark:text-white/60" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Payment History</h1>
      </div>

      {error && <Alert type="error" message={error} />}

      {transactions.length === 0 ? (
        <EmptyState icon="💳" title="No payments yet" subtitle="Your payment history will appear here" />
      ) : (
        <div className="space-y-3">
          {transactions.map(t => (
            <TransactionCard key={t.id || t._id} txn={t} />
          ))}
        </div>
      )}
    </div>
  );
}
