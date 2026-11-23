import {invitationUrl,emailValid} from "./validation";
function escape(value:string){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]??c));}
export function invitationMessage(input:{recipient:string;group:string;origin:string;token:string}){
 if(!emailValid(input.recipient))throw Error("Invalid recipient");
 const url=invitationUrl(input.origin,"individual",input.token);
 return {to:input.recipient,subject:"Convite BoraFute",html:`<div style="background:#20252B;color:#FFFFFF;padding:24px"><h1 style="color:#B8FF28">BoraFute</h1><p>Bora pro jogo!</p><p>Você recebeu um convite para ${escape(input.group)}.</p><p>Entre com a conta de e-mail destinatária e aceite explicitamente.</p><a style="color:#B8FF28" href="${escape(url)}">Conferir convite</a><p>O link não concede acesso ao ser aberto.</p></div>`,text:`Convite BoraFute para ${input.group}. Autentique-se com a conta destinatária e aceite: ${url}`};
}
export async function testInvitationTransport(message:ReturnType<typeof invitationMessage>,transport:(message:ReturnType<typeof invitationMessage>)=>Promise<{id:string}>){
 // Dependency-injected test seam ONLY. No live Resend adapter or environment keys.
 try{const result=await transport(message);return result.id?{state:"accepted_by_provider" as const}:{state:"failed" as const};}catch{return {state:"failed" as const};}
}
export function liveDeliveryState(){return {state:"blocked" as const,code:"delivery_disabled" as const};}
