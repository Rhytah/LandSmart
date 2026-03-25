import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../Web3Context";
import { useToast, ToastContainer } from "./Toast";

export default function MarketPanel() {
  const { contracts, account } = useWeb3();
  const toast = useToast();
  const [listings, setListings] = useState([]);
  const [landCount, setLandCount] = useState(0);
  const [listForm, setListForm] = useState({ landID: "", price: "" });
  const [loading, setLoading] = useState("");

  useEffect(() => { if (contracts) fetchListings(); }, [contracts]);

  async function fetchListings() {
    setLoading("fetch");
    try {
      const count = await contracts.landRegistry.landCount();
      setLandCount(Number(count));
      const results = [];
      for (let i = 1; i <= Number(count); i++) {
        try {
          const listing = await contracts.landMarket.listings(i);
          if (listing.isActive) {
            const land = await contracts.landRegistry.getLand(i);
            results.push({ ...listing, land, id: i });
          }
        } catch (e) {}
      }
      setListings(results);
    } catch (e) { console.error(e); }
    setLoading("");
  }

  async function listLand() {
    if (!listForm.landID || !listForm.price) return toast("Fill all fields", "error");
    setLoading("list");
    try {
      const tx = await contracts.landMarket.listLand(
        Number(listForm.landID),
        ethers.parseEther(listForm.price)
      );
      toast("Listing land for sale...", "info");
      await tx.wait();
      toast("Land listed on market!", "success");
      setListForm({ landID: "", price: "" });
      fetchListings();
    } catch (e) { toast(e.reason || e.message || "Failed", "error"); }
    setLoading("");
  }

  async function buyLand(landID, price) {
    setLoading(`buy-${landID}`);
    try {
      const duty = await contracts.landMarket.calculateStampDuty(price);
      const tx = await contracts.landMarket.buyLand(landID, { value: price });
      toast(`Purchasing land — stamp duty: ${ethers.formatEther(duty)} ETH auto-sent to treasury`, "info");
      await tx.wait();
      toast("Land purchased! Ownership transferred on-chain.", "success");
      fetchListings();
    } catch (e) { toast(e.reason || e.message || "Failed", "error"); }
    setLoading("");
  }

  async function cancelListing(landID) {
    setLoading(`cancel-${landID}`);
    try {
      const tx = await contracts.landMarket.cancelListing(landID);
      toast("Cancelling listing...", "info");
      await tx.wait();
      toast("Listing cancelled", "success");
      fetchListings();
    } catch (e) { toast(e.reason || e.message || "Failed", "error"); }
    setLoading("");
  }

  if (!account) return <div className="connect-prompt"><div className="connect-prompt-icon">◇</div><h2>Connect Wallet</h2><p>Connect MetaMask to access the land market.</p></div>;

  return (
    <div>
      <ToastContainer />
      <div className="section-title">Land Market</div>
      <div className="section-sub">Buy and sell verified land — stamp duty collected automatically on-chain</div>

      {/* List for sale */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">◇</span>List Land for Sale</div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Land ID</label>
            <input className="form-input" type="number" placeholder="e.g. 1" value={listForm.landID} onChange={(e) => setListForm((f) => ({ ...f, landID: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Asking Price (ETH)</label>
            <input className="form-input" type="number" step="0.001" placeholder="e.g. 0.5" value={listForm.price} onChange={(e) => setListForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
        </div>
        {listForm.price && (
          <div style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius)", marginBottom: 12, fontSize: 11, color: "var(--text2)" }}>
            <span style={{ color: "var(--text3)" }}>Stamp duty (4%): </span>
            <span style={{ color: "var(--gold)" }}>{(parseFloat(listForm.price || 0) * 0.04).toFixed(4)} ETH</span>
            <span style={{ color: "var(--text3)", marginLeft: 16 }}>Seller receives: </span>
            <span style={{ color: "var(--accent3)" }}>{(parseFloat(listForm.price || 0) * 0.96).toFixed(4)} ETH</span>
          </div>
        )}
        <button className="btn btn-primary btn-full" onClick={listLand} disabled={loading === "list"}>
          {loading === "list" ? "Listing..." : "List on Market"}
        </button>
      </div>

      {/* Active Listings */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">◇</span>Active Listings ({listings.length})</div>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 14px" }} onClick={fetchListings}>↻ Refresh</button>
        </div>
        {loading === "fetch" ? (
          <div className="loading"><div className="spinner" /> Loading market...</div>
        ) : listings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◇</div>
            <div className="empty-text">No active listings.<br />List a verified land parcel to start selling.</div>
          </div>
        ) : (
          <div className="land-grid">
            {listings.map((listing) => {
              const isOwner = listing.seller?.toLowerCase() === account?.toLowerCase();
              const price = listing.askingPrice;
              return (
                <div className="land-card" key={listing.id}>
                  <div className="land-card-header">
                    <div className="land-plot">{listing.land?.plotNumber}</div>
                    <span className="badge badge-sale">For Sale</span>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div className="price-large">{ethers.formatEther(price)} ETH</div>
                    <div className="price-sub">
                      Stamp duty: {ethers.formatEther((price * 4n) / 100n)} ETH · Seller gets: {ethers.formatEther((price * 96n) / 100n)} ETH
                    </div>
                  </div>
                  <div className="land-detail"><span className="land-detail-label">District</span><span className="land-detail-value">{listing.land?.district}</span></div>
                  <div className="land-detail"><span className="land-detail-label">Area</span><span className="land-detail-value">{Number(listing.land?.areaSqMeters).toLocaleString()} m²</span></div>
                  <div className="land-detail"><span className="land-detail-label">GPS</span><span className="gps-tag">◎ {listing.land?.gpsCoordinates}</span></div>
                  <div className="land-detail">
                    <span className="land-detail-label">Seller</span>
                    <span className="address-cell">{listing.seller?.slice(0, 8)}...{listing.seller?.slice(-4)}</span>
                  </div>
                  <div className="land-actions">
                    {isOwner ? (
                      <button className="btn btn-danger" style={{ flex: 1, fontSize: 11 }} onClick={() => cancelListing(listing.id)} disabled={loading === `cancel-${listing.id}`}>
                        {loading === `cancel-${listing.id}` ? "..." : "Cancel Listing"}
                      </button>
                    ) : (
                      <button className="btn btn-primary" style={{ flex: 1, fontSize: 11 }} onClick={() => buyLand(listing.id, price)} disabled={loading === `buy-${listing.id}`}>
                        {loading === `buy-${listing.id}` ? "Purchasing..." : "Buy Land"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stamp Duty Info */}
      <div className="card" style={{ borderColor: "rgba(240,165,0,0.2)", background: "rgba(240,165,0,0.03)" }}>
        <div className="card-title" style={{ marginBottom: 12 }}><span style={{ color: "var(--gold)" }}>◎</span> Automatic Stamp Duty</div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.8 }}>
          Every land sale automatically sends <strong style={{ color: "var(--gold)" }}>4% stamp duty</strong> to the government treasury wallet — no human involvement, no tax evasion possible. The smart contract enforces this rule on every transaction without exception.
        </div>
      </div>
    </div>
  );
}
