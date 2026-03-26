import { useState, useEffect } from "react";
import { Web3Provider } from "./Web3Context";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import IdentityPanel from "./components/IdentityPanel";
import LandPanel from "./components/LandPanel";
import MarketPanel from "./components/MarketPanel";
import AdminPanel from "./components/AdminPanel";
import "./App.css";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "identity", label: "Identity", icon: "◈" },
  { id: "land", label: "Land Registry", icon: "◻" },
  { id: "market", label: "Market", icon: "◇" },
  { id: "admin", label: "Admin", icon: "◉" },
];

function getInitialTheme() {
  try {
    const stored = localStorage.getItem("landsmart-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [theme, setTheme] = useState(() => getInitialTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("landsmart-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <Web3Provider>
      <div className="app">
        <div className="bg-grid" />
        <div className="bg-glow" />
        <Header theme={theme} onToggleTheme={toggleTheme} />
        <nav className="tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
        <main className="main-content">
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "identity" && <IdentityPanel />}
          {activeTab === "land" && <LandPanel />}
          {activeTab === "market" && <MarketPanel />}
          {activeTab === "admin" && <AdminPanel />}
        </main>
      </div>
    </Web3Provider>
  );
}
