import { createContext, useContext, useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  ADDRESSES,
  IDENTITY_REGISTRY_ABI,
  LAND_REGISTRY_ABI,
  LAND_MARKET_ABI,
} from "./contracts";

const Web3Context = createContext(null);

const CONTRACT_ENV_KEYS = [
  ["identityRegistry", "Identity Registry", "VITE_IDENTITY_REGISTRY_ADDRESS"],
  ["landRegistry", "Land Registry", "VITE_LAND_REGISTRY_ADDRESS"],
  ["landMarket", "Land Market", "VITE_LAND_MARKET_ADDRESS"],
];

function resolveContractAddresses() {
  const resolved = {};
  const missing = [];
  const invalid = [];
  for (const [key, label, envKey] of CONTRACT_ENV_KEYS) {
    const raw = ADDRESSES[key];
    if (!raw) {
      missing.push(envKey);
      continue;
    }
    if (!ethers.isAddress(raw)) {
      invalid.push(`${label} (${envKey}="${raw}")`);
      continue;
    }
    resolved[key] = ethers.getAddress(raw);
  }
  if (missing.length) {
    return {
      error: `Contract address(es) missing in .env: ${missing.join(", ")}. Set each to your deployed 0x address and restart the dev server.`,
    };
  }
  if (invalid.length) {
    return {
      error: `Invalid contract address: ${invalid.join("; ")}. Use a valid Sepolia contract address (0x + 40 hex chars).`,
    };
  }
  return { addresses: resolved };
}

export function Web3Provider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not found. Please install MetaMask.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      await web3Provider.send("eth_requestAccounts", []);
      const web3Signer = await web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      const network = await web3Provider.getNetwork();
      if (network.chainId !== 11155111n) {
        setError("Please switch MetaMask to Sepolia testnet.");
        setConnecting(false);
        return;
      }

      const resolved = resolveContractAddresses();
      if (resolved.error) {
        setError(resolved.error);
        setConnecting(false);
        return;
      }
      const a = resolved.addresses;

      const identityRegistry = new ethers.Contract(
        a.identityRegistry,
        IDENTITY_REGISTRY_ABI,
        web3Signer
      );
      const landRegistry = new ethers.Contract(
        a.landRegistry,
        LAND_REGISTRY_ABI,
        web3Signer
      );
      const landMarket = new ethers.Contract(
        a.landMarket,
        LAND_MARKET_ABI,
        web3Signer
      );

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setContracts({ identityRegistry, landRegistry, landMarket });
    } catch (err) {
      setError(err.message || "Connection failed");
    }
    setConnecting(false);
  }, []);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setContracts(null);
    setError(null);
  }, []);

  return (
    <Web3Context.Provider
      value={{ provider, signer, account, contracts, connecting, error, connect, disconnect }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}
