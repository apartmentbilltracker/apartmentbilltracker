import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppVersion } from "../../hooks/useAppVersion";
import { useAuth } from "../../context/AuthContext";
import { Alert, Spinner } from "../../components/ui";
import { Eye, EyeOff, CheckCircle, Home, Zap, Users } from "lucide-react";

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

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const appVersion = useAppVersion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    const result = await signIn(email, password);
    setLoading(false);
    if (result.success) navigate("/home");
    else setError(result.error);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-gray-100 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Decorative glow blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Two-column layout — stacks on mobile, side-by-side on lg+ */}
      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        {/* ── LEFT: Promo / Ad panel ── hidden on mobile, shown on lg+ */}
        <div className="hidden lg:flex lg:flex-1 flex-col items-start text-left">
          {/* Logo + app name */}
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
            Manage bills <br className="hidden sm:block" />
            <span className="text-accent">without the hassle.</span>
          </h2>
          <p className="text-gray-500 dark:text-white/50 text-sm mb-8 max-w-sm">
            The all-in-one tool for apartment tenants and landlords to track
            bills, split costs, and settle payments.
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

        {/* ── RIGHT: Login form ── */}
        <div className="w-full lg:w-[400px] flex-shrink-0">
          <div className="text-center mb-7 lg:hidden">
            {/* On mobile the logo lives here since the left column collapses above */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back
            </h1>
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
              Sign in to your account
            </p>
          </div>
          <div className="hidden lg:block mb-7">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back
            </h1>
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
              Sign in to your account
            </p>
          </div>

          <div className="card overflow-hidden shadow-xl shadow-gray-200/60 dark:shadow-black/40">
            <div className="h-1 bg-gradient-to-r from-accent via-amber-400 to-amber-600" />
            <div className="p-8">
              {error && (
                <div className="mb-5">
                  <Alert type="error">{error}</Alert>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label !mb-0">Password</label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      className="input pr-11"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white/70 transition-colors"
                    >
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full flex items-center justify-center gap-2 !py-3"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-white/50 mt-5">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-accent font-semibold hover:underline"
            >
              Create one
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
