import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { authService } from "../../services/apiService";
import { setToken } from "../../services/api";
import { Alert, Spinner } from "../../components/ui";
import { Eye, EyeOff, CheckCircle, Home, Zap, Users } from "lucide-react";
import { useAppVersion } from "../../hooks/useAppVersion";

const FEATURES = [
  {
    icon: Home,
    label: "Shared Spaces Hub",
    desc: "Keep tabs on your living spaces, household statuses, and roommates seamlessly.",
  },
  {
    icon: Zap,
    label: "Fair Expense Splitting",
    desc: "Split shared bills like electricity, water, and internet comfortably and evenly.",
  },
  {
    icon: Users,
    label: "Fair-Share Tracking",
    desc: "Log your days at home so utility shares adjust naturally when you're away.",
  },
  {
    icon: CheckCircle,
    label: "Clear Payment History",
    desc: "See exactly who covered what, see remaining tabs, and settle up easily.",
  },
];

// ── STEP 1: Name + Email Identification ──
function Step1({ onNext, onGoogleSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email) {
      setError(
        "Please introduce yourself with your name and email to get started.",
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authService.createUser({ name, email });
      onNext({ name, email });
    } catch (err) {
      setError(
        err?.data?.message ||
          err.message ||
          "We couldn't set up your registration link just yet. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUpResponse = async (credentialResponse) => {
    setGoogleLoading(true);
    setError("");
    try {
      const accessToken = credentialResponse.access_token;
      // Fetch user info from Google's OAuth2 API (same as mobile)
      const userResponse = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      );
      const userData = await userResponse.json();

      const res = await authService.googleLogin({
        email: userData.email,
        name: userData.name,
        avatar: userData.picture,
        accessToken,
      });
      const d = res?.data || res;
      if (d?.token) {
        setToken(d.token);
        onGoogleSuccess();
      } else {
        setError(
          "We couldn't link your Google account. Please use standard registration.",
        );
      }
    } catch (err) {
      setError(
        err?.data?.message ||
          err.message ||
          "We couldn't link your Google account. Please use standard registration.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSignUpResponse,
    onError: () => {
      setError("Google sign-up failed. Please try again.");
    },
    scope: "openid profile email",
    access_type: "offline",
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          What should the house call you?
        </label>
        <input
          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
          placeholder="Juan dela Cruz"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading || googleLoading}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Your Email Address
        </label>
        <input
          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || googleLoading}
        />
      </div>

      <button
        type="submit"
        className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#1a7a52] hover:bg-[#156342] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transform active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
        disabled={loading || googleLoading}
      >
        {loading ? (
          <>
            <Spinner size="sm" />
            <span>Preparing your invite...</span>
          </>
        ) : (
          "Continue"
        )}
      </button>

      {/* Premium Splitter Decorator */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800/80"></div>
        <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          or secure access via
        </span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800/80"></div>
      </div>

      {/* Integrated Google Access Button */}
      <button
        type="button"
        onClick={() => googleLogin()}
        className="w-full inline-flex items-center justify-center gap-2.5 py-3 bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-xs transform active:scale-[0.99] transition-all disabled:opacity-50"
        disabled={loading || googleLoading}
      >
        {googleLoading ? (
          <>
            <Spinner size="sm" />
            <span>Knocking on Google's door...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.055 14.982 0 12 0 7.354 0 3.307 2.664 1.296 6.545l3.97 3.22z"
              />
              <path
                fill="#4285F4"
                d="M23.755 12.273c0-.818-.073-1.609-.209-2.373H12v4.509h6.6c-.287 1.509-1.137 2.786-2.423 3.645l3.764 2.918c2.204-2.036 3.814-5.036 3.814-8.699z"
              />
              <path
                fill="#FBBC05"
                d="M5.266 14.235L1.296 17.454A11.96 11.96 0 0 1 0 12c0-1.936.46-3.764 1.296-5.454l3.97 3.22a7.045 7.045 0 0 0 0 4.47z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.955-1.073 7.941-2.918l-3.764-2.918c-1.045.7-2.382 1.118-4.177 1.118-3.218 0-5.945-2.164-6.914-5.082l-3.97 3.073C3.307 21.336 7.354 24 12 24z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>
    </form>
  );
}

// ── STEP 2: Secure Token Verification ──
function Step2({ data, onNext }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code) {
      setError(
        "Please enter the 6-digit invitation token we sent to your inbox.",
      );
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
      setError(
        err?.data?.message ||
          err.message ||
          "That token doesn't match our records. Please verify the code and try again.",
      );
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

      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center leading-relaxed">
        We dropped a unique verification token over to{" "}
        <strong className="text-slate-800 dark:text-slate-200 font-bold">
          {data.email}
        </strong>
      </p>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block text-center">
          6-Digit Invitation Token
        </label>
        <input
          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xl font-black text-slate-800 dark:text-white text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
          placeholder="000000"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>

      <button
        type="submit"
        className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#1a7a52] hover:bg-[#156342] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transform active:scale-[0.99] transition-all disabled:opacity-50 mt-1"
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner size="sm" />
            <span>Checking token...</span>
          </>
        ) : (
          "Verify Token"
        )}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="w-full text-xs font-bold text-[#1a7a52] dark:text-[#7ee8a2] hover:underline disabled:opacity-50 text-center block pt-1"
      >
        {resending ? "Sending a fresh key..." : "Send a fresh code"}
      </button>
    </form>
  );
}

// ── STEP 3: Setup Profile Security ──
function Step3({ data, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirm) {
      setError(
        "Please complete both password sections to protect your profile.",
      );
      return;
    }
    if (password.length < 8) {
      setError(
        "For safety, your household password needs to be at least 8 characters long.",
      );
      return;
    }
    if (password !== confirm) {
      setError(
        "The passwords don't quite match yet. Take a quick look and try again.",
      );
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
      setError(
        err?.data?.message ||
          err.message ||
          "We encountered an error securing your profile settings. Please try once more.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Create a Secure Password
        </label>
        <div className="relative">
          <input
            type={showPwd ? "text" : "password"}
            className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Confirm Your Password
        </label>
        <input
          type="password"
          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
          placeholder="Repeat your chosen password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#1a7a52] hover:bg-[#156342] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transform active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner size="sm" />
            <span>Setting up your room...</span>
          </>
        ) : (
          "Complete Setup"
        )}
      </button>
    </form>
  );
}

