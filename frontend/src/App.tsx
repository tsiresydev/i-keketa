import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/auth-provider';
import { ChatPage } from './pages/ChatPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';

export const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/decouvrir" element={<DiscoverPage />} />
          <Route path="/profil" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
