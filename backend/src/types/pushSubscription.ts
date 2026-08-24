export interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
}

export interface NewPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}
