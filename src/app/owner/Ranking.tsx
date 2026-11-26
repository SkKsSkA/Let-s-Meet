import { LOCALES, type Locale } from "@/lib/i18n";

const colors = ["#5d3dcc", "#c23d52", "#147f70", "#b26a14", "#2475b8", "#a13c88"];
const otherColor = "#777180";

type Row = { label: string; detail: string; count: number };

export function Ranking({
  rows, total, locale, otherLabel,
}: { rows: Row[]; total?: number; locale: Locale; otherLabel: string }) {
  const number = new Intl.NumberFormat(LOCALES[locale].intl);
  const percent = new Intl.NumberFormat(LOCALES[locale].intl, {
    style: "percent", maximumFractionDigits: 1,
  });
  const ranked = (total ? rows.slice(0, colors.length) : rows).map((row, index) => ({
    ...row, color: colors[index],
  }));
  const otherCount = total ? total - ranked.reduce((sum, row) => sum + row.count, 0) : 0;
  const segments = otherCount > 0
    ? [...ranked, { label: otherLabel, detail: "", count: otherCount, color: otherColor }]
    : ranked;

  let countSoFar = 0;
  const stops = total ? segments.map(row => {
    const start = countSoFar / total;
    countSoFar += row.count;
    return `${row.color} ${start}turn ${countSoFar / total}turn`;
  }).join(", ") : "";

  return (
    <div className="mt-4 space-y-4">
      {total ? (
        <div className="relative mx-auto grid h-44 w-44 place-items-center rounded-full border border-ink/20 sm:h-52 sm:w-52"
          style={{ background: `conic-gradient(${stops})` }} aria-hidden="true">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-2xl font-bold text-ink">
            {number.format(total)}
          </span>
        </div>
      ) : null}
      <ol className="divide-y divide-ink/15">
        {segments.map((row, index) => (
          <li key={JSON.stringify([row.label, row.detail, index])} className="flex items-baseline gap-2 py-2">
            {total ? <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border border-ink/20"
              style={{ backgroundColor: row.color }} /> : null}
            <span className="min-w-0 flex-1 break-words font-semibold">
              {row.label}
              {row.detail && <span className="block text-sm font-normal">{row.detail}</span>}
            </span>
            <strong className="whitespace-nowrap tabular-nums">
              {number.format(row.count)}{total ? ` · ${percent.format(row.count / total)}` : ""}
            </strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
