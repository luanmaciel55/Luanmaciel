-- Additive migration: does not alter existing site auth settings, tables or admin roles.
begin;
create schema if not exists chat_private;
revoke all on schema chat_private from public, anon;
grant usage on schema chat_private to authenticated;

create table public.chat_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 60),
 created_at timestamptz not null default now()
);
create table public.chat_identities (
 user_id uuid primary key references public.chat_profiles(id) on delete cascade,
 email text not null unique check(email = lower(email)),
 phone text not null unique check(phone ~ '^\+[1-9][0-9]{9,14}$')
);
create table public.chat_threads (
 id uuid primary key default gen_random_uuid(),
 user_a uuid not null references public.chat_profiles(id) on delete cascade,
 user_b uuid not null references public.chat_profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(user_a,user_b), check(user_a < user_b)
);
create index chat_threads_b on public.chat_threads(user_b);
create table public.chat_contacts (
 owner_id uuid references public.chat_profiles(id) on delete cascade,
 contact_id uuid references public.chat_profiles(id) on delete cascade,
 primary key(owner_id,contact_id), check(owner_id <> contact_id)
);
create index chat_contacts_contact on public.chat_contacts(contact_id);
create table public.chat_blocks (
 owner_id uuid references public.chat_profiles(id) on delete cascade,
 blocked_id uuid references public.chat_profiles(id) on delete cascade,
 primary key(owner_id,blocked_id), check(owner_id <> blocked_id)
);
create index chat_blocks_blocked on public.chat_blocks(blocked_id);
create table public.chat_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.chat_threads(id) on delete cascade,
 sender_id uuid not null references public.chat_profiles(id) on delete cascade,
 kind text not null check(kind in ('text','audio','sticker')),
 body text, audio_path text, sticker_id smallint,
 created_at timestamptz not null default now(),
 check ((kind='text' and body is not null and char_length(body) between 1 and 4000 and audio_path is null and sticker_id is null)
 or (kind='audio' and audio_path is not null and char_length(audio_path)<200 and body is null and sticker_id is null)
 or (kind='sticker' and sticker_id is not null and sticker_id between 1 and 20 and body is null and audio_path is null))
);
create index chat_messages_thread_created on public.chat_messages(thread_id,created_at desc,id);
create index chat_messages_sender on public.chat_messages(sender_id,created_at desc);
create table public.chat_calls (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.chat_threads(id) on delete cascade,
 caller_id uuid not null references public.chat_profiles(id) on delete cascade,
 status text not null default 'ringing' check(status in ('ringing','active','ended')),
 offer jsonb not null check(octet_length(offer::text)<65536 and offer->>'type'='offer'),
 answer jsonb check(octet_length(answer::text)<65536 and answer->>'type'='answer'),
 created_at timestamptz not null default now()
);
create index chat_calls_thread_created on public.chat_calls(thread_id,created_at desc);
create index chat_calls_caller on public.chat_calls(caller_id,created_at desc);
create table public.chat_ice (
 id uuid primary key default gen_random_uuid(),
 call_id uuid not null references public.chat_calls(id) on delete cascade,
 sender_id uuid not null references public.chat_profiles(id) on delete cascade,
 candidate jsonb not null check(octet_length(candidate::text)<4096),
 created_at timestamptz not null default now()
);
create index chat_ice_call on public.chat_ice(call_id,created_at);
create index chat_ice_sender on public.chat_ice(sender_id);
create table public.chat_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.chat_profiles(id) on delete cascade,
 thread_id uuid not null references public.chat_threads(id) on delete cascade,
 reason text not null check(char_length(reason) between 5 and 1000),
 created_at timestamptz not null default now()
);
create index chat_reports_reporter on public.chat_reports(reporter_id);
create index chat_reports_thread on public.chat_reports(thread_id);
create table public.chat_limits (key text primary key, started_at timestamptz not null, hits integer not null);
create index chat_limits_started on public.chat_limits(started_at);

