import type { Database } from './database';

type PublicSchema = Database['public'];
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export type Role = Enums<'user_role'>;
export type ItemKind = Enums<'item_kind'>;
export type ReviewStatus = Enums<'review_status'>;
export type SolveStatus = Enums<'solve_status'>;
export type ConnectionStatus = Enums<'connection_status'>;
export type RequestDirection = Enums<'request_direction'>;
export type TagKind = Enums<'tag_kind'>;

export type Tag = Pick<Tables<'tags'>, 'id' | 'kind' | 'name' | 'slug'>;
export type ConnectionDashboardRow = Views<'v_connection_dashboard'>;
export type ModerationQueueRow = Views<'v_moderation_queue'>;

// Kết quả chung của mọi Server Action dùng với useActionState
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
} | null;
