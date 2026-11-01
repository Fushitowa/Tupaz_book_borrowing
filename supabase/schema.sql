-- Nizel Library. Run in the Supabase SQL Editor for a new project.
create extension if not exists pgcrypto;

do $$ begin create type public.staff_role as enum ('admin','librarian'); exception when duplicate_object then null; end $$;
do $$ begin create type public.borrow_status as enum ('pending','approved','rejected','returned'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.staff_role,
  created_at timestamptz not null default now()
);
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now()
);
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  author text not null check (char_length(author) between 1 and 120),
  category_id uuid references public.categories(id) on delete set null,
  description text not null default '', cover_url text, isbn text,
  total_copies integer not null default 1 check (total_copies >= 0),
  available_copies integer not null default 1 check (available_copies >= 0 and available_copies <= total_copies),
  created_at timestamptz not null default now()
);
create table if not exists public.borrowers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists borrowers_email_lower_uidx on public.borrowers(lower(email));
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  borrower_id uuid not null references public.borrowers(id) on delete restrict,
  status text not null default 'borrowed' check (status in ('borrowed','returned')),
  borrowed_at timestamptz not null default now(), due_at timestamptz not null,
  returned_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.borrow_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('NL-' || upper(substr(encode(gen_random_bytes(8),'hex'),1,12))),
  book_id uuid not null references public.books(id) on delete restrict,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text not null check (char_length(customer_email) between 5 and 254),
  customer_phone text,
  customer_address text not null default '',
  requested_days integer not null default 14 check (requested_days between 1 and 30),
  status public.borrow_status not null default 'pending',
  requested_at timestamptz not null default now(), reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  due_date timestamptz, returned_at timestamptz,
  loan_id uuid references public.loans(id) on delete set null,
  handled_by uuid references public.profiles(id) on delete set null
);
-- Additive columns also let existing Nizel installations upgrade in place.
alter table public.borrow_requests add column if not exists customer_address text not null default '';
alter table public.borrow_requests add column if not exists requested_days integer not null default 14 check (requested_days between 1 and 30);
alter table public.borrow_requests add column if not exists reviewed_at timestamptz;
alter table public.borrow_requests add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.borrow_requests add column if not exists due_date timestamptz;
alter table public.borrow_requests add column if not exists loan_id uuid references public.loans(id) on delete set null;
create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text not null check (char_length(customer_email) between 5 and 254),
  status public.borrow_status not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(), reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  loan_id uuid references public.loans(id) on delete set null
);

create index if not exists loans_status_due_idx on public.loans(status,due_at);
create index if not exists loans_borrower_idx on public.loans(borrower_id);
create index if not exists requests_status_date_idx on public.borrow_requests(status,requested_at desc);
create index if not exists return_requests_status_date_idx on public.return_requests(status,requested_at desc);
create unique index if not exists borrow_requests_pending_email_book_uidx on public.borrow_requests(lower(customer_email),book_id) where status='pending';
create unique index if not exists return_requests_pending_email_book_uidx on public.return_requests(lower(customer_email),book_id) where status='pending';

create or replace function public.adjust_available_on_total_change() returns trigger
language plpgsql set search_path = '' as $$ begin
  if new.total_copies <> old.total_copies then
    if new.total_copies < (select count(*) from public.loans where book_id=old.id and status='borrowed') then
      raise exception 'Total copies cannot be lower than the number currently on loan.';
    end if;
    new.available_copies := new.total_copies - (select count(*) from public.loans where book_id=old.id and status='borrowed');
  end if;
  return new;
end $$;
drop trigger if exists books_total_copies_inventory on public.books;
create trigger books_total_copies_inventory before update of total_copies on public.books
for each row execute function public.adjust_available_on_total_change();

create or replace function public.current_staff_role() returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$ select public.current_staff_role() is not null $$;
-- The first Auth signup becomes the initial administrator. Later accounts must
-- be created by an administrator through the protected librarian workflow.
create or replace function public.bootstrap_first_library_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(8246102901);
  if not exists (select 1 from public.profiles where role='admin') then
    insert into public.profiles(id,email,full_name,role)
    values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)),'admin')
    on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,role='admin';
  end if;
  return new;
