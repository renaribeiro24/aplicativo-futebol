import { Settings2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
export function SetupNotice() {
  return (
    <Alert className="border-dashed bg-muted/50">
      <Settings2 aria-hidden="true" />
      <AlertTitle>Autenticação em preparação</AlertTitle>
      <AlertDescription>
        Este ambiente ainda não está conectado ao Supabase. O acesso ficará
        disponível após a configuração. Nenhuma conta ou sessão de demonstração
        é criada.
      </AlertDescription>
    </Alert>
  );
}
