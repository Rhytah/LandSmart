import { useState } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../Web3Context";
import { useToast, ToastContainer } from "./Toast";

function normalizeAddress(input) {
  try {
    return ethers.getAddress((input || "").trim());
  } catch {
    return null;
  }
}

/**
 * Normalizes `identities(addr)` return value (plain object, tuple, or ethers v6 Result).
 */
function readIdentityRow(raw) {
  if (raw == null) return {};
  const r = raw;
  const pick = (name, i) => r[name] ?? r[i];
  return {
    walletAddress: pick("walletAddress", 0),
    nationalID: pick("nationalID", 1),
    fullName: pick("fullName", 2),
    isVerified: pick("isVerified", 3),
    role: pick("role", 4),
    verifiedAt: pick("verifiedAt", 5),
  };
}

function shortAddr(a) {
  try {
    const x = ethers.getAddress(a);
    return `${x.slice(0, 6)}…${x.slice(-4)}`;
  } catch {
    return a;
  }
}

function isIdentityRegistered(identity) {
  const row = readIdentityRow(identity);
  const w = row.walletAddress;
  let walletOk = false;
  if (w) {
    try {
      walletOk = ethers.getAddress(w) !== ethers.ZeroAddress;
    } catch {
      walletOk = false;
    }
  }
  const hasNameOrId = Boolean(
    String(row.fullName ?? "").trim().length ||
      String(row.nationalID ?? "").trim().length
  );
  return walletOk || hasNameOrId;
}

function explainVerifyError(e) {
  const msg = String(e?.reason || e?.message || "").toLowerCase();
  if (
    msg.includes("not registered") ||
    msg.includes("not register") ||
    msg.includes("no identity") ||
    msg.includes("identity not") ||
    msg.includes("does not exist")
  ) {
    return "This wallet has not completed Register Identity. The citizen must connect MetaMask with that address, open the Identity tab, and submit Register Identity (name + ID) first. Assigning a role in Admin does not count as registration.";
  }
  return e?.reason || e?.message || "Verification failed";
}

