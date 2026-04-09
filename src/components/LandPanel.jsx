import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../Web3Context";
import { useToast, ToastContainer } from "./Toast";
import { STATUS_NAMES, ROLE_NAMES, ADDRESSES } from "../contracts";

function shortHex(addr) {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Same shape as Dashboard — ethers `getLand` can return a Result tuple. */
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

function normBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  try {
    return BigInt(v) === 1n;
  } catch {
    return Number(v) === 1;
  }
}

/** Verifier / Government / Admin also see recent registry IDs (plus every ID they own). */
const APPROVER_LAND_ID_WINDOW = 300;

function explainVerifierApproveError(e, link) {
  const raw = e?.reason || e?.message || "Verifier approve failed";
  const msg = String(raw).toLowerCase();
  const authFail =
    msg.includes("verifier") ||
    msg.includes("not authorized") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("access denied") ||
    msg.includes("only verifier") ||
    msg.includes("role");

  if (authFail) {
    if (link?.status === "mismatch" && link.onChain && link.expected) {
      return (
        `Land → Identity mismatch: Land reads ${shortHex(link.onChain)}, this app uses ${shortHex(link.expected)}. ` +
        "Fix `.env` or redeploy Land so it points at the Identity you use in the app."
      );
    }
    console.info(
      "[LandSmart] Verifier approve: check role & KYC in Approve Land; Identity → Look Up. Land.identityRegistry() must match VITE_IDENTITY_REGISTRY_ADDRESS.",
      { chainReason: raw, landIdentityLink: link }
    );
    return (
      "Verifier approve failed — see role/KYC in Approve Land. If those look fine, press F12 → Console for details."
    );
  }
  return raw;
}

const DISTRICTS = [
  { label: "— Uganda —", value: "", disabled: true },
  { label: "Kampala, Uganda", value: "Kampala" },
  { label: "Wakiso, Uganda", value: "Wakiso" },
  { label: "Entebbe, Uganda", value: "Entebbe" },
  { label: "Mukono, Uganda", value: "Mukono" },
  { label: "Jinja, Uganda", value: "Jinja" },
  { label: "Gulu, Uganda", value: "Gulu" },
  { label: "— Kenya —", value: "", disabled: true },
  { label: "Nairobi, Kenya", value: "Nairobi" },
  { label: "Mombasa, Kenya", value: "Mombasa" },
  { label: "Kisumu, Kenya", value: "Kisumu" },
  { label: "Nakuru, Kenya", value: "Nakuru" },
  { label: "Eldoret, Kenya", value: "Eldoret" },
  { label: "— Botswana —", value: "", disabled: true },
  { label: "Gaborone, Botswana", value: "Gaborone" },
  { label: "Francistown, Botswana", value: "Francistown" },
  { label: "Maun, Botswana", value: "Maun" },
  { label: "Serowe, Botswana", value: "Serowe" },
];

