import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppVersion } from "../../hooks/useAppVersion";
import { useAuth } from "../../context/AuthContext";
import { Alert, Spinner } from "../../components/ui";
import { Eye, EyeOff, CheckCircle, Home, Zap, Users } from "lucide-react";

/* Warm, community-minded feature descriptions */
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

export default function LoginPage() {
  const { signIn } = useAuth(); //[cite: 10]
  const navigate = useNavigate(); //[cite: 10]
  const appVersion = useAppVersion(); //[cite: 10]
  const [email, setEmail] = useState(""); //[cite: 10]
  const [password, setPassword] = useState(""); //[cite: 10]
  const [showPwd, setShowPwd] = useState(false); //[cite: 10]
  const [loading, setLoading] = useState(false); //[cite: 10]
  const [error, setError] = useState(""); //[cite: 10]

  const handleSubmit = async (e) => {
    e.preventDefault(); //[cite: 10]
    if (!email || !password) {
      //[cite: 10]
      setError("Please type in your email and password to continue.");
      return;
    }
    setLoading(true); //[cite: 10]
    setError(""); //[cite: 10]
    const result = await signIn(email, password); //[cite: 10]
    setLoading(false); //[cite: 10]
    if (result.success)
      navigate("/home"); //[cite: 10]
    else setError(result.error); //[cite: 10]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Decorative ambient glow elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 rounded-full blur-3xl pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-emerald-600/5 dark:bg-emerald-400/5 rounded-full blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />

      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        {/* ── LEFT Side Panel: Premium Co-Living Branding (Desktop View) ── */}
        <div className="hidden lg:flex lg:flex-1 flex-col items-start text-left z-10">
          {/* Main Identity Header */}
          <div className="flex items-center gap-3 mb-8 bg-white/40 dark:bg-slate-900/40 p-2 pr-4 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 backdrop-blur-md shadow-2xs">
            <div className="w-11 h-11 rounded-xl overflow-hidden shadow-sm bg-[#1a7a52] flex items-center justify-center shrink-0">
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
                HomeSpace
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
            A thoughtful space for roommates and households to manage shared
            costs, stay perfectly balanced, and handle everyday expenses
            together.
          </p>

          {/* Feature Grid Elements */}
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

        {/* ── RIGHT Side Panel: Secured Login Frame ── */}
        <div className="w-full lg:w-[400px] shrink-0 z-10">
          {/* Welcoming Top Text Area */}
          <div className="text-center lg:text-left mb-6">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Welcome back to the house
            </h1>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
              Step inside to check your home dashboard
            </p>
          </div>

          {/* Glassmorphic Portal Entry Box */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#1a7a52] via-[#2bb37b] to-[#7ee8a2]" />

            <div className="p-8">
              {error && ( //[cite: 10]
                <div className="mb-5">
                  <Alert type="error">{error}</Alert> {/*[cite: 10] */}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Your Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
                    placeholder="name@example.com"
                    value={email} //[cite: 10]
                    onChange={(e) => setEmail(e.target.value)} //[cite: 10]
                    autoComplete="email" //[cite: 10]
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Your Password
                    </label>
                    <Link
                      to="/forgot-password" //[cite: 10]
                      className="text-xs font-bold text-[#1a7a52] dark:text-[#7ee8a2] hover:underline"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"} //[cite: 10]
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
                      placeholder="••••••••"
                      value={password} //[cite: 10]
                      onChange={(e) => setPassword(e.target.value)} //[cite: 10]
                      autoComplete="current-password" //[cite: 10]
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)} //[cite: 10]
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
                      {/*[cite: 10] */}
                    </button>
                  </div>
                </div>

                {/* Submit Action Block */}
                <button
                  type="submit" //[cite: 10]
                  className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#1a7a52] hover:bg-[#156342] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transform active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
                  disabled={loading} //[cite: 10]
                >
                  {loading ? ( //[cite: 10]
                    <>
                      <Spinner size="sm" />
                      <span>Opening the door...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 mt-6">
            New to the community?{" "}
            <Link
              to="/register" //[cite: 10]
              className="text-[#1a7a52] dark:text-[#7ee8a2] font-bold hover:underline ml-0.5"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* Footer Branding Layer */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider text-slate-300 dark:text-slate-700 whitespace-nowrap uppercase">
        Version {appVersion} &middot; Build 42 {/*[cite: 10] */}
      </p>
    </div>
  );
}