function explainRegisterError(e) {
  const msg = String(e?.reason || e?.message || "").toLowerCase();
  if (
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("duplicate")
  ) {
    return "register-duplicate";
  }
  if (msg.includes("national") && (msg.includes("taken") || msg.includes("used"))) {
    return "This national ID (or hash) may already be linked to another wallet on-chain. Try Look Up on that other address, or use a distinct ID field if your contract allows it.";
  }
  return e?.reason || e?.message || "Registration failed";
}

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
    const me = account ? normalizeAddress(account) : null;
    if (!me) {
      toast("Connect your wallet first.", "error");
      return;
    }
    setLoading("register");
    try {
      const existing = await contracts.identityRegistry.identities(me);
      if (isIdentityRegistered(existing)) {
        const row = readIdentityRow(existing);
        const role = await contracts.identityRegistry.getRole(me);
        setCheckAddr(me);
        setCheckResult({
          fullName: row.fullName,
          nationalID: row.nationalID,
          isVerified: row.isVerified,
          role: Number(role),
          verifiedAt: Number(row.verifiedAt),
        });
        toast(
          row.fullName
            ? `You’re already registered as “${row.fullName}”. Your record is shown in Look Up below — no second registration needed.`
            : `Wallet ${shortAddr(me)} already has an identity. See Look Up below. To register someone else, they must use their own MetaMask account.`,
          "info"
        );
        setLoading("");
        return;
      }
      const tx = await contracts.identityRegistry.registerIdentity(form.nationalID, form.fullName);
      toast("Transaction submitted — awaiting confirmation...", "info");
      await tx.wait();
      toast(`Identity registered for ${form.fullName}`, "success");
      setForm({ nationalID: "", fullName: "" });
    } catch (e) {
      const explained = explainRegisterError(e);
      if (explained === "register-duplicate") {
        toast(
          `This wallet (${shortAddr(me)}) already has an identity on-chain (one registration per address). Use Look Up to see it, or switch MetaMask to the citizen’s wallet to register them.`,
          "info"
        );
      } else {
        toast(explained, "error");
      }
    }
    setLoading("");
  }

  async function verifyIdentity() {
    if (!verifyAddr) return toast("Enter an address", "error");
    const addr = normalizeAddress(verifyAddr);
    if (!addr) return toast("Enter a valid 0x wallet address", "error");
    setLoading("verify");
    try {
      const raw = await contracts.identityRegistry.identities(addr);
      if (!isIdentityRegistered(raw)) {
        toast(
          `No identity record for ${shortAddr(addr)} on this contract (Sepolia). ` +
            "The holder must connect MetaMask with that exact address and submit Register Identity here first. " +
            "Use Look Up with the same 0x to confirm name/ID appear. Assign Role in Admin does not create a registration.",
          "error"
        );
        setLoading("");
        return;
      }
      const row = readIdentityRow(raw);
      if (row.isVerified) {
        toast("This identity is already KYC-verified.", "info");
        setLoading("");
        return;
      }
      const tx = await contracts.identityRegistry.verifyIdentity(addr);
      toast("Verifying identity...", "info");
      await tx.wait();
      toast("Identity verified successfully", "success");
      setVerifyAddr("");
    } catch (e) {
      toast(explainVerifyError(e), "error");
    }
    setLoading("");
  }

  async function checkIdentity() {
    if (!checkAddr) return toast("Enter an address", "error");
    const addr = normalizeAddress(checkAddr);
    if (!addr) return toast("Enter a valid 0x wallet address", "error");
    setLoading("check");
    try {
      const identity = await contracts.identityRegistry.identities(addr);
      const row = readIdentityRow(identity);
      const role = await contracts.identityRegistry.getRole(addr);
      setCheckResult({
        fullName: row.fullName,
        nationalID: row.nationalID,
        isVerified: row.isVerified,
        role: Number(role),
        verifiedAt: Number(row.verifiedAt),
      });
    } catch (e) {
      toast("Could not fetch identity", "error");
    }
    setLoading("");
  }

  const ROLES = ["None", "Citizen", "Verifier", "Government", "Admin"];

  function lookupHint(result) {
    const hasRecord = Boolean(result.fullName || result.nationalID);
    if (!hasRecord) {
      return (
        <>
          No identity record for this wallet. The holder must use <strong>Register Identity</strong> first.
          {result.role > 0 &&
            " A role can be assigned by Admin, but that does not create KYC data or mark the person as verified."}
        </>
      );
    }
    if (!result.isVerified) {
      return (
        <>
          <strong>Role</strong> (Verifier, Government, etc.) is separate from <strong>KYC verified</strong>.
          After registration, Government or Admin must click <strong>Verify Identity</strong> for this address to
          clear KYC.
        </>
      );
    }
    return null;
  }

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
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>
            ◎ Your <strong style={{ color: "var(--text2)" }}>connected</strong> wallet is registered — one identity per address.
            <br />
            ◎ Each citizen must register while MetaMask is set to <em>their</em> account; you cannot register again from the same wallet.
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
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>
            ◎ Only Government or Admin can verify.
            <br />
            ◎ The citizen must <strong style={{ color: "var(--text2)" }}>Register Identity</strong> first (same wallet, Identity tab). Admin <strong style={{ color: "var(--text2)" }}>Assign Role</strong> does not register them.
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

        {checkResult && (() => {
          const hint = lookupHint(checkResult);
          return (
          <div style={{ marginTop: 20, padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>{checkResult.fullName || "—"}</div>
              <span className={`badge ${checkResult.isVerified ? "badge-verified" : "badge-pending"}`}>
                KYC: {checkResult.isVerified ? "Verified" : "Not verified"}
              </span>
            </div>
            <div className="land-detail">
              <span className="land-detail-label">National ID</span>
              <span className="land-detail-value">{checkResult.nationalID || "—"}</span>
            </div>
            <div className="land-detail">
              <span className="land-detail-label">Role (permissions)</span>
              <span className="role-tag">{ROLES[checkResult.role]}</span>
            </div>
            {checkResult.verifiedAt > 0 && (
              <div className="land-detail">
                <span className="land-detail-label">Verified At</span>
                <span className="land-detail-value">{new Date(checkResult.verifiedAt * 1000).toLocaleDateString()}</span>
              </div>
            )}
            {hint ? <p className="identity-lookup-hint">{hint}</p> : null}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
