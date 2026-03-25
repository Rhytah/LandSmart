import { useWeb3 } from "../Web3Context";

export default function Header() {
  const { account, connecting, error, connect, disconnect } = useWeb3();

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
