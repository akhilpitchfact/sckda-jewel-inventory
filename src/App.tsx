import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Shell from './components/Shell';
import { Splash } from './components/ui';
import LoginScreen from './screens/LoginScreen';
import ChangePasswordScreen from './screens/ChangePasswordScreen';
import DashboardScreen from './screens/DashboardScreen';
import ArticleFormScreen from './screens/ArticleFormScreen';
import InventoryScreen from './screens/InventoryScreen';
import ArticleDetailScreen from './screens/ArticleDetailScreen';
import VerificationScreen from './screens/VerificationScreen';
import ReportsScreen from './screens/ReportsScreen';
import AuditScreen from './screens/AuditScreen';
import UsersScreen from './screens/UsersScreen';
import CategoriesScreen from './screens/CategoriesScreen';

export default function App() {
  const { user, loading, can } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <LoginScreen />;
  if (user.mustChangePassword) return <ChangePasswordScreen forced />;

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/inventory" element={<InventoryScreen />} />
        <Route path="/articles/:id" element={<ArticleDetailScreen />} />
        {can('article.create') && <Route path="/new" element={<ArticleFormScreen />} />}
        {(can('article.edit') || can('article.amend')) && <Route path="/articles/:id/edit" element={<ArticleFormScreen />} />}
        {can('article.verify') && <Route path="/verification" element={<VerificationScreen />} />}
        {can('reports.view') && <Route path="/reports" element={<ReportsScreen />} />}
        {can('audit.view') && <Route path="/audit" element={<AuditScreen />} />}
        {can('users.manage') && <Route path="/users" element={<UsersScreen />} />}
        {can('settings.manage') && <Route path="/categories" element={<CategoriesScreen />} />}
        <Route path="/password" element={<ChangePasswordScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
