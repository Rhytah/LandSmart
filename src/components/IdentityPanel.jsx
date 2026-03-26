import { useState } from "react";
import { useWeb3 } from "../Web3Context";
import { useToast, ToastContainer } from "./Toast";

export default function IdentityPanel() {
  const { contracts, account } = useWeb3();
  const toast = useToast();
  const [form, setForm] = useState({ nationalID: "", fullName: "" });
  const [verifyAddr, setVerifyAddr] = useState("");
  const [checkAddr, setCheckAddr] = useState("");
  const [checkResult, setCheckResult] = useState(null);
  const [loading, setLoading] = useState("");

  const handle = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function registerIdentity() {
    if (!form.nationalID || !form.fullName) return toast("Fill all fields", "error");
    setLoading("register");
    try {
      const tx = await contracts.identityRegistry.registerIdentity(form.nationalID, form.fullName);
      toast("Transaction submitted — awaiting confirmation...", "info");
      await tx.wait();
      toast(`Identity registered for ${form.fullName}`, "success");
      setForm({ nationalID: "", fullName: "" });
    } catch (e) {
      toast(e.reason || e.message || "Transaction failed", "error");
    }
    setLoading("");
  }

  async function verifyIdentity() {
    if (!verifyAddr) return toast("Enter an address", "error");
    setLoading("verify");
    try {
      const tx = await contracts.identityRegistry.verifyIdentity(verifyAddr);
      toast("Verifying identity...", "info");
      await tx.wait();
      toast("Identity verified successfully", "success");
      setVerifyAddr("");
    } catch (e) {
      toast(e.reason || e.message || "Failed", "error");
    }
    setLoading("");
  }

  async function checkIdentity() {
    if (!checkAddr) return toast("Enter an address", "error");
    setLoading("check");
    try {
      const identity = await contracts.identityRegistry.identities(checkAddr);
      const role = await contracts.identityRegistry.getRole(checkAddr);
      setCheckResult({
        fullName: identity.fullName,
        nationalID: identity.nationalID,
        isVerified: identity.isVerified,
        role: Number(role),
        verifiedAt: Number(identity.verifiedAt),
      });
    } catch (e) {
      toast("Could not fetch identity", "error");
    }
    setLoading("");
  }

  const ROLES = ["None", "Citizen", "Verifier", "Government", "Admin"];

  if (!account) return <div className="connect-prompt"><div className="connect-prompt-icon">◈</div><h2>Connect Wallet</h2><p>Connect MetaMask to manage identities.</p></div>;

  return (
    <div>
      <ToastContainer />
      <div className="section-title">Identity Registry</div>
      <div className="section-sub">KYC verification — all identity data stored on-chain</div>

      <div className="panel-grid-2">
        {/* Register */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><span className="card-title-icon">+</span>Register Identity</div>
          </div>
          <div className="form-group">
            <label className="form-label">National ID Hash</label>
            <input className="form-input" placeholder="e.g. CM9100123456789" value={form.nationalID} onChange={handle("nationalID")} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="e.g. Alice Nakato" value={form.fullName} onChange={handle("fullName")} />
          </div>
          <button className="btn btn-primary btn-full" onClick={registerIdentity} disabled={loading === "register"}>
            {loading === "register" ? "Submitting..." : "Register Identity"}
          </button>
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--text3)" }}>
            ◎ Your wallet address will be linked to this identity on-chain
          </div>
        </div>

        {/* Verify */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><span className="card-title-icon">✓</span>Verify Identity</div>
            <span className="role-tag">Gov / Admin</span>
          </div>
          <div className="form-group">
            <label className="form-label">Citizen Wallet Address</label>
            <input className="form-input" placeholder="0x..." value={verifyAddr} onChange={(e) => setVerifyAddr(e.target.value)} />
          </div>
          <button className="btn btn-success btn-full" onClick={verifyIdentity} disabled={loading === "verify"}>
            {loading === "verify" ? "Verifying..." : "Verify Identity"}
          </button>
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--text3)" }}>
            ◎ Only Government or Admin role can verify identities
          </div>
        </div>
      </div>

      {/* Lookup */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">◈</span>Look Up Identity</div>
        </div>
        <div className="form-inline-row">
          <input className="form-input" placeholder="Enter wallet address 0x..." value={checkAddr} onChange={(e) => setCheckAddr(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button className="btn btn-ghost" onClick={checkIdentity} disabled={loading === "check"} style={{ whiteSpace: "nowrap" }}>
            {loading === "check" ? "..." : "Look Up"}
          </button>
        </div>

        {checkResult && (
          <div style={{ marginTop: 20, padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>{checkResult.fullName || "—"}</div>
              <span className={`badge ${checkResult.isVerified ? "badge-verified" : "badge-disputed"}`}>
                {checkResult.isVerified ? "Verified" : "Unverified"}
              </span>
            </div>
            <div className="land-detail">
              <span className="land-detail-label">National ID</span>
              <span className="land-detail-value">{checkResult.nationalID}</span>
            </div>
            <div className="land-detail">
              <span className="land-detail-label">Role</span>
              <span className="role-tag">{ROLES[checkResult.role]}</span>
            </div>
            {checkResult.verifiedAt > 0 && (
              <div className="land-detail">
                <span className="land-detail-label">Verified At</span>
                <span className="land-detail-value">{new Date(checkResult.verifiedAt * 1000).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
