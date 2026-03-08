import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roomService, billingCycleService, paymentProcessingService } from '../../services/apiService';
import { Spinner, Alert } from '../../components/ui';
import { CheckCircle, ArrowLeft, X } from 'lucide-react';

export default function CashPage() {
  const { state } = useAuth();
  const { user } = state;
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // form | confirm | success
  const [room, setRoom] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [amount, setAmount] = useState(0);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const roomsRes = await roomService.getClientRooms();
        const rooms = Array.isArray(roomsRes) ? roomsRes : roomsRes?.rooms || roomsRes?.data || [];
        const joined = rooms.find(r =>
          r.members?.some(m => String(m.user?._id || m.user?.id || m.user) === String(user?.id || user?._id))
        );
        if (!joined) { navigate('/bills'); return; }
        setRoom(joined);
        const cycleRes = await billingCycleService.getActiveCycle(joined.id || joined._id);
        const c = cycleRes?.billingCycle || cycleRes?.data || cycleRes;
        setCycle(c);
        setAmount(Number(c?.share_per_member || c?.per_member_share || 0));
      } catch (e) { setError(e?.message || 'Failed to load'); }
      setLoading(false);
    };
    if (user) init();
  }, [user]);

  const validate = () => {
    if (!receiptNumber.trim()) { setError('Receipt number is required'); return false; }
    if (!receiverName.trim()) { setError('Receiver name is required'); return false; }
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await paymentProcessingService.recordCash({
        roomId: room.id || room._id,
        billingCycleId: cycle?._id || cycle?.id,
        amount,
        receiptNumber: receiptNumber.trim(),
        receiverName: receiverName.trim(),
        witnessName: witnessName.trim(),
        notes: notes.trim(),
      });
      if (res?.success || res?.transaction) {
        setTransactionId(res?.transaction?.id || res?.transaction?._id || res?.receiptNumber || '');
        setStep('success');
      } else {
        setError(res?.message || 'Failed to record payment');
      }
    } catch (e) {
      setError(e?.data?.message || e?.message || 'Failed to record payment');
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Spinner size="lg" className="text-accent" />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/8">
          <ArrowLeft size={18} className="text-gray-600 dark:text-white/60" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cash Payment</h1>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

      {step === 'form' && (
        <div className="space-y-4">
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500 dark:text-white/40">Amount</p>
            <p className="text-3xl font-extrabold text-accent mt-1">₱{amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Payment Details</h2>
            <div>
              <label className="label">Receipt Number <span className="text-red-500">*</span></label>
              <input value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} className="input mt-1" placeholder="e.g. RCP-001" />
            </div>
            <div>
              <label className="label">Receiver Name <span className="text-red-500">*</span></label>
              <input value={receiverName} onChange={e => setReceiverName(e.target.value)} className="input mt-1" placeholder="Name of person who received" />
            </div>
            <div>
              <label className="label">Witness Name <span className="text-gray-400 text-xs">(optional)</span></label>
              <input value={witnessName} onChange={e => setWitnessName(e.target.value)} className="input mt-1" placeholder="Name of witness" />
            </div>
            <div>
              <label className="label">Notes <span className="text-gray-400 text-xs">(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input mt-1 resize-none" placeholder="Any additional notes…" />
            </div>
            <button
              onClick={() => { if (validate()) setStep('confirm'); }}
              className="btn-primary w-full"
            >
              Review & Submit
            </button>
          </div>
        </div>
      )}

      {/* Confirm modal overlay */}
      {step === 'confirm' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Confirm Cash Payment</h3>
              <button onClick={() => setStep('form')}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Amount', `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
                ['Receipt #', receiptNumber],
                ['Receiver', receiverName],
                witnessName && ['Witness', witnessName],
                notes && ['Notes', notes],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-white/8">
                  <span className="text-gray-500 dark:text-white/40">{k}</span>
                  <span className="font-medium text-gray-900 dark:text-white text-right max-w-[200px]">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep('form')} className="btn-secondary flex-1">Edit</button>
              <button onClick={submit} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {submitting ? <Spinner size="sm" /> : null}Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="card p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Payment Recorded!</h2>
          <p className="text-sm text-gray-500 dark:text-white/40">Your cash payment has been recorded successfully.</p>
          <div className="text-left bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500 dark:text-white/40">Amount</span><span className="font-bold text-accent">₱{amount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-white/40">Receipt #</span><span className="font-medium">{receiptNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-white/40">Receiver</span><span className="font-medium">{receiverName}</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/payment-history')} className="btn-secondary flex-1 text-sm">Payment History</button>
            <button onClick={() => navigate('/bills')} className="btn-primary flex-1 text-sm">Back to Bills</button>
          </div>
        </div>
      )}
    </div>
  );
}
