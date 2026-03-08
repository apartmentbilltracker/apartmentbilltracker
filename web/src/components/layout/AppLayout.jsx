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
      <header className="bg-white dark:bg-dark-card border-b border-gray-100 dark:border-white/8 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src="/icon.png"
                alt="App logo"
                className="w-8 h-8 rounded-lg object-cover"
              />
              <span className="font-bold text-gray-900 dark:text-white hidden sm:block">
                Apt Bill Tracker
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, icon: Icon, label, exact }) => {
                const active = exact
                  ? location.pathname === to
                  : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side: profile avatar + mobile toggle grouped together */}
            <div className="flex items-center gap-1">
              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl px-2 py-1.5 transition-colors"
                >
                  <Avatar src={avatarSrc} name={user?.name || ""} size="sm" />
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-white/80 max-w-[120px] truncate">
                    {user?.name}
                  </span>
                  <ChevronDown
                    size={14}
                    className="text-gray-400 hidden sm:block"
                  />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 card shadow-lg py-1 z-50">
                    <Link
                      to="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <User size={15} /> Profile
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-white/8 bg-white dark:bg-dark-card px-4 py-3 space-y-1">
            {navItems.map(({ to, icon: Icon, label, exact }) => {
              const active = exact
                ? location.pathname === to
                : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-gray-600 dark:text-white/60"
                  }`}
                >
                  <Icon size={18} /> {label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400"
            >
              <LogOut size={18} /> Sign Out
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
            <span>
              Apartment Bill Tracker &copy; {new Date().getFullYear()}
            </span>
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
