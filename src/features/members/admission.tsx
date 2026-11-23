"use client";
import {useActionState,useState} from "react";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {processAdmission,type MemberActionState} from "./actions";
import {tokenValid} from "./validation";
function AdmissionForm({kind,operation,label}:{kind:"individual"|"shared";operation:"preview"|"accept"|"request";label:string}){
 const [state,submit,pending]=useActionState(processAdmission.bind(null,kind,operation),{} as MemberActionState);const [invalid,setInvalid]=useState(false);
 return <form action={submit} onSubmit={event=>{const raw=new URLSearchParams(window.location.hash.slice(1)).get("token");if(!tokenValid(raw)){event.preventDefault();setInvalid(true);return;}setInvalid(false);const input=event.currentTarget.elements.namedItem("token");if(input instanceof HTMLInputElement)input.value=raw;}} className="space-y-3">
 <input type="hidden" name="token" defaultValue=""/><Button disabled={pending} type="submit">{pending?"Confirmando…":label}</Button>
 {invalid&&<p role="alert" className="feedback-error">Link inválido. Abra novamente o link completo recebido.</p>}{state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.message&&<p className="feedback-success" role="status">{state.message}</p>}
 </form>;
}
export function AdmissionPanel({kind,authenticated}:{kind:"individual"|"shared";authenticated:boolean}){
 return <div className="mx-auto max-w-xl space-y-6 rounded-xl border border-border bg-card p-5 sm:p-8"><h1 className="text-2xl font-semibold">{kind==="individual"?"Convite individual":"Solicitar ingresso"}</h1><p>Abrir este link não altera sua participação. Nenhuma operação ocorre antes da sua confirmação.</p>
 {!authenticated?<><p>Entre ou crie sua conta em outra aba. Confirme seu e-mail e volte a esta aba para recarregar a página e continuar com o mesmo link.</p><div className="flex flex-wrap gap-4"><Link href="/login" target="_blank" rel="noopener noreferrer" className="text-primary underline">Entrar em outra aba</Link><Link href="/signup" target="_blank" rel="noopener noreferrer" className="text-primary underline">Criar conta em outra aba</Link></div></>:<><p className="text-sm text-muted-foreground">{kind==="individual"?"Use a conta com o e-mail confirmado do destinatário. O aceite concede participação como Jogador e Avulso.":"Sua solicitação precisará ser aprovada por um gestor. Ela não concede acesso automático."}</p><AdmissionForm kind={kind} operation="preview" label="Conferir convite"/><AdmissionForm kind={kind} operation={kind==="individual"?"accept":"request"} label={kind==="individual"?"Aceitar convite explicitamente":"Confirmar solicitação"}/></>}
 <Link href="/dashboard" className="inline-block text-sm text-primary underline">Ir ao dashboard</Link>
 </div>;
}
