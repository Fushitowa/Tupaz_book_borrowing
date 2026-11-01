import CustomerPage from './pages/CustomerPage'
import SetupScreen from './components/SetupScreen'
import StaffPage from './pages/StaffPage'
import { isSupabaseConfigured, supabase } from './lib'

const isCustomerPortal = import.meta.env.MODE === 'customer'

export default function App() {
  if (!isSupabaseConfigured || !supabase) {
    return <SetupScreen />
  }

  return isCustomerPortal ? <CustomerPage /> : <StaffPage />
}
