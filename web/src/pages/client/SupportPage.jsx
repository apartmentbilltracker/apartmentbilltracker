import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supportService } from "../../services/apiService";
import { Alert, EmptyState, StatusBadge } from "../../components/ui";
import {
  Plus,
  X,
  Send,
  ChevronDown,
  ChevronUp,
  LifeBuoy,
  Bug,
  MessageSquare,
  Sparkles,
  Activity,
  User,
  ArrowRight,
} from "lucide-react";

const TABS = ["Tickets", "Bug Reports"];

function NewTicketForm({ onSubmit, onCancel }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      setError(
        "Please provide both a summary subject and a description so we can help you effectively.",
      );
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ subject: subject.trim(), message: message.trim() });
    } catch (e) {
      setError(
        e?.data?.message ||
          e?.message ||
          "We ran into a small hitch creating your request. Please try once more.",
      );
    }
    setSubmitting(false);
  };

  return (
    <div className="rounded-3xl border-2 border-[#1a7a52]/30 dark:border-[#7ee8a2]/20 p-6 bg-white dark:bg-slate-900 shadow-xl animate-fadeIn space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 flex items-center justify-center text-[#1a7a52] dark:text-[#7ee8a2]">
            <LifeBuoy size={16} />
          </div>
          <h3 className="font-black text-slate-900 dark:text-white tracking-tight">
            Open a Support Case
          </h3>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X
            size={16}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          />
        </button>
      </div>

      {error && <Alert type="error" message={error} />}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
            Subject
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-4 py-3 text-sm focus:border-[#1a7a52] focus:ring-2 focus:ring-[#1a7a52]/10 dark:focus:border-[#7ee8a2] outline-none text-slate-900 dark:text-white transition-all"
            placeholder="Give your case a clear, brief title..."
          />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
            Message Details
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-4 py-3 text-sm focus:border-[#1a7a52] focus:ring-2 focus:ring-[#1a7a52]/10 dark:focus:border-[#7ee8a2] outline-none text-slate-900 dark:text-white transition-all resize-none"
            placeholder="Tell us what you're experiencing. Include any detail that might assist us..."
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-[#1a7a52] hover:bg-[#135c3d] dark:bg-[#7ee8a2] dark:hover:bg-[#64d08b] text-white dark:text-[#02302e] text-xs font-black flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={13} />
          )}
          Send Ticket
        </button>
      </div>
    </div>
  );
}

function NewBugForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      setError(
        "A descriptive title and summary are needed to log this interface issue.",
      );
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        steps: steps.trim(),
      });
    } catch (e) {
      setError(
        e?.data?.message ||
          e?.message ||
          "We could not submit your report at this time.",
      );
    }
    setSubmitting(false);
  };

  return (
    <div className="rounded-3xl border-2 border-[#1a7a52]/30 dark:border-[#7ee8a2]/20 p-6 bg-white dark:bg-slate-900 shadow-xl animate-fadeIn space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
            <Bug size={16} />
          </div>
          <h3 className="font-black text-slate-900 dark:text-white tracking-tight">
            Log an Interface Bug
          </h3>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X
            size={16}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          />
        </button>
      </div>

      {error && <Alert type="error" message={error} />}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
            Bug Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-4 py-3 text-sm focus:border-[#1a7a52] focus:ring-2 focus:ring-[#1a7a52]/10 dark:focus:border-[#7ee8a2] outline-none text-slate-900 dark:text-white transition-all"
            placeholder="What screen component or mechanism broke?"
          />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
            What is going wrong?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-4 py-3 text-sm focus:border-[#1a7a52] focus:ring-2 focus:ring-[#1a7a52]/10 dark:focus:border-[#7ee8a2] outline-none text-slate-900 dark:text-white transition-all resize-none"
            placeholder="Describe the unexpected app layout behavior..."
          />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
            Steps to Replicate{" "}
            <span className="text-slate-400 dark:text-slate-600 font-medium lowercase">
              (optional)
            </span>
          </label>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-4 py-3 text-sm focus:border-[#1a7a52] focus:ring-2 focus:ring-[#1a7a52]/10 dark:focus:border-[#7ee8a2] outline-none text-slate-900 dark:text-white transition-all resize-none"
            placeholder="e.g., 1. Click settings tab, 2. Toggle dark theme..."
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={13} />
          )}
          File Bug Report
        </button>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const { state } = useAuth();
  const { user } = state;
  const [tab, setTab] = useState(0);
  const [tickets, setTickets] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, bRes] = await Promise.allSettled([
        supportService.getMyTickets(),
        supportService.getMyBugReports(),
      ]);
      if (tRes.status === "fulfilled")
        setTickets(tRes.value?.tickets || tRes.value?.data || []);
      if (bRes.status === "fulfilled")
        setBugs(bRes.value?.bugs || bRes.value?.data || []);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const submitTicket = async (data) => {
    await supportService.createTicket(data);
    setSuccess("Got it! Your care ticket has been generated safely.");
    setShowForm(false);
    load();
  };

  const submitBug = async (data) => {
    await supportService.reportBug(data);
    setSuccess(
      "Excellent catch. Our systems team has logged this operational bug.",
    );
    setShowForm(false);
    load();
  };

  const items = tab === 0 ? tickets : bugs;

  /* Signature Premium Core Homepage Loading Ring Component */
  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-48 space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-16 h-16 rounded-2xl bg-[#1a7a52]/20 dark:bg-[#7ee8a2]/10 animate-ping duration-1000" />
          <div className="w-12 h-12 rounded-2xl border-2 border-slate-200 dark:border-slate-800 border-t-[#1a7a52] dark:border-t-[#7ee8a2] animate-spin" />
          <div className="absolute w-5 h-5 rounded-xl bg-gradient-to-br from-[#1a7a52] to-[#135c3d] dark:from-[#7ee8a2] dark:to-[#64d08b] shadow-md flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#02302e] animate-pulse" />
          </div>
        </div>
        <p className="text-xs font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase animate-pulse pt-2">
          Opening connection to concierge...
        </p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 px-4 animate-fadeIn">
      {/* Luxury Glassmorphic Header Block */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
        <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 blur-3xl group-hover:scale-110 transition-transform duration-700" />

        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-xs font-black text-[#1a7a52] dark:text-[#7ee8a2] tracking-wide uppercase">
            <Activity size={12} /> Support Concierge
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Help Desk & Diagnostics
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 max-w-xl">
            Need help configuring a utility split or notice an application
            component alignment issue? Get in touch with us directly.
          </p>
        </div>

        <button
          onClick={() => {
            setShowForm(true);
            setSuccess("");
            setError("");
          }}
          className="rounded-xl bg-[#1a7a52] text-white hover:bg-[#135c3d] dark:bg-[#7ee8a2] dark:text-[#02302e] dark:hover:bg-[#64d08b] text-xs font-black px-4 py-3 transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center"
        >
          <Plus size={14} />
          {tab === 0 ? "File Support Ticket" : "Report Layout Bug"}
        </button>
      </div>

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

      {showForm && (
        <div className="max-w-2xl mx-auto">
          {tab === 0 ? (
            <NewTicketForm
              onSubmit={submitTicket}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <NewBugForm
              onSubmit={submitBug}
              onCancel={() => setShowForm(false)}
            />
          )}
        </div>
      )}

      {/* Premium Minimal Bento Selector Cards */}
      <div className="grid grid-cols-2 gap-3">
        {TABS.map((t, i) => {
          const isActive = tab === i;
          return (
            <button
              key={t}
              onClick={() => {
                setTab(i);
                setShowForm(false);
              }}
              className={`p-5 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden ${
                isActive
                  ? "bg-white dark:bg-slate-900 border-[#1a7a52]/40 dark:border-[#7ee8a2]/40 shadow-sm ring-1 ring-[#1a7a52]/10 dark:ring-[#7ee8a2]/10"
                  : "bg-white/40 dark:bg-slate-900/20 border-slate-200/60 dark:border-slate-800/60 opacity-60 hover:opacity-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Operational Registry
                  </p>
                  <p
                    className={`text-base font-black mt-1 ${isActive ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}
                  >
                    {t}
                  </p>
                </div>
                <span
                  className={`text-lg font-black px-3 py-1 rounded-xl ${
                    isActive
                      ? "bg-[#1a7a52]/10 text-[#1a7a52] dark:bg-[#7ee8a2]/10 dark:text-[#7ee8a2]"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  {i === 0 ? tickets.length : bugs.length}
                </span>
              </div>
              {isActive && (
                <div className="absolute left-0 bottom-0 top-0 w-1 bg-[#1a7a52] dark:bg-[#7ee8a2]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Core Display Loop Streams */}
      {items.length === 0 ? (
        <EmptyState
          icon={
            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center text-slate-400">
              <MessageSquare size={24} />
            </div>
          }
          title="All clear right now"
          subtitle={`You haven't logged any open ${tab === 0 ? "support tickets" : "system bug reports"} yet.`}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const id = item.id || item._id;
            const isOpen = expanded === id;
            const title = item.subject || item.title;
            const body = item.message || item.description;
            const replies = item.replies || item.comments || [];

            return (
              <div
                key={id}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-md"
                    : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                }`}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : id)}
                  className="w-full p-5 flex items-center gap-4 text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">
                      {title}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-1">
                      Logged{" "}
                      {new Date(
                        item.created_at || item.createdAt,
                      ).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={item.status} />
                    <div className="text-slate-400">
                      {isOpen ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800/60 p-5 bg-slate-50/40 dark:bg-slate-900/40 space-y-4 animate-slideDown">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Initial Statement
                      </span>
                      <p className="text-sm leading-relaxed font-medium text-slate-700 dark:text-slate-300 whitespace-pre-line">
                        {body}
                      </p>
                    </div>

                    {item.steps && (
                      <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 space-y-1">
                        <p className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                          Steps to Reproduce Layout
                        </p>
                        <p className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400 whitespace-pre-line">
                          {item.steps}
                        </p>
                      </div>
                    )}

                    {/* Replies Pipeline section */}
                    {replies.length > 0 && (
                      <div className="border-t border-slate-200/60 dark:border-slate-800/80 pt-4 space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <MessageSquare size={10} /> Correspondence Timeline
                        </h4>

                        <div className="space-y-2.5 max-w-3xl">
                          {replies.map((r, i) => (
                            <div
                              key={i}
                              className="rounded-xl p-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 shadow-sm flex gap-3 items-start"
                            >
                              <div className="w-7 h-7 rounded-lg bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-[#1a7a52] dark:text-[#7ee8a2] flex items-center justify-center shrink-0 mt-0.5">
                                <User size={13} />
                              </div>
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-[#1a7a52] dark:text-[#7ee8a2]">
                                    {r.from || r.user?.name || "Desk Agent"}
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                                  <span className="text-[9px] font-bold uppercase text-slate-400">
                                    Response
                                  </span>
                                </div>
                                <p className="text-xs leading-relaxed font-semibold text-slate-600 dark:text-slate-300">
                                  {r.message || r.text || r.content}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