// ── MAIN CORE EXPORT: Register Page Layout Framework ──
export default function RegisterPage() {
  const navigate = useNavigate();
  const appVersion = useAppVersion();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});

  const stepLabels = ["Profile Info", "Verify Token", "Security"];

  const handleRegistrationComplete = () => {
    navigate("/dashboard"); // Routed cleanly on instant Google success or final password setup
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 rounded-full blur-3xl pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-emerald-600/5 dark:bg-emerald-400/5 rounded-full blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />

      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        {/* ── LEFT Panel: Premium Branding Structure (Desktop view Only) ── */}
        <div className="hidden lg:flex lg:flex-1 flex-col items-start text-left z-10">
          <div className="flex items-center gap-3 mb-8 bg-white/40 dark:bg-slate-900/40 p-2 pr-4 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 backdrop-blur-md shadow-2xs">
            <div className="w-11 h-11 rounded-xl overflow-hidden shadow-sm border border-[#1a7a52] flex items-center justify-center shrink-0">
              <img
                src="/icon.png"
                alt="Community brand icon"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-black text-[#1a7a52] dark:text-[#7ee8a2] uppercase tracking-widest leading-none">
                Co-Living
              </p>
              <p className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-none">
                PropFlow
              </p>
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            Stress-free co-living, <br className="hidden sm:block" />
            <span className="text-[#1a7a52] dark:text-[#7ee8a2]">
              beautifully organized.
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8 max-w-sm leading-relaxed">
            Create an account to start tracking bills, splitting shared
            household costs, and staying comfortably balanced with everyone
            inside your apartment.
          </p>

          <ul className="space-y-5 w-full max-w-sm">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-start gap-3.5 group">
                <div className="w-9 h-9 rounded-xl bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 border border-[#1a7a52]/5 flex items-center justify-center shrink-0 mt-0.5 transition-colors group-hover:bg-[#1a7a52]/15">
                  <Icon
                    size={16}
                    className="text-[#1a7a52] dark:text-[#7ee8a2]"
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {label}
                  </p>
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── RIGHT Panel: Registration Framework Box ── */}
        <div className="w-full lg:w-[420px] shrink-0 z-10">
          <div className="text-center lg:text-left mb-6">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Create Account
            </h1>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
              Set up your space profile in 3 simple steps
            </p>
          </div>

          {/* Clean Step Indicator Framework */}
          <div className="flex items-center justify-center lg:justify-start gap-1.5 mb-6 px-1">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={n} className="flex items-center gap-1.5">
                  <div
                    className={`flex items-center gap-1.5 ${active ? "text-[#1a7a52] dark:text-[#7ee8a2]" : done ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-700"}`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
                        active
                          ? "border-[#1a7a52] bg-[#1a7a52] text-white dark:border-[#7ee8a2] dark:bg-[#7ee8a2] dark:text-[#02302e] shadow-sm"
                          : done
                            ? "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-[#02302e]"
                            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {done ? (
                        <CheckCircle size={12} className="stroke-[3]" />
                      ) : (
                        n
                      )}
                    </div>
                    <span className="text-xs font-bold hidden sm:inline tracking-tight">
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      className={`w-6 h-[2px] rounded-full mx-0.5 ${n < step ? "bg-emerald-500 dark:bg-emerald-400" : "bg-slate-200 dark:bg-slate-800"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Premium Glassmorphic Layout Frame Container */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#1a7a52] via-[#2bb37b] to-[#7ee8a2]" />
            <div className="p-8">
              {step === 1 && (
                <Step1
                  onNext={(d) => {
                    setFormData(d);
                    setStep(2);
                  }}
                  onGoogleSuccess={handleRegistrationComplete}
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
                <Step3 data={formData} onDone={handleRegistrationComplete} />
              )}
            </div>
          </div>

          {/* Bottom portal entry link redirection */}
          <p className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-[#1a7a52] dark:text-[#7ee8a2] font-bold hover:underline ml-0.5"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Persistent version layer profile footer */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider text-slate-300 dark:text-slate-700 whitespace-nowrap uppercase">
        Version {appVersion} &middot; Build 1
      </p>
    </div>
  );
}
