import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  billingCycleService,
  paymentProcessingService,
} from "../../services/apiService";
import { Spinner, Alert } from "../../components/ui";
import { Upload, CheckCircle, ArrowLeft, Copy, Check } from "lucide-react";

const BANKS = [
  "BDO",
  "BPI",
  "Metrobank",
  "PNB",
  "UnionBank",
  "RCBC",
  "Landbank",
  "Other",
];

export default function BankTransferPage() {
  const { state } = useAuth();
  const { user } = state;
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: bank details | 2: upload proof | 3: success
  const [room, setRoom] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [amount, setAmount] = useState(0);
  const [accountDetails, setAccountDetails] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    const init = async () => {
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
        if (!joined) {
          navigate("/bills");
          return;
        }
        setRoom(joined);
        const roomId = joined.id || joined._id;
        const cycleRes = await billingCycleService.getActiveCycle(roomId);
        const c = cycleRes?.billingCycle || cycleRes?.data || cycleRes;
        setCycle(c);
        setAmount(Number(c?.share_per_member || c?.per_member_share || 0));
        // Initiate bank transfer to get account details
        const res = await paymentProcessingService.initiateBankTransfer({
          roomId,
          amount: Number(c?.share_per_member || 0),
          billingCycleId: c?._id || c?.id,
        });
        setAccountDetails(res?.accountDetails || res?.bankDetails || res?.data);
        setTransactionId(
          res?.transaction?.id ||
            res?.transaction?._id ||
            res?.transactionId ||
            "",
        );
        setReferenceNumber(
          res?.referenceNumber ||
            res?.reference_number ||
            res?.transaction?.referenceNumber ||
            "",
        );
      } catch (e) {
        setError(e?.data?.message || e?.message || "Failed to initialize");
      }
      setLoading(false);
    };
    if (user) init();
  }, [user]);

  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5MB");
      return;
    }
    setProofFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  };

  const submit = async () => {
    if (!depositDate) {
      setError("Enter the deposit date");
      return;
    }
    if (!proofFile) {
      setError("Upload proof of transfer");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("transactionId", transactionId);
      formData.append("depositDate", depositDate);
      formData.append("bank", selectedBank);
      formData.append("proof", proofFile);
      await paymentProcessingService.confirmBankTransfer(formData);
      setStep(3);
    } catch (e) {
      setError(e?.data?.message || e?.message || "Submission failed");
    }
    setSubmitting(false);
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Spinner size="lg" className="text-accent" />
        <p className="text-sm text-gray-500 dark:text-white/40">
          Loading bank details…
        </p>
      </div>
    );

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/8"
        >
          <ArrowLeft size={18} className="text-gray-600 dark:text-white/60" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Bank Transfer
        </h1>
      </div>

      {error && (
        <Alert type="error" message={error} onDismiss={() => setError("")} />
      )}

      {step === 1 && (
        <div className="space-y-4">
          {/* Amount */}
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500 dark:text-white/40">
              Amount to Transfer
            </p>
            <p className="text-3xl font-extrabold text-accent mt-1">
              ₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Account details */}
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Transfer Details
            </h2>
            {accountDetails ? (
              Object.entries(accountDetails)
                .filter(([k]) => !["_id", "id", "__v"].includes(k))
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 rounded-lg p-3"
                  >
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 dark:text-white/30 capitalize">
                        {k.replace(/_/g, " ")}
                      </p>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {String(v)}
                      </p>
                    </div>
                    <button
                      onClick={() => copy(String(v), k)}
                      className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-white/10"
                    >
                      {copied === k ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-white/40">
                Contact your host for bank details, then proceed to upload
                proof.
              </p>
            )}
            {referenceNumber && (
              <div className="flex items-center gap-2 bg-accent/5 rounded-lg p-3 border border-accent/20">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 dark:text-white/30">
                    Reference Number (include in transfer)
                  </p>
                  <p className="font-mono font-bold text-accent">
                    {referenceNumber}
                  </p>
                </div>
                <button
                  onClick={() => copy(referenceNumber, "ref")}
                  className="p-1.5 rounded hover:bg-accent/10"
                >
                  {copied === "ref" ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} className="text-accent" />
                  )}
                </button>
              </div>
            )}
          </div>

          <button onClick={() => setStep(2)} className="btn-primary w-full">
            I've Transferred → Upload Proof
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Upload Proof of Transfer
          </h2>

          <div>
            <label className="label">Bank Used</label>
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="input mt-1"
            >
              <option value="">Select bank…</option>
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Deposit / Transfer Date</label>
            <input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="input mt-1"
            />
          </div>

          <div>
            <label className="label">Proof of Transfer</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-1 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-accent/50 transition-colors"
            >
              {proofPreview ? (
                <img
                  src={proofPreview}
                  alt="proof"
                  className="max-h-48 rounded-lg object-contain"
                />
              ) : (
                <>
                  <Upload size={24} className="text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-white/40">
                    {proofFile
                      ? proofFile.name
                      : "Click to upload screenshot/receipt"}
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {submitting ? <Spinner size="sm" /> : null}Confirm Transfer
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Transfer Submitted!
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/40">
            Your proof has been submitted. Your host will verify it shortly.
          </p>
          <div className="text-left bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Amount</span>
              <span className="font-bold text-accent">
                ₱{amount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Method</span>
              <span className="font-medium">Bank Transfer</span>
            </div>
            {selectedBank && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/40">Bank</span>
                <span className="font-medium">{selectedBank}</span>
              </div>
            )}
            {referenceNumber && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/40">
                  Reference
                </span>
                <span className="font-mono font-medium">{referenceNumber}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/payment-history")}
              className="btn-secondary flex-1 text-sm"
            >
              Payment History
            </button>
            <button
              onClick={() => navigate("/bills")}
              className="btn-primary flex-1 text-sm"
            >
              Back to Bills
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
