export type Role = 'admin' | 'librarian'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'returned'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'
export type LoanStatus = 'borrowed' | 'returned'

export type Book = {
  id: string
  title: string
  author: string
  category_id: string | null
  description: string
  cover_url: string | null
  isbn: string | null
  total_copies: number
  available_copies: number
  created_at: string
  categories?: { name: string } | null
}

export type Borrower = {
  id: string
  name: string
  email: string
  is_active: boolean
  created_at: string
}

export type Loan = {
  id: string
  book_id: string
  borrower_id: string
  status: LoanStatus
  borrowed_at: string
  due_at: string
  returned_at: string | null
  books?: Pick<Book, 'title' | 'author'>
  borrowers?: Pick<Borrower, 'name' | 'email'>
}

export type RequestRow = {
  id: string
  reference: string
  book_id: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  customer_address: string
  requested_days: number
  status: RequestStatus
  requested_at: string
  reviewed_at: string | null
  due_date: string | null
  returned_at: string | null
  loan_id: string | null
  books?: { title: string; author: string }
}

export type ReturnRequest = {
  id: string
  book_id: string
  customer_name: string
  customer_email: string
  status: ReviewStatus
  requested_at: string
  reviewed_at: string | null
  loan_id: string | null
  books?: { title: string; author: string }
}
