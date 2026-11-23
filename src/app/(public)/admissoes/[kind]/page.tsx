import {notFound} from "next/navigation";
import {getCurrentUser} from "@/features/auth/session";
import {AdmissionPanel} from "@/features/members/admission";
export const metadata={title:"Convite BoraFute",referrer:"no-referrer",robots:{index:false,follow:false}};
export default async function AdmissionPage({params}:{params:Promise<{kind:string}>}){const {kind}=await params;if(kind!=="individual"&&kind!=="solicitacao")notFound();const user=await getCurrentUser();return <AdmissionPanel kind={kind==="individual"?"individual":"shared"} authenticated={Boolean(user)}/>;}
