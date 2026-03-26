import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../Web3Context";
import { useToast, ToastContainer } from "./Toast";
import { STATUS_NAMES } from "../contracts";

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

  const handle = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => { if (contracts && account) fetchMyLands(); }, [contracts, account]);

  async function fetchMyLands() {
    setLoading("fetch");
    try {
      const ids = await contracts.landRegistry.getLandsByOwner(account);
      const lands = await Promise.all(ids.map((id) => contracts.landRegistry.getLand(Number(id))));
      setMyLands(lands.map((l, i) => ({ ...l, id: Number(ids[i]) })));
    } catch (e) { console.error(e); }
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
    setLoading("vApprove");
    try {
      const tx = await contracts.landRegistry.verifierApprove(Number(approveID));
      toast("Submitting verifier approval...", "info");
      await tx.wait();
      toast("Verifier approval submitted", "success");
    } catch (e) { toast(e.reason || e.message || "Failed", "error"); }
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
      fetchMyLands();
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
          <div className="form-group">
            <label className="form-label">Land ID</label>
            <input className="form-input" type="number" placeholder="e.g. 1" value={approveID} onChange={(e) => setApproveID(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={verifierApprove} disabled={loading === "vApprove"}>
              {loading === "vApprove" ? "..." : "Verifier Approve"}
            </button>
            <button className="btn btn-success" style={{ flex: 1 }} onClick={governmentApprove} disabled={loading === "gApprove"}>
              {loading === "gApprove" ? "..." : "Gov Approve"}
            </button>
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

      {/* My Lands */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">◻</span>My Land Parcels</div>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 14px" }} onClick={fetchMyLands}>↻ Refresh</button>
        </div>
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
                  <div className="land-plot">{land.plotNumber}</div>
                  {statusBadge(land.status)}
                </div>
                <div className="land-detail"><span className="land-detail-label">ID</span><span className="land-detail-value">#{land.id}</span></div>
                <div className="land-detail"><span className="land-detail-label">District</span><span className="land-detail-value">{land.district}</span></div>
                <div className="land-detail"><span className="land-detail-label">Area</span><span className="land-detail-value">{Number(land.areaSqMeters).toLocaleString()} m²</span></div>
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
