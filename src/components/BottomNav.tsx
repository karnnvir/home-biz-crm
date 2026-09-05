import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Speak", icon: "🎙️", end: true },
  { to: "/orders", label: "Orders", icon: "🧾" },
  { to: "/customers", label: "Customers", icon: "👤" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