export default function LandPanel() {
  const { contracts, account } = useWeb3();
  const toast = useToast();
  const [myLands, setMyLands] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedLand, setSelectedLand] = useState(null);
  const [loading, setLoading] = useState("");
  const [form, setForm] = useState({
    plotNumber: "", gpsCoordinates: "", district: "",
    areaSqMeters: "", registeredValue: ""
  });
  const [approveID, setApproveID] = useState("");
  const [disputeID, setDisputeID] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  /** Role + KYC from Identity Registry — Land Registry often requires both for verifier actions. */
  const [identityGate, setIdentityGate] = useState({ role: null, verified: null });
  /** Land contract’s identityRegistry() vs app .env — mismatch breaks verifierApprove auth. */
  const [landIdentityLink, setLandIdentityLink] = useState({
    status: "unknown",
    onChain: null,
    expected: null,
  });

  const handle = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    let cancelled = false;
    async function loadLandIdentityPointer() {
      if (!contracts?.landRegistry) return;
      if (!ADDRESSES.identityRegistry) {
        if (!cancelled) setLandIdentityLink({ status: "unknown", onChain: null, expected: null });
        return;
      }
      try {
        const ptr = await contracts.landRegistry.identityRegistry();
        const onChain = ethers.getAddress(ptr);
        const expected = ethers.getAddress(ADDRESSES.identityRegistry);
        if (cancelled) return;
        setLandIdentityLink({
          status: onChain === expected ? "ok" : "mismatch",
          onChain,
          expected,
        });
      } catch {
        if (!cancelled) setLandIdentityLink({ status: "unknown", onChain: null, expected: null });
      }
    }
    loadLandIdentityPointer();
    return () => {
      cancelled = true;
    };
  }, [contracts]);

  useEffect(() => {
    let cancelled = false;
    async function loadGate() {
      if (!contracts?.identityRegistry || !account) {
        setIdentityGate({ role: null, verified: null });
        return;
      }
      try {
        const [role, verified] = await Promise.all([
          contracts.identityRegistry.getRole(account),
          contracts.identityRegistry.isVerified(account),
        ]);
        if (!cancelled) {
          setIdentityGate({ role: Number(role), verified: Boolean(verified) });
        }
      } catch {
        if (!cancelled) setIdentityGate({ role: null, verified: null });
      }
    }
    loadGate();
    return () => {
      cancelled = true;
    };
  }, [contracts, account]);

  useEffect(() => { if (contracts && account) fetchMyLands(); }, [contracts, account]);

  async function fetchMyLands() {
    setLoading("fetch");
    try {
      const me = ethers.getAddress(account);
      const ownerIdsRaw = await contracts.landRegistry.getLandsByOwner(account);
      const ownerIds = ownerIdsRaw.map((x) => Number(x));
      const idSet = new Set(ownerIds);

      let role = 0;
      try {
        role = Number(await contracts.identityRegistry.getRole(account));
      } catch {
        role = 0;
      }

      const total = Number(await contracts.landRegistry.landCount());
      if (role >= 2 && total > 0) {
        const start = Math.max(1, total - APPROVER_LAND_ID_WINDOW + 1);
        for (let id = start; id <= total; id++) idSet.add(id);
      }

      const ids = [...idSet].sort((a, b) => a - b);
      const lands = await Promise.all(ids.map((id) => contracts.landRegistry.getLand(id)));
      setMyLands(
        lands.map((l, i) => {
          const row = readLandTuple(l);
          let ownerMatch = false;
          try {
            const ow = row.currentOwner;
            if (ow) ownerMatch = ethers.getAddress(ow) === me;
          } catch {
            ownerMatch = false;
          }
          return {
            ...row,
            id: ids[i],
            verifierApproved: normBool(row.verifierApproved),
            governmentApproved: normBool(row.governmentApproved),
            isOwned: ownerMatch,
          };
        })
      );
    } catch (e) {
      console.error(e);
    }
    setLoading("");
  }

  async function registerLand() {
    const { plotNumber, gpsCoordinates, district, areaSqMeters, registeredValue } = form;
    if (!plotNumber || !gpsCoordinates || !district || !areaSqMeters || !registeredValue)
      return toast("Fill all fields", "error");
    setLoading("register");
    try {
      const tx = await contracts.landRegistry.registerLand(
        plotNumber, gpsCoordinates, district,
        Number(areaSqMeters),
        ethers.parseEther(registeredValue)
      );
      toast("Registering land on-chain...", "info");
      await tx.wait();
      toast(`Plot ${plotNumber} registered!`, "success");
      setForm({ plotNumber: "", gpsCoordinates: "", district: "", areaSqMeters: "", registeredValue: "" });
      fetchMyLands();
    } catch (e) { toast(e.reason || e.message || "Failed", "error"); }
    setLoading("");
  }

  async function verifierApprove() {
    if (!approveID) return toast("Enter land ID", "error");
    if (identityGate.role !== null && identityGate.role < 2) {
      toast(
        `This wallet is “${ROLE_NAMES[identityGate.role] ?? identityGate.role}” on the Identity contract. Verifier approve needs role Verifier (2), Government (3), or Admin (4).`,
        "error"
      );
      return;
    }
    if (identityGate.role !== null && identityGate.role >= 2 && identityGate.verified === false) {
      toast(
        "Note: KYC is still unverified for this wallet — many Land contracts require Gov/Admin to run Verify Identity first. Submitting tx anyway…",
        "info"
      );
    }
    setLoading("vApprove");
    try {
      const tx = await contracts.landRegistry.verifierApprove(Number(approveID));
      toast("Submitting verifier approval...", "info");
      await tx.wait();
      toast("Verifier approval submitted", "success");
      await fetchMyLands();
    } catch (e) {
      toast(explainVerifierApproveError(e, landIdentityLink), "error");
    }
    setLoading("");
  }

  async function governmentApprove() {
    if (!approveID) return toast("Enter land ID", "error");
    setLoading("gApprove");
    try {
      const tx = await contracts.landRegistry.governmentApprove(Number(approveID));
      toast("Submitting government approval...", "info");
      await tx.wait();
      toast("Land approved by government!", "success");
      await fetchMyLands();
    } catch (e) { toast(e.reason || e.message || "Failed", "error"); }
    setLoading("");
  }

  async function flagDispute() {
    if (!disputeID || !disputeReason) return toast("Enter ID and reason", "error");
    setLoading("dispute");
    try {
      const tx = await contracts.landRegistry.flagDispute(Number(disputeID), disputeReason);
      toast("Flagging dispute...", "info");
      await tx.wait();
      toast("Land flagged as disputed", "success");
    } catch (e) { toast(e.reason || e.message || "Failed", "error"); }
    setLoading("");
  }

  async function viewHistory(landID) {
    setLoading("history");
    try {
      const h = await contracts.landRegistry.getOwnershipHistory(landID);
      setHistory(h);
      setSelectedLand(landID);
    } catch (e) { toast("Could not fetch history", "error"); }
    setLoading("");
  }

  const statusBadge = (s) => {
    const n = Number(s);
    const cls = ["badge-default","badge-pending","badge-verified","badge-disputed","badge-sale"][n] || "badge-default";
    return <span className={`badge ${cls}`}>{STATUS_NAMES[n]}</span>;
  };

  if (!account) return (
    <div className="connect-prompt">
      <div className="connect-prompt-icon">◻</div>
      <h2>Connect Wallet</h2>
      <p>Connect MetaMask to manage land parcels.</p>
    </div>
  );

  return (
    <div>
      <ToastContainer />
      <div className="section-title">Land Registry</div>
      <div className="section-sub">Register and manage land parcels — Uganda · Kenya · Botswana</div>

      {landIdentityLink.status === "mismatch" && (
        <div className="error-banner" style={{ marginBottom: 20 }}>
          <strong>Contract wiring problem:</strong> this Land Registry on-chain points to Identity{" "}
          <span className="address-cell">{landIdentityLink.onChain}</span>, but the app is using{" "}
          <span className="address-cell">{landIdentityLink.expected}</span>. Verifier checks run against the Land’s
          Identity — roles you see in the UI may not match. Redeploy Land linked to your current Identity or update
          deployment / <code style={{ fontSize: 11 }}>.env</code> so they match.
        </div>
      )}

      {/* Register Form */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">+</span>Register New Land Parcel</div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Plot Number</label>
            <input className="form-input" placeholder="e.g. PLOT-001-KAMPALA" value={form.plotNumber} onChange={handle("plotNumber")} />
          </div>
          <div className="form-group">
            <label className="form-label">District / City</label>
            <select className="form-input" value={form.district} onChange={handle("district")}>
              <option value="">Select district...</option>
              {DISTRICTS.map((d, i) =>
                d.disabled
                  ? <option key={i} disabled style={{ color: "var(--text3)", fontWeight: 700 }}>{d.label}</option>
                  : <option key={i} value={d.value}>{d.label}</option>
              )}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">GPS Coordinates</label>
            <input className="form-input" placeholder="e.g. 0.3476,32.5825" value={form.gpsCoordinates} onChange={handle("gpsCoordinates")} />
          </div>
          <div className="form-group">
            <label className="form-label">Area (square meters)</label>
            <input className="form-input" type="number" placeholder="e.g. 500" value={form.areaSqMeters} onChange={handle("areaSqMeters")} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Registered Value (ETH)</label>
          <input className="form-input" type="number" step="0.001" placeholder="e.g. 0.5" value={form.registeredValue} onChange={handle("registeredValue")} />
        </div>
        <button className="btn btn-primary btn-full" onClick={registerLand} disabled={loading === "register"}>
          {loading === "register" ? "Registering on Blockchain..." : "Register Land on Blockchain"}
        </button>
      </div>

      {/* Approval Actions */}
      <div className="panel-grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title"><span className="card-title-icon">✓</span>Approve Land</div>
          </div>
          {identityGate.role !== null && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                fontSize: 11,
                lineHeight: 1.5,
                color: "var(--text2)",
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              <strong style={{ color: "var(--text)" }}>This wallet on Identity Registry:</strong>{" "}
              role <span className="role-tag">{ROLE_NAMES[identityGate.role] ?? identityGate.role}</span>
              {" · "}
              KYC{" "}
              <span className={identityGate.verified ? "badge badge-verified" : "badge badge-pending"} style={{ fontSize: 9, padding: "2px 6px" }}>
                {identityGate.verified ? "verified" : "not verified"}
              </span>
              {identityGate.role >= 2 && !identityGate.verified && (
                <span style={{ display: "block", marginTop: 8, color: "var(--gold)" }}>
                  Verifier actions often require KYC verified — use Identity → Verify Identity (Gov/Admin) for this address.
                </span>
              )}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Land ID</label>
            <input className="form-input" type="number" placeholder="e.g. 1" value={approveID} onChange={(e) => setApproveID(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={verifierApprove} disabled={loading === "vApprove" || loading === "gApprove"}>
              {loading === "vApprove" ? "..." : "Verifier Approve"}
            </button>
            <button className="btn btn-success" style={{ flex: 1 }} onClick={governmentApprove} disabled={loading === "gApprove" || loading === "vApprove"}>
              {loading === "gApprove" ? "..." : "Gov Approve"}
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "var(--text3)", lineHeight: 1.5 }}>
            On-chain flow is usually <strong>two steps</strong>: Verifier Approve, then Government Approve. Government stays pending until someone with Gov/Admin runs the second tx.
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title"><span className="card-title-icon">!</span>Flag Dispute</div>
            <span className="role-tag">Gov Only</span>
          </div>
          <div className="form-group">
            <label className="form-label">Land ID</label>
            <input className="form-input" type="number" placeholder="e.g. 1" value={disputeID} onChange={(e) => setDisputeID(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Reason</label>
            <input className="form-input" placeholder="e.g. Duplicate claim submitted" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
          </div>
          <button className="btn btn-danger btn-full" onClick={flagDispute} disabled={loading === "dispute"}>
            {loading === "dispute" ? "..." : "Flag as Disputed"}
          </button>
        </div>
      </div>

      {/* Parcels: owner + approver view */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">◻</span>Land Parcels</div>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 14px" }} onClick={fetchMyLands}>↻ Refresh</button>
        </div>
        <p style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5, marginBottom: 12 }}>
          <strong>Owners</strong> see every parcel tied to this wallet. Wallets with Identity role{" "}
          <span className="role-tag" style={{ fontSize: 9 }}>Verifier</span>,{" "}
          <span className="role-tag" style={{ fontSize: 9 }}>Government</span>, or{" "}
          <span className="role-tag" style={{ fontSize: 9 }}>Admin</span> also see the latest{" "}
          {APPROVER_LAND_ID_WINDOW} land IDs on the registry (plus any they own) so approvals and status stay visible
          without owning the plot. <span className="badge badge-default" style={{ fontSize: 9 }}>You own</span> vs{" "}
          <span className="badge badge-default" style={{ fontSize: 9 }}>Registry</span> is shown on each card.
        </p>
        {loading === "fetch" ? (
          <div className="loading"><div className="spinner" /> Loading your lands...</div>
        ) : myLands.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◻</div>
            <div className="empty-text">No land parcels registered yet.</div>
          </div>
        ) : (
          <div className="land-grid">
            {myLands.map((land) => (
              <div className="land-card" key={land.id}>
                <div className="land-card-header">
                  <div>
                    <div className="land-plot">{land.plotNumber || `Parcel #${land.id}`}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {land.isOwned ? (
                        <span className="badge badge-verified" style={{ fontSize: 9, textTransform: "uppercase" }}>
                          You own
                        </span>
                      ) : (
                        <span className="badge badge-default" style={{ fontSize: 9, textTransform: "uppercase" }}>
                          Registry
                        </span>
                      )}
                    </div>
                  </div>
                  {statusBadge(land.status)}
                </div>
                <div className="land-detail"><span className="land-detail-label">ID</span><span className="land-detail-value">#{land.id}</span></div>
                {!land.isOwned && land.currentOwner && (
                  <div className="land-detail">
                    <span className="land-detail-label">Owner</span>
                    <span className="land-detail-value address-cell" title={land.currentOwner}>
                      {shortHex(land.currentOwner)}
                    </span>
                  </div>
                )}
                <div className="land-detail"><span className="land-detail-label">District</span><span className="land-detail-value">{land.district}</span></div>
                <div className="land-detail"><span className="land-detail-label">Area</span><span className="land-detail-value">{Number(land.areaSqMeters ?? 0).toLocaleString()} m²</span></div>
                <div className="land-detail"><span className="land-detail-label">GPS</span><span className="gps-tag">◎ {land.gpsCoordinates}</span></div>
                <div className="land-detail">
                  <span className="land-detail-label">Verifier</span>
                  <span className={`badge ${land.verifierApproved ? "badge-verified" : "badge-pending"}`}>{land.verifierApproved ? "Approved" : "Pending"}</span>
                </div>
                <div className="land-detail">
                  <span className="land-detail-label">Government</span>
                  <span className={`badge ${land.governmentApproved ? "badge-verified" : "badge-pending"}`}>{land.governmentApproved ? "Approved" : "Pending"}</span>
                </div>
                <div className="land-actions">
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11 }} onClick={() => viewHistory(land.id)}>
                    View History
                  </button>
                  <a
                    href={`https://sepolia.etherscan.io/address/${land.currentOwner}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                    style={{ flex: 1, fontSize: 11, textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    Etherscan ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ownership History */}
      {selectedLand && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><span className="card-title-icon">◎</span>Ownership History — Land #{selectedLand}</div>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 14px" }} onClick={() => { setSelectedLand(null); setHistory([]); }}>Close</button>
          </div>
          {loading === "history" ? (
            <div className="loading"><div className="spinner" /> Fetching immutable history...</div>
          ) : (
            <div className="timeline">
              {history.map((record, i) => (
                <div className="timeline-item" key={i}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-type">{record.transactionType}</div>
                    <div className="timeline-owner">{record.owner}</div>
                    {Number(record.price) > 0 && (
                      <div style={{ fontSize: 11, color: "var(--accent3)", marginBottom: 4 }}>
                        {ethers.formatEther(record.price)} ETH
                      </div>
                    )}
                    <div className="timeline-time">
                      {new Date(Number(record.timestamp) * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
