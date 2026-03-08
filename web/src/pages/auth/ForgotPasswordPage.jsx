import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/apiService";
import { Alert, Spinner } from "../../components/ui";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useAppVersion } from "../../hooks/useAppVersion";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const appVersion = useAppVersion();
  const [step, setStep] = useState(1); // 1=email, 2=code, 3=new password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Enter your email");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authService.requestPasswordReset(email);
      setStep(2);
    } catch (err) {
      setError(err?.data?.message || err.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!code) {
      setError("Enter the code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authService.verifyResetCode(email, code);
      setResetToken(res?.resetToken || code);
      setStep(3);
    } catch (err) {
      setError(err?.data?.message || err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!password || !confirm) {
      setError("Fill in all fields");
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
      await authService.resetPassword(email, resetToken || code, password);
      setSuccess("Password reset successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err?.data?.message || err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-gray-100 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg mb-4 overflow-hidden">
            <img
              src="/icon.png"
              alt="App logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reset Password
          </h1>
          <p className="text-gray-500 dark:text-white/50 text-sm mt-1">
            {step === 1 && "We'll send a reset code to your email"}
            {step === 2 && `Enter the code sent to ${email}`}
            {step === 3 && "Create a new password"}
          </p>
        </div>

        <div className="card overflow-hidden shadow-xl shadow-gray-200/60 dark:shadow-black/40">
          <div className="h-1 bg-gradient-to-r from-accent via-amber-400 to-amber-600" />
          <div className="p-8">
            {error && (
              <div className="mb-4">
                <Alert type="error">{error}</Alert>
              </div>
            )}
            {success && (
              <div className="mb-4">
                <Alert type="success">{success}</Alert>
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
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
                      Sending...
                    </>
                  ) : (
                    "Send Reset Code"
                  )}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="label">6-Digit Code</label>
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
                    "Verify Code"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
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
                      Resetting...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-white/50 mt-6">
          <Link
            to="/login"
            className="text-accent font-medium hover:underline flex items-center justify-center gap-1.5"
          >
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </p>
      </div>

      {/* Version */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-300 dark:text-white/20 whitespace-nowrap">
        v{appVersion} &middot; build 1
      </p>
    </div>
  );
}
