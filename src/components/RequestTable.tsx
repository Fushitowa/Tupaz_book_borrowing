import type { RequestStatus, RequestRow } from '../lib'
import { formatDate } from '../utils/format'

type RequestTableProps = {
  rows: RequestRow[]
  onChange: (id: string, status: RequestStatus) => void
  compact?: boolean
}

export default function RequestTable({
  rows,
  onChange,
  compact = false,
}: RequestTableProps) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>READER</th>
            <th>BOOK</th>
            <th>REQUESTED / DUE</th>
            <th>STATUS</th>
            {!compact && <th>REFERENCE</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty-cell">
                No borrowing requests yet.
              </td>
            </tr>
          ) : (
            rows.map((request) => (
              <tr key={request.id}>
                <td>
                  <b>{request.customer_name}</b>
                  <small>{request.customer_email}</small>
                </td>
                <td>{request.books?.title || '—'}</td>
                  <td>{formatDate(request.requested_at)}{request.due_date && <small>Due {formatDate(request.due_date)}</small>}</td>
                <td>
                  <span className={`status ${request.status}`}>
                    {request.status}
                  </span>
                </td>
                {!compact && (
                  <td><code>{request.reference}</code></td>
                )}
                <td className="row-actions">
                  {request.status === 'pending' && (
                    <>
                      <button
                        className="approve"
                        onClick={() => onChange(request.id, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        className="danger-link"
                        onClick={() => onChange(request.id, 'rejected')}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
