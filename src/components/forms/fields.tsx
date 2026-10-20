import { Input } from "@/components/ui/input";
import { positionLabels } from "@/features/groups/validation";
export function TextField({
  name,
  label,
  value,
  required = false,
  maxLength = 100,
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input
        name={name}
        defaultValue={value}
        required={required}
        maxLength={maxLength}
      />
    </label>
  );
}
export function PositionField({ value }: { value?: string | null }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      Posição preferida
      <select
        name="position"
        defaultValue={value ?? ""}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Não informada</option>
        {Object.entries(positionLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
