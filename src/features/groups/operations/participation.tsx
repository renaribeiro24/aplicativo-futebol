import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export function ParticipationPreparation() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap gap-3">
          <h2 id="participation" className="text-xl font-semibold">
            Regras de participação
          </h2>
          <Badge variant="secondary">Em preparação</Badge>
        </div>
        <CardDescription id="participation-notice">
          A modelagem atual não armazena regras de participação. Nenhuma
          alteração pode ser salva nesta seção.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset
          disabled
          aria-labelledby="participation"
          aria-describedby="participation-notice"
        >
          <label className="grid gap-2 text-sm font-medium">
            Regras do grupo
            <textarea className="form-control min-h-24" />
          </label>
        </fieldset>
      </CardContent>
    </Card>
  );
}
