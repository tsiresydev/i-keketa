import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './context/session-provider';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';

export const App = () => (
  <BrowserRouter>
    <SessionProvider>
      <PwaInstallPrompt />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  </BrowserRouter>
);