end $$;
create or replace function public.admin_setup_available() returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists(select 1 from public.profiles where role='admin')
$$;
drop trigger if exists on_auth_user_created_first_admin on auth.users;
create trigger on_auth_user_created_first_admin after insert on auth.users
for each row execute function public.bootstrap_first_library_admin();
revoke all on function public.current_staff_role() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.bootstrap_first_library_admin() from public;
revoke all on function public.admin_setup_available() from public;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.admin_setup_available() to anon,authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.borrowers enable row level security;
alter table public.loans enable row level security;
alter table public.borrow_requests enable row level security;
alter table public.return_requests enable row level security;
drop policy if exists "staff read profiles" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
drop policy if exists "public reads categories" on public.categories;
drop policy if exists "admins manage categories" on public.categories;
drop policy if exists "public reads books" on public.books;
drop policy if exists "staff manage books" on public.books;
drop policy if exists "staff read requests" on public.borrow_requests;
drop policy if exists "staff read borrowers" on public.borrowers;
drop policy if exists "staff read loans" on public.loans;
drop policy if exists "staff read return requests" on public.return_requests;
drop policy if exists "admins manage books" on public.books;
drop policy if exists "staff read borrowers" on public.borrowers;
drop policy if exists "admins manage borrowers" on public.borrowers;
drop policy if exists "staff read loans" on public.loans;
drop policy if exists "staff read requests" on public.borrow_requests;
drop policy if exists "staff read return requests" on public.return_requests;
create policy "staff read profiles" on public.profiles for select to authenticated using (public.is_staff());
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.current_staff_role()='admin') with check (public.current_staff_role()='admin');
create policy "public reads categories" on public.categories for select to anon,authenticated using (true);
create policy "admins manage categories" on public.categories for all to authenticated using (public.current_staff_role()='admin') with check (public.current_staff_role()='admin');
create policy "public reads books" on public.books for select to anon,authenticated using (true);
create policy "admins manage books" on public.books for all to authenticated using (public.current_staff_role()='admin') with check (public.current_staff_role()='admin');
create policy "staff read borrowers" on public.borrowers for select to authenticated using (public.is_staff());
create policy "admins manage borrowers" on public.borrowers for all to authenticated using (public.current_staff_role()='admin') with check (public.current_staff_role()='admin');
create policy "staff read loans" on public.loans for select to authenticated using (public.is_staff());
create policy "staff read requests" on public.borrow_requests for select to authenticated using (public.is_staff());
create policy "staff read return requests" on public.return_requests for select to authenticated using (public.is_staff());
revoke all on public.profiles,public.categories,public.books,public.borrowers,public.loans,public.borrow_requests,public.return_requests from anon,authenticated;
grant select on public.categories,public.books to anon,authenticated;
grant select on public.profiles,public.borrowers,public.loans,public.borrow_requests,public.return_requests to authenticated;
grant insert,update,delete on public.categories,public.books,public.borrowers,public.profiles to authenticated;

-- Public submissions do not create accounts and never expose borrower or loan data.
create or replace function public.submit_borrow_request(p_book_id uuid,p_name text,p_email text,p_phone text,p_address text,p_days integer) returns text
language plpgsql security definer set search_path = '' as $$
declare v_reference text;
begin
  if char_length(trim(p_name)) not between 2 and 120 then raise exception 'Enter your name (2 to 120 characters).'; end if;
  if trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(trim(p_email))>254 then raise exception 'Enter a valid email address.'; end if;
  if char_length(trim(p_address)) not between 3 and 300 then raise exception 'Enter your home address (3 to 300 characters).'; end if;
  if p_phone is not null and char_length(trim(p_phone))>30 then raise exception 'Phone number is too long.'; end if;
  if p_days not between 1 and 30 then raise exception 'Choose a borrowing period from 1 to 30 days.'; end if;
  if not exists(select 1 from public.books where id=p_book_id and available_copies>0) then raise exception 'This book is currently unavailable.'; end if;
  if (select count(*) from public.borrow_requests where lower(customer_email)=lower(trim(p_email)) and status='pending') >= 10 then raise exception 'You have several requests awaiting review already.'; end if;
  insert into public.borrow_requests(book_id,customer_name,customer_email,customer_phone,customer_address,requested_days)
  values(p_book_id,trim(p_name),lower(trim(p_email)),nullif(trim(coalesce(p_phone,'')),''),trim(p_address),p_days) returning reference into v_reference;
  return v_reference;
