function clone(value) { return structuredClone(value); }

export function createInMemoryTransactionRepository(initial = []) {
  let sequence = 0;
  let items = initial.map((item, index) => ({
    ...clone(item),
    createdAt: item.createdAt || `2026-09-19T00:00:0${index}.000Z`,
    updatedAt: item.updatedAt || `2026-09-19T00:00:0${index}.000Z`,
  }));

  return {
    async list() { return clone(items); },
    async get(id) { return clone(items.find((item) => item.id === id) || null); },
    async create(draft) {
      const timestamp = new Date().toISOString();
      const item = { ...clone(draft), id: `memory-${Date.now()}-${sequence++}`, createdAt: timestamp, updatedAt: timestamp };
      items.push(item);
      return clone(item);
    },
    async update(id, draft) {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("ไม่พบรายการที่ต้องการแก้ไข");
      items[index] = { ...items[index], ...clone(draft), id, updatedAt: new Date().toISOString() };
      return clone(items[index]);
    },
    async delete(id) { items = items.filter((item) => item.id !== id); },
  };
}
