import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './i18n'

import MenuPage       from './pages/menu/MenuPage'
import OrderStatus    from './pages/menu/OrderStatus'
import KitchenPanel   from './pages/kitchen/KitchenPanel'
import WaiterPanel    from './pages/waiter/WaiterPanel'
import AdminLayout    from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminMenu      from './pages/admin/AdminMenu'
import AdminTables    from './pages/admin/AdminTables'
import AdminReports   from './pages/admin/AdminReports'
import AdminSettings  from './pages/admin/AdminSettings'
import AdminQR       from './pages/admin/AdminQR'
import AdminStaff     from './pages/admin/AdminStaff'
import AdminAllergens from './pages/admin/AdminAllergens'
import AdminCampaigns from './pages/admin/AdminCampaigns'
import AdminInfoPages from './pages/admin/AdminInfoPages'
import AdminSocial    from './pages/admin/AdminSocial'
import AdminLanguages from './pages/admin/AdminLanguages'
import AdminMedia     from './pages/admin/AdminMedia'
import AdminHeroCards from './pages/admin/AdminHeroCards'
import AdminBulkPrice from './pages/admin/AdminBulkPrice'
import AdminImport    from './pages/admin/AdminImport'
import AdminOutlets   from './pages/admin/AdminOutlets'
import AdminDelivery  from './pages/admin/AdminDelivery'
import AdminSurvey    from './pages/admin/AdminSurvey'
import AdminAI        from './pages/admin/AdminAI'
import SuperLayout    from './pages/super/SuperLayout'
import SuperDashboard from './pages/super/SuperDashboard'
import SuperPlans     from './pages/super/SuperPlans'
import SuperStats     from './pages/super/SuperStats'
import LoginPage      from './pages/auth/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Müşteri */}
        <Route path="/menu/:restaurantSlug/:tableId" element={<MenuPage />} />
        <Route path="/order/:orderId" element={<OrderStatus />} />

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Mutfak */}
        <Route path="/kitchen" element={
          <ProtectedRoute roles={['kitchen','admin','super_admin']}>
            <KitchenPanel />
          </ProtectedRoute>
        } />

        {/* Garson */}
        <Route path="/waiter" element={
          <ProtectedRoute roles={['waiter','admin','super_admin']}>
            <WaiterPanel />
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute roles={['admin','super_admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index        element={<AdminDashboard />} />
          <Route path="menu"       element={<AdminMenu />} />
          <Route path="categories" element={<AdminMenu />} />
          <Route path="tables"     element={<AdminTables />} />
          <Route path="reports"    element={<AdminReports />} />
          <Route path="settings"   element={<AdminSettings />} />
          <Route path="staff"      element={<AdminStaff />} />
          <Route path="analytics"  element={<AdminReports />} />
          <Route path="qr"         element={<AdminQR />} />
          <Route path="orders"     element={<AdminDashboard />} />
          <Route path="allergens"  element={<AdminAllergens />} />
          <Route path="campaigns"  element={<AdminCampaigns />} />
          <Route path="info-pages" element={<AdminInfoPages />} />
          <Route path="social"     element={<AdminSocial />} />
          <Route path="languages"  element={<AdminLanguages />} />
          <Route path="media"      element={<AdminMedia />} />
          <Route path="hero-cards" element={<AdminHeroCards />} />
          <Route path="bulk-price" element={<AdminBulkPrice />} />
          <Route path="import"     element={<AdminImport />} />
          <Route path="outlets"    element={<AdminOutlets />} />
          <Route path="delivery"   element={<AdminDelivery />} />
          <Route path="survey"     element={<AdminSurvey />} />
          <Route path="ai"         element={<AdminAI />} />
        </Route>

        {/* Super Admin */}
        <Route path="/super" element={
          <ProtectedRoute roles={['super_admin']}>
            <SuperLayout />
          </ProtectedRoute>
        }>
          <Route index element={<SuperDashboard />} />
          <Route path="plans" element={<SuperPlans />} />
          <Route path="stats" element={<SuperStats />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
