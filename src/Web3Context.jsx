import { createContext, useContext, useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  ADDRESSES,
  IDENTITY_REGISTRY_ABI,
  LAND_REGISTRY_ABI,
  LAND_MARKET_ABI,
} from "./contracts";

const Web3Context = createContext(null);

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

      const identityRegistry = new ethers.Contract(
        ADDRESSES.identityRegistry,
        IDENTITY_REGISTRY_ABI,
        web3Signer
      );
      const landRegistry = new ethers.Contract(
        ADDRESSES.landRegistry,
        LAND_REGISTRY_ABI,
        web3Signer
      );
      const landMarket = new ethers.Contract(
        ADDRESSES.landMarket,
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
