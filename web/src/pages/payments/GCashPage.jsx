import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  roomService,
  billingCycleService,
  paymentProcessingService,
  settingsService,
} from "../../services/apiService";
import { Spinner, Alert } from "../../components/ui";
import { Copy, Check, CheckCircle, ArrowLeft } from "lucide-react";

function StepIndicator({ step }) {
  const steps = ["QR Code", "Verify", "Done"];
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {steps.map((s, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors
              ${done ? "bg-green-500 text-white" : active ? "bg-accent text-black" : "bg-gray-200 dark:bg-white/10 text-gray-500"}`}
            >
              {done ? <Check size={12} /> : idx}
            </div>
            <span
              className={`ml-1.5 text-xs font-medium mr-3 ${active ? "text-gray-900 dark:text-white" : "text-gray-400"}`}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px mr-3 ${done ? "bg-green-500" : "bg-gray-200 dark:bg-white/10"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function GCashPage() {
  const { state } = useAuth();
  const { user } = state;
  const navigate = useNavigate();
  const [step, setStep] = useState("loading"); // loading | qr | verify | success
  const [room, setRoom] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [amount, setAmount] = useState(0);
  const [transactionId, setTransactionId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [hostQrUri, setHostQrUri] = useState(null);
  const [mobileNumber, setMobileNumber] = useState("");
  const [copied, setCopied] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [error, setError] = useState("");

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
        const share = Number(c?.share_per_member || c?.per_member_share || 0);
        setAmount(share);

        // Load host GCash QR
        const pmRes = await settingsService.getPaymentMethods(roomId);
        const gcashQr =
          pmRes?.paymentMethods?.gcash?.qrUrl || pmRes?.gcash?.qrUrl;
        if (gcashQr) setHostQrUri(gcashQr);

        // Initiate
        const res = await paymentProcessingService.initiateGCash({
          roomId,
          amount: share,
          billingCycleId: c?._id || c?.id,
        });
        if (res?.success || res?.transaction) {
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
          setStep("qr");
        } else {
          setError(res?.message || "Failed to initiate GCash payment");
        }
      } catch (e) {
        setError(e?.data?.message || e?.message || "Failed to initiate");
      }
    };
    if (user) init();
  }, [user]);

  const copy = async () => {
    await navigator.clipboard.writeText(referenceNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const verify = async () => {
    if (!mobileNumber.trim()) {
      setError("Enter your GCash mobile number");
      return;
    }
    setVerifyLoading(true);
    setError("");
    try {
      const res = await paymentProcessingService.verifyGCash({
        transactionId,
        mobileNumber,
      });
      if (res?.success || res?.transaction) {
        setStep("success");
      } else {
        setError(res?.message || "Verification failed");
      }
    } catch (e) {
      setError(e?.data?.message || e?.message || "Verification failed");
    }
    setVerifyLoading(false);
  };

  const stepNum =
    step === "qr" ? 1 : step === "verify" ? 2 : step === "success" ? 3 : 0;

  if (step === "loading")
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Spinner size="lg" className="text-accent" />
        <p className="text-sm text-gray-500 dark:text-white/40">
          Initializing payment…
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
          GCash Payment
        </h1>
      </div>

      <StepIndicator step={stepNum} />

      {error && (
        <Alert type="error" message={error} onDismiss={() => setError("")} />
      )}

      {/* Step 1: QR + Reference */}
      {step === "qr" && (
        <div className="space-y-4">
          <div className="card p-5 text-center space-y-4">
            <p className="text-sm text-gray-500 dark:text-white/40">
              Scan QR or use reference number
            </p>
            <p className="text-2xl font-extrabold text-accent">
              ₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>

            {hostQrUri && (
              <div className="flex justify-center">
                <img
                  src={hostQrUri}
                  alt="GCash QR"
                  className="w-48 h-48 object-contain rounded-xl border border-gray-200 dark:border-white/10"
                />
              </div>
            )}

            {referenceNumber && (
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                <div className="flex-1 text-left">
                  <p className="text-xs text-gray-400 dark:text-white/30">
                    Reference Number
                  </p>
                  <p className="font-mono font-bold text-gray-900 dark:text-white">
                    {referenceNumber}
                  </p>
                </div>
                <button
                  onClick={copy}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10"
                >
                  {copied ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <Copy size={16} className="text-gray-400" />
                  )}
                </button>
              </div>
            )}

            <div className="text-left bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                Instructions
              </p>
              {[
                "Open your GCash app",
                `Send ₱${amount.toLocaleString()} to the QR above`,
                referenceNumber
                  ? `Include reference: ${referenceNumber}`
                  : "Note your reference number",
                'Come back and tap "Verify Payment"',
              ].map((s, i) => (
                <div
                  key={i}
                  className="flex gap-2 text-sm text-blue-800 dark:text-blue-200"
                >
                  <span className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep("verify")}
              className="btn-primary w-full"
            >
              I've Sent the Payment →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Verify */}
      {step === "verify" && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Verify Payment
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/40">
            Enter the GCash mobile number you used to send the payment.
          </p>
          <div>
            <label className="label">GCash Mobile Number</label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="input mt-1"
              placeholder="09XXXXXXXXX"
              maxLength={11}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("qr")}
              className="btn-secondary flex-1"
            >
              Back
            </button>
            <button
              onClick={verify}
              disabled={verifyLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {verifyLoading ? <Spinner size="sm" /> : null}Verify Payment
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === "success" && (
        <div className="card p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Payment Submitted!
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/40">
            Your payment is awaiting verification by your host.
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
              <span className="font-medium">GCash</span>
            </div>
            {referenceNumber && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/40">
                  Reference
                </span>
                <span className="font-mono font-medium">{referenceNumber}</span>
              </div>
            )}
            {mobileNumber && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/40">
                  Mobile No.
                </span>
                <span className="font-medium">{mobileNumber}</span>
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
