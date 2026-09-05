import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { BottomNav } from "./components/BottomNav";
import { Login } from "./screens/Login";
import { Home } from "./screens/Home";
import { Orders } from "./screens/Orders";
import { OrderDetail } from "./screens/OrderDetail";
import { Customers } from "./screens/Customers";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="empty-state">Loading…</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
