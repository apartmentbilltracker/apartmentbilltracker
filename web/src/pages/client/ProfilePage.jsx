import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { roomService, hostRoleService } from "../../services/apiService";
import { useAppVersion } from "../../hooks/useAppVersion";
import { Alert, Avatar } from "../../components/ui";
import {
  Camera,
  Save,
  LogOut,
  Star,
  Shield,
  FileText,
  ChevronRight,
  User,
  Activity,
  Mail,
  Calendar,
  Lock,
  Sparkles,
} from "lucide-react";

export default function ProfilePage() {
  const { state, updateUserProfile, signOut: logout } = useAuth(); //[cite: 9]
  const { user } = state; //[cite: 9]
  const navigate = useNavigate(); //[cite: 9]
  const userId = user?.id || user?._id; //[cite: 9]
  const appVersion = useAppVersion(); //[cite: 9]
  const [name, setName] = useState(user?.name || ""); //[cite: 9]
  const [avatarPreview, setAvatarPreview] = useState(null); //[cite: 9]
  const [avatarBase64, setAvatarBase64] = useState(null); //[cite: 9]
  const [saving, setSaving] = useState(false); //[cite: 9]
  const [error, setError] = useState(""); //[cite: 9]
  const [success, setSuccess] = useState(""); //[cite: 9]
  const [isPayer, setIsPayer] = useState(null); //[cite: 9]
  const [hostStatus, setHostStatus] = useState(null); //[cite: 9]
  const [requestingHost, setRequestingHost] = useState(false); //[cite: 9]
  const fileRef = useRef(null); //[cite: 9]

  useEffect(() => {
    if (!userId) return; //[cite: 9]
    // Load payer status
    roomService
      .getClientRooms() //[cite: 9]
      .then((res) => {
        const rooms = Array.isArray(res) ? res : res?.rooms || []; //[cite: 9]
        const room = rooms[0] || null; //[cite: 9]
        if (room) {
          const member = room.members?.find(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId), //[cite: 9]
          );
          if (member) setIsPayer(member.isPayer ?? member.is_payer ?? false); //[cite: 9]
        }
      })
      .catch(() => {});

    // Load host request status
    if (user?.role !== "host" && user?.role !== "admin") {
      //[cite: 9]
      hostRoleService
        .getHostStatus() //[cite: 9]
        .then((res) => {
          setHostStatus(res?.hostRequestStatus || res?.status || null); //[cite: 9]
        })
        .catch(() => {});
    }
  }, [userId, user?.role]); //[cite: 9]

  const avatarSrc =
    avatarPreview ||
    (() => {
      const a = user?.avatar; //[cite: 9]
      if (!a) return null; //[cite: 9]
      if (typeof a === "string")
        return a.startsWith("{") ? JSON.parse(a)?.url : a; //[cite: 9]
      return a?.url; //[cite: 9]
    })();

  const handleFile = (e) => {
    const file = e.target.files?.[0]; //[cite: 9]
    if (!file) return; //[cite: 9]
    if (file.size > 2 * 1024 * 1024) {
      //[cite: 9]
      setError(
        "Let's keep the image file under 2 MB so it loads instantly across the community feed.",
      ); //[cite: 9]
      return; //[cite: 9]
    }
    const reader = new FileReader(); //[cite: 9]
    reader.onload = (ev) => {
      setAvatarPreview(ev.target.result); //[cite: 9]
      setAvatarBase64(ev.target.result); //[cite: 9]
    };
    reader.readAsDataURL(file); //[cite: 9]
  };

  const requestHost = async () => {
    setRequestingHost(true); //[cite: 9]
    try {
      await hostRoleService.requestHost(); //[cite: 9]
      setHostStatus("pending"); //[cite: 9]
      setSuccess(
        "Your application to become a property host has been forwarded to our admin desk.",
      ); //[cite: 9]
    } catch (e) {
      setError(
        e?.message ||
          "We could not register your hosting request right now. Give it another try shortly.",
      ); //[cite: 9]
    }
    setRequestingHost(false); //[cite: 9]
  };

  const handleLogout = async () => {
    if (
      window.confirm(
        "Ready to sign out of your dashboard session? Your parameters remain safe.",
      )
    ) {
      //[cite: 9]
      await logout?.(); //[cite: 9]
      navigate("/login"); //[cite: 9]
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      //[cite: 9]
      setError(
        "Please share a display name so your housemates recognize you easily.",
      ); //[cite: 9]
      return; //[cite: 9]
    }
    setSaving(true); //[cite: 9]
    setError(""); //[cite: 9]
    setSuccess(""); //[cite: 9]
    try {
      await updateUserProfile(name.trim(), avatarBase64); //[cite: 9]
      setSuccess(
        "Wonderful! Your profile details have been securely synchronized across the system.",
      ); //[cite: 9]
      setAvatarBase64(null); //[cite: 9]
    } catch (e) {
      setError(
        e?.data?.message ||
          e?.message ||
          "We ran into an obstacle saving your profile settings.",
      ); //[cite: 9]
    }
    setSaving(false); //[cite: 9]
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 px-4 animate-fadeIn">
      {/* Glassmorphic Masthead */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6 group">
        <div className="absolute -right-20 -top-20 w-52 h-52 rounded-full bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 blur-3xl group-hover:scale-110 transition-transform duration-700" />

        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-xs font-black text-[#1a7a52] dark:text-[#7ee8a2] tracking-wide uppercase">
            <Activity size={12} /> Resident Profile Hub
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Account Workspace
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 max-w-xl">
            Manage your personal verification credentials, avatar identities,
            interface layout access roles, and platform utility parameters.
          </p>
        </div>
      </div>
      {error && (
        <Alert type="error" message={error} onDismiss={() => setError("")} />
      )}{" "}
      {/*[cite: 9] */}
      {success && (
        <Alert
          type="success"
          message={success}
          onDismiss={() => setSuccess("")}
        />
      )}{" "}
      {/*[cite: 9] */}
      {/* Main Grid Workspace split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Identity Card and Account metrics */}
        <div className="space-y-6 md:col-span-1">
          {/* Avatar Premium Panel */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-[#1a7a52]/10 to-transparent dark:from-[#7ee8a2]/5" />

            <div className="relative mt-4 z-10 group/avatar">
              <div className="ring-4 ring-white dark:ring-slate-900 rounded-full shadow-md overflow-hidden transition-transform duration-300 group-hover/avatar:scale-[1.02]">
                <Avatar src={avatarSrc} name={user?.name || ""} size="xl" />{" "}
                {/*[cite: 9] */}
              </div>
              <button
                onClick={() => fileRef.current?.click()} //[cite: 9]
                className="absolute bottom-1 right-1 w-9 h-9 bg-[#1a7a52] dark:bg-[#7ee8a2] text-white dark:text-[#02302e] rounded-xl flex items-center justify-center shadow-lg hover:scale-115 active:scale-95 transition-all"
              >
                <Camera size={15} />
              </button>
              <input
                ref={fileRef} //[cite: 9]
                type="file" //[cite: 9]
                accept="image/*" //[cite: 9]
                className="hidden" //[cite: 9]
                onChange={handleFile} //[cite: 9]
              />
            </div>

            <div className="mt-4 space-y-1 z-10">
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                {user?.name} {/*[cite: 9] */}
              </h2>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
                <Mail size={12} />
                {user?.email} {/*[cite: 9] */}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {user?.role || "client"} {/*[cite: 9] */}
                </span>
              </div>
            </div>
          </div>

          {/* Account Registry Metadata */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
              System Registry
            </h3>

            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 shrink-0">
                  <Calendar size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Member Since
                  </p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {user?.createdAt || user?.created_at //[cite: 9]
                      ? new Date(
                          user.createdAt || user.created_at,
                        ).toLocaleDateString("en-PH", {
                          //[cite: 9]
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}{" "}
                    {/*[cite: 9] */}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 shrink-0">
                  <User size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Access Tier
                  </p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                    {user?.role || "client"} {/*[cite: 9] */}
                  </p>
                </div>
              </div>

              {isPayer !== null && ( //[cite: 9]
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isPayer
                        ? "bg-[#1a7a52]/10 text-[#1a7a52] dark:bg-[#7ee8a2]/10 dark:text-[#7ee8a2]"
                        : "bg-slate-50 dark:bg-slate-800/50 text-slate-400"
                    }`}
                  >
                    <Activity size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Ledger Accountability
                    </p>
                    <p
                      className={`text-xs font-black capitalize ${isPayer ? "text-[#1a7a52] dark:text-[#7ee8a2]" : "text-slate-800 dark:text-slate-200"}`}
                    >
                      {" "}
                      {/*[cite: 9] */}
                      {isPayer ? "Primary Room Payer" : "General Resident"}{" "}
                      {/*[cite: 9] */}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Session Sign-out Module */}
          <div className="rounded-2xl border border-slate-200/40 dark:border-slate-800/60 p-4 bg-white/50 dark:bg-slate-900/40">
            <button
              onClick={handleLogout} //[cite: 9]
              className="w-full flex items-center justify-center gap-2 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-black text-xs uppercase tracking-wider py-2 rounded-xl hover:bg-rose-500/5 transition-all"
            >
              <LogOut size={14} />
              Terminate Session
            </button>
          </div>
        </div>

        {/* Right Column: Interaction Parameter Modules */}
        <div className="space-y-6 md:col-span-2">
          {/* Identity Parameters Settings Form */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 bg-white dark:bg-slate-900 shadow-sm space-y-5">
            <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 uppercase">
              Personal Credentials
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Public Full Name
                </label>
                <input
                  type="text" //[cite: 9]
                  value={name} //[cite: 9]
                  onChange={(e) => setName(e.target.value)} //[cite: 9]
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-4 py-2.5 text-sm font-semibold focus:border-[#1a7a52] focus:ring-2 focus:ring-[#1a7a52]/10 dark:focus:border-[#7ee8a2] outline-none text-slate-900 dark:text-white transition-all"
                  placeholder="Your preferred display name" //[cite: 9]
                />
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Lock size={11} /> Registered Email Address
                </label>
                <input
                  type="email" //[cite: 9]
                  value={user?.email || ""} //[cite: 9]
                  disabled //[cite: 9]
                  className="w-full rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-4 py-2.5 text-sm font-semibold text-slate-400 dark:text-slate-500 cursor-not-allowed outline-none"
                />
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-600 mt-1">
                  Email authentication overrides are managed via Admin security.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={handleSave} //[cite: 9]
                disabled={saving} //[cite: 9]
                className="px-5 py-2.5 rounded-xl bg-[#1a7a52] hover:bg-[#135c3d] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-black flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 w-full sm:w-auto justify-center"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save Sync Changes
              </button>
            </div>
          </div>

          {/* Become a Host Operations Upgrade Section */}
          {user?.role !== "host" &&
            user?.role !== "admin" && ( //[cite: 9]
              <div className="rounded-2xl border border-amber-500/20 dark:border-amber-400/10 p-6 bg-gradient-to-br from-amber-500/[0.02] to-transparent shadow-sm space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.01] rounded-full blur-2xl group-hover:scale-120 transition-transform duration-500" />

                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Star
                      size={16}
                      className="text-amber-500 fill-amber-500/20"
                    />{" "}
                    Property Management Registry
                  </h2>
                  <span className="text-[9px] font-black tracking-widest uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                    Role Upgrade
                  </span>
                </div>

                {hostStatus === "approved" ? ( //[cite: 9]
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 leading-relaxed">
                    Excellent news! Your hosting privileges have been approved.
                    Refresh your workspace to see property configuration tools.
                  </p>
                ) : hostStatus === "pending" ? ( //[cite: 9]
                  <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs font-semibold text-amber-700 dark:text-amber-300 leading-relaxed">
                    Your application token is actively queued in our database
                    pending general administration clearance. We'll verify this
                    shortly.
                  </div>
                ) : hostStatus === "rejected" ? ( //[cite: 9]
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 leading-relaxed">
                      Your previous request to access host utilities was
                      declined by management review agents.
                    </p>
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      If your operational parameters have changed, feel free to
                      submit a revised clearance review.
                    </p>
                    <button
                      onClick={requestHost} //[cite: 9]
                      disabled={requestingHost} //[cite: 9]
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {requestingHost ? (
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Star size={13} />
                      )}{" "}
                      {/*[cite: 9] */}
                      Reapply for Operations Clearance
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                      Upgrading to a Host profile grants you backend access to
                      initiate structural room ledger splits, map custom utility
                      bill cycles, and monitor general resident accounts
                      balances.
                    </p>
                    <button
                      onClick={requestHost} //[cite: 9]
                      disabled={requestingHost} //[cite: 9]
                      className="px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 dark:border-amber-400/20 text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {requestingHost ? (
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Sparkles size={13} />
                      )}{" "}
                      {/*[cite: 9] */}
                      Request Host Dashboard Access
                    </button>
                  </div>
                )}
              </div>
            )}

          {/* Legal Registry Segment Directories */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/20">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Compliance & Registry Terms
              </h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              <Link
                to="/privacy-policy" //[cite: 9]
                className="flex items-center gap-3.5 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors group/link"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Shield size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover/link:text-[#1a7a52] dark:group-hover/link:text-[#7ee8a2] transition-colors">
                    Privacy Charter
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    How data architecture security logs manage privacy.
                  </p>
                </div>
                <ChevronRight
                  size={14}
                  className="text-slate-300 dark:text-slate-700 transform group-hover/link:translate-x-0.5 transition-transform"
                />{" "}
                {/*[cite: 9] */}
              </Link>

              <Link
                to="/terms-of-service" //[cite: 9]
                className="flex items-center gap-3.5 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors group/link"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover/link:text-[#1a7a52] dark:group-hover/link:text-[#7ee8a2] transition-colors">
                    Terms of Engagement
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    Usage parameters and standard workspace agreements.
                  </p>
                </div>
                <ChevronRight
                  size={14}
                  className="text-slate-300 dark:text-slate-700 transform group-hover/link:translate-x-0.5 transition-transform"
                />{" "}
                {/*[cite: 9] */}
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* App Integrity Footnote */}
      <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-700 pt-2">
        PropFlow Engine · v{appVersion} (Build 1) {/*[cite: 9] */}
      </p>
    </div>
  );
}
