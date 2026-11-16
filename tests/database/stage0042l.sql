\set ON_ERROR_STOP on
-- Synthetic fixtures in disposable PostgreSQL only. SQL claims are NOT real JWTs.
begin;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$ begin
  if value is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'ok - %',label;
end $$;
create function pg_temp.denied(statement text,state text,label text) returns void language plpgsql security invoker as $$ begin
  begin execute statement;
  exception when others then
    if sqlstate<>state then raise exception 'FAIL: % expected % got %: %',label,state,sqlstate,sqlerrm; end if;
    raise notice 'ok - %',label; return;
  end;
  raise exception 'FAIL: % unexpectedly succeeded',label;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.create_group_once(gen_random_uuid(),'Local L A','stage42l-a',null,'America/Sao_Paulo') as ga \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.create_group_once(gen_random_uuid(),'Local L B','stage42l-b',null,'UTC') as gb \gset
-- Privileged fixture setup, never used as evidence of client authorization.
insert into public.group_members(group_id,player_id,role,status)
select :'ga',id,case user_id when '00000000-0000-4000-8000-000000000004' then 'admin'
  when '00000000-0000-4000-8000-000000000006' then 'guest' else 'player' end,'active'
from public.players where user_id in ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000006');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.venues(group_id,name,address) values(:'ga','Local legado','Endereço livre original; não converter') returning id as legacy \gset
insert into public.venues(group_id,name,deleted_at) values(:'ga','Local desativado',now()) returning id as inactive \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
insert into public.venues(group_id,name) values(:'gb','Outro grupo') returning id as foreign_venue \gset
select pg_temp.ok((select primary_venue_id is null from public.groups where id=:'ga'),'new group has no inferred primary');
select pg_temp.ok(not has_column_privilege('authenticated','public.groups','primary_venue_id','UPDATE'),'no direct pointer grant');
select pg_temp.ok(not has_column_privilege('authenticated','public.venues','postal_code','UPDATE') and not has_column_privilege('authenticated','public.venues','postal_code','INSERT'),'no direct structured writes');
select pg_temp.ok((select not prosecdef from pg_proc where oid='public.save_group_primary_venue(uuid,text,text,text,text,text,text,text,uuid,uuid,timestamptz,text,double precision,double precision,text,text)'::regprocedure),'public wrapper invoker');
select pg_temp.ok((select prosecdef and proowner='app_executor'::regrole and proconfig=array['search_path=""'] from pg_proc where oid='private.save_group_primary_venue_impl(uuid,text,text,text,text,text,text,text,uuid,uuid,timestamptz,text,double precision,double precision,text,text)'::regprocedure),'private implementation scoped owner and empty search_path');
select pg_temp.ok(not has_function_privilege('anon','public.save_group_primary_venue(uuid,text,text,text,text,text,text,text,uuid,uuid,timestamptz,text,double precision,double precision,text,text)','EXECUTE') and not has_function_privilege('service_role','public.save_group_primary_venue(uuid,text,text,text,text,text,text,text,uuid,uuid,timestamptz,text,double precision,double precision,text,text)','EXECUTE'),'no anonymous/service_role RPC grant');
select pg_temp.ok(not has_function_privilege('authenticated','private.assign_schedule_primary_venue()','EXECUTE') and not has_function_privilege('authenticated','private.guard_group_primary_venue()','EXECUTE'),'triggers not client callable');
select pg_temp.ok((select convalidated and contype='f' and confrelid='public.venues'::regclass from pg_constraint where conname='groups_primary_venue_fkey'),'validated composite venue FK');
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.ok(current_user='authenticated' and session_user='authenticated','non-privileged client SQL');
select pg_temp.ok(private.group_role(:'ga')='owner','owner fixture verified');
insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)
values(:'ga',1,'18:00',90,'weekly',1,'2030-01-07') returning id as no_primary_schedule \gset
select pg_temp.ok((select venue_id is null from public.group_schedules where id=:'no_primary_schedule'),'unconfigured group preserves nullable venue compatibility');
select updated_at as legacy_version from public.venues where id=:'legacy' \gset
select public.save_group_primary_venue(:'ga','Local legado','01310100','Avenida sintética','s/n','Bairro sintético','Cidade sintética','sp',:'legacy',null,:'legacy_version',null) as principal \gset
select pg_temp.ok(:'principal'=:'legacy','owner assigns existing local');
select pg_temp.ok((select address='Endereço livre original; não converter' and postal_code='01310100' and state='SP' and street_number='s/n' from public.venues where id=:'legacy'),'legacy free text preserved with structured address');
select pg_temp.ok((select primary_venue_id=:'legacy' and timezone='America/Sao_Paulo' from public.groups where id=:'ga'),'pointer assigned without timezone change');
select pg_temp.ok((select venue_id is null from public.group_schedules where id=:'no_primary_schedule'),'assigning principal does not backfill a prior NULL schedule');
select updated_at as version1 from public.venues where id=:'legacy' \gset
select pg_temp.denied(format('update public.groups set primary_venue_id=%L where id=%L',:'foreign_venue',:'ga'),'42501','pointer cannot be modified directly');
select pg_temp.denied(format('update public.venues set postal_code=''11111111'' where id=%L',:'legacy'),'42501','structured address cannot be modified directly');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',%2$L,%3$L,now(),null)',:'ga',:'foreign_venue',:'legacy'),'23503','cross-tenant venue rejected');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',%2$L,%3$L,now(),null)',:'ga',:'inactive',:'legacy'),'23503','inactive venue rejected');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',%2$L,%3$L,now(),null)',:'ga','ffffffff-ffff-4fff-8fff-ffffffffffff',:'legacy'),'23503','missing venue rejected');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',%2$L,%3$L,%4$L,null)',:'ga',:'legacy',:'legacy',:'legacy_version'),'40001','stale address version rejected');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',null,null,null,null)',:'ga'),'40001','stale pointer rejected before creating orphan');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''bad'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',%2$L,%3$L,%4$L,null)',:'ga',:'legacy',:'legacy',:'version1'),'23514','invalid postal code rejected');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''XX'',%2$L,%3$L,%4$L,null)',:'ga',:'legacy',:'legacy',:'version1'),'23514','invalid UF rejected');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'','' '',''1'',''Bairro'',''Cidade'',''SP'',%2$L,%3$L,%4$L,null)',:'ga',:'legacy',:'legacy',:'version1'),'23514','required street rejected');
select pg_temp.ok((select updated_at=:'version1' and name='Local legado' from public.venues where id=:'legacy'),'failed updates do not alter venue or version');
-- Insert ignores a forged foreign venue: new schedules resolve the authorized principal.
insert into public.group_schedules(group_id,venue_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)
values(:'ga',null,1,'19:00',90,'weekly',1,'2030-01-07') returning id as schedule \gset
select pg_temp.ok((select venue_id=:'legacy' from public.group_schedules where id=:'schedule'),'schedule resolves principal, never client tenant reference');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select pg_temp.ok(private.group_role(:'ga')='admin','admin fixture verified');
select public.save_group_primary_venue(:'ga','Segundo local','01310100','Outra rua','2','Outro bairro','Outra cidade','RJ',null,:'legacy',null,'Sala 1') as next_primary \gset
select pg_temp.ok((select primary_venue_id=:'next_primary' from public.groups where id=:'ga'),'admin creates and assigns new primary');
select pg_temp.ok((select venue_id=:'legacy' from public.group_schedules where id=:'schedule'),'primary switch never rewrites old schedule');
update public.group_schedules set duration_minutes=100 where id=:'schedule';
select pg_temp.ok((select venue_id=:'legacy' and duration_minutes=100 from public.group_schedules where id=:'schedule'),'old schedule editing retains old venue');
insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)
values(:'ga',1,'20:00',60,'weekly',1,'2030-01-07') returning id as next_schedule \gset
select pg_temp.ok((select venue_id=:'next_primary' from public.group_schedules where id=:'next_schedule'),'new schedule uses new primary');
select updated_at as new_version from public.venues where id=:'next_primary' \gset
select public.save_group_primary_venue(:'ga','Segundo local atualizado','01310100','Rua atualizada','3','Bairro','Cidade','MG',:'next_primary',:'next_primary',:'new_version',null) as edited_primary \gset
select pg_temp.ok(:'edited_primary'<>:'next_primary','referenced location uses a new version');
select pg_temp.ok((select venue_id=:'next_primary' from public.group_schedules where id=:'next_schedule'),'old event keeps old version');
\set next_primary :edited_primary
select pg_temp.ok((select name='Segundo local atualizado' and street_number='3' from public.venues where id=:'next_primary'),'admin updates principal address');

