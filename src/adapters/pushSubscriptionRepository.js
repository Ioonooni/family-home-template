export function createPushSubscriptionRepository(client) {
  return {
    async save(subscription) {
      const json = subscription.toJSON();
      const { error } = await client.from("push_subscriptions").insert({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      if (error && !error.message.includes("duplicate")) throw error;
    },
  };
}
