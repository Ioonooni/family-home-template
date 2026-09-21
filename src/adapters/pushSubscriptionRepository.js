export function createPushSubscriptionRepository(client) {
  return {
    async save(subscription) {
      const json = subscription.toJSON();
      const { error } = await client.from("push_subscriptions").upsert({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }, { onConflict: "owner_id,endpoint" });
      if (error) throw error;
    },
  };
}