-- New revision: mapping data is optional, overrides explicit, used locations versioned.
select public.create_group_once(gen_random_uuid(),'Synthetic map group','stage42l-map',null,'UTC') as gm \gset
select public.save_group_primary_venue(:'gm','Ponto sintético','','','','','','',p_latitude=>-23.5,p_longitude=>-46.5,p_location_provider=>'geoapify',p_external_place_id=>'synthetic-place') as map_primary \gset
select pg_temp.ok((select latitude=-23.5 and longitude=-46.5 and postal_code is null and city is null and external_place_id='synthetic-place' from public.venues where id=:'map_primary'),'available mapping metadata stored without invented address');
select updated_at as map_version from public.venues where id=:'map_primary' \gset
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''Bad point'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',p_venue_id=>%2$L,p_expected_primary_venue_id=>%2$L,p_expected_venue_updated_at=>%3$L,p_latitude=>91,p_longitude=>0)',:'gm',:'map_primary',:'map_version'),'23514','latitude range enforced');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''Bad point'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',p_venue_id=>%2$L,p_expected_primary_venue_id=>%2$L,p_expected_venue_updated_at=>%3$L,p_latitude=>0)',:'gm',:'map_primary',:'map_version'),'23514','half coordinate pair rejected');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''Bad reference'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',p_expected_primary_venue_id=>%2$L,p_external_place_id=>''orphan'')',:'gm',:'map_primary'),'23514','external id without provider rejected');
insert into public.matches(group_id,title,starts_at,ends_at,capacity) values(:'gm','Synthetic match',now()+interval '1 day',now()+interval '25 hours',10) returning id as mapped_match \gset
select pg_temp.ok((select venue_id=:'map_primary' from public.matches where id=:'mapped_match'),'new match defaults to principal');
select public.save_group_primary_venue(:'gm','Ponto atualizado','','','','','','',p_venue_id=>:'map_primary',p_expected_primary_venue_id=>:'map_primary',p_expected_venue_updated_at=>:'map_version',p_latitude=>-23.6,p_longitude=>-46.6,p_location_provider=>'geoapify',p_external_place_id=>'synthetic-place') as map_updated \gset
select pg_temp.ok(:'map_updated'<>:'map_primary','match reference forces copy-on-write');
select pg_temp.ok((select name='Ponto sintético' and latitude=-23.5 and longitude=-46.5 and superseded_at is not null from public.venues where id=:'map_primary'),'old match location values remain exact');
select pg_temp.ok((select venue_id=:'map_primary' from public.matches where id=:'mapped_match'),'old match FK unchanged');
select pg_temp.denied(format('update public.venues set name=''Changed history'' where id=%L',:'map_primary'),'23514','historical referenced attributes cannot be rewritten');
select public.save_group_primary_venue(:'gm','Ponto atualizado','','','','','','',p_expected_primary_venue_id=>:'map_updated',p_latitude=>-23.6,p_longitude=>-46.6,p_location_provider=>'geoapify',p_external_place_id=>'synthetic-place') as reused \gset
select pg_temp.ok(:'reused'=:'map_updated','identical current location is reused');
insert into public.venues(group_id,name) values(:'gm','Substituição manual') returning id as manual_venue \gset
insert into public.matches(group_id,venue_id,title,starts_at,ends_at,capacity) values(:'gm',:'manual_venue','Manual match',now()+interval '2 days',now()+interval '49 hours',10) returning id as manual_match \gset
select pg_temp.ok((select venue_id=:'manual_venue' from public.matches where id=:'manual_match'),'manual match override preserved');
insert into public.group_schedules(group_id,venue_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)values(:'gm',:'manual_venue',1,'21:00',90,'weekly',1,'2030-01-07')returning id as manual_schedule \gset
select pg_temp.ok((select venue_id=:'manual_venue' from public.group_schedules where id=:'manual_schedule'),'manual schedule override preserved');
select pg_temp.denied(format('insert into public.matches(group_id,venue_id,title,starts_at,ends_at,capacity) values(%L,%L,''Cross match'',now()+interval ''1 day'',now()+interval ''25 hours'',10)',:'gm',:'foreign_venue'),'23503','cross-tenant match override rejected');
select pg_temp.denied(format('insert into public.group_schedules(group_id,venue_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)values(%L,%L,1,''21:00'',90,''weekly'',1,''2030-01-07'')',:'gm',:'map_primary'),'23503','superseded location not selectable for new schedules');
select count(*) as authorized_venue_count from public.venues where group_id=:'ga' \gset
-- Player, authenticated guest and other tenant are real DB roles with synthetic claims.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.ok(private.group_role(:'ga')='player','player fixture verified');
select pg_temp.ok((select count(*)=:'authorized_venue_count'::int from public.venues where group_id=:'ga'),'player reads active local data within group');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',null,%2$L,null,null)',:'ga',:'next_primary'),'42501','player cannot manage primary');
select pg_temp.denied(format('insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on) values(%L,1,''19:00'',90,''weekly'',1,''2030-01-07'')',:'ga'),'42501','player cannot create schedule');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
select pg_temp.ok(private.group_role(:'ga')='guest','guest fixture verified');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',null,%2$L,null,null)',:'ga',:'next_primary'),'42501','guest cannot manage primary');
select pg_temp.denied(format('insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on) values(%L,1,''19:00'',90,''weekly'',1,''2030-01-07'')',:'ga'),'42501','guest cannot create schedule');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.ok((select count(*)=0 from public.groups where id=:'ga'),'other group pointer not visible');
select pg_temp.ok((select count(*)=0 from public.venues where group_id=:'ga'),'other group address not visible');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',null,%2$L,null,null)',:'ga',:'next_primary'),'42501','other group owner cannot manage primary');
reset session authorization;
-- Administrative invariant checks are explicitly privileged, not RLS evidence.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.denied(format('update public.venues set deleted_at=now() where id=%L',:'next_primary'),'23514','primary cannot be soft-deleted');
select pg_temp.denied(format('update public.venues set postal_code=null,street=null,street_number=null,complement=null,neighborhood=null,city=null,state=null where id=%L',:'next_primary'),'23514','primary cannot lose structured address');
select pg_temp.denied(format('update public.groups set primary_venue_id=%L where id=%L',:'foreign_venue',:'ga'),'23503','guard rejects cross-tenant pointer even in maintenance');
select pg_temp.denied(format('delete from public.venues where id=%L',:'next_primary'),'23503','FK prevents deleting principal');
-- Force a failure AFTER venue insert; the RPC must roll back both records.
create function pg_temp.fail_primary() returns trigger language plpgsql as $$ begin
  raise exception 'synthetic forced failure' using errcode='P0001';
end $$;
create trigger zz_synthetic_fail_primary before update of primary_venue_id on public.groups
for each row when (new.id=:'ga'::uuid) execute function pg_temp.fail_primary();
select count(*) as before_rollback from public.venues where group_id=:'ga' and deleted_at is null \gset
set session authorization authenticated;
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''Rollback local'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',null,%2$L,null,null)',:'ga',:'next_primary'),'P0001','late failure rolls back whole RPC');
select pg_temp.ok((select count(*)=:'before_rollback'::int from public.venues where group_id=:'ga'),'failed RPC leaves no orphan venue');
select pg_temp.ok((select primary_venue_id=:'next_primary' from public.groups where id=:'ga'),'failed RPC preserves pointer');
reset session authorization;
drop trigger zz_synthetic_fail_primary on public.groups;
set session authorization anon;
select pg_temp.denied('select * from public.venues','42501','anonymous venue read denied');
select pg_temp.denied(format('select public.save_group_primary_venue(%1$L,''X'',''01310100'',''Rua'',''1'',''Bairro'',''Cidade'',''SP'',null,null,null,null)',:'ga'),'42501','anonymous RPC denied');
reset session authorization;
commit;
