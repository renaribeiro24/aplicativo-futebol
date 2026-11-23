\set ON_ERROR_STOP on
-- Disposable PostgreSQL session identities; NOT real Auth/JWT or HTTP evidence.
begin;
create or replace function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'ok - %',label; end $$;
create or replace function pg_temp.denied(statement text,wanted text,label text) returns void language plpgsql as $$
declare code text; begin
 begin execute statement; exception when others then get stacked diagnostics code=returned_sqlstate; end;
 if code is distinct from wanted then raise exception 'FAIL: %, wanted %, got %',label,wanted,code; end if;
 raise notice 'ok - %',label;
end $$;
insert into auth.users(id,email,email_confirmed_at) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'synthetic-'||n||'@example.invalid',now() from generate_series(201,208)n;
set session authorization authenticated;
do $$ declare n int;begin for n in 201..208 loop
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
 perform public.ensure_my_identity('Synthetic member '||n);
end loop;end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select public.create_group('Synthetic Management A','members-management-a') as ga \gset
select public.member_command('create_invitation',:'ga','10000000-0000-4000-8000-000000000001',jsonb_build_object('email','synthetic-203@example.invalid','delivery','manual','token_hash',repeat('a',64))) as invite \gset
select pg_temp.ok((public.member_command('create_invitation',:'ga','10000000-0000-4000-8000-000000000001',jsonb_build_object('email','synthetic-203@example.invalid','delivery','manual','token_hash',repeat('a',64))))=:'invite'::jsonb,'create retry idempotent');
select pg_temp.denied(format('select public.member_command(''create_invitation'',%L,''10000000-0000-4000-8000-000000000001'',%L::jsonb)',:'ga',jsonb_build_object('email','other@example.invalid','delivery','manual','token_hash',repeat('a',64))),'22023','idempotency payload cannot change');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
select public.create_group('Synthetic Management B','members-management-b') as gb \gset
select pg_temp.denied(format('select public.member_command(''data'',%L)',:'ga'),'42501','other tenant data denied');
select pg_temp.denied(format('select public.member_command(''preview'',null,null,%L::jsonb)',jsonb_build_object('kind','individual','token_hash',repeat('a',64))),'42501','wrong confirmed recipient denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000203',true);
select pg_temp.ok(public.member_command('preview',null,null,jsonb_build_object('kind','individual','token_hash',repeat('a',64)))->>'group'='Synthetic Management A','preview bound recipient only');
select pg_temp.denied(format('select public.member_command(''data'',%L)',:'ga'),'42501','preview grants no membership');
select public.member_command('accept',null,null,jsonb_build_object('kind','individual','token_hash',repeat('a',64))) as accepted \gset
select (:'accepted'::jsonb->>'member') as member \gset
select pg_temp.ok(public.member_command('accept',null,null,jsonb_build_object('kind','individual','token_hash',repeat('a',64)))->>'member'=:'member','accepted replay same membership');
select pg_temp.ok((select role='player' and status='active' from public.group_members where id=:'member'),'new entrant player active');
select pg_temp.ok((public.member_command('data',:'ga')->'members'->0 ? 'name'),'sports projection available');
select pg_temp.ok(not (public.member_command('data',:'ga') ? 'invitations'),'player has no admin queues');
select pg_temp.ok((select count(*)=1 from public.member_participation_periods where member_id=:'member'),'one participation period');
select pg_temp.ok((select count(*)=1 and bool_and(billing_type='casual') from public.member_billing_terms where group_id=:'ga'),'new entrant casual only self visible');
select pg_temp.denied(format('select public.set_member_role(%L,%L,''admin'')',:'ga',:'member'),'42501','player cannot self promote');
select pg_temp.denied('select * from private.member_contacts','42501','private contact table denied');
select pg_temp.denied('select private.member_verified_email()','42501','verified Auth bridge not exposed');
select pg_temp.denied(format('select public.member_command(''create_link'',%L,gen_random_uuid(),%L::jsonb)',:'ga',jsonb_build_object('label','Denied','token_hash',repeat('b',64))),'42501','player cannot create link');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select public.set_member_role(:'ga',:'member','admin');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000203',true);
select public.member_command('create_link',:'ga',gen_random_uuid(),jsonb_build_object('label','Synthetic join','max_uses',1,'token_hash',repeat('b',64))) as shared \gset
select pg_temp.denied(format('select public.set_member_role(%L,%L,''admin'')',:'ga',:'member'),'42501','admin cannot promote');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000204',true);
select public.member_command('request',null,null,jsonb_build_object('kind','shared','token_hash',repeat('b',64))) as req \gset
select pg_temp.ok(public.member_command('request',null,null,jsonb_build_object('kind','shared','token_hash',repeat('b',64)))=:'req'::jsonb,'pending request deduplicated');
select pg_temp.denied(format('select public.member_command(''data'',%L)',:'ga'),'42501','pending request grants no access');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select pg_temp.ok((public.member_command('data',:'ga')->'links'->0->>'used')::int=0,'opening/request does not consume use');
select public.member_command('review',:'ga',null,jsonb_build_object('id',:'req'::jsonb->>'id','decision','approve'));
select pg_temp.ok((public.member_command('data',:'ga')->'links'->0->>'used')::int=1,'approval consumes one use');
select pg_temp.denied(format('select public.member_command(''review'',%L,null,%L::jsonb)',:'ga',jsonb_build_object('id',:'req'::jsonb->>'id','decision','approve')),'P4090','duplicate approval denied');
select public.set_member_role(:'ga',:'member','player');
select public.set_member_status(:'ga',:'member','suspended');
select pg_temp.denied(format('select public.set_member_status(%L,%L,''active'')',:'ga',:'member'),'42501','old reactivation blocked');
select public.member_command('create_invitation',:'ga',gen_random_uuid(),jsonb_build_object('email','synthetic-203@example.invalid','delivery','manual','token_hash',repeat('c',64)));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000203',true);
select pg_temp.denied(format('select public.member_command(''data'',%L)',:'ga'),'42501','inactive private access denied');
select pg_temp.denied(format('select public.member_command(''accept'',null,null,%L::jsonb)',jsonb_build_object('kind','individual','token_hash',repeat('a',64))),'P4092','old accepted invite never reactivates');
select pg_temp.ok(public.member_command('accept',null,null,jsonb_build_object('kind','individual','token_hash',repeat('c',64)))->>'member'=:'member','return reuses identity');
select pg_temp.ok((select count(*)=2 and count(*) filter(where ended_at is null)=1 from public.member_participation_periods where member_id=:'member'),'return opens new period');
select pg_temp.ok((select role='player' and status='active' from public.group_members where id=:'member'),'return never restores admin');
select pg_temp.ok((select count(*)=2 and bool_and(billing_type='casual') from public.member_billing_terms where group_id=:'ga'),'past/current terms preserved without overlap');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select public.member_command('create_invitation',:'ga',gen_random_uuid(),jsonb_build_object('email','synthetic-205@example.invalid','delivery','automatic','token_hash',repeat('d',64)));
select pg_temp.ok((select v->>'delivery'='blocked' from jsonb_array_elements(public.member_command('data',:'ga')->'invitations') v where v->>'email'='synthetic-205@example.invalid'),'no email marked delivered');
select pg_temp.denied(format('select public.member_command(''create_invitation'',%L,gen_random_uuid(),%L::jsonb)',:'ga',jsonb_build_object('email','synthetic-205@example.invalid','delivery','automatic','token_hash',repeat('e',64))),'P4290','24h automated attempt limit');
select public.member_command('create_invitation',:'ga',gen_random_uuid(),jsonb_build_object('email','synthetic-205@example.invalid','delivery','manual','token_hash',repeat('f',64)));
select pg_temp.denied(format('select public.member_command(''create_invitation'',%L,gen_random_uuid(),%L::jsonb)',:'ga',jsonb_build_object('email','synthetic-205@example.invalid','delivery','automatic','token_hash',repeat('e',64))),'P4290','manual rotation does not reset email budget');
select public.member_command('billing',:'ga',null,jsonb_build_object('id',:'member','type','monthly','from',current_date+1));
select pg_temp.ok((select count(*)=3 from public.member_billing_terms where group_id=:'ga' and player_id=(select player_id from public.group_members where id=:'member')),'future modality preserves history');
select pg_temp.denied(format('select public.member_command(''billing'',%L,null,%L::jsonb)',:'ga',jsonb_build_object('id',:'member','type','monthly','from',current_date)),'23514','no retroactive modality');
reset session authorization;
select pg_temp.ok(not has_table_privilege('app_executor','auth.users','SELECT'),'no broad Auth SELECT');
select pg_temp.ok(not has_schema_privilege('app_executor','auth','USAGE'),'no Auth schema grant');
select pg_temp.ok((select count(*)=0 from private.member_admission_context),'admission contexts removed');
select pg_temp.ok((select count(*)=1 from public.group_members where group_id=:'ga' and role='owner' and status='active'),'unique owner preserved');
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'member_%' and c.relkind='r'),'private tables RLS closed');
update auth.users set email_confirmed_at=null where id='00000000-0000-4000-8000-000000000205';
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000205',true);
select pg_temp.denied(format('select public.member_command(''accept'',null,null,%L::jsonb)',jsonb_build_object('kind','individual','token_hash',repeat('f',64))),'42501','unconfirmed email denied');
reset session authorization;
set session authorization anon;
select pg_temp.denied(format('select public.member_command(''data'',%L)',:'ga'),'42501','anonymous RPC denied');
reset session authorization;
-- Privacy of peers and rejected/revoked/expired flows.
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000204',true);
select pg_temp.ok(not exists(select 1 from jsonb_array_elements(public.member_command('data',:'ga')->'members') m where m->>'email' is not null),'player sees no peer contact');
select pg_temp.ok(not exists(select 1 from jsonb_array_elements(public.member_command('data',:'ga')->'members') m where m->>'id'<> (select id::text from public.group_members where group_id=:'ga' and player_id=(select id from public.players where user_id='00000000-0000-4000-8000-000000000204')) and jsonb_array_length(m->'terms')>0),'player sees no peer modality history');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select public.member_command('create_link',:'ga',gen_random_uuid(),jsonb_build_object('label','Revocable synthetic','token_hash',repeat('7',64))) as revlink \gset
select public.member_command('create_link',:'ga',gen_random_uuid(),jsonb_build_object('label','Reject synthetic','token_hash',repeat('8',64)));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000206',true);
select public.member_command('request',null,null,jsonb_build_object('kind','shared','token_hash',repeat('8',64))) as rejectedrequest \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select public.member_command('review',:'ga',null,jsonb_build_object('id',:'rejectedrequest'::jsonb->>'id','decision','reject'));
select public.member_command('revoke_link',:'ga',null,jsonb_build_object('id',:'revlink'::jsonb->>'id'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000206',true);
select pg_temp.denied(format('select public.member_command(''data'',%L)',:'ga'),'42501','rejection grants no access');
select pg_temp.denied(format('select public.member_command(''request'',null,null,%L::jsonb)',jsonb_build_object('kind','shared','token_hash',repeat('7',64))),'42501','revoked shared link denied');
select pg_temp.denied(format('select public.member_command(''accept'',null,null,%L::jsonb)',jsonb_build_object('kind','shared','token_hash',repeat('8',64))),'22023','shared link cannot directly admit');
select pg_temp.denied('select public.member_command(''unknown'',null,null,''{}'')','22023','unknown commands rejected');
select pg_temp.denied('select public.member_command(''preview'',null,null,''[]'')','22023','array payload rejected');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select public.member_command('create_invitation',:'ga',gen_random_uuid(),jsonb_build_object('email','synthetic-207@example.invalid','delivery','manual','token_hash',repeat('9',64)));
reset session authorization;
update public.group_invitations set expires_at=clock_timestamp()-interval '1 second' where group_id=:'ga' and token_hash=repeat('9',64);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
insert into public.group_members(group_id,player_id,role,status) select :'ga',id,'guest','active' from public.players where user_id='00000000-0000-4000-8000-000000000208';
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000207',true);
select pg_temp.denied(format('select public.member_command(''accept'',null,null,%L::jsonb)',jsonb_build_object('kind','individual','token_hash',repeat('9',64))),'42501','expired individual invite denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000208',true);
select pg_temp.denied(format('select public.member_command(''data'',%L)',:'ga'),'42501','guest private projection denied');
select pg_temp.ok((select count(*)=0 from public.groups where id=:'ga'),'guest direct group read denied');
select pg_temp.denied(format('select public.member_command(''review'',%L,null,%L::jsonb)',:'ga',jsonb_build_object('id',:'rejectedrequest'::jsonb->>'id','decision','approve')),'42501','guest cannot approve');
reset session authorization;

rollback;
