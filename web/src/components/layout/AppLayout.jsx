import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../ui";
import { useAppVersion } from "../../hooks/useAppVersion";
import {
  Home,
  FileText,
  Bell,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Megaphone,
  Calendar,
  HelpCircle,
  CheckSquare,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", icon: Home, label: "Home", exact: true },
  { to: "/bills", icon: FileText, label: "Bills" },
  { to: "/billing-history", icon: Calendar, label: "History" },
  { to: "/announcements", icon: Megaphone, label: "Announcements" },
  { to: "/presence", icon: CheckSquare, label: "Presence" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/support", icon: HelpCircle, label: "Support" },
];

export default function AppLayout() {
  const { state, signOut } = useAuth();
  const { user } = state;
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const appVersion = useAppVersion();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const avatarSrc = user?.avatar
    ? typeof user.avatar === "string"
      ? user.avatar.startsWith("{")
        ? JSON.parse(user.avatar)?.url
        : user.avatar
      : user.avatar?.url
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex flex-col">
      {/* ── Top Navbar ── */}
      {/* ── Top Navbar ── */}
      <header className="sticky top-0 z-40 w-full transition-all duration-300 border-b backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-100 dark:border-slate-800/60 shadow-sm shadow-slate-100/20 dark:shadow-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Brand Identity / Logo Node */}
            <Link
              to="/"
              className="flex items-center gap-3 group active:scale-[0.98] transition-transform duration-200"
            >
              <div className="relative p-[1.5px] rounded-xl bg-gradient-to-tr from-[#1a7a52] to-[#7ee8a2] shadow-sm shrink-0">
                <img
                  src="/icon.png"
                  alt="Property Flow Logo"
                  className="w-8 h-8 rounded-[10px] object-cover ring-2 ring-white dark:ring-slate-900"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-slate-900 dark:text-white hidden sm:block tracking-tight leading-tight group-hover:text-[#1a7a52] dark:group-hover:text-[#7ee8a2] transition-colors duration-200">
                  Property Flow
                </span>
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase hidden sm:block leading-none mt-0.5">
                  Dashboard
                </span>
              </div>
            </Link>

            {/* Desktop Command Center Navigation */}
            <nav className="hidden md:flex items-center gap-1.5">
              {navItems.map(({ to, icon: Icon, label, exact }) => {
                const active = exact
                  ? location.pathname === to
                  : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs tracking-tight transition-all duration-200 group relative ${
                      active
                        ? "bg-[#1a7a52]/8 dark:bg-[#7ee8a2]/10 text-[#02302e] dark:text-[#7ee8a2] font-black border border-[#1a7a52]/10 dark:border-[#7ee8a2]/20"
                        : "text-slate-600 dark:text-slate-300 font-bold hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon
                      size={15}
                      className={`transition-transform duration-200 group-hover:scale-110 ${
                        active
                          ? "text-[#1a7a52] dark:text-[#7ee8a2]"
                          : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                      }`}
                    />
                    {label}

                    {/* Micro Active Bottom Border Bar */}
                    {active && (
                      <span className="absolute bottom-[-14px] left-4 right-4 h-[2px] rounded-full bg-[#1a7a52] dark:bg-[#7ee8a2]" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Control Block Group: User Matrix & Mobile Trigger */}
            <div className="flex items-center gap-2">
              {/* Architectural Profile Dropdown Node */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className={`flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl border transition-all duration-200 select-none ${
                    profileOpen
                      ? "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-inner"
                      : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-100 dark:hover:border-slate-800"
                  }`}
                >
                  <div className="p-[1px] rounded-xl bg-slate-200 dark:bg-slate-700 shadow-sm shrink-0">
                    <Avatar
                      src={avatarSrc}
                      name={user?.name || ""}
                      size="sm"
                      className="ring-2 ring-white dark:ring-slate-900 rounded-[10px]"
                    />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-black text-slate-800 dark:text-white max-w-[110px] truncate leading-tight">
                      {user?.name}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mt-0.5">
                      Tenant
                    </p>
                  </div>
                  <ChevronDown
                    size={13}
                    className={`text-slate-400 dark:text-slate-500 hidden sm:block transition-transform duration-200 shrink-0 ${
                      profileOpen
                        ? "rotate-180 text-slate-600 dark:text-slate-300"
                        : ""
                    }`}
                  />
                </button>

                {/* Elevated Floating Profile Panel Context */}
                {profileOpen && (
                  <>
                    {/* Backdrop Overlay Dismissal Capture */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileOpen(false)}
                    />

                    <div className="absolute right-0 mt-2.5 w-56 rounded-2xl border bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 shadow-2xl shadow-slate-950/10 dark:shadow-black/40 overflow-hidden py-1.5 z-50 animate-fadeIn origin-top-right">
                      {/* Meta Micro Header Segment inside Dropdown */}
                      <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20 mb-1">
                        <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase leading-none">
                          Logged In As
                        </p>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate mt-1">
                          {user?.name || "System Resident"}
                        </p>
                      </div>

                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-xs font-black text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <User
                          size={14}
                          className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600"
                        />
                        Manage Profile
                      </Link>

                      <div className="h-px bg-slate-50 dark:bg-slate-800/50 my-1" />

                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left"
                      >
                        <LogOut
                          size={14}
                          className="text-rose-400 dark:text-rose-500"
                        />
                        Terminate Session
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Tactile Mobile Menu Menu Toggle */}
              <button
                className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center border transition-all active:scale-95 ${
                  mobileOpen
                    ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-inner"
                    : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle Navigation Control Dropdown"
              >
                {mobileOpen ? (
                  <X size={18} className="stroke-[2.5]" />
                ) : (
                  <Menu size={18} className="stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Immersive Mobile Navigation Overlay */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 space-y-1.5 shadow-xl shadow-slate-950/5 animate-slideDown">
            {navItems.map(({ to, icon: Icon, label, exact }) => {
              const active = exact
                ? location.pathname === to
                : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black transition-all ${
                    active
                      ? "bg-[#1a7a52]/8 dark:bg-[#7ee8a2]/10 text-[#02302e] dark:text-[#7ee8a2] border border-[#1a7a52]/10 dark:border-[#7ee8a2]/20 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Icon
                    size={16}
                    className={
                      active
                        ? "text-[#1a7a52] dark:text-[#7ee8a2]"
                        : "text-slate-400 dark:text-slate-500"
                    }
                  />
                  {label}
                </Link>
              );
            })}

            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

            <button
              onClick={() => {
                setMobileOpen(false);
                handleSignOut();
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/10 transition-colors text-left"
            >
              <LogOut size={16} className="text-rose-400 dark:text-rose-500" />
              Terminate Session
            </button>
          </div>
        )}
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 dark:border-white/8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 dark:text-white/30">
          <div className="flex items-center gap-2">
            <img
              src="/icon.png"
              alt="logo"
              className="w-5 h-5 rounded-md object-cover opacity-60"
            />
            <span>PropFlow &copy; {new Date().getFullYear()}</span>
            <span className="hidden sm:inline text-gray-200 dark:text-white/10">
              ·
            </span>
            <span className="hidden sm:inline">v{appVersion} (build 1)</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/privacy-policy"
              className="hover:text-accent transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-of-service"
              className="hover:text-accent transition-colors"
            >
              Terms of Service
            </Link>
            <Link to="/support" className="hover:text-accent transition-colors">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
