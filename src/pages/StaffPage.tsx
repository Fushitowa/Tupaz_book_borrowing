import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  CalendarClock,
  LayoutDashboard,
  Library,
  LogOut,
  Plus,
  Search,
  Settings2,
  Shield,
  Users,
  X,
} from 'lucide-react'
import BookCover from '../components/BookCover'
import BrandLogo from '../components/BrandLogo'
import RequestTable from '../components/RequestTable'
import StatCard from '../components/StatCard'
import { supabase, type Book, type Borrower, type Loan, type RequestRow, type RequestStatus, type ReturnRequest, type Role } from '../lib'
import { formatDate } from '../utils/format'

type Section = 'overview' | 'books' | 'requests' | 'loans' | 'borrowers' | 'people' | 'categories'
type LibrarianProfile = {
  id: string
  full_name: string | null
  email: string
  role: Role
  created_at: string
}

export default function StaffPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [role, setRole] = useState<Role | null>(null)
  const [section, setSection] = useState<Section>('overview')
  const [books, setBooks] = useState<Book[]>([])
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [librarians, setLibrarians] = useState<LibrarianProfile[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [adminSetupAvailable, setAdminSetupAvailable] = useState<boolean | null>(null)
  const [creatingAdmin, setCreatingAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [editingBook, setEditingBook] = useState<Book | null | false>(false)
  const [addingLibrarian, setAddingLibrarian] = useState(false)

  const loadDashboardData = useCallback(async () => {
      if (!supabase) return

      const [booksResult, requestsResult, returnsResult, loansResult, borrowersResult, librariansResult, categoriesResult] =
      await Promise.all([
          supabase.from('books').select('*,categories(name)').order('title'),
          supabase
          .from('borrow_requests')
          .select('*,books(title,author)')
          .order('requested_at', { ascending: false }),
          supabase.from('return_requests').select('*,books(title,author)').order('requested_at', { ascending: false }),
          supabase.from('loans').select('*,books(title,author),borrowers(name,email)').order('borrowed_at', { ascending: false }),
          supabase.from('borrowers').select('*').order('name'),
          supabase
          .from('profiles')
          .select('id,full_name,email,role,created_at')
          .eq('role', 'librarian')
          .order('full_name'),
          supabase.from('categories').select('id,name').order('name'),
      ])

      const firstError = [
        booksResult.error,
        requestsResult.error,
        returnsResult.error,
        loansResult.error,
        borrowersResult.error,
        librariansResult.error,
        categoriesResult.error,
      ].find((error) => error !== null)

      if (firstError) setMessage(firstError.message)
      if (!booksResult.error) setBooks(booksResult.data as Book[])
      if (!requestsResult.error) setRequests(requestsResult.data as RequestRow[])
      if (!returnsResult.error) setReturnRequests(returnsResult.data as ReturnRequest[])
      if (!loansResult.error) setLoans(loansResult.data as Loan[])
      if (!borrowersResult.error) setBorrowers(borrowersResult.data as Borrower[])
      if (!librariansResult.error) setLibrarians(librariansResult.data)
      if (!categoriesResult.error) setCategories(categoriesResult.data)
    }, [])

  useEffect(() => {
      if (!supabase) return

      supabase.auth.getSession().then(({ data }) => setSession(data.session))
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession)
      })
      void supabase.rpc('admin_setup_available').then(({ data, error }) => {
        setAdminSetupAvailable(!error && data === true)
        if (error) setMessage('Account setup is unavailable. Run supabase/schema.sql in your Supabase project, then reload this page.')
      })

      return () => subscription.unsubscribe()
    }, [])

  useEffect(() => {
      if (!session || !supabase) {
        setRole(null)
        return
      }

      supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
          setRole(data?.role || null)
          if (data?.role) void loadDashboardData()
      })
    }, [session, loadDashboardData])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    const formData = new FormData(event.currentTarget)
    const { error } = await supabase.auth.signInWithPassword({
        email: String(formData.get('email')),
        password: String(formData.get('password')),
    })
    setBusy(false)
    if (error) setMessage(error.message)
  }

  async function createFirstAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name')).trim()
    const email = String(formData.get('email')).trim().toLowerCase()
    const password = String(formData.get('password'))

    setBusy(true)
    setMessage('')
    const { data: setupAvailable, error: setupError } = await supabase.rpc('admin_setup_available')
    if (setupError || !setupAvailable) {
      setBusy(false)
      setAdminSetupAvailable(false)
      setMessage(setupError?.message || 'An administrator account already exists. Ask that administrator to create your staff account.')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }

    setAdminSetupAvailable(false)
    setCreatingAdmin(false)
    setMessage(data.session
      ? 'Administrator account created. You are now signed in.'
      : 'Administrator account created. Check your email to confirm it, then sign in.')
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    const formData = new FormData(event.currentTarget)
    const bookId = editingBook ? editingBook.id : null
    const values = {
      title: String(formData.get('title')).trim(),
      author: String(formData.get('author')).trim(),
      category_id: String(formData.get('category') || '') || null,
      description: String(formData.get('description') || ''),
      cover_url: String(formData.get('cover') || '') || null,
      isbn: String(formData.get('isbn') || '') || null,
      total_copies: Number(formData.get('copies')),
    }

    setBusy(true)
    const result = bookId
    ? await supabase.from('books').update(values).eq('id', bookId)
    : await supabase
    .from('books')
    .insert({ ...values, available_copies: values.total_copies })
    setBusy(false)

    if (result.error) {
      setMessage(result.error.message)
      return
    }

    setEditingBook(false)
    setMessage('Book saved.')
    void loadDashboardData()
  }

  async function changeRequestStatus(id: string, status: RequestStatus) {
    if (!supabase) return
    const rpc = status === 'approved' ? 'staff_approve_borrow_request' : 'staff_reject_borrow_request'
    const { error } = await supabase.rpc(rpc, { p_request_id: id })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(`Request marked ${status}.`)
    void loadDashboardData()
  }

  async function reviewReturnRequest(id: string, approve: boolean) {
    if (!supabase) return
    const { error } = await supabase.rpc('staff_review_return_request', { p_request_id: id, p_approve: approve })
    if (error) setMessage(error.message)
    else { setMessage(approve ? 'Return confirmed and inventory updated.' : 'Return notice rejected.'); void loadDashboardData() }
  }

  async function markLoanReturned(loan: Loan) {
    if (!supabase || loan.status !== 'borrowed' || !confirm(`Confirm return of “${loan.books?.title || 'this book'}”?`)) return
    const { error } = await supabase.rpc('return_book', { p_loan_id: loan.id })
    if (error) setMessage(error.message)
    else { setMessage('Book marked as returned. Inventory updated.'); void loadDashboardData() }
  }

  async function deleteBook(book: Book) {
    if (!supabase || !confirm(`Delete “${book.title}”?`)) return

    const { error } = await supabase.from('books').delete().eq('id', book.id)
    if (error) setMessage(error.message)
    else void loadDashboardData()
  }

  async function createLibrarian(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    const formData = new FormData(event.currentTarget)
    setBusy(true)
    const { error } = await supabase.functions.invoke('manage-librarian', {
        body: {
          name: String(formData.get('name')).trim(),
          email: String(formData.get('email')).trim(),
          password: String(formData.get('password')),
        },
    })
    setBusy(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setAddingLibrarian(false)
    setMessage('Librarian account created. Share the temporary password securely.')
    void loadDashboardData()
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const { error } = await supabase
    .from('categories')
    .insert({ name: String(formData.get('name')).trim() })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Category added.')
    form.reset()
    void loadDashboardData()
  }

  const visibleBooks = books.filter((book) =>
    `${book.title} ${book.author}`.toLowerCase().includes(search.toLowerCase()),
  )
  const pendingCount = requests.filter((request) => request.status === 'pending').length + returnRequests.filter((request) => request.status === 'pending').length
  const activeCount = loans.filter((loan) => loan.status === 'borrowed').length
  const overdueCount = loans.filter((loan) => loan.status === 'borrowed' && new Date(loan.due_at) < new Date()).length

  if (session === undefined) return <div className="login-page">Loading…</div>
  if (!session) return <div className="login-page">
  <a className="brand" href="#">
    <BrandLogo />Nizel <b>Library</b>
  </a>
  {creatingAdmin ? <form className="login-card" onSubmit={createFirstAdmin}>
    <p className="eyebrow">FIRST-TIME SETUP</p>
    <h1>Create your account.</h1>
    <p className="muted">The first account becomes the Nizel Library administrator.</p>
    <label>Full name<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>
    <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
    <label>Password<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>
    {message&&<p className="error" role="alert">{message}</p>}
    <button className="button button-dark full" disabled={busy}>{busy?'Creating account…':'Create administrator account'} <ArrowUpRight size={16}/></button>
    <button type="button" className="login-switch" onClick={()=>{setCreatingAdmin(false);setMessage('')}}>Back to sign in</button>
  </form> : <form className="login-card" onSubmit={login}>
    <p className="eyebrow">STAFF PORTAL</p>
    <h1>Welcome back.</h1>
    <p className="muted">Sign in with your library staff account.</p>
    <label>Email address<input name="email" type="email" required autoComplete="username"/>
    </label>
    <label>Password<input name="password" type="password" required autoComplete="current-password"/>
    </label>{message&&<p className="error" role="alert">{message}</p>}<button className="button button-dark full" disabled={busy}>{busy?'Signing in…':'Sign in'} <ArrowUpRight size={16}/>
    </button>
    {adminSetupAvailable ? <button type="button" className="login-switch" onClick={()=>{setCreatingAdmin(true);setMessage('')}}>First time here? Create the administrator account</button> : <small className="muted">Need librarian access? Ask an admin to create your account under Librarians.</small>}
  </form>}
</div>
  if (!role) return <div className="login-page">
  <div className="login-card">
    <p className="eyebrow">ACCESS NOT SET UP</p>
    <h1>Staff profile needed.</h1>
    <p className="muted">Your account is signed in but has no staff role. Ask the library administrator to assign your role in Supabase.</p>
    <button className="button button-dark" onClick={()=>supabase!.auth.signOut()}>Sign out</button>
  </div>
</div>
const navigation: Array<{ section: Section; label: string; Icon: LucideIcon }> = [
    { section: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { section: 'books', label: 'Books', Icon: BookOpen },
    { section: 'requests', label: 'Requests', Icon: ArrowUpRight },
    { section: 'loans', label: 'Loans', Icon: CalendarClock },
    ...(role === 'admin'
      ? [
          { section: 'borrowers' as const, label: 'Borrowers', Icon: Users },
          { section: 'people' as const, label: 'Librarians', Icon: Users },
          { section: 'categories' as const, label: 'Categories', Icon: Settings2 },
        ]
      : []),
  ]

  return <div className="staff-app">
  <aside className="sidebar">
    <a className="brand" href="#">
      <BrandLogo />
      <span>Nizel<br/>
        <b>Library</b>
      </span>
    </a>
    <div className="side-label">WORKSPACE</div>
    <nav>{navigation.map(({ section: key, label, Icon })=>
      <button key={key} className={section===key?'active':''} onClick={()=>setSection(key)}>
        <Icon size={17}/>{label}{key==='requests'&&pendingCount>0&&<i>{pendingCount}</i>}</button>)}</nav>
    <div className="sidebar-bottom">
      <div className="user-chip">
        <div className="avatar">{session.user.email?.[0]?.toUpperCase()}</div>
        <div>
          <b>{session.user.email?.split('@')[0]}</b>
          <small>{role}</small>
        </div>
      </div>
      <button className="signout" onClick={()=>supabase!.auth.signOut()}>
        <LogOut size={16}/> Sign out</button>
    </div>
  </aside>
  <main className="staff-main">
    <header className="staff-top">
      <div>
        <span className="crumb">Nizel Library <span>/</span> {section[0].toUpperCase()+section.slice(1)}</span>
        <h1>{section==='overview'?'Good day, '+(session.user.email?.split('@')[0]||'')+'.':section==='requests'?'Borrow requests':section==='loans'?'Active loans and returns':section==='borrowers'?'Borrower records':section==='people'?'Librarian accounts':section==='categories'?'Book categories':'Book collection'}</h1>
      </div>
      <div className="top-actions">
        <span className="role-pill">
          <Shield size={14}/> {role}</span>
        <button className="icon-button" title="Refresh data" onClick={()=>void loadDashboardData()}>
          <Clock3 size={17}/>
        </button>
      </div>
    </header>{message&&<div className="notice" onClick={()=>setMessage('')}>{message}<button>
        <X size={14}/>
      </button>
    </div>}
    {section==='overview'&&<>
      <div className="stat-grid">
        <StatCard title="Total titles" value={books.length} hint={`${books.reduce((n,b)=>n+b.total_copies,0)} copies in collection`} icon={<Library/>}/>
          <StatCard title="Pending requests" value={pendingCount} hint="Borrow and return notices" icon={<Clock3/>} accent/>
          <StatCard title="Currently borrowed" value={activeCount} hint="Active loans, not yet returned" icon={<ArrowUpRight/>}/>
          <StatCard title="Overdue" value={overdueCount} hint="Past expected return date" icon={<CircleHelp/>}/>
        </div>
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Recent requests</h2>
                <p>Latest activity from readers</p>
              </div>
              <button className="text-button" onClick={()=>setSection('requests')}>View all <ArrowUpRight size={14}/>
              </button>
            </div>
            <RequestTable rows={requests.slice(0,6)} onChange={changeRequestStatus} compact/>
          </section>
          <section className="panel stock-panel">
            <div className="panel-head">
              <div>
                <h2>Collection snapshot</h2>
                <p>Availability across your shelves</p>
              </div>
            </div>
            <div className="stock-count">
              <strong>{books.reduce((n,b)=>n+b.available_copies,0)}</strong>
              <span>copies available</span>
            </div>
            <div className="stock-list">{books.slice(0,5).map(b=>
              <div key={b.id}>
                <span>{b.title}</span>
                <b>{b.available_copies} / {b.total_copies}</b>
              </div>)}</div>
          </section>
        </div>
      </>}
      {section==='books'&&<section className="panel">
        <div className="panel-head">
          <div>
            <h2>Books</h2>
            <p>{role==='admin'?'Manage titles and copy counts.':'Browse the library collection and check book availability.'}</p>
          </div>
          {role==='admin'&&<button className="button button-dark small" onClick={()=>setEditingBook(null)}>
            <Plus size={15}/> Add book</button>}
        </div>
        <div className="toolbar staff-toolbar">
          <label className="search-box">
            <Search size={16}/>
            <input placeholder="Search books" value={search} onChange={e=>setSearch(e.target.value)}/>
            </label>
            <span className="muted">{books.length} books</span>
          </div>
          {visibleBooks.length === 0
            ? <div className="empty books-empty">No books match your search.</div>
            : <div className="staff-book-grid">
                {visibleBooks.map((book, index) => <article className="staff-book-card" key={book.id}>
                  <BookCover book={book} variant={index} />
                  <div className="staff-book-details">
                    <span className="staff-book-category">{book.categories?.name || 'Uncategorized'}</span>
                    <h3>{book.title}</h3>
                    <p className="staff-book-author">{book.author}</p>
                    <div className="staff-book-meta">
                      <span className="availability"><i className={book.available_copies ? '' : 'low'} />{book.available_copies} / {book.total_copies} copies</span>
                      <span className="staff-book-isbn">ISBN {book.isbn || '—'}</span>
                    </div>
                    {role === 'admin' && <div className="staff-book-actions">
                      <button onClick={() => setEditingBook(book)}>Edit</button>
                      <button className="danger-link" onClick={() => void deleteBook(book)}>Delete</button>
                    </div>}
                  </div>
                </article>)}
              </div>}
        </section>}
      {section==='requests'&&<>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>All borrowing activity</h2>
          <p>Review borrow requests. Approval creates a borrower record and starts a timed loan.</p>
            </div>
          <span className="count-pill">{requests.filter(r=>r.status==='pending').length} pending</span>
          </div>
          <RequestTable rows={requests} onChange={changeRequestStatus}/>
        </section>
        <section className="panel return-requests-panel">
          <div className="panel-head"><div><h2>Return notices</h2><p>Confirm the matching active loan when the book is received.</p></div><span className="count-pill">{returnRequests.filter(r=>r.status==='pending').length} pending</span></div>
          <div className="table-scroll"><table><thead><tr><th>READER</th><th>BOOK</th><th>RECEIVED</th><th>STATUS</th><th /></tr></thead><tbody>{returnRequests.length===0?<tr><td colSpan={5} className="empty-cell">No return notices yet.</td></tr>:returnRequests.map(r=><tr key={r.id}><td><b>{r.customer_name}</b><small>{r.customer_email}</small></td><td>{r.books?.title||'—'}</td><td>{formatDate(r.requested_at)}</td><td><span className={`status ${r.status}`}>{r.status}</span></td><td className="row-actions">{r.status==='pending'&&<><button className="approve" onClick={()=>void reviewReturnRequest(r.id,true)}>Confirm return</button><button className="danger-link" onClick={()=>void reviewReturnRequest(r.id,false)}>Reject</button></>}</td></tr>)}</tbody></table></div>
        </section>
      </>}
      {section==='loans'&&<section className="panel"><div className="panel-head"><div><h2>Loan history</h2><p>Review due dates and record books as returned.</p></div><span className="count-pill">{activeCount} active · {overdueCount} overdue</span></div><div className="table-scroll"><table><thead><tr><th>BOOK</th><th>BORROWER</th><th>CHECKED OUT</th><th>DUE DATE</th><th>STATUS</th><th /></tr></thead><tbody>{loans.length===0?<tr><td colSpan={6} className="empty-cell">No loans have been created yet.</td></tr>:loans.map(loan=>{const overdue=loan.status==='borrowed'&&new Date(loan.due_at)<new Date();return <tr key={loan.id}><td><b>{loan.books?.title||'—'}</b><small>{loan.books?.author||''}</small></td><td><b>{loan.borrowers?.name||'—'}</b><small>{loan.borrowers?.email||''}</small></td><td>{formatDate(loan.borrowed_at)}</td><td>{formatDate(loan.due_at)}</td><td><span className={`status ${loan.status==='returned'?'returned':overdue?'rejected':'approved'}`}>{loan.status==='returned'?'returned':overdue?'overdue':'borrowed'}</span></td><td className="row-actions">{loan.status==='borrowed'&&<button className="approve" onClick={()=>void markLoanReturned(loan)}>Mark returned</button>}</td></tr>})}</tbody></table></div></section>}
      {section==='borrowers'&&role==='admin'&&<section className="panel"><div className="panel-head"><div><h2>Borrowers</h2><p>Created when a borrow request is approved. Deactivate a record to stop future borrowing.</p></div><span className="count-pill">{borrowers.length} records</span></div><div className="table-scroll"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>RECORD</th><th>ADDED</th><th /></tr></thead><tbody>{borrowers.length===0?<tr><td colSpan={5} className="empty-cell">Borrower records are added when requests are approved.</td></tr>:borrowers.map(b=><tr key={b.id}><td><b>{b.name}</b></td><td>{b.email}</td><td><span className={`status ${b.is_active?'approved':'rejected'}`}>{b.is_active?'active':'inactive'}</span></td><td>{formatDate(b.created_at)}</td><td className="row-actions"><button onClick={async()=>{const {error}=await supabase!.rpc('admin_set_borrower_active',{p_borrower_id:b.id,p_is_active:!b.is_active});if(error)setMessage(error.message);else void loadDashboardData()}}>{b.is_active?'Deactivate':'Reactivate'}</button></td></tr>)}</tbody></table></div></section>}
        {section==='categories'&&role==='admin'&&<div className="dashboard-grid">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Categories</h2>
                <p>Group titles for easy browsing.</p>
              </div>
            </div>
            <form className="inline-form" onSubmit={addCategory}>
              <input name="name" required maxLength={50} placeholder="New category name"/>
              <button className="button button-dark small">
                <Plus size={15}/> Add</button>
            </form>
            <div className="category-list">{categories.map(c=>
              <div key={c.id}>
                <span>{c.name}</span>
                <button className="danger-link" onClick={async()=>{const {error}=await supabase!.from('categories').delete().eq('id',c.id);
                  if(error)setMessage(error.message);
                  else void loadDashboardData()}}>Remove</button>
              </div>)}</div>
          </section>
          <div className="hint-card">
            <Settings2/>
            <h3>Keep it organized</h3>
            <p>Categories make it easier for readers to find books on the public website.</p>
          </div>
        </div>}
        {section==='people'&&role==='admin'&&<section className="panel">
          <div className="panel-head">
            <div>
              <h2>Librarian accounts</h2>
              <p>Staff profiles with borrowing desk access.</p>
            </div>
            <button className="button button-dark small" onClick={()=>setAddingLibrarian(true)}>
              <Plus size={15}/> Create librarian account</button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>LIBRARIAN</th>
                  <th>EMAIL</th>
                  <th>ADDED</th>
                </tr>
              </thead>
              <tbody>{librarians.map(p=>
                <tr key={p.id}>
                  <td>
                    <b>{p.full_name||'—'}</b>
                  </td>
                  <td>{p.email}</td>
                  <td>{formatDate(p.created_at)}</td>
                </tr>)}</tbody>
            </table>
          </div>
        </section>}
      </main>{addingLibrarian&&<div className="overlay">
        <form className="dialog" onSubmit={createLibrarian}>
          <button type="button" className="close" onClick={()=>setAddingLibrarian(false)}>
            <X/>
          </button>
          <p className="eyebrow">STAFF ACCESS</p>
          <h2>Add a librarian</h2>
          <label>Full name<input name="name" required maxLength={100}/>
          </label>
          <label>Email address<input name="email" type="email" required maxLength={254}/>
          </label>
          <label>Temporary password<input name="password" type="password" required minLength={8}/>
          </label>
          <button className="button button-dark full" disabled={busy}>{busy?'Creating…':'Create librarian account'} <Users size={16}/>
          </button>
          <small className="muted">They can change their password after signing in. Edge Function deployment is required.</small>
        </form>
      </div>}{editingBook!==false&&<div className="overlay">
        <form className="dialog" onSubmit={saveBook}>
          <button type="button" className="close" onClick={()=>setEditingBook(false)}>
            <X/>
          </button>
          <p className="eyebrow">{editingBook?'EDIT TITLE':'NEW TITLE'}</p>
          <h2>{editingBook?'Update book details':'Add a book'}</h2>
          <label>Title<input name="title" required maxLength={180} defaultValue={editingBook?editingBook.title:''}/>
          </label>
          <label>Author<input name="author" required maxLength={120} defaultValue={editingBook?editingBook.author:''}/>
          </label>
          <label>Category<select name="category" defaultValue={(editingBook ? editingBook.category_id || '' : '')}>
            <option value="">Uncategorized</option>{categories.map(c=>
            <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label>Description<textarea name="description" rows={3} maxLength={1500} defaultValue={editingBook?editingBook.description:''}/>
        </label>
        <div className="form-row">
          <label>Total copies<input name="copies" type="number" min="0" required defaultValue={editingBook?editingBook.total_copies:1}/>
          </label>
          <label>ISBN<input name="isbn" maxLength={30} defaultValue={editingBook?editingBook.isbn||'':''}/>
          </label>
        </div>
        <label>Cover image URL <span className="muted">(optional)</span>
          <input name="cover" type="url" defaultValue={editingBook?editingBook.cover_url||'':''}/>
        </label>
        <button className="button button-dark full" disabled={busy}>{busy?'Saving…':'Save book'} <Check size={16}/>
        </button>
      </form>
    </div>}</div>
  }