-- Privileged helpers have fixed search paths and explicitly check the caller.
-- Identities and limits are server-only; they are never queryable by chat users.
create function chat_private.member(p_thread uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.chat_threads where id=p_thread and auth.uid() in(user_a,user_b));
$$;
create function chat_private.can_send(p_thread uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.chat_threads t where t.id=p_thread and auth.uid() in(t.user_a,t.user_b)
 and not exists(select 1 from public.chat_blocks b where (b.owner_id=t.user_a and b.blocked_id=t.user_b) or (b.owner_id=t.user_b and b.blocked_id=t.user_a)));
$$;
create function chat_private.known_profile(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.uid()=p_user or exists(select 1 from public.chat_threads t where auth.uid() in(t.user_a,t.user_b) and p_user in(t.user_a,t.user_b)));
$$;
revoke all on all functions in schema chat_private from public, anon;
grant execute on all functions in schema chat_private to authenticated;

alter table public.chat_profiles enable row level security;
alter table public.chat_identities enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_contacts enable row level security;
alter table public.chat_blocks enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_calls enable row level security;
alter table public.chat_ice enable row level security;
alter table public.chat_reports enable row level security;
alter table public.chat_limits enable row level security;
revoke all on public.chat_profiles,public.chat_identities,public.chat_threads,public.chat_contacts,public.chat_blocks,public.chat_messages,public.chat_calls,public.chat_ice,public.chat_reports,public.chat_limits from anon,authenticated;
grant all on public.chat_profiles,public.chat_identities,public.chat_threads,public.chat_contacts,public.chat_blocks,public.chat_messages,public.chat_calls,public.chat_ice,public.chat_reports,public.chat_limits to service_role;
grant select on public.chat_profiles,public.chat_threads,public.chat_contacts,public.chat_blocks,public.chat_messages,public.chat_calls,public.chat_ice to authenticated;
grant insert on public.chat_blocks,public.chat_messages,public.chat_calls,public.chat_ice,public.chat_reports to authenticated;
grant delete on public.chat_blocks,public.chat_contacts to authenticated;
grant update(status,answer) on public.chat_calls to authenticated;
create policy profiles_read on public.chat_profiles for select to authenticated using(chat_private.known_profile(id));
create policy threads_read on public.chat_threads for select to authenticated using((select auth.uid()) in(user_a,user_b));
create policy contacts_read on public.chat_contacts for select to authenticated using(owner_id=(select auth.uid()));
create policy contacts_delete on public.chat_contacts for delete to authenticated using(owner_id=(select auth.uid()));
create policy blocks_read on public.chat_blocks for select to authenticated using(owner_id=(select auth.uid()));
create policy blocks_insert on public.chat_blocks for insert to authenticated with check(owner_id=(select auth.uid()) and chat_private.known_profile(blocked_id));
create policy blocks_delete on public.chat_blocks for delete to authenticated using(owner_id=(select auth.uid()));
create policy messages_read on public.chat_messages for select to authenticated using(chat_private.member(thread_id));
create policy messages_insert on public.chat_messages for insert to authenticated with check(sender_id=(select auth.uid()) and chat_private.can_send(thread_id)
 and (kind<>'audio' or (split_part(audio_path,'/',1)=thread_id::text and split_part(audio_path,'/',2)=auth.uid()::text)));
create policy calls_read on public.chat_calls for select to authenticated using(chat_private.member(thread_id));
create policy calls_insert on public.chat_calls for insert to authenticated with check(caller_id=(select auth.uid()) and chat_private.can_send(thread_id) and status='ringing' and answer is null);
create policy calls_update on public.chat_calls for update to authenticated using(chat_private.member(thread_id)) with check(chat_private.member(thread_id));
create policy ice_read on public.chat_ice for select to authenticated using(exists(select 1 from public.chat_calls c where c.id=call_id and chat_private.member(c.thread_id)));
create policy ice_insert on public.chat_ice for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.chat_calls c where c.id=call_id and c.status<>'ended' and c.created_at>now()-interval '2 hours' and chat_private.can_send(c.thread_id)));
create policy reports_insert on public.chat_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and chat_private.member(thread_id));

