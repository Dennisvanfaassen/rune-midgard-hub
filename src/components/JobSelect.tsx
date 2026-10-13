import { JOBS, jobName } from "@/lib/ro/jobs";

export function JobSelect({ value, onChange, includeAny, className }: { value: string; onChange: (v: string) => void; includeAny?: boolean; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={"h-9 rounded-md border border-input bg-background px-2 text-sm " + (className ?? "")}>
      {includeAny && <option value="Any">Any class</option>}
      {JOBS.map((j) => <option key={j} value={j}>{jobName(j)}</option>)}
    </select>
  );
}

export const fieldClass = "h-9 rounded-md border border-input bg-background px-2 text-sm";
