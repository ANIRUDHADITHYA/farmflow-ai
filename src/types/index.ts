export interface User {
  id: string;
  name: string;
  phone: string;
  farm_name: string;
  created_at: string;
}

export interface Animal {
  id: string;
  tag_number: string;
  type: string;
  status: 'active' | 'sold' | 'deceased';
  created_at: string;
}

export interface Treatment {
  id: string;
  animal_id: string;
  medicine: string;
  dosage: string;
  withdrawal_hours: number;
  batch_number: string;
  created_at: string;
  animal?: Animal;
}

export interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  image_url: string;
  supplier: string;
  amount: number;
  extracted_json: Record<string, unknown>;
  created_at: string;
}

export interface Reminder {
  id: string;
  title: string;
  due_date: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  type: 'treatment' | 'inventory' | 'invoice' | 'reminder' | string;
  description: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: string[];
  intent?: string;
  quickReplies?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  intent: string | null;
  attachments: string[] | null;
  quick_replies: string[] | null;
  created_at: string;
}

export interface AIResponse {
  intent: string;
  data: Record<string, unknown>;
  follow_up_questions?: string[];
  message?: string;
}

export type TabType = 'home' | 'chat' | 'animals' | 'inventory' | 'reports';

export interface DashboardStats {
  lowStockCount: number;
  pendingReminders: number;
  todayTreatments: number;
  totalActivities: number;
  totalAnimals: number;
  totalExpenses: number;
}