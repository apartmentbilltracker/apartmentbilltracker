import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/apiService";
import { Alert, Spinner } from "../../components/ui";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useAppVersion } from "../../hooks/useAppVersion";

export default function ForgotPasswordPage() {
  const navigate = useNavigate(); //[cite: 8]
  const appVersion = useAppVersion(); //[cite: 8]
  const [step, setStep] = useState(1); // 1=email, 2=code, 3=new password[cite: 8]
  const [email, setEmail] = useState(""); //[cite: 8]
  const [code, setCode] = useState(""); //[cite: 8]
  const [resetToken, setResetToken] = useState(""); //[cite: 8]
  const [password, setPassword] = useState(""); //[cite: 8]
  const [confirm, setConfirm] = useState(""); //[cite: 8]
  const [showPwd, setShowPwd] = useState(false); //[cite: 8]
  const [loading, setLoading] = useState(false); //[cite: 8]
  const [error, setError] = useState(""); //[cite: 8]
  const [success, setSuccess] = useState(""); //[cite: 8]

  const handleSendCode = async (e) => {
    e.preventDefault(); //[cite: 8]
    if (!email) {
      //[cite: 8]
      setError(
        "Please enter your email address so we can find your account workspace.",
      );
      return;
    }
    setLoading(true); //[cite: 8]
    setError(""); //[cite: 8]
    try {
      await authService.requestPasswordReset(email); //[cite: 8]
      setStep(2); //[cite: 8]
    } catch (err) {
      setError(
        err?.data?.message ||
          err.message ||
          "We couldn't dispatch a verification code right now. Please try again.",
      );
    } finally {
      setLoading(false); //[cite: 8]
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault(); //[cite: 8]
    if (!code) {
      //[cite: 8]
      setError(
        "Please type in the 6-digit code sent to your inbox to continue.",
      );
      return;
    }
    setLoading(true); //[cite: 8]
    setError(""); //[cite: 8]
    try {
      const res = await authService.verifyResetCode(email, code); //[cite: 8]
      setResetToken(res?.resetToken || code); //[cite: 8]
      setStep(3); //[cite: 8]
    } catch (err) {
      setError(
        err?.data?.message ||
          err.message ||
          "That code doesn't seem quite right. Double-check your inbox and try again.",
      );
    } finally {
      setLoading(false); //[cite: 8]
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault(); //[cite: 8]
    if (!password || !confirm) {
      //[cite: 8]
      setError(
        "Please complete both password sections to protect your profile.",
      );
      return;
    }
    if (password.length < 8) {
      //[cite: 8]
      setError(
        "For your protection, your new password must be at least 8 characters long.",
      );
      return;
    }
    if (password !== confirm) {
      //[cite: 8]
      setError(
        "The entries do not match. Please verify your typing and try again.",
      );
      return;
    }
    setLoading(true); //[cite: 8]
    setError(""); //[cite: 8]
    try {
      await authService.resetPassword(email, resetToken || code, password); //[cite: 8]
      setSuccess(
        "Your security settings have updated successfully! Returning you back to the portal entry...",
      );
      setTimeout(() => navigate("/login"), 2000); //[cite: 8]
    } catch (err) {
      setError(
        err?.data?.message ||
          err.message ||
          "We ran into an issue updating your security settings. Please give it another try.",
      );
    } finally {
      setLoading(false); //[cite: 8]
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 rounded-full blur-3xl pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-emerald-600/5 dark:bg-emerald-400/5 rounded-full blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />

      <div className="w-full max-w-sm relative z-10">
        {/* Dynamic Header Workspace */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl shadow-md border border-[#1a7a52] mb-4 overflow-hidden">
            <img
              src="/icon.png"
              alt="Community brand identity"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Account Recovery
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
            {step === 1 &&
              "We will forward a unique confirmation token straight to your dashboard login address."}
            {step === 2 &&
              `Please check your mailbox. We dropped a verification token over to ${email}`}
            {step === 3 &&
              "Establish a robust new security code to protect your household dashboard access."}
          </p>
        </div>

        {/* Premium Glassmorphic Layout Frame */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#1a7a52] via-[#2bb37b] to-[#7ee8a2]" />

          <div className="p-8">
            {error && ( //[cite: 8]
              <div className="mb-4">
                <Alert type="error">{error}</Alert> {/*[cite: 8] */}
              </div>
            )}
            {success && ( //[cite: 8]
              <div className="mb-4">
                <Alert type="success">{success}</Alert> {/*[cite: 8] */}
              </div>
            )}

            {/* STEP 1: Email Submission */}
            {step === 1 && ( //[cite: 8]
              <form onSubmit={handleSendCode} className="space-y-4">
                {" "}
                {/*[cite: 8] */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Your Email Address
                  </label>
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
                    type="email" //[cite: 8]
                    placeholder="name@example.com"
                    value={email} //[cite: 8]
                    onChange={(e) => setEmail(e.target.value)} //[cite: 8]
                  />
                </div>
                <button
                  type="submit" //[cite: 8]
                  className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#1a7a52] hover:bg-[#156342] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transform active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
                  disabled={loading} //[cite: 8]
                >
                  {loading ? ( //[cite: 8]
                    <>
                      <Spinner size="sm" />
                      <span>Sending security token...</span>
                    </>
                  ) : (
                    <span>Request Reset Code</span>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Verification Token Check */}
            {step === 2 && ( //[cite: 8]
              <form onSubmit={handleVerifyCode} className="space-y-4">
                {" "}
                {/*[cite: 8] */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block text-center">
                    6-Digit Key
                  </label>
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xl font-black text-slate-800 dark:text-white text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
                    placeholder="000000" //[cite: 8]
                    maxLength={6} //[cite: 8]
                    value={code} //[cite: 8]
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} //[cite: 8]
                  />
                </div>
                <button
                  type="submit" //[cite: 8]
                  className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#1a7a52] hover:bg-[#156342] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transform active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
                  disabled={loading} //[cite: 8]
                >
                  {loading ? ( //[cite: 8]
                    <>
                      <Spinner size="sm" />
                      <span>Checking token...</span>
                    </>
                  ) : (
                    <span>Confirm Verification Key</span>
                  )}
                </button>
                <button
                  type="button" //[cite: 8]
                  onClick={() => setStep(1)} //[cite: 8]
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition-colors mt-1"
                >
                  <ArrowLeft size={12} /> Back to email input
                </button>
              </form>
            )}

            {/* STEP 3: Setup New Password Credential */}
            {step === 3 && ( //[cite: 8]
              <form onSubmit={handleResetPassword} className="space-y-4">
                {" "}
                {/*[cite: 8] */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    New Secure Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"} //[cite: 8]
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
                      placeholder="Minimum 8 characters"
                      value={password} //[cite: 8]
                      onChange={(e) => setPassword(e.target.value)} //[cite: 8]
                    />
                    <button
                      type="button" //[cite: 8]
                      onClick={() => setShowPwd(!showPwd)} //[cite: 8]
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
                      {/*[cite: 8] */}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Confirm New Password
                  </label>
                  <input
                    type="password" //[cite: 8]
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a7a52] dark:focus:ring-[#7ee8a2] transition-all"
                    placeholder="Repeat your new password"
                    value={confirm} //[cite: 8]
                    onChange={(e) => setConfirm(e.target.value)} //[cite: 8]
                  />
                </div>
                <button
                  type="submit" //[cite: 8]
                  className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#1a7a52] hover:bg-[#156342] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transform active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
                  disabled={loading} //[cite: 8]
                >
                  {loading ? ( //[cite: 8]
                    <>
                      <Spinner size="sm" />
                      <span>Updating account security...</span>
                    </>
                  ) : (
                    <span>Save New Password</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Return Options */}
        <p className="text-center text-xs font-bold mt-6">
          <Link
            to="/login" //[cite: 8]
            className="text-[#1a7a52] dark:text-[#7ee8a2] hover:underline inline-flex items-center justify-center gap-1.5 transition-all"
          >
            <ArrowLeft size={12} /> Back to Sign In
          </Link>
        </p>
      </div>

      {/* Persistent Version Layer */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider text-slate-300 dark:text-slate-700 whitespace-nowrap uppercase">
        Version {appVersion} &middot; Build 1 {/*[cite: 8] */}
      </p>
    </div>
  );
}
