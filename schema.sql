-- AIhub Supabase schema
-- Run this in your Supabase SQL editor

create extension if not exists "uuid-ossp";

-- profiles (extends auth.users)
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  full_name          text,
  avatar_url         text,
  role               text not null default 'student' check (role in ('student','teacher','admin')),
  tier               text not null default 'free' check (tier in ('free','pro')),
  stripe_customer_id text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users can read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- resource progress
create table if not exists public.resource_progress (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  resource_id text not null,
  completed   boolean not null default false,
  percent     int not null default 0 check (percent between 0 and 100),
  updated_at  timestamptz not null default now(),
  unique(user_id, resource_id)
);
alter table public.resource_progress enable row level security;
create policy "Users manage own progress" on public.resource_progress using (auth.uid() = user_id);
create index if not exists idx_progress_user on public.resource_progress(user_id);

-- bookmarks
create table if not exists public.bookmarks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  resource_id text not null,
  created_at  timestamptz not null default now(),
  unique(user_id, resource_id)
);
alter table public.bookmarks enable row level security;
create policy "Users manage own bookmarks" on public.bookmarks using (auth.uid() = user_id);
create index if not exists idx_bookmarks_user on public.bookmarks(user_id);

-- quiz results
create table if not exists public.quiz_results (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  path_id    text not null,
  score      int not null,
  passed     boolean not null,
  taken_at   timestamptz not null default now()
);
alter table public.quiz_results enable row level security;
create policy "Users manage own quiz results" on public.quiz_results using (auth.uid() = user_id);
create index if not exists idx_quiz_user on public.quiz_results(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- CLASSROOM MANAGEMENT  (run these additions in your Supabase SQL editor)
-- ─────────────────────────────────────────────────────────────────────────────

-- classrooms: one per teacher, holds the shareable join code
create table if not exists public.classrooms (
  id         uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  code       text not null,
  name       text not null default 'My Classroom',
  created_at timestamptz not null default now(),
  constraint classrooms_code_unique unique (code)
);
alter table public.classrooms enable row level security;

-- Teachers fully manage their own classrooms
create policy "Teachers manage classrooms"
  on public.classrooms for all
  using  (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Any authenticated user can look up a classroom by code (needed for join flow)
create policy "Authenticated lookup classrooms"
  on public.classrooms for select
  using (auth.role() = 'authenticated');

-- classroom_members: students who joined via a teacher's code
create table if not exists public.classroom_members (
  id           uuid primary key default uuid_generate_v4(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id   uuid not null references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  constraint classroom_members_unique unique (classroom_id, student_id)
);
alter table public.classroom_members enable row level security;

-- Students can join and read their own membership
create policy "Students manage own membership"
  on public.classroom_members for all
  using  (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- Teachers can read members of their classrooms
create policy "Teachers read classroom members"
  on public.classroom_members for select
  using (
    classroom_id in (select id from public.classrooms where teacher_id = auth.uid())
  );

-- Allow teachers to read their students' resource progress
create policy "Teachers read student progress"
  on public.resource_progress for select
  using (
    auth.uid() = user_id
    or user_id in (
      select cm.student_id from public.classroom_members cm
      join  public.classrooms c on c.id = cm.classroom_id
      where c.teacher_id = auth.uid()
    )
  );

-- Allow teachers to read their students' profile names
create policy "Teachers read student profiles"
  on public.profiles for select
  using (
    auth.uid() = id
    or id in (
      select cm.student_id from public.classroom_members cm
      join  public.classrooms c on c.id = cm.classroom_id
      where c.teacher_id = auth.uid()
    )
  );

create index if not exists idx_classrooms_teacher on public.classrooms(teacher_id);
create index if not exists idx_classrooms_code    on public.classrooms(code);
create index if not exists idx_cm_classroom       on public.classroom_members(classroom_id);
create index if not exists idx_cm_student         on public.classroom_members(student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ASSIGNMENTS  (teacher assigns content to their classroom)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.assignments (
  id           uuid primary key default uuid_generate_v4(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id   uuid not null references auth.users(id) on delete cascade,
  -- what is being assigned
  content_type text not null check (content_type in ('resource', 'exercise', 'path', 'activity')),
  content_id   text not null,   -- resource/exercise/path/activity id from JSON files
  title        text not null,   -- denormalised for display without extra fetch
  note         text,            -- optional teacher note / instructions
  due_date     date,
  created_at   timestamptz not null default now()
);
alter table public.assignments enable row level security;

-- Teachers fully manage their own classroom's assignments
create policy "Teachers manage assignments"
  on public.assignments for all
  using  (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Students can read assignments for classrooms they're in
create policy "Students read their assignments"
  on public.assignments for select
  using (
    classroom_id in (
      select classroom_id from public.classroom_members where student_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ASSIGNMENT COMPLETIONS  (per-student completion of an assignment)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.assignment_completions (
  id            uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references auth.users(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  constraint assignment_completions_unique unique (assignment_id, student_id)
);
alter table public.assignment_completions enable row level security;

-- Students manage their own completions
create policy "Students manage own completions"
  on public.assignment_completions for all
  using  (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- Teachers can read completions for their classroom's assignments
create policy "Teachers read assignment completions"
  on public.assignment_completions for select
  using (
    assignment_id in (
      select id from public.assignments where teacher_id = auth.uid()
    )
  );

create index if not exists idx_assignments_classroom on public.assignments(classroom_id);
create index if not exists idx_assignments_teacher   on public.assignments(teacher_id);
create index if not exists idx_ac_assignment         on public.assignment_completions(assignment_id);
create index if not exists idx_ac_student            on public.assignment_completions(student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME — enable live profile/role updates
-- Without REPLICA IDENTITY FULL, UPDATE events don't include the changed row
-- content, so the frontend Realtime subscription can't read the new role.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles replica identity full;

-- Add profiles to the Supabase Realtime publication so changes are broadcast
-- (Supabase creates this publication automatically; this makes profiles part of it)
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
