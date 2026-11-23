"use client";
import {useState} from "react";
import Link from "next/link";
import Image from "next/image";
import {Card,CardHeader,CardContent} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {MemberForm} from "./forms";
import {isManager,mayManageMember,mayPromote} from "./validation";
import type {MemberData} from "./model";
const roles={owner:"Proprietário",admin:"Administrador",player:"Jogador",guest:"Convidado"};
const modality=(value:string|null)=>value==="monthly"?"Mensalista":value==="casual"?"Avulso":"Não definida";
const date=(value:string)=>new Date(value.includes("T")?value:value+"T12:00:00Z").toLocaleDateString("pt-BR",{timeZone:"UTC"});
export function MembersPanel({data,slug,individual,shared,demo=false}:{data:MemberData;slug:string;individual:{requestId:string;token:string};shared:{requestId:string;token:string};demo?:boolean}){
 const manager=isManager(data.role);const [status,setStatus]=useState("active");const [role,setRole]=useState("");const [billing,setBilling]=useState("");
 const members=data.members.filter(m=>(!status||(status==="active"?m.status==="active":m.status!=="active"))&&(!role||m.role===role)&&(!billing||m.billing===billing));
 return <div className="min-w-0 space-y-8">
 {demo&&<p role="status" className="feedback-error">Demonstração isolada com dados fictícios. Gravações desativadas.</p>}
 <Card><CardHeader><h2 className="text-xl font-semibold">Integrantes do grupo</h2><p className="text-sm text-muted-foreground">Função administrativa e modalidade financeira são independentes. Convidados ocasionais não fazem parte desta lista permanente.</p></CardHeader><CardContent className="space-y-5">
 <div className="grid gap-4 sm:grid-cols-3">
 <label className="grid gap-2 text-sm">Situação<select className="form-control" value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Ativos</option>{manager&&<><option value="inactive">Inativos</option><option value="">Todos</option></>}</select></label>
 <label className="grid gap-2 text-sm">Função<select className="form-control" value={role} onChange={e=>setRole(e.target.value)}><option value="">Todas</option><option value="owner">Proprietário</option><option value="admin">Administrador</option><option value="player">Jogador</option></select></label>
 {manager&&<label className="grid gap-2 text-sm">Modalidade financeira<select className="form-control" value={billing} onChange={e=>setBilling(e.target.value)}><option value="">Todas</option><option value="monthly">Mensalista</option><option value="casual">Avulso</option></select></label>}
 </div>
 <p className="text-sm text-muted-foreground">{members.length} integrante(s) nesta seleção.</p>
 {members.length?<ul className="divide-y divide-border">{members.map(m=><li key={m.id} className="min-w-0 space-y-3 py-5">
 <div className="flex flex-wrap items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-semibold" aria-hidden="true">{m.avatar?.startsWith("https://")?<Image src={m.avatar} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover"/>:m.name.slice(0,1)}</span><h3 className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{m.name}{m.nickname&&<span className="block text-sm font-normal text-muted-foreground">{m.nickname}</span>}</h3><Badge variant="secondary">{roles[m.role]}</Badge><Badge variant="secondary">{m.status==="active"?"Ativo":"Inativo"}</Badge></div>
 {(manager||m.billing)&&<p className="text-sm">Modalidade: <strong>{modality(m.billing)}</strong></p>}
 <details className="space-y-3"><summary className="cursor-pointer text-sm text-primary">Histórico e detalhes</summary>
 {manager&&m.email&&<p className="break-all text-sm">Contato confirmado na entrada: {m.email}</p>}
 <h4 className="text-sm font-semibold">Períodos de participação</h4><ul className="space-y-1 text-sm">{m.periods.map((p,i)=><li key={i}>{date(p.start)} — {p.end?date(p.end):"atual"}</li>)}</ul>
 {m.terms.length>0&&<><h4 className="text-sm font-semibold">Histórico de modalidade</h4><ul className="space-y-1 text-sm">{m.terms.map(t=><li key={t.id}>{modality(t.type)} · {date(t.from)} — {t.until?date(t.until)+" (fim exclusivo)":"sem encerramento"}</li>)}</ul></>}
 <p className="text-sm text-muted-foreground">A identidade e as participações anteriores são preservadas. Estatísticas por partida serão tratadas no próximo incremento.</p>
 </details>
 {manager&&m.status==="active"&&<div className="grid gap-4 lg:grid-cols-2">
 {mayManageMember(data.role,m.role)&&<MemberForm slug={slug} operation="status" label="Inativar integrante" disabled={demo}><input type="hidden" name="id" value={m.id}/><input type="hidden" name="value" value="suspended"/><p className="text-sm text-muted-foreground">Bloqueia acesso ao grupo e preserva o histórico. Retorno exige novo convite.</p></MemberForm>}
 {(mayPromote(data.role,m.role,m.status)||(data.role==="owner"&&m.role==="admin"))&&<MemberForm slug={slug} operation="role" label={m.role==="admin"?"Tornar jogador":"Promover a administrador"} disabled={demo}><input type="hidden" name="id" value={m.id}/><input type="hidden" name="value" value={m.role==="admin"?"player":"admin"}/></MemberForm>}
 <MemberForm slug={slug} operation="billing" label="Agendar modalidade" disabled={demo}><input type="hidden" name="id" value={m.id}/><label className="grid gap-2 text-sm">Modalidade<select name="type" className="form-control" required><option value="casual">Avulso</option><option value="monthly">Mensalista</option></select></label><label className="grid gap-2 text-sm">Início futuro<input type="date" name="from" className="form-control" required/></label><p className="text-sm text-muted-foreground">Sem efeito retroativo, pró-rata ou geração de cobranças. Uma vigência futura conflitante será rejeitada.</p></MemberForm>
 </div>}
 {manager&&m.status!=="active"&&<p className="text-sm text-muted-foreground">Para retornar, envie um novo convite individual. O aceite inicia outro período como Jogador e Avulso.</p>}
 </li>)}</ul>:<p>Nenhum integrante encontrado com estes filtros.</p>}
 </CardContent></Card>
 {manager&&<>
 <Card><CardHeader><h2 className="text-xl font-semibold">Convite individual</h2></CardHeader><CardContent className="space-y-5"><p className="text-sm text-muted-foreground">Somente a conta com este e-mail confirmado poderá aceitar. Válido por 30 dias. Gerar outro convite para o mesmo destinatário revoga o link pendente anterior.</p>
 <MemberForm slug={slug} operation="create_invitation" label="Preparar convite" requestId={individual.requestId} token={individual.token} disabled={demo}>
 <label className="grid gap-2 text-sm">E-mail do destinatário<input type="email" name="email" autoComplete="off" maxLength={254} className="form-control" required/></label>
 <label className="grid gap-2 text-sm">Compartilhamento<select name="delivery" className="form-control"><option value="manual">Compartilhar manualmente</option><option value="automatic">Preparar envio automático (desativado nesta etapa)</option></select></label><p className="text-sm text-muted-foreground">Nenhum e-mail real será enviado. A tentativa automática reserva o limite de 24 horas, mesmo bloqueada.</p></MemberForm>
 <ul className="divide-y divide-border">{data.invitations.map(i=><li key={i.id} className="space-y-2 py-3"><p className="break-all text-sm">{i.email}</p><p className="text-sm">{i.accepted?"Aceito":i.revoked?"Revogado":new Date(i.expires).getTime()<Date.now()?"Expirado":"Pendente"} · validade {date(i.expires)}{i.delivery==="blocked"?" · e-mail não enviado":""}</p>{!i.accepted&&!i.revoked&&<MemberForm slug={slug} operation="revoke_invitation" label="Revogar convite" disabled={demo}><input type="hidden" name="id" value={i.id}/></MemberForm>}</li>)}</ul>
 </CardContent></Card>
 <Card><CardHeader><h2 className="text-xl font-semibold">Links de solicitação</h2></CardHeader><CardContent className="space-y-5"><p className="text-sm text-muted-foreground">Válidos até revogação. Abrir o link ou solicitar ingresso não concede acesso e não consome o limite. Somente a aprovação conta como uso.</p>
 <MemberForm slug={slug} operation="create_link" label="Criar link compartilhável" requestId={shared.requestId} token={shared.token} disabled={demo}><label className="grid gap-2 text-sm">Descrição do link<input name="label" maxLength={80} required className="form-control"/></label><label className="grid gap-2 text-sm">Limite de aprovações (opcional)<input type="number" name="max_uses" min={1} max={99999999} className="form-control"/></label></MemberForm>
 <ul className="divide-y divide-border">{data.links.map(l=><li key={l.id} className="space-y-3 py-3"><h3 className="font-medium [overflow-wrap:anywhere]">{l.label}</h3><p className="text-sm">{l.revoked?"Revogado":"Ativo"} · {l.used} aprovação(ões){l.max===null?" · sem limite":" de "+l.max}</p>{!l.revoked&&<MemberForm slug={slug} operation="revoke_link" label="Revogar link" disabled={demo}><input type="hidden" name="id" value={l.id}/></MemberForm>}</li>)}</ul></CardContent></Card>
 <Card><CardHeader><h2 className="text-xl font-semibold">Solicitações de ingresso</h2></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Pendências sem movimentação vencem após 30 dias. Pessoas inativas retornam por convite individual.</p>{data.requests.length?<ul className="divide-y divide-border">{data.requests.map(r=><li key={r.id} className="space-y-3 py-4"><p className="font-medium [overflow-wrap:anywhere]">{r.name}</p><p className="break-all text-sm">{r.email}</p><p className="text-sm">{({pending:"Pendente",approved:"Aprovada",rejected:"Recusada",expired:"Expirada"} as Record<string,string>)[r.state]??"Indisponível"}</p>{r.state==="pending"&&<div className="flex flex-wrap gap-4">{(["approve","reject"] as const).map(decision=><MemberForm key={decision} slug={slug} operation="review" label={decision==="approve"?"Aprovar como Jogador e Avulso":"Recusar"} disabled={demo}><input type="hidden" name="id" value={r.id}/><input type="hidden" name="decision" value={decision}/></MemberForm>)}</div>}</li>)}</ul>:<p>Nenhuma solicitação registrada.</p>}</CardContent></Card>
 </>}
 <Link href={"/groups/"+slug} className="text-sm text-primary underline">Voltar ao grupo</Link>
 </div>;
}