end $$;
-- Remove legacy RPCs so callers cannot bypass the new request and loan workflow.
drop function if exists public.submit_borrow_request(uuid,text,text,text);
drop function if exists public.staff_update_request(uuid,public.borrow_status);
create or replace function public.submit_return_request(p_name text,p_email text,p_book_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(trim(p_name)) not between 2 and 120 then raise exception 'Enter your name (2 to 120 characters).'; end if;
  if trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(trim(p_email))>254 then raise exception 'Enter a valid email address.'; end if;
  if not exists(select 1 from public.loans l join public.borrowers b on b.id=l.borrower_id where l.book_id=p_book_id and l.status='borrowed' and lower(b.email)=lower(trim(p_email))) then raise exception 'We could not find an active loan matching that book and email.'; end if;
  if (select count(*) from public.return_requests where lower(customer_email)=lower(trim(p_email)) and status='pending') >= 10 then raise exception 'You have several return notices awaiting review already.'; end if;
  insert into public.return_requests(book_id,customer_name,customer_email) values(p_book_id,trim(p_name),lower(trim(p_email)));
end $$;
create or replace function public.track_borrow_request(p_reference text)
returns table(reference text,status public.borrow_status,requested_at timestamptz,due_date timestamptz,book_title text,book_author text)
language sql security definer set search_path = '' as $$
  select r.reference,r.status,r.requested_at,r.due_date,b.title,b.author from public.borrow_requests r join public.books b on b.id=r.book_id where r.reference=upper(trim(p_reference)) limit 1
$$;

create or replace function public.staff_approve_borrow_request(p_request_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.borrow_requests%rowtype; v_borrower uuid; v_loan uuid;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff sign-in is required.'; end if;
  select * into r from public.borrow_requests where id=p_request_id for update;
  if not found or r.status<>'pending' then raise exception 'Request is missing or already reviewed.'; end if;
  insert into public.borrowers(name,email,is_active) values(r.customer_name,lower(r.customer_email),true)
  on conflict (lower(email)) do update set name=excluded.name,is_active=true returning id into v_borrower;
  update public.books set available_copies=available_copies-1 where id=r.book_id and available_copies>0;
  if not found then raise exception 'No copies are currently available.'; end if;
  insert into public.loans(book_id,borrower_id,due_at) values(r.book_id,v_borrower,now()+make_interval(days=>r.requested_days)) returning id into v_loan;
  update public.borrow_requests set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),handled_by=auth.uid(),loan_id=v_loan,due_date=(select due_at from public.loans where id=v_loan) where id=r.id;
  return v_loan;
end $$;
create or replace function public.staff_reject_borrow_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff sign-in is required.'; end if;
  update public.borrow_requests set status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),handled_by=auth.uid() where id=p_request_id and status='pending';
  if not found then raise exception 'Request is missing or already reviewed.'; end if;
end $$;
create or replace function public.return_book(p_loan_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_book uuid;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff sign-in is required.'; end if;
  update public.loans set status='returned',returned_at=now() where id=p_loan_id and status='borrowed' returning book_id into v_book;
  if v_book is null then raise exception 'Loan is missing or already returned.'; end if;
  update public.books set available_copies=least(total_copies,available_copies+1) where id=v_book;
  update public.borrow_requests set status='returned',returned_at=now(),handled_by=auth.uid() where loan_id=p_loan_id and status='approved';
end $$;
create or replace function public.staff_review_return_request(p_request_id uuid,p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.return_requests%rowtype; v_loan uuid;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff sign-in is required.'; end if;
  select * into r from public.return_requests where id=p_request_id for update;
  if not found or r.status<>'pending' then raise exception 'Return notice is missing or already reviewed.'; end if;
  if p_approve then
    select l.id into v_loan from public.loans l join public.borrowers b on b.id=l.borrower_id
    where l.book_id=r.book_id and l.status='borrowed' and lower(b.email)=lower(r.customer_email) order by l.borrowed_at limit 1 for update of l;
    if v_loan is null then raise exception 'No active matching loan was found.'; end if;
    perform public.return_book(v_loan);
  end if;
  update public.return_requests set status=case when p_approve then 'approved'::public.borrow_status else 'rejected'::public.borrow_status end,
    reviewed_at=now(),reviewed_by=auth.uid(),loan_id=v_loan where id=r.id;
end $$;
create or replace function public.admin_set_borrower_active(p_borrower_id uuid,p_is_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_staff_role()<>'admin' then raise exception 'Administrator access is required.'; end if;
  if not p_is_active and exists(select 1 from public.loans where borrower_id=p_borrower_id and status='borrowed') then raise exception 'Return this borrower’s active loans before deactivating the record.'; end if;
  update public.borrowers set is_active=p_is_active where id=p_borrower_id;
  if not found then raise exception 'Borrower not found.'; end if;
end $$;

revoke all on function public.submit_borrow_request(uuid,text,text,text,text,integer) from public;
revoke all on function public.submit_return_request(text,text,uuid) from public;
revoke all on function public.track_borrow_request(text) from public;
revoke all on function public.staff_approve_borrow_request(uuid) from public;
revoke all on function public.staff_reject_borrow_request(uuid) from public;
revoke all on function public.staff_review_return_request(uuid,boolean) from public;
revoke all on function public.return_book(uuid) from public;
revoke all on function public.admin_set_borrower_active(uuid,boolean) from public;
grant execute on function public.submit_borrow_request(uuid,text,text,text,text,integer) to anon,authenticated;
grant execute on function public.submit_return_request(text,text,uuid) to anon,authenticated;
grant execute on function public.track_borrow_request(text) to anon,authenticated;
grant execute on function public.staff_approve_borrow_request(uuid) to authenticated;
grant execute on function public.staff_reject_borrow_request(uuid) to authenticated;
grant execute on function public.staff_review_return_request(uuid,boolean) to authenticated;
grant execute on function public.return_book(uuid) to authenticated;
grant execute on function public.admin_set_borrower_active(uuid,boolean) to authenticated;

-- Create the first account in the staff portal. It receives the administrator role.
