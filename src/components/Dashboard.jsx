import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../Web3Context";
import { ROLE_NAMES, STATUS_NAMES } from "../contracts";

/** Normalizes getLand() tuple (ethers may expose named props, numeric indices, or both). */
function readLandTuple(raw) {
  if (raw == null) return {};
  const r = raw;
  const pick = (name, i) => r[name] ?? r[i];
  return {
    landID: pick("landID", 0),
    currentOwner: pick("currentOwner", 1),
    plotNumber: pick("plotNumber", 2),
    gpsCoordinates: pick("gpsCoordinates", 3),
    district: pick("district", 4),
    areaSqMeters: pick("areaSqMeters", 5),
    registeredValue: pick("registeredValue", 6),
    status: pick("status", 7),
    registrationDate: pick("registrationDate", 8),
    governmentApproved: pick("governmentApproved", 9),
    verifierApproved: pick("verifierApproved", 10),
  };
}

function formatOwner(addr) {
  if (addr == null || addr === "") return "—";
  const s = typeof addr === "string" ? addr : String(addr);
  if (s.length < 12) return s;
  return `${s.slice(0, 8)}...${s.slice(-4)}`;
}

export default function Dashboard() {
  const { contracts, account } = useWeb3();
  const [stats, setStats] = useState({ landCount: 0, myLands: 0, role: 0, verified: false });
  const [recentLands, setRecentLands] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contracts || !account) return;
    fetchStats();
  }, [contracts, account]);

  async function fetchStats() {
    setLoading(true);
    try {
      const landCount = await contracts.landRegistry.landCount();
      const myLandIDs = await contracts.landRegistry.getLandsByOwner(account);
      const role = await contracts.identityRegistry.getRole(account);
      const verified = await contracts.identityRegistry.isVerified(account);

      setStats({
        landCount: Number(landCount),
        myLands: myLandIDs.length,
        role: Number(role),
        verified,
      });

      const total = Number(landCount);
      const ids = [];
      for (let i = Math.max(1, total - 4); i <= total; i++) ids.push(i);
      const lands = await Promise.all(ids.map((id) => contracts.landRegistry.getLand(id)));
      setRecentLands(
        lands
          .map((l, i) => ({ ...readLandTuple(l), id: ids[i] }))
          .reverse()
      );
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const statusBadge = (s) => {
    const n = Number(s);
    const cls = ["badge-default","badge-pending","badge-verified","badge-disputed","badge-sale"][n] || "badge-default";
    return <span className={`badge ${cls}`}>{STATUS_NAMES[n] || "Unknown"}</span>;
  };

  if (!account) {
    return (
      <div className="connect-prompt">
        <div className="connect-prompt-icon">⬡</div>
        <h2>AntiCorrupt Land Registry</h2>
        <p>Connect your MetaMask wallet to interact with the blockchain land registry system deployed on Sepolia testnet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Project Info Banner */}
      <div style={{
        padding: "16px 20px",
        background: "rgba(0,212,255,0.05)",
        border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: "var(--radius)",
        marginBottom: 24,
        fontSize: 12,
        color: "var(--text2)",
        lineHeight: 1.8
      }}>
        <strong style={{ color: "var(--accent)" }}>
          Blockchain for Government Transparency — Anti-Corruption Smart Contracts
        </strong>
        <br />
        A decentralized land registry system deployed on Ethereum Sepolia testnet.
        Smart contracts enforce transparent ownership, eliminate double selling, and
        automate stamp duty collection — removing all discretionary human control
        from the process. Built by students from 🇺🇬 Uganda · 🇰🇪 Kenya · 🇧🇼 Botswana.
      </div>

      <div className="section-title">Overview</div>
      <div className="section-sub">On-chain land registry — Sepolia Testnet</div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Parcels</div>
          <div className="stat-value">{loading ? "—" : stats.landCount}</div>
          <div className="stat-sub">Registered on-chain</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">My Lands</div>
          <div className="stat-value">{loading ? "—" : stats.myLands}</div>
          <div className="stat-sub">Owned by you</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your Role</div>
          <div className="stat-value" style={{ fontSize: 20, paddingTop: 8 }}>
            {loading ? "—" : ROLE_NAMES[stats.role] || "None"}
          </div>
          <div className="stat-sub">System access level</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">KYC Status</div>
          <div className="stat-value" style={{ fontSize: 20, paddingTop: 8 }}>
            {loading ? "—" : stats.verified ? "✓ Verified" : "✕ Unverified"}
          </div>
          <div className="stat-sub" style={{ color: stats.verified ? "var(--accent3)" : "var(--red)" }}>
            {stats.verified ? "Identity confirmed" : "Not yet verified"}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="card-title-icon">◻</span>
            Recent Land Registrations
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 14px" }} onClick={fetchStats}>
            ↻ Refresh
          </button>
        </div>
        {loading ? (
          <div className="loading"><div className="spinner" /> Loading on-chain data...</div>
        ) : recentLands.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◻</div>
            <div className="empty-text">No land parcels registered yet.<br />Register the first one in the Land Registry tab.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Plot Number</th>
                  <th>District</th>
                  <th>Area (m²)</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Verify</th>
                </tr>
              </thead>
              <tbody>
                {recentLands.map((land) => {
                  const owner = land.currentOwner;
                  return (
                  <tr key={land.id}>
                    <td style={{ color: "var(--text3)" }}>#{land.id}</td>
                    <td style={{ color: "var(--text)", fontWeight: 600 }}>{land.plotNumber ?? "—"}</td>
                    <td>{land.district ?? "—"}</td>
                    <td>{Number(land.areaSqMeters ?? 0).toLocaleString()}</td>
                    <td className="address-cell">{formatOwner(owner)}</td>
                    <td>{statusBadge(land.status)}</td>
                    <td>
                      {owner ? (
                        <a
                          href={`https://sepolia.etherscan.io/address/${owner}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--accent)", fontSize: 11 }}
                        >
                          Etherscan ↗
                        </a>
                      ) : (
                        <span style={{ color: "var(--text3)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">◈</span>Your Wallet</div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text2)" }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "var(--text3)", marginRight: 16 }}>ADDRESS</span>
            <span className="address-cell">{account}</span>
            <a
              href={`https://sepolia.etherscan.io/address/${account}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)", fontSize: 11, marginLeft: 12 }}
            >
              View on Etherscan ↗
            </a>
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "var(--text3)", marginRight: 24 }}>ROLE</span>
            <span className="role-tag">{ROLE_NAMES[stats.role]}</span>
          </div>
          <div>
            <span style={{ color: "var(--text3)", marginRight: 20 }}>KYC</span>
            <span className={`badge ${stats.verified ? "badge-verified" : "badge-disputed"}`}>
              {stats.verified ? "Verified" : "Unverified"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
