import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, BookOpen, Search, Shield, Undo2, X } from 'lucide-react'
import { supabase, type Book, type RequestRow } from '../lib'
import { formatDate } from '../utils/format'

export default function CustomerPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [toast, setToast] = useState('')
  const [trackingReference, setTrackingReference] = useState('')
  const [trackingResult, setTrackingResult] = useState<RequestRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestBusy, setRequestBusy] = useState(false)
  const [returnBusy, setReturnBusy] = useState(false)
  const [returnError, setReturnError] = useState('')

  const loadCatalog = useCallback(async () => {
      if (!supabase) return

      const [booksResult, categoriesResult] = await Promise.all([
          supabase.from('books').select('*,categories(name)').order('title'),
          supabase.from('categories').select('id,name').order('name'),
      ])

      if (booksResult.error || categoriesResult.error) {
        setToast(
          booksResult.error?.message ||
          categoriesResult.error?.message ||
          'Could not load the library catalog.',
        )
        setBooks([])
        setCategories([])
      } else {
        setBooks(booksResult.data as Book[])
        setCategories(categoriesResult.data)
      }

      setLoading(false)
    }, [])

  useEffect(() => {
      void loadCatalog()
    }, [loadCatalog])

  const visibleBooks = books.filter((book) => {
      const matchesCategory = category === 'all' || book.category_id === category
      const matchesSearch = `${book.title} ${book.author}`
      .toLowerCase()
      .includes(query.toLowerCase())

      return matchesCategory && matchesSearch
  })

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedBook || !supabase) return

    const formData = new FormData(event.currentTarget)
    setRequestBusy(true)
    const { data, error } = await supabase.rpc('submit_borrow_request', {
        p_book_id: selectedBook.id,
        p_name: String(formData.get('name')),
        p_email: String(formData.get('email')),
        p_phone: String(formData.get('phone') || ''),
        p_address: String(formData.get('address')),
        p_days: Number(formData.get('days')),
    })

    setRequestBusy(false)
    if (error) {
      setToast(error.message)
      return
    }

    setSelectedBook(null)
    setToast(`Request received. Your reference is ${data}. Save it to track your request.`)
    void loadCatalog()
  }

  async function submitReturnRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setReturnBusy(true)
    setReturnError('')
    const form = event.currentTarget
    const formData = new FormData(form)
    const { error } = await supabase.rpc('submit_return_request', {
      p_name: String(formData.get('return_name')),
      p_email: String(formData.get('return_email')),
      p_book_id: String(formData.get('return_book')),
    })
    setReturnBusy(false)
    if (error) setReturnError(error.message)
    else {
      form.reset()
      setToast('Return notice sent. A librarian will confirm the book when it is received.')
    }
  }

  async function trackRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    const { data, error } = await supabase.rpc('track_borrow_request', {
        p_reference: trackingReference.trim(),
    })

    if (error || !data?.length) {
      setTrackingResult(null)
      setToast('No request found for that reference.')
      return
    }

    const result = data[0]
    setTrackingResult({
        reference: result.reference,
        status: result.status,
        requested_at: result.requested_at,
        due_date: result.due_date,
        books: { title: result.book_title, author: result.book_author },
      } as RequestRow)
  }

