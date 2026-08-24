import { get, post } from "./api";

interface PublicKeyResponse {
  publicKey: string;
}

export function fetchVapidPublicKey(): Promise<PublicKeyResponse> {
  return get<PublicKeyResponse>("/api/push/public-key");
}

export function registerSubscription(subscription: PushSubscriptionJSON): Promise<unknown> {
  return post("/api/push/subscribe", subscription);
}

export function removeSubscription(endpoint: string): Promise<unknown> {
  return post("/api/push/unsubscribe", { endpoint });
}

export function sendTestPush(): Promise<{ sent: number }> {
  return post<{ sent: number }>("/api/push/test");
}
