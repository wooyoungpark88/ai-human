-- AI Human Chat - Supabase 데이터베이스 스키마
-- Supabase Dashboard > SQL Editor 에서 실행하세요.

-- ============================================================
-- 1. 사용자 프로필 (Supabase Auth 확장)
-- ============================================================
create table if not exists public.user_profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 새 사용자 가입 시 자동으로 프로필 생성
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '사용자')
  );
  return new;
end;
$$ language plpgsql security definer;

-- 트리거 (이미 존재하면 무시)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. AI 캐릭터 프로필 (client_profiles/*.json 대체)
-- ============================================================
create table if not exists public.ai_profiles (
  id text primary key,
  name text not null,
  description text not null default '',
  personality text not null default '',
  speaking_style text not null default '',
  background_story text not null default '',
  system_prompt text not null,
  face_id text,
  voice_id text,
  is_public boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. 대화 세션
-- ============================================================
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  profile_id text references public.ai_profiles(id),
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- ============================================================
-- 4. 메시지
-- ============================================================
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  emotion text,
  intensity float,
  created_at timestamptz default now()
);

-- ============================================================
-- 5. Row Level Security (RLS)
-- ============================================================
alter table public.user_profiles enable row level security;
alter table public.ai_profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- user_profiles: 자기 프로필만 조회/수정
create policy "Users can view own profile"
  on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);

-- ai_profiles: 공개 프로필은 누구나 조회
create policy "Anyone can view public AI profiles"
  on public.ai_profiles for select using (is_public = true);

-- conversations: 자기 대화만 조회/생성
create policy "Users can view own conversations"
  on public.conversations for select using (auth.uid() = user_id);
create policy "Users can create own conversations"
  on public.conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations"
  on public.conversations for update using (auth.uid() = user_id);

-- messages: 자기 대화의 메시지만 조회/생성
create policy "Users can view messages of own conversations"
  on public.messages for select using (
    conversation_id in (select id from public.conversations where user_id = auth.uid())
  );
create policy "Users can insert messages to own conversations"
  on public.messages for insert with check (
    conversation_id in (select id from public.conversations where user_id = auth.uid())
  );

-- 서비스 역할 키를 사용하는 백엔드는 RLS를 바이패스하므로 별도 정책 불필요

-- ============================================================
-- 6. 인덱스
-- ============================================================
create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at);
