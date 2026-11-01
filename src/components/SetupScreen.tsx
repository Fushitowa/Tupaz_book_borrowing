import { BookOpen } from 'lucide-react'

export default function SetupScreen() {
  return (
    <main className="setup">
      <div className="brand-mark"><BookOpen /></div>
      <p className="eyebrow">NIZEL LIBRARY</p>
      <h1>Connect your library.</h1>
      <p>
        To load live books and borrowing records, add your Supabase project URL
        and anon key to a local <code>.env</code> file, then run the SQL setup in
        <code>supabase/schema.sql</code>.
      </p>
      <div className="setup-commands">
        <code>npm install</code>
        <code>npm run dev:admin</code>
        <code>npm run dev:customer</code>
      </div>
      <span className="muted">
        Staff portal · localhost:5173 &nbsp; / &nbsp; Customer website ·
        localhost:5174
      </span>
    </main>
  )
}
