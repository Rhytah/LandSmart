import { useWeb3 } from "../Web3Context";

export default function Header({ theme, onToggleTheme }) {
  const { account, connecting, error, connect, disconnect } = useWeb3();

  const shortAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">⬡</div>
        <div className="header-brand-text">
          <div className="header-title">
            Anti<span>Corrupt</span>
          </div>
          <div className="header-subtitle">EA Blockchain Land Registry · 🇺🇬 🇰🇪 🇧🇼</div>
        </div>
      </div>
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
      <div className="header-actions">
        <div className="network-badge">
          <div className="network-dot" />
          <span className="network-label-full">Sepolia Testnet</span>
          <span className="network-label-short" aria-hidden="true">
            Sepolia
          </span>
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
      {error && (
        <div className="header-error-banner error-banner" role="alert">
          {error}
        </div>
      )}
    </header>
  );
}
