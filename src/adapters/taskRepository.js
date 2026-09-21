export function createTaskRepository(client) {
  return {
    async list() {
      const { data, error } = await client.from("tasks").select("*").order("duedate", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async create(payload) {
      const { error } = await client.from("tasks").insert({ ...payload, status: "pending" });
      if (error) throw error;
    },
    async update(id, payload) {
      const { error } = await client.from("tasks").update(payload).eq("id", id);
      if (error) throw error;
    },
    async updateStatus(id, status) {
      const { error } = await client.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    async delete(id) {
      const { error } = await client.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    subscribe(onChange) {
      const channel = client.channel("tasks-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
        .subscribe();
      return () => client.removeChannel(channel);
    },
  };
}
