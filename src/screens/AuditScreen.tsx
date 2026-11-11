import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api';
import { Empty, ErrorBox, Loading, PageHeader, ROLE_LABEL } from '../components/ui';
import { dateTime, istDay, istDayEnd, istDayStart } from '../format';
import { ACTION_LABEL, auditSummary } from '../utils/audit';
import type { AuditEntry } from '../types';

const GROUPS = [['', 'All activity'], ['article', 'Articles'], ['photo', 'Photos'], ['auth', 'Logins'], ['user', 'Users'], ['category', 'Categories']];

export default function AuditScreen() {
  const today = istDay();
  const [from, setFrom] = useState(new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [action, setAction] = useState('');
  const [articleNo, setArticleNo] = useState('');
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setRows(null);
    const id = setTimeout(() => api.get<AuditEntry[]>(`/audit${qs({ from: istDayStart(from), to: istDayEnd(to), action, article_no: articleNo || undefined })}`)
      .then(setRows).catch((e) => setErr(e.message)), 250);
    return () => clearTimeout(id);
  }, [from, to, action, articleNo]);

  return (
    <div>
      <PageHeader title="Audit trail" kn="ಲೆಕ್ಕಪರಿಶೋಧನಾ ದಾಖಲೆ" subtitle="Append-only record of every action in the system. Entries can never be edited or deleted." />
      <div className="card mb-5 grid gap-3 p-4 tablet:grid-cols-4">
        <input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>{GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input className="input font-mono uppercase" placeholder="Article ID" value={articleNo} onChange={(e) => setArticleNo(e.target.value.toUpperCase().trim())} />
      </div>
      <ErrorBox>{err}</ErrorBox>
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title="No activity in this period" /> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>When</th><th>Officer</th><th>Action</th><th>Article</th><th>Details</th><th>IP</th></tr></thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap text-charcoal/70">{dateTime(h.at)}</td>
                  <td className="whitespace-nowrap">{h.user_name || 'System'}{h.user_role && <div className="text-xs text-charcoal/50">{ROLE_LABEL[h.user_role]?.en}</div>}</td>
                  <td className={`whitespace-nowrap font-semibold ${h.action === 'auth.login_failed' ? 'text-red-700' : h.action === 'article.approved' ? 'text-emerald-700' : ''}`}>{ACTION_LABEL[h.action] || h.action}</td>
                  <td className="whitespace-nowrap font-mono">{h.article_no ? <Link className="text-maroon-700 hover:underline" to={`/articles/${h.article_no}`}>{h.article_no}</Link> : '—'}</td>
                  <td className="min-w-[260px] text-xs text-charcoal/80">{h.action === 'article.registered' ? `${(h.details as { quantity?: number })?.quantity ?? ''} pc, ${(h.details as { gross_weight?: number })?.gross_weight ?? ''} g` : auditSummary(h.details)}</td>
                  <td className="whitespace-nowrap text-xs text-charcoal/50">{h.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
