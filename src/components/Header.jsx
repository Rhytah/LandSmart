import { useWeb3 } from "../Web3Context";

export default function Header({ theme, onToggleTheme }) {
  const { account, connecting, connect, disconnect } = useWeb3();

  const shortAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">⬡</div>
        <div>
          <div className="header-title">
            Anti<span>Corrupt</span>
          </div>
          <div className="header-subtitle">EA Blockchain Land Registry · 🇺🇬 🇰🇪 🇧🇼</div>
        </div>
      </div>
      <div className="header-right">
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-pressed={theme === "light"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <div style={{ fontSize: 20, letterSpacing: 6 }}>🇺🇬 🇰🇪 🇧🇼</div>
        <div className="network-badge">
          <div className="network-dot" />
          Sepolia Testnet
        </div>
        {account ? (
          <>
            <div className="account-pill">
              <div className="account-dot" />
              {shortAddress}
            </div>
            <button className="connect-btn" onClick={disconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <button className="connect-btn" onClick={connect} disabled={connecting}>
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
