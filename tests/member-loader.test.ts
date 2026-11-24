import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),load:vi.fn(),user:vi.fn(),client:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/features/groups/server",()=>({loadGroup:m.load}));
vi.mock("@/features/auth/session",()=>({requireUser:m.user}));
vi.mock("@/lib/supabase/server",()=>({createClient:m.client}));
import {loadMembers,memberClient} from "@/features/members/server";
beforeEach(()=>{vi.clearAllMocks();m.load.mockResolvedValue({group:{id:"synthetic"},role:"player"});m.user.mockResolvedValue({id:"synthetic-user"});m.client.mockResolvedValue({rpc:m.rpc});m.rpc.mockResolvedValue({data:{role:"player",members:[]},error:null});});
describe("SSR members loader — mocked, not real JWT",()=>{
 it("requires verified server session before client",async()=>{m.user.mockRejectedValue(Error("login required"));await expect(memberClient()).rejects.toThrow("login required");expect(m.client).not.toHaveBeenCalled();});
 it("binds group from authorized server loader",async()=>{await loadMembers("synthetic-slug");expect(m.load).toHaveBeenCalledWith("synthetic-slug");expect(m.rpc).toHaveBeenCalledWith("member_command",{p_operation:"data",p_group_id:"synthetic"});});
 it("denied group stops before Data API",async()=>{m.load.mockRejectedValue(Error("NEXT_NOT_FOUND"));await expect(loadMembers("foreign")).rejects.toThrow("NEXT_NOT_FOUND");expect(m.rpc).not.toHaveBeenCalled();});
 it("missing schema returns preparation without fake members",async()=>{m.rpc.mockResolvedValue({data:null,error:{code:"PGRST202",message:"private detail"}});expect((await loadMembers("synthetic")).members).toBeNull();});
 it("unexpected upstream errors remain sanitized",async()=>{m.rpc.mockResolvedValue({data:null,error:{code:"XX000",message:"PRIVATE_DETAILS"}});await expect(loadMembers("synthetic")).rejects.not.toThrow("PRIVATE_DETAILS");});
 it("malformed projection is not rendered",async()=>{m.rpc.mockResolvedValue({data:{role:"root"},error:null});await expect(loadMembers("synthetic")).rejects.toThrow();});
});
