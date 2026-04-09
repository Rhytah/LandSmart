import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../Web3Context";
import { useToast, ToastContainer } from "./Toast";

function pickTuple(r, name, i) {
  if (r == null) return undefined;
  return r[name] ?? r[i];
}

function readListingTuple(raw) {
  if (raw == null) return {};
  const r = raw;
  return {
    landID: pickTuple(r, "landID", 0),
    seller: pickTuple(r, "seller", 1),
    askingPrice: pickTuple(r, "askingPrice", 2),
    isActive: pickTuple(r, "isActive", 3),
    listedAt: pickTuple(r, "listedAt", 4),
  };
}

function readLandTuple(raw) {
  if (raw == null) return {};
  const r = raw;
  return {
    plotNumber: pickTuple(r, "plotNumber", 2),
    gpsCoordinates: pickTuple(r, "gpsCoordinates", 3),
    district: pickTuple(r, "district", 4),
    areaSqMeters: pickTuple(r, "areaSqMeters", 5),
    currentOwner: pickTuple(r, "currentOwner", 1),
  };
}

function listingIsActive(v) {
  if (v === true) return true;
  if (v === false) return false;
  try {
    return BigInt(v) === 1n;
  } catch {
    return Number(v) === 1;
  }
}

function toBigIntWei(v) {
  if (v == null) return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
}

function safeFormatEther(wei) {
  try {
    if (wei == null) return "0";
    return ethers.formatEther(wei);
  } catch {
    return "—";
  }
}

export default function MarketPanel() {
  const { contracts, account } = useWeb3();
  const toast = useToast();
  const [listings, setListings] = useState([]);
  const [listForm, setListForm] = useState({ landID: "", price: "" });
  const [loading, setLoading] = useState("");

  useEffect(() => { if (contracts) fetchListings(); }, [contracts]);

  async function fetchListings() {
    setLoading("fetch");
    try {
      const count = await contracts.landRegistry.landCount();
      const results = [];
      for (let i = 1; i <= Number(count); i++) {
        try {
          const row = readListingTuple(await contracts.landMarket.listings(i));
          if (!listingIsActive(row.isActive)) continue;
          const landRaw = await contracts.landRegistry.getLand(i);
          results.push({
            ...row,
            askingPrice: toBigIntWei(row.askingPrice),
            land: readLandTuple(landRaw),
            id: i,
          });
        } catch (e) {
          /* no listing for this id */
        }
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
      const priceWei = toBigIntWei(price);
      const duty = await contracts.landMarket.calculateStampDuty(priceWei);
      const tx = await contracts.landMarket.buyLand(landID, { value: priceWei });
      toast(`Purchasing — Transfer Tax: ${ethers.formatEther(duty)} ETH auto-sent to treasury`, "info");
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

  if (!account) return (
    <div className="connect-prompt">
      <div className="connect-prompt-icon">◇</div>
      <h2>Connect Wallet</h2>
      <p>Connect MetaMask to access the land market.</p>
    </div>
  );

  return (
    <div>
      <ToastContainer />
      <div className="section-title">Land Market</div>
      <div className="section-sub">Buy and sell verified land — stamp duty / transfer tax collected automatically on-chain</div>

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
            <span style={{ color: "var(--text3)" }}>Stamp Duty / Transfer Tax (4%): </span>
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
              let sellerLc = "";
              try {
                sellerLc = listing.seller ? ethers.getAddress(listing.seller).toLowerCase() : "";
              } catch {
                sellerLc = (listing.seller && String(listing.seller).toLowerCase()) || "";
              }
              const isOwner = sellerLc === account?.toLowerCase();
              const price = toBigIntWei(listing.askingPrice);
              const tax = (price * 4n) / 100n;
              const sellerReceives = (price * 96n) / 100n;
              return (
                <div className="land-card" key={listing.id}>
                  <div className="land-card-header">
                    <div className="land-plot">{listing.land?.plotNumber || `Land #${listing.id}`}</div>
                    <span className="badge badge-sale">For Sale</span>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div className="price-large">{safeFormatEther(price)} ETH</div>
                    <div className="price-sub">
                      Transfer Tax: {safeFormatEther(tax)} ETH · Seller gets: {safeFormatEther(sellerReceives)} ETH
                    </div>
                  </div>
                  <div className="land-detail"><span className="land-detail-label">District</span><span className="land-detail-value">{listing.land?.district ?? "—"}</span></div>
                  <div className="land-detail"><span className="land-detail-label">Area</span><span className="land-detail-value">{Number(listing.land?.areaSqMeters ?? 0).toLocaleString()} m²</span></div>
                  <div className="land-detail"><span className="land-detail-label">GPS</span><span className="gps-tag">◎ {listing.land?.gpsCoordinates}</span></div>
                  <div className="land-detail">
                    <span className="land-detail-label">Seller</span>
                    <span className="address-cell">
                      {listing.seller
                        ? `${String(listing.seller).slice(0, 8)}...${String(listing.seller).slice(-4)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="land-detail">
                    <span className="land-detail-label">Verify</span>
                    <a href={`https://sepolia.etherscan.io/address/${listing.seller}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 11 }}>
                      Etherscan ↗
                    </a>
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
        <div className="card-title" style={{ marginBottom: 12 }}><span style={{ color: "var(--gold)" }}>◎</span> Automatic Stamp Duty / Transfer Tax</div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.8 }}>
          Every land sale automatically sends <strong style={{ color: "var(--gold)" }}>4% stamp duty</strong> to
          the government treasury wallet — enforcing Uganda's Stamp Duty Act, Kenya's Stamp Duty Act Cap 480,
          and Botswana's Transfer Duty Act without any human involvement. No human collects it, no human
          can intercept it. Tax evasion is structurally impossible.
        </div>
      </div>
    </div>
  );
}
