import { loadIdentity } from "@/features/identity/server";
import { saveProfile } from "@/features/identity/actions";
import { ActionForm } from "@/components/forms/action-form";
import { TextField, PositionField } from "@/components/forms/fields";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export const metadata = { title: "Meu perfil" };
export default async function Profile() {
  const { profile, player } = await loadIdentity();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold">
        Seu perfil, dentro e fora de campo.
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Minha identidade</CardTitle>
          <CardDescription>
            O nome de exibição é privado. Sua identidade esportiva é
            compartilhada com os grupos dos quais você participa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={saveProfile} label="Salvar perfil">
            <TextField
              name="display_name"
              label="Nome de exibição"
              value={profile.display_name}
              required
            />
            <TextField
              name="name"
              label="Nome esportivo"
              value={player.name}
              required
            />
            <TextField
              name="nickname"
              label="Apelido (opcional)"
              value={player.nickname ?? ""}
              maxLength={60}
            />
            <PositionField value={player.preferred_position} />
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
