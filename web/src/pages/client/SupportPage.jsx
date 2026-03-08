import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supportService } from '../../services/apiService';
import { Spinner, Alert, EmptyState, StatusBadge } from '../../components/ui';
import { Plus, X, Send, ChevronDown, ChevronUp } from 'lucide-react';

const TABS = ['Tickets', 'Bug Reports'];

function NewTicketForm({ onSubmit, onCancel }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!subject.trim() || !message.trim()) { setError('Both fields are required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ subject: subject.trim(), message: message.trim() });
    } catch (e) { setError(e?.data?.message || e?.message || 'Failed'); }
    setSubmitting(false);
  };

  return (
    <div className="card p-5 space-y-4 border-2 border-accent/30">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">New Support Ticket</h3>
        <button onClick={onCancel}><X size={16} className="text-gray-400 hover:text-gray-600" /></button>
      </div>
      {error && <Alert type="error" message={error} />}
      <div>
        <label className="label">Subject</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} className="input mt-1" placeholder="Brief description…" />
      </div>
      <div>
        <label className="label">Message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="input mt-1 resize-none" placeholder="Describe your issue…" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button onClick={submit} disabled={submitting} className="btn-primary text-sm flex items-center gap-1.5">
          {submitting ? <Spinner size="sm" /> : <Send size={14} />}Submit
        </button>
      </div>
    </div>
  );
}

function NewBugForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!title.trim() || !description.trim()) { setError('Title and description are required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), steps: steps.trim() });
    } catch (e) { setError(e?.data?.message || e?.message || 'Failed'); }
    setSubmitting(false);
  };

  return (
    <div className="card p-5 space-y-4 border-2 border-accent/30">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Report a Bug</h3>
        <button onClick={onCancel}><X size={16} className="text-gray-400 hover:text-gray-600" /></button>
      </div>
      {error && <Alert type="error" message={error} />}
      <div>
        <label className="label">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="input mt-1" placeholder="Short bug title…" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="input mt-1 resize-none" placeholder="What happened?" />
      </div>
      <div>
        <label className="label">Steps to Reproduce <span className="text-gray-400 text-xs">(optional)</span></label>
        <textarea value={steps} onChange={e => setSteps(e.target.value)} rows={2} className="input mt-1 resize-none" placeholder="1. Go to… 2. Click…" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button onClick={submit} disabled={submitting} className="btn-primary text-sm flex items-center gap-1.5">
          {submitting ? <Spinner size="sm" /> : <Send size={14} />}Submit
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, bRes] = await Promise.allSettled([
        supportService.getMyTickets(),
        supportService.getMyBugReports(),
      ]);
      if (tRes.status === 'fulfilled') setTickets(tRes.value?.tickets || tRes.value?.data || []);
      if (bRes.status === 'fulfilled') setBugs(bRes.value?.bugs || bRes.value?.data || []);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const submitTicket = async (data) => {
    await supportService.createTicket(data);
    setSuccess('Ticket submitted!');
    setShowForm(false);
    load();
  };

  const submitBug = async (data) => {
    await supportService.reportBug(data);
    setSuccess('Bug report submitted!');
    setShowForm(false);
    load();
  };

  const items = tab === 0 ? tickets : bugs;

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" className="text-accent" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Support</h1>
        <button onClick={() => { setShowForm(true); setSuccess(''); setError(''); }} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={14} />{tab === 0 ? 'New Ticket' : 'Report Bug'}
        </button>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

      {showForm && (
        tab === 0
          ? <NewTicketForm onSubmit={submitTicket} onCancel={() => setShowForm(false)} />
          : <NewBugForm onSubmit={submitBug} onCancel={() => setShowForm(false)} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-dark-card rounded-xl">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => { setTab(i); setShowForm(false); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === i ? 'bg-white dark:bg-dark-bg shadow text-accent' : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'}`}
          >
            {t} {i === 0 ? `(${tickets.length})` : `(${bugs.length})`}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState icon="🎫" title={`No ${tab === 0 ? 'tickets' : 'bug reports'} yet`} subtitle="Submit one if you need help" />
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const id = item.id || item._id;
            const isOpen = expanded === id;
            const title = item.subject || item.title;
            const body = item.message || item.description;
            const replies = item.replies || item.comments || [];
            return (
              <div key={id} className="card overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : id)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{title}</p>
                    <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                      {new Date(item.created_at || item.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                  {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-white/8 p-4 bg-gray-50/50 dark:bg-white/3 space-y-3">
                    <p className="text-sm text-gray-700 dark:text-white/70 whitespace-pre-line">{body}</p>
                    {item.steps && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-white/40 mb-1">STEPS TO REPRODUCE</p>
                        <p className="text-sm text-gray-700 dark:text-white/70 whitespace-pre-line">{item.steps}</p>
                      </div>
                    )}
                    {replies.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-white/10 pt-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-500 dark:text-white/40">REPLIES</p>
                        {replies.map((r, i) => (
                          <div key={i} className="text-sm bg-white dark:bg-dark-card rounded-lg p-3 border border-gray-100 dark:border-white/8">
                            <p className="text-xs font-medium text-accent mb-1">{r.from || r.user?.name || 'Support'}</p>
                            <p className="text-gray-700 dark:text-white/70">{r.message || r.text || r.content}</p>
                          </div>
                        ))}
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
