export type UserRole = "member" | "admin";

export type WalletMode = "free" | "linked";

export type PaymentProvider = "cashapp" | "robinhood";

export type ConnectionStatus = "connected" | "disconnected";

export type MarketStatus = "proposed" | "live" | "resolved" | "cancelled";

export type OutcomeSide = "yes" | "no";

export type OrderStatus = "open" | "partial" | "filled" | "cancelled";

export type LedgerKind =
  | "grant"
  | "reserve"
  | "release"
  | "trade"
  | "settlement";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  wallet_mode: WalletMode;
  balance_cents: number;
  reserved_cents: number;
  created_at: string;
}

export interface PaymentConnection {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  handle: string;
  status: ConnectionStatus;
  display_name: string | null;
  connected_at: string;
  disconnected_at: string | null;
}

export interface Invite {
  email: string;
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
}

export interface Market {
  id: string;
  question: string;
  description: string | null;
  status: MarketStatus;
  created_by: string;
  resolved_outcome: OutcomeSide | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  creator?: Pick<Profile, "id" | "email" | "display_name">;
  confirmation_count?: number;
  last_trade_price?: number | null;
}

export interface Order {
  id: string;
  market_id: string;
  user_id: string;
  side: OutcomeSide;
  price_cents: number;
  qty: number;
  filled_qty: number;
  status: OrderStatus;
  created_at: string;
}

export interface Trade {
  id: string;
  market_id: string;
  yes_order_id: string;
  no_order_id: string;
  yes_user_id: string;
  no_user_id: string;
  price_cents: number;
  qty: number;
  created_at: string;
}

export interface Position {
  market_id: string;
  user_id: string;
  yes_qty: number;
  no_qty: number;
  yes_cost_cents: number;
  no_cost_cents: number;
  updated_at: string;
  market?: Market;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  amount_cents: number;
  kind: LedgerKind;
  ref_id: string | null;
  note: string | null;
  created_at: string;
}

export interface OrderBookLevel {
  price_cents: number;
  qty: number;
}

export interface OrderBook {
  yes_bids: OrderBookLevel[];
  no_bids: OrderBookLevel[];
}
