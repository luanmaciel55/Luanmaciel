import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
create publication supabase_realtime;`);
await db.exec(await readFile(new URL('../supabase/migrations/20261008020515_mobile_chat.sql',import.meta.url),'utf8'));
const a='10000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002',c='30000000-0000-4000-8000-000000000003',thread='40000000-0000-4000-8000-000000000004';
for(const [id,name] of [[a,'Alice'],[b,'Bruno'],[c,'Carlos']]){
 await db.query('insert into auth.users values($1)',[id]);await db.query('select public.chat_create_profile($1,$2,$3,$4)',[id,name,`${name.toLowerCase()}@example.invalid`,`+552199999000${name==='Alice'?1:name==='Bruno'?2:3}`]);
}
await db.query('insert into public.chat_threads(id,user_a,user_b) values($1,$2,$3)',[thread,a,b]);
async function as(id){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
async function denied(sql,params=[]){await assert.rejects(()=>db.query(sql,params));}
await as(a);
assert.equal((await db.query('select * from chat_profiles')).rows.length,2,'Only self and conversation peers visible');
await denied('select * from chat_identities');await denied('select chat_rate_limit($1,100)',['x']);await denied('select chat_create_profile($1,$2,$3,$4)',[c,'Wrong','wrong@example.invalid','+5521999994444']);
await denied('insert into chat_messages(thread_id,sender_id,kind,body) values($1,$2,$3,$4)',[thread,b,'text','Spoof']);
await db.query('insert into chat_messages(thread_id,sender_id,kind,body) values($1,$2,$3,$4)',[thread,a,'text','Olá']);
await denied('insert into chat_messages(thread_id,sender_id,kind,body) values($1,$2,$3,$4)',[thread,a,'text',null]);
await denied('insert into chat_messages(thread_id,sender_id,kind,sticker_id) values($1,$2,$3,$4)',[thread,a,'sticker',21]);
await db.query('insert into chat_messages(thread_id,sender_id,kind,sticker_id) values($1,$2,$3,$4)',[thread,a,'sticker',20]);
await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['chat-audio',`${thread}/${a}/test.webm`]);
await denied('insert into storage.objects(bucket_id,name) values($1,$2)',['chat-audio',`${thread}/${b}/spoof.webm`]);
await as(c);assert.equal((await db.query('select * from chat_messages')).rows.length,0);assert.equal((await db.query('select * from chat_threads')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
await denied('insert into chat_messages(thread_id,sender_id,kind,body) values($1,$2,$3,$4)',[thread,c,'text','Intrusion']);
await as(b);assert.equal((await db.query('select * from chat_messages')).rows.length,2);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
await db.query('insert into chat_blocks(owner_id,blocked_id) values($1,$2)',[b,a]);
await as(a);await denied('insert into chat_messages(thread_id,sender_id,kind,body) values($1,$2,$3,$4)',[thread,a,'text','Blocked']);
await denied('insert into chat_calls(thread_id,caller_id,offer) values($1,$2,$3)',[thread,a,{type:'offer',sdp:'test'}]);
await as(b);await db.query('delete from chat_blocks where owner_id=$1',[b]);
await as(a);const {rows:[call]}=await db.query('insert into chat_calls(thread_id,caller_id,offer) values($1,$2,$3) returning id',[thread,a,{type:'offer',sdp:'test'}]);
await denied('update chat_calls set status=$1,answer=$2 where id=$3',['active',{type:'answer',sdp:'test'},call.id]);
await as(c);assert.equal((await db.query('select * from chat_calls')).rows.length,0);await denied('insert into chat_ice(call_id,sender_id,candidate) values($1,$2,$3)',[call.id,c,{candidate:'x'}]);
await as(b);await db.query('update chat_calls set status=$1,answer=$2 where id=$3',['active',{type:'answer',sdp:'test'},call.id]);
await db.query('insert into chat_ice(call_id,sender_id,candidate) values($1,$2,$3)',[call.id,b,{candidate:'x'}]);
await denied('update chat_calls set caller_id=$1 where id=$2',[b,call.id]);
await db.query('update chat_calls set status=$1 where id=$2',['ended',call.id]);
await denied('insert into chat_ice(call_id,sender_id,candidate) values($1,$2,$3)',[call.id,b,{candidate:'x'}]);
await db.exec('reset role;set role service_role;');
assert.equal((await db.query("select chat_rate_limit('test',2) as ok")).rows[0].ok,true);assert.equal((await db.query("select chat_rate_limit('test',2) as ok")).rows[0].ok,true);assert.equal((await db.query("select chat_rate_limit('test',2) as ok")).rows[0].ok,false);
await db.exec('reset role;set role anon;');await denied('select * from chat_profiles');await denied('select * from chat_messages');
console.log('PASS: migration, profile isolation, private identifiers, server-only RPCs, sender spoofing, message validation, private audio, third-user isolation, blocking, call lifecycle, ICE authorization, rate limiting and anonymous access.');
await db.close();