create function chat_private.message_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.sender_id <> auth.uid() then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if (select count(*) from public.chat_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=60 then raise exception 'rate limit'; end if;
 new.created_at:=now(); return new;
end $$;
create trigger chat_message_guard before insert on public.chat_messages for each row execute function chat_private.message_guard();
create function chat_private.call_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if tg_op='INSERT' then
  if new.caller_id<>auth.uid() then raise exception 'unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,2));
  if (select count(*) from public.chat_calls where caller_id=auth.uid() and created_at>now()-interval '1 minute')>=5 then raise exception 'rate limit'; end if;
  new.created_at:=now(); return new;
 end if;
 if new.id<>old.id or new.thread_id<>old.thread_id or new.caller_id<>old.caller_id or new.offer<>old.offer or new.created_at<>old.created_at then raise exception 'immutable fields'; end if;
 if old.status='ended' then raise exception 'call ended'; end if;
 if new.status='active' and (old.status<>'ringing' or auth.uid()=old.caller_id or new.answer is null or old.created_at<now()-interval '1 minute' or not chat_private.can_send(old.thread_id)) then raise exception 'invalid answer'; end if;
 if new.status not in('active','ended') then raise exception 'invalid transition'; end if;
 if new.status='ended' and new.answer is distinct from old.answer then raise exception 'immutable answer'; end if;
 return new;
end $$;
create trigger chat_call_guard before insert or update on public.chat_calls for each row execute function chat_private.call_guard();
create function chat_private.ice_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.sender_id<>auth.uid() then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.call_id::text,3));
 if (select count(*) from public.chat_ice where call_id=new.call_id)>=200 then raise exception 'too many candidates'; end if;
 new.created_at:=now(); return new;
end $$;
create trigger chat_ice_guard before insert on public.chat_ice for each row execute function chat_private.ice_guard();
revoke all on function chat_private.message_guard(),chat_private.call_guard(),chat_private.ice_guard() from public,anon,authenticated;

-- SECURITY INVOKER: service_role-only RPCs; no public privileged endpoints.
create function public.chat_create_profile(p_user uuid,p_name text,p_email text,p_phone text) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.chat_profiles(id,name) values(p_user,p_name);
 insert into public.chat_identities(user_id,email,phone) values(p_user,p_email,p_phone);
end $$;
create function public.chat_rate_limit(p_key text,p_limit integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 delete from public.chat_limits where started_at<now()-interval '1 day';
 insert into public.chat_limits(key,started_at,hits) values(p_key,now(),1)
 on conflict(key) do update set hits=case when public.chat_limits.started_at<now()-interval '10 minutes' then 1 else public.chat_limits.hits+1 end,
 started_at=case when public.chat_limits.started_at<now()-interval '10 minutes' then now() else public.chat_limits.started_at end
 returning hits into n;
 return n<=p_limit;
end $$;
revoke all on function public.chat_create_profile(uuid,text,text,text), public.chat_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.chat_create_profile(uuid,text,text,text), public.chat_rate_limit(text,integer) to service_role;

-- Private audio: maximum 5 MB; signed URLs only for conversation members.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chat-audio','chat-audio',false,5242880,array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav']);
create function chat_private.audio_allowed(p_path text,p_write boolean) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare t uuid;
begin
 if auth.uid() is null then return false; end if;
 begin t:=split_part(p_path,'/',1)::uuid; exception when invalid_text_representation then return false; end;
 if p_write then return split_part(p_path,'/',2)=auth.uid()::text and chat_private.can_send(t); end if;
 return chat_private.member(t);
end $$;
revoke all on function chat_private.audio_allowed(text,boolean) from public,anon;
grant execute on function chat_private.audio_allowed(text,boolean) to authenticated;
create policy chat_audio_read on storage.objects for select to authenticated using(bucket_id='chat-audio' and chat_private.audio_allowed(name,false));
create policy chat_audio_insert on storage.objects for insert to authenticated with check(bucket_id='chat-audio' and chat_private.audio_allowed(name,true));
create policy chat_audio_delete on storage.objects for delete to authenticated using(bucket_id='chat-audio' and split_part(name,'/',2)=(select auth.uid())::text);

alter publication supabase_realtime add table public.chat_messages,public.chat_threads,public.chat_calls,public.chat_ice;
commit;
