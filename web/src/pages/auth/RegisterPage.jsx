import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/apiService";
import { setToken } from "../../services/api";
import { Alert, Spinner } from "../../components/ui";
import { Eye, EyeOff, CheckCircle, Home, Zap, Users } from "lucide-react";
import { useAppVersion } from "../../hooks/useAppVersion";

const FEATURES = [
  {
    icon: Home,
    label: "Room Management",
    desc: "Track every room, tenant, and occupancy status in one place.",
  },
  {
    icon: Zap,
    label: "Instant Bill Splits",
    desc: "Electricity, water & internet split fairly among roommates.",
  },
  {
    icon: Users,
    label: "Presence Tracking",
    desc: "Log your days present to calculate your exact water share.",
  },
  {
    icon: CheckCircle,
    label: "Payment Records",
    desc: "Know who paid, what remains, and settle balances easily.",
  },
];

// Step 1: Name + Email
function Step1({ onNext }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authService.createUser({ name, email });
      onNext({ name, email });
    } catch (err) {
      setError(err?.data?.message || err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <div>
        <label className="label">Full Name</label>
        <input
          className="input"
          placeholder="Juan dela Cruz"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Email</label>
        <input
          className="input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button
        type="submit"
        className="btn-primary w-full flex items-center justify-center gap-2"
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner size="sm" />
            Sending code...
          </>
        ) : (
          "Continue"
        )}
      </button>
    </form>
  );
}

// Step 2: Verify Code
function Step2({ data, onNext }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code) {
      setError("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authService.verifyActivationCode({
        email: data.email,
        activationCode: code,
      });
      onNext({ ...data, code });
    } catch (err) {
      setError(err?.data?.message || err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authService.resendVerification(data.email);
    } catch (_) {}
    setResending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <p className="text-sm text-gray-500 dark:text-white/50">
        A 6-digit code was sent to{" "}
        <strong className="text-gray-700 dark:text-white/80">
          {data.email}
        </strong>
      </p>
      <div>
        <label className="label">Verification Code</label>
        <input
          className="input text-center text-xl tracking-widest"
          placeholder="000000"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <button
        type="submit"
        className="btn-primary w-full flex items-center justify-center gap-2"
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner size="sm" />
            Verifying...
          </>
        ) : (
          "Verify"
        )}
      </button>
      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="w-full text-sm text-accent hover:underline disabled:opacity-50"
      >
        {resending ? "Resending..." : "Resend code"}
      </button>
    </form>
  );
}

// Step 3: Set Password
function Step3({ data, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirm) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authService.setPassword({
        email: data.email,
        activationCode: data.code,
        password,
      });
      const d = res?.data || res;
      if (d?.token) setToken(d.token);
      onDone();
    } catch (err) {
      setError(err?.data?.message || err.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <div>
        <label className="label">Password</label>
        <div className="relative">
          <input
            type={showPwd ? "text" : "password"}
            className="input pr-11"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <div>
        <label className="label">Confirm Password</label>
        <input
          type="password"
          className="input"
          placeholder="Repeat password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button
        type="submit"
        className="btn-primary w-full flex items-center justify-center gap-2"
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner size="sm" />
            Creating account...
          </>
        ) : (
          "Create Account"
        )}
      </button>
    </form>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const appVersion = useAppVersion();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});

  const stepLabels = ["Account Info", "Verify Email", "Set Password"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-gray-100 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Two-column layout */}
      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        {/* ── LEFT: Promo panel ── hidden on mobile, shown on lg+ */}
        <div className="hidden lg:flex lg:flex-1 flex-col items-start text-left">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0">
              <img
                src="/icon.png"
                alt="App logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-accent uppercase tracking-widest">
                Apartment
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                Bill Tracker
              </p>
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-snug mb-4">
            Join your apartment <br className="hidden sm:block" />
            <span className="text-accent">billing community.</span>
          </h2>
          <p className="text-gray-500 dark:text-white/50 text-sm mb-8 max-w-sm">
            Create an account to start tracking bills, splitting costs, and
            staying on top of every payment — all in one place.
          </p>

          <ul className="space-y-4 w-full max-w-sm">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 dark:bg-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={18} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                    {label}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/40">
                    {desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── RIGHT: Registration form ── */}
        <div className="w-full lg:w-[420px] flex-shrink-0">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center lg:text-left">
              Create Account
            </h1>
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1 text-center lg:text-left">
              Set up your account in 3 quick steps
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center lg:justify-start gap-2 mb-6">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={n} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 ${active ? "text-accent" : done ? "text-green-600" : "text-gray-400"}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                        active
                          ? "border-accent bg-accent text-white"
                          : done
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-gray-300 dark:border-white/20"
                      }`}
                    >
                      {done ? <CheckCircle size={14} /> : n}
                    </div>
                    <span className="text-xs font-medium hidden sm:block">
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      className={`w-8 h-0.5 ${n < step ? "bg-green-500" : "bg-gray-200 dark:bg-white/10"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="card overflow-hidden shadow-xl shadow-gray-200/60 dark:shadow-black/40">
            <div className="h-1 bg-gradient-to-r from-accent via-amber-400 to-amber-600" />
            <div className="p-8">
              {step === 1 && (
                <Step1
                  onNext={(d) => {
                    setFormData(d);
                    setStep(2);
                  }}
                />
              )}
              {step === 2 && (
                <Step2
                  data={formData}
                  onNext={(d) => {
                    setFormData(d);
                    setStep(3);
                  }}
                />
              )}
              {step === 3 && (
                <Step3 data={formData} onDone={() => navigate("/login")} />
              )}
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-white/50 mt-5">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-accent font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Version */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-300 dark:text-white/20 whitespace-nowrap">
        v{appVersion} &middot; build 1
      </p>
    </div>
  );
}
