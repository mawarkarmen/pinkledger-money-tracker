import React from 'react';
import ReactDOM from 'react-dom/client';

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import {
  AuthProvider,
  useAuth,
} from './context/AuthContext';

import AppLayout from './components/AppLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import AccountsPage from './pages/AccountsPage';
import BudgetsPage from './pages/BudgetsPage';
import CategoriesPage from './pages/CategoriesPage';
import SettingsPage from './pages/SettingsPage';

import './styles.css';
import './ui-fixes.css';

function LoadingScreen() {
  return (
    <div className="full-loader">
      <div className="loader" />
      Loading PinkLedger...
    </div>
  );
}

function ProtectedApp() {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={<DashboardPage />}
        />

        <Route
          path="/transactions"
          element={<TransactionsPage />}
        />

        <Route
          path="/accounts"
          element={<AccountsPage />}
        />

        <Route
          path="/budgets"
          element={<BudgetsPage />}
        />

        <Route
          path="/categories"
          element={<CategoriesPage />}
        />

        <Route
          path="/settings"
          element={<SettingsPage />}
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  );
}

function App() {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user
            ? (
              <Navigate
                to="/"
                replace
              />
            )
            : (
              <LoginPage />
            )
        }
      />

      <Route
        path="/*"
        element={<ProtectedApp />}
      />
    </Routes>
  );
}

ReactDOM
  .createRoot(
    document.getElementById(
      'root',
    ),
  )
  .render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );