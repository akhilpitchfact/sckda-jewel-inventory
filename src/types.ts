export type Role = 'superadmin' | 'inventory' | 'verifier' | 'accounts' | 'management';
export type Metal = 'gold' | 'silver';
export type Source = 'hundi' | 'seva';
export type Status = 'pending' | 'returned' | 'approved' | 'cancelled';

export interface User {
  id: number; username: string; name: string; designation?: string | null; role: Role; mustChangePassword: boolean;
}

export interface Category { id: number; metal: Metal; name: string; name_kn: string | null; active: number; sort: number }

export interface Article {
  id: number; article_no: string; metal: Metal; category_id: number; category_name: string; category_name_kn: string | null;
  article_type: string | null; description: string; quantity: number; gross_weight: number; net_weight: number | null;
  purity: string | null; purity_remarks: string | null; source: Source; receipt_ref: string | null; received_at: string;
  donor_name: string | null; donor_mobile: string | null; donor_address: string | null; donor_hidden?: boolean;
  remarks: string | null; weighed_by: string | null; status: Status; return_remarks: string | null;
  verified_by: number | null; verified_by_name: string | null; verified_at: string | null; verification_remarks: string | null;
  cancel_reason: string | null; created_by: number; created_by_name: string; created_at: string;
  updated_by: number | null; updated_by_name: string | null; updated_at: string | null;
  photo_count: number; cover_photo_id: number | null;
}

export interface ArticleItem { id?: number; line_no?: number; description: string | null; weight: number }
export interface Photo { id: number; caption: string | null; size: number; uploaded_at: string; uploaded_by_name: string }
export interface AuditEntry {
  id: number; at: string; user_id: number | null; user_name: string | null; user_role: Role | null; action: string;
  entity: string; entity_id: number | null; article_no: string | null; details: Record<string, unknown> | null; ip: string | null;
}
