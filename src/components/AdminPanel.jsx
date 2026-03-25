import { useState } from "react";
import { useWeb3 } from "../Web3Context";
import { useToast, ToastContainer } from "./Toast";
import { ROLE_NAMES } from "../contracts";

export default function AdminPanel() {
  const { contracts, account } = useWeb3();
  const toast = useToast();
  const [roleForm, setRoleForm] = useState({ address: "", role: "2" });
  const [loading, setLoading] = useState("");

  async function assignRole() {
    if (!roleForm.address) return toast("Enter an address", "error");
    setLoading("role");
    try {
      const tx = await contracts.identityRegistry.assignRole(roleForm.address, Number(roleForm.role));
      toast("Assigning role...", "info");
      await tx.wait();
      toast(`Role "${ROLE_NAMES[roleForm.role]}" assigned successfully`, "success");
      setRoleForm({ address: "", role: "2" });
    } catch (e) { toast(e.reason || e.message || "Failed", "error"); }
    setLoading("");
  }

  if (!account) return <div className="connect-prompt"><div className="connect-prompt-icon">◉</div><h2>Connect Wallet</h2><p>Admin functions require a connected wallet.</p></div>;

  return (
    <div>
      <ToastContainer />
      <div className="section-title">Admin Panel</div>
      <div className="section-sub">System administration — Admin role required</div>

      <div className="card" style={{ borderColor: "rgba(255,59,92,0.2)", background: "rgba(255,59,92,0.02)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, padding: "10px 14px", background: "rgba(255,59,92,0.08)", borderRadius: "var(--radius)", border: "1px solid rgba(255,59,92,0.2)", fontSize: 12, color: "var(--red)" }}>
          ⚠ Admin functions — only callable by the contract deployer wallet
        </div>

        <div className="card-header" style={{ marginTop: 0 }}>
          <div className="card-title"><span className="card-title-icon">◉</span>Assign Role</div>
        </div>

        <div className="form-group">
          <label className="form-label">Wallet Address</label>
          <input className="form-input" placeholder="0x..." value={roleForm.address} onChange={(e) => setRoleForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-input" value={roleForm.role} onChange={(e) => setRoleForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="1">Citizen</option>
            <option value="2">Verifier (Surveyor / Local Council)</option>
            <option value="3">Government (Ministry of Lands)</option>
            <option value="4">Admin</option>
          </select>
        </div>
        <button className="btn btn-primary btn-full" onClick={assignRole} disabled={loading === "role"}>
          {loading === "role" ? "Assigning..." : "Assign Role"}
        </button>
      </div>

      {/* Role Reference */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">◈</span>Role Permissions Reference</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Can Do</th>
                <th>Cannot Do</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="role-tag">Citizen</span></td>
                <td style={{ color: "var(--accent3)", fontSize: 11 }}>Register identity, Register land, List/Buy land</td>
                <td style={{ color: "var(--red)", fontSize: 11 }}>Approve land, Assign roles</td>
              </tr>
              <tr>
                <td><span className="role-tag">Verifier</span></td>
                <td style={{ color: "var(--accent3)", fontSize: 11 }}>All Citizen actions + Verifier approval</td>
                <td style={{ color: "var(--red)", fontSize: 11 }}>Government approval, Assign roles</td>
              </tr>
              <tr>
                <td><span className="role-tag">Government</span></td>
                <td style={{ color: "var(--accent3)", fontSize: 11 }}>Verify identities, Final land approval, Flag disputes</td>
                <td style={{ color: "var(--red)", fontSize: 11 }}>Assign roles</td>
              </tr>
              <tr>
                <td><span className="role-tag">Admin</span></td>
                <td style={{ color: "var(--accent3)", fontSize: 11 }}>All actions + Assign roles, Set market contract</td>
                <td style={{ color: "var(--red)", fontSize: 11 }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">◎</span>Deployed Contract Addresses</div>
        </div>
        <div style={{ fontSize: 12 }}>
          {["identityRegistry", "landRegistry", "landMarket"].map((name) => (
            <div className="land-detail" key={name}>
              <span className="land-detail-label" style={{ textTransform: "capitalize" }}>{name}</span>
              <span className="address-cell">{contracts?.[name]?.target || "Not connected"}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 11, color: "var(--text3)" }}>
          ◎ Verify these on{" "}
          <a href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            sepolia.etherscan.io
          </a>
        </div>
      </div>
    </div>
  );
}