return <div className="public-app">
  <header className="public-nav">
    <a className="brand" href="#home">
      <span className="brand-mark">
        <BookOpen size={21}/>
      </span>
      <span>Nizel <b>Library</b>
      </span>
    </a>
    <nav>
      <a href="#collection">Collection</a>
      <a href="#how">How it works</a>
      <a href="#track">Track request</a>
    </nav>
    <a className="button button-dark small" href="#collection">Explore books <ArrowUpRight size={15}/>
    </a>
  </header>
  <section id="home" className="hero">
    <div className="hero-copy">
      <span className="pill">
        <span className="dot"/> YOUR NEIGHBORHOOD LIBRARY</span>
      <h1>Stories worth<br/>coming back <em>to.</em>
      </h1>
      <p>Find your next favorite in our shelves. Browse the collection and request a book in just a few steps.</p>
      <a href="#collection" className="button button-dark">Browse the collection <ArrowDownLeft size={16}/>
      </a>
      <div className="hero-note">
        <span className="tiny-icon">
          <Shield size={14}/>
        </span> No account needed to request a book</div>
    </div>
    <div className="hero-art">
      <div className="sun"/>
      <div className="art-book">
        <span>THE<br/>QUIET<br/>CHAPTER</span>
        <small>NIZEL LIBRARY</small>
      </div>
      <div className="plant">✳</div>
      <div className="art-caption">A little room for wonder.</div>
    </div>
  </section>
  <main>
    <section className="collection-section" id="collection">
      <div className="section-head">
        <div>
          <p className="eyebrow">FIND YOUR NEXT READ</p>
          <h2>On our shelves</h2>
        </div>
        <span className="muted">{books.length} titles in the collection</span>
      </div>
      <div className="toolbar">
        <label className="search-box">
          <Search size={17}/>
          <input placeholder="Search title or author" value={query} onChange={e=>setQuery(e.target.value)}/>
          </label>
          <select value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="all">All categories</option>{categories.map(c=>
            <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>{loading?<div className="empty">Loading the collection…</div>:visibleBooks.length===0?<div className="empty">No available books match your search.</div>:<div className="book-grid">{visibleBooks.map((book,i)=>
          <article className="book-card" key={book.id}>
            <div className={`book-cover cover-${i%5}`}>{book.cover_url?<img src={book.cover_url} alt=""/>:<>
                <BookOpen size={24}/>
                <span>{book.title}</span>
              </>}</div>
            <div className="book-info">
              <span className="category-label">{book.categories?.name||'Collection'}</span>
              <h3>{book.title}</h3>
              <p>{book.author}</p>
              <div className="book-bottom">
                <span>{book.available_copies} available</span>
                <button className="text-button" disabled={book.available_copies < 1} onClick={()=>setSelectedBook(book)}>{book.available_copies > 0 ? <>Request <ArrowUpRight size={14}/></> : 'Unavailable'}
                </button>
              </div>
            </div>
          </article>)}</div>}</section>
      <section className="info-band" id="how">
        <div>
          <p className="eyebrow">SIMPLE AS A GOOD STORY</p>
          <h2>Borrowing, made easy.</h2>
        </div>
        <div className="steps">
          <div>
            <b>01</b>
            <span>Browse the shelves and pick a book.</span>
          </div>
          <div>
            <b>02</b>
            <span>Send your request with your contact details.</span>
          </div>
          <div>
            <b>03</b>
            <span>We’ll confirm when it’s ready for pickup.</span>
          </div>
        </div>
      </section>
      <section className="track-section" id="track">
        <div>
          <p className="eyebrow">ALREADY SENT A REQUEST?</p>
          <h2>Check its progress.</h2>
          <p className="muted">Enter the reference number shown after you submitted your request.</p>
        </div>
        <form className="track-form" onSubmit={trackRequest}>
          <input required placeholder="e.g. NL-8A41F2" value={trackingReference} onChange={e=>setTrackingReference(e.target.value)}/>
            <button className="button button-dark">Track <ArrowUpRight size={15}/>
            </button>{trackingResult&&<div className="track-result">
              <b>{trackingResult.books?.title}</b>
              <span className={`status ${trackingResult.status}`}>{trackingResult.status}</span>
              <small>Requested {formatDate(trackingResult.requested_at)}{trackingResult.due_date?` · Due ${formatDate(trackingResult.due_date)}`:''}</small>
            </div>}</form>
        </section>
      <section className="track-section return-section" id="return">
        <div>
          <p className="eyebrow">RETURN A BOOK</p>
          <h2>Let us know it’s back.</h2>
          <p className="muted">Send a return notice with the email used for your loan. Staff will confirm the book before updating availability.</p>
        </div>
        <form className="return-form" onSubmit={submitReturnRequest}>
          <label>Your name<input name="return_name" required minLength={2} maxLength={120} /></label>
          <label>Email used for the loan<input name="return_email" required type="email" maxLength={254} /></label>
          <label>Book<select name="return_book" required defaultValue=""><option value="" disabled>Choose a book</option>{books.map(book => <option key={book.id} value={book.id}>{book.title} — {book.author}</option>)}</select></label>
          {returnError && <p className="error" role="alert">{returnError}</p>}
          <button className="button button-dark" disabled={returnBusy || loading}>{returnBusy ? 'Sending…' : 'Send return notice'} <Undo2 size={15}/></button>
        </form>
      </section>
      </main>
      <footer>
        <a className="brand" href="#home">
          <span className="brand-mark">
            <BookOpen size={18}/>
          </span>Nizel <b>Library</b>
        </a>
        <span>Good books. Good neighbors.</span>
        <span>Open to everyone</span>
      </footer>{selectedBook&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedBook(null)}}>
        <form className="dialog" onSubmit={submitRequest}>
          <button type="button" className="close" onClick={()=>setSelectedBook(null)}>
            <X/>
          </button>
          <p className="eyebrow">REQUEST THIS BOOK</p>
          <h2>{selectedBook.title}</h2>
          <p className="muted">by {selectedBook.author} · {selectedBook.categories?.name||'Collection'} · {selectedBook.available_copies} available</p>{selectedBook.description&&<p className="book-description">{selectedBook.description}</p>}<label>Your name<input required name="name" minLength={2} maxLength={100}/>
          </label>
          <label>Email address<input required name="email" type="email" maxLength={254}/>
          </label>
          <label>Phone number <span className="muted">(optional)</span>
            <input name="phone" maxLength={30}/>
          </label>
          <label>Home address<input name="address" required minLength={3} maxLength={300} autoComplete="street-address" /></label>
          <label>Borrowing period <span className="muted">(1–30 days)</span><input name="days" type="number" min={1} max={30} defaultValue={14} required /></label>
          <button className="button button-dark full" disabled={requestBusy}>{requestBusy?'Sending request…':'Send borrowing request'} <ArrowUpRight size={16}/>
          </button>
          <small className="muted">The library team will contact you about pickup.</small>
        </form>
      </div>}{toast&&<div className="toast" onClick={()=>setToast('')}>{toast}<button onClick={()=>setToast('')}>
          <X size={15}/>
        </button>
      </div>}</div>
    }
