export const ACTION_LABEL: Record<string, string> = {
  'article.registered': 'Registered',
  'article.edited': 'Edited before verification',
  'article.corrected_resubmitted': 'Corrected and resubmitted',
  'article.approved': 'Verified and approved',
  'article.returned': 'Returned for correction',
  'article.amended': 'Amended after approval',
  'article.cancelled': 'Cancelled',
  'photo.added': 'Photo added',
  'photo.removed': 'Photo removed',
  'auth.login': 'Logged in',
  'auth.logout': 'Logged out',
  'auth.login_failed': 'Failed login attempt',
  'auth.password_changed': 'Changed own password',
  'user.bootstrap': 'Super Administrator created at first start',
  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.password_reset': 'Password reset by administrator',
  'category.create': 'Category added',
  'category.update': 'Category changed',
};

export const FIELD_LABEL: Record<string, string> = {
  metal: 'Metal', category_id: 'Category', article_type: 'Article type', description: 'Description', quantity: 'Quantity',
  gross_weight: 'Gross weight (g)', net_weight: 'Net weight (g)', purity: 'Purity', purity_remarks: 'Purity remarks',
  source: 'Source', receipt_ref: 'Receipt reference', received_at: 'Received at', donor_name: 'Donor name',
  donor_mobile: 'Donor mobile', donor_address: 'Donor address', remarks: 'Remarks', weighed_by: 'Weighed by', items: 'Individual weights',
  name: 'Name', role: 'Role', active: 'Active', designation: 'Designation', mobile: 'Mobile',
};

const fmt = (v: unknown): string => {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.map((i: { weight?: number }) => `${i.weight ?? '?'} g`).join(', ') || '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** One-line human summary of an audit entry's details. */
export function auditSummary(details: Record<string, unknown> | null): string {
  if (!details) return '';
  const parts: string[] = [];
  const changes = details.changes as Record<string, { from: unknown; to: unknown }> | undefined;
  if (details.reason) parts.push(`Reason: ${details.reason}`);
  if (details.remarks) parts.push(`Remarks: ${details.remarks}`);
  if (changes) {
    for (const [k, c] of Object.entries(changes)) parts.push(`${FIELD_LABEL[k] || k}: ${fmt(c.from)} → ${fmt(c.to)}`);
  }
  if (details.gross_weight != null && !changes) parts.push(`${details.quantity} pc, ${details.gross_weight} g`);
  if (details.username) parts.push(`User: ${details.username}`);
  if (details.role && !changes) parts.push(`Role: ${details.role}`);
  if (details.name && !details.username && !changes) parts.push(String(details.name));
  if (details.sha256) parts.push(`file ${String(details.sha256).slice(0, 10)}…`);
  if (details.purity && !changes && !details.gross_weight) parts.push(`Purity: ${details.purity}`);
  if (details.locked) parts.push('Account locked for 15 minutes');
  return parts.join(' · ');
}
