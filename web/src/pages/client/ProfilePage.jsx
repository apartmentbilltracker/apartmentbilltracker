import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { roomService, hostRoleService } from "../../services/apiService";
import { useAppVersion } from "../../hooks/useAppVersion";
import { Spinner, Alert, Avatar } from "../../components/ui";
import {
  Camera,
  Save,
  LogOut,
  Star,
  Shield,
  FileText,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function ProfilePage() {
  const { state, updateUserProfile, signOut: logout } = useAuth();
  const { user } = state;
  const navigate = useNavigate();
  const userId = user?.id || user?._id;
  const appVersion = useAppVersion();
  const [name, setName] = useState(user?.name || "");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarBase64, setAvatarBase64] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPayer, setIsPayer] = useState(null);
  const [hostStatus, setHostStatus] = useState(null);
  const [requestingHost, setRequestingHost] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    // Load payer status
    roomService
      .getClientRooms()
      .then((res) => {
        const rooms = Array.isArray(res) ? res : res?.rooms || [];
        const room = rooms[0] || null;
        if (room) {
          const member = room.members?.find(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId),
          );
          if (member) setIsPayer(member.isPayer ?? member.is_payer ?? false);
        }
      })
      .catch(() => {});
    // Load host request status
    if (user?.role !== "host" && user?.role !== "admin") {
      hostRoleService
        .getHostStatus()
        .then((res) => {
          setHostStatus(res?.hostRequestStatus || res?.status || null);
        })
        .catch(() => {});
    }
  }, [userId]);

  const avatarSrc =
    avatarPreview ||
    (() => {
      const a = user?.avatar;
      if (!a) return null;
      if (typeof a === "string")
        return a.startsWith("{") ? JSON.parse(a)?.url : a;
      return a?.url;
    })();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target.result);
      setAvatarBase64(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const requestHost = async () => {
    setRequestingHost(true);
    try {
      await hostRoleService.requestHost();
      setHostStatus("pending");
      setSuccess("Host request submitted!");
    } catch (e) {
      setError(e?.message || "Failed to submit request");
    }
    setRequestingHost(false);
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      await logout?.();
      navigate("/login");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateUserProfile(name.trim(), avatarBase64);
      setSuccess("Profile updated successfully!");
      setAvatarBase64(null);
    } catch (e) {
      setError(e?.data?.message || e?.message || "Failed to update profile");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        Profile
      </h1>

      {error && (
        <Alert type="error" message={error} onDismiss={() => setError("")} />
      )}
      {success && (
        <Alert
          type="success"
          message={success}
          onDismiss={() => setSuccess("")}
        />
      )}

      {/* Avatar */}
      <div className="card p-6 flex flex-col items-center gap-4">
        <div className="relative">
          <Avatar src={avatarSrc} name={user?.name || ""} size="xl" />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 bg-accent text-black rounded-full flex items-center justify-center shadow-lg hover:bg-accent-dark transition-colors"
          >
            <Camera size={14} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900 dark:text-white">
            {user?.name}
          </p>
          <p className="text-sm text-gray-500 dark:text-white/40">
            {user?.email}
          </p>
          <span className="badge mt-1 capitalize">
            {user?.role || "client"}
          </span>
        </div>
      </div>

      {/* Edit form */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Edit Info
        </h2>
        <div>
          <label className="label">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input mt-1"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={user?.email || ""}
            disabled
            className="input mt-1 opacity-60 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
            Email cannot be changed here
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          {saving ? <Spinner size="sm" /> : <Save size={15} />}
          Save Changes
        </button>
      </div>

      {/* Account info */}
      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Account Info
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 dark:text-white/40">Member since</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {user?.createdAt || user?.created_at
                ? new Date(
                    user.createdAt || user.created_at,
                  ).toLocaleDateString("en-PH", {
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-white/40">Role</p>
            <p className="font-medium text-gray-900 dark:text-white capitalize">
              {user?.role || "client"}
            </p>
          </div>
          {isPayer !== null && (
            <div>
              <p className="text-gray-500 dark:text-white/40">Room Status</p>
              <p
                className={`font-medium capitalize ${isPayer ? "text-accent" : "text-gray-900 dark:text-white"}`}
              >
                {isPayer ? "Payer" : "Non-payer"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Become a Host */}
      {user?.role !== "host" && user?.role !== "admin" && (
        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Star size={16} className="text-amber-500" /> Become a Host
          </h2>
          {hostStatus === "approved" ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              Your host request has been approved!
            </p>
          ) : hostStatus === "pending" ? (
            <p className="text-sm text-amber-600 dark:text-amber-300">
              Your request is pending review by an admin.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-white/40">
                Hosts can manage rooms, set billing cycles, and track payments.
              </p>
              <button
                onClick={requestHost}
                disabled={requestingHost}
                className="btn-secondary flex items-center gap-2"
              >
                {requestingHost ? <Spinner size="sm" /> : <Star size={14} />}
                Request to Become a Host
              </button>
            </>
          )}
        </div>
      )}

      {/* Legal */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-white/8">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
            Legal
          </h2>
        </div>
        <Link
          to="/privacy-policy"
          className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/8"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <Shield size={15} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800 dark:text-white">
              Privacy Policy
            </p>
            <p className="text-xs text-gray-400 dark:text-white/30">
              How we handle your data
            </p>
          </div>
          <ChevronRight
            size={15}
            className="text-gray-300 dark:text-white/20"
          />
        </Link>
        <Link
          to="/terms-of-service"
          className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
            <FileText size={15} className="text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800 dark:text-white">
              Terms of Service
            </p>
            <p className="text-xs text-gray-400 dark:text-white/30">
              Rules and usage agreement
            </p>
          </div>
          <ChevronRight
            size={15}
            className="text-gray-300 dark:text-white/20"
          />
        </Link>
      </div>

      {/* App version */}
      <p className="text-center text-xs text-gray-300 dark:text-white/20 pb-2">
        Apartment Bill Tracker · v{appVersion} (build 1)
      </p>

      {/* Logout */}
      <div className="card p-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 dark:hover:text-red-400 font-medium text-sm py-2 transition-colors"
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </div>
  );
}
