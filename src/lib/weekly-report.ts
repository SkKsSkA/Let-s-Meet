import "server-only";
import { eventStartIso } from "./event-agent";
import { APP_TZ, formatMoney, KINDS } from "./format";
import { getAdminSupabase } from "./supabase/admin";

const weekdays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: APP_TZ, dateStyle: "short" });
const displayDate = new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", dateStyle: "short" });
const demoSlugPattern = "demo-%";
const pageSize = 500;

function weekBounds(now: Date) {
  const endDay = new Date(localDate.format(now) + "T00:00:00Z");
  endDay.setUTCDate(endDay.getUTCDate() - (endDay.getUTCDay() + 6) % 7);
  const startDay = new Date(endDay);
  startDay.setUTCDate(startDay.getUTCDate() - 7);
  const lastDay = new Date(endDay);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);

  const start = eventStartIso(startDay.toISOString().slice(0, 16));
  const end = eventStartIso(endDay.toISOString().slice(0, 16));
  if (!start || !end) throw new Error("Could not determine report period");

  return {
    start, end,
    period: `${displayDate.format(startDay)}–${displayDate.format(lastDay)}`,
  };
}

async function readPages<Row extends { id: string }>(
  page: (cursor: string | undefined) => PromiseLike<{ data: Row[] | null; error: unknown }>,
) {
  const rows: Row[] = [];
  let cursor: string | undefined;
  for (;;) {
    const { data, error } = await page(cursor);
    if (error || !data) throw new Error("Report query failed");
    if (data.length === 0) return rows;
    rows.push(...data);
    cursor = data[data.length - 1].id;
  }
}

function ranking(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b, "ru")).slice(0, 5);
}

function eventKind(kind: string | null) {
  return KINDS.find(value => value === kind) ?? "Другое";
}

function table(heading: string, rows: [string, number][]) {
  return [`### ${heading}`, "", ...(rows.length ? [
    "| Категория | Количество |",
    "| --- | ---: |",
    ...rows.map(([label, count]) => `| ${label} | ${count} |`),
  ] : ["За этот период данных нет."]), ""].join("\n");
}

export async function buildWeeklyReport(db: NonNullable<ReturnType<typeof getAdminSupabase>>, now = new Date()) {
  const { start, end, period } = weekBounds(now);
  const totalCount = db.from("events").select("id", { count: "exact", head: true })
    .lt("created_at", end).not("slug", "like", demoSlugPattern);
  const newCount = db.from("events").select("id", { count: "exact", head: true })
    .gte("created_at", start).lt("created_at", end).not("slug", "like", demoSlugPattern);

  const [total, created, events, contributions, agent] = await Promise.all([
    totalCount, newCount,
    readPages(cursor => {
      const query = db.from("events").select("id,kind,starts_at").gte("starts_at", start).lt("starts_at", end)
        .not("slug", "like", demoSlugPattern).order("id").limit(pageSize);
      return cursor ? query.gt("id", cursor) : query;
    }),
    readPages(cursor => {
      const query = db.from("contributions").select("id,amount,events!inner(id)").eq("confirmed", true)
        .gte("events.starts_at", start).lt("events.starts_at", end)
        .not("events.slug", "like", demoSlugPattern).order("id").limit(pageSize);
      return cursor ? query.gt("id", cursor) : query;
    }),
    readPages(cursor => {
      const query = db.from("agent_requests").select("id,kind,source").gte("created_at", start)
        .lt("created_at", end).order("id").limit(pageSize);
      return cursor ? query.gt("id", cursor) : query;
    }).catch(() => null),
  ]);

  if ([total, created].some(result => result.error || result.count === null)) {
    throw new Error("Report count failed");
  }

  const raised = contributions.reduce((sum, row) => sum + row.amount, 0);
  const formats = ranking(events.map(row => eventKind(row.kind)));
  const days = ranking(events.map(row => {
    const weekday = new Date(localDate.format(new Date(row.starts_at)) + "T00:00:00Z").getUTCDay();
    return weekdays[(weekday + 6) % 7];
  }));
  const aiResponses = agent?.filter(row => row.source === "ai").length ?? 0;

  return {
    title: `Отчёт Let's meet! · ${period}`,
    body: [
      `Неделя **${period}** по времени Алматы.`,
      "",
      "| Показатель | Значение |",
      "| --- | ---: |",
      `| Создано за неделю | ${created.count} |`,
      `| Всего создано к концу недели | ${total.count} |`,
      `| Встреч с датой проведения на этой неделе | ${events.length} |`,
      `| Подтверждённые взносы по этим встречам | ${formatMoney(raised, "ru")} |`,
      "",
      "Подтверждённые взносы отражают состояние на момент отчёта. Демо-встречи исключены.",
      "",
      table("Популярные форматы встреч", formats),
      table("Популярные дни проведения", days),
      "### ИИ-планировщик",
      "",
      ...(agent ? [
        `- Запросов за неделю: ${agent.length}`,
        `- Ответов Gemini: ${aiResponses}`,
        `- Ответов по шаблону: ${agent.length - aiResponses}`,
        "",
        table("Темы запросов", ranking(agent.map(row => eventKind(row.kind)))),
      ] : ["Статистика запросов недоступна."]),
      ...(events.length < 5 ? ["", "В выборке меньше пяти встреч. Рейтинги пока дают только предварительный ориентир."] : []),
    ].join("\n"),
  };
}
