import { describe, expect, it } from "vitest";
import { daysUntil, filterTasks, localDateString, summarizeTasks, urgencyFor } from "./task.js";

const now = new Date(2026, 8, 19, 12);
const tasks = [
  { id: "1", title: "วันนี้", category: "home", duedate: "2026-09-19", status: "pending", details: {} },
  { id: "2", title: "พรุ่งนี้", category: "work", duedate: "2026-09-20", status: "pending", details: { note: "ประชุม" } },
  { id: "3", title: "เสร็จ", category: "home", duedate: "2026-09-10", status: "done", details: {} },
];

describe("task domain", () => {
  it("formats local dates without UTC shifting", () => {
    expect(localDateString(now)).toBe("2026-09-19");
  });

  it("calculates day distance", () => {
    expect(daysUntil("2026-09-20", now)).toBe(1);
  });

  it("filters by status, category and search", () => {
    expect(filterTasks(tasks, { filter: "pending", now })).toHaveLength(2);
    expect(filterTasks(tasks, { categories: new Set(["home"]), now })).toHaveLength(2);
    expect(filterTasks(tasks, { search: "ประชุม", now }).map((task) => task.id)).toEqual(["2"]);
  });

  it("summarizes dashboard counts", () => {
    expect(summarizeTasks(tasks, now)).toEqual({ today: 1, tomorrow: 1, week: 2, month: 2, expiring: 0, pending: 2 });
  });

  it("does not show urgency for completed tasks", () => {
    expect(urgencyFor(tasks[2], now)).toBeNull();
  });
});
