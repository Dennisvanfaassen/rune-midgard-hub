import { JOBS, PARTY_ROLES, jobName } from "@/lib/ro/jobs";
import { fieldClass } from "@/components/JobSelect";

export function PartyRoleSelect({ value, onChange, className = "" }: { value: string; onChange: (value: string) => void; className?: string }) {
  const known = [...PARTY_ROLES, ...JOBS].includes(value);
  return <select aria-label="Party role" className={`${fieldClass} ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
    <optgroup label="Party roles">{PARTY_ROLES.map((r) => <option key={r}>{r}</option>)}</optgroup>
    <optgroup label="Specific class">{JOBS.map((j) => <option value={j} key={j}>{jobName(j)}</option>)}</optgroup>
    {!known && <option>{value}</option>}
  </select>;
}