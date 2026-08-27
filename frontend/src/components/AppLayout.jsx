import {
  LayoutDashboard,
  ArrowLeftRight,
  WalletCards,
  PieChart,
  Tags,
  Settings,
  LogOut,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const items = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/transactions', 'Transactions', ArrowLeftRight],
  ['/accounts', 'Accounts', WalletCards],
  ['/budgets', 'Budgets', PieChart],
  ['/categories', 'Categories', Tags],
  ['/settings', 'Settings', Settings],
];

export default function AppLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const title = items.find(([path]) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path),
  )?.[1];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div
          className="brand"
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
        >
          <div className="brand-mark">P</div>

          <div>
            <strong>PinkLedger</strong>
            <span>Money tracker</span>
          </div>
        </div>

        <nav className="side-nav">
          {items.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          className="sidebar-logout"
          type="button"
          onClick={() => signOut()}
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">Personal finance</span>
            <h1>{title || 'PinkLedger'}</h1>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>

      <nav className="mobile-nav">
        {items.slice(0, 5).map(([path, label, Icon]) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className="mobile-nav-link"
          >
            <Icon size={19} />
            <span>{label === 'Transactions' ? 'Activity' : label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}