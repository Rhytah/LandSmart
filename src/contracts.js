function envAddr(key) {
  const v = import.meta.env[key];
  return (typeof v === "string" ? v : "").trim();
}

/** Trims env values. Empty strings become "" — do not pass raw "" to ethers.Contract (ethers treats it as ENS). */
export const ADDRESSES = {
  identityRegistry: envAddr("VITE_IDENTITY_REGISTRY_ADDRESS"),
  landRegistry: envAddr("VITE_LAND_REGISTRY_ADDRESS"),
  landMarket: envAddr("VITE_LAND_MARKET_ADDRESS"),
};

/** Matches `chain/IdentityRegistry.sol`: Role enum is 0=None … 4=Admin. */
export const IDENTITY_REGISTRY_ABI = [
  "function registerIdentity(string nationalIDHash, string fullName) public",
  "function verifyIdentity(address citizen) public",
  "function assignRole(address user, uint8 role) public",
  "function isVerified(address user) public view returns (bool)",
  "function getRole(address user) public view returns (uint8)",
  "function identities(address) public view returns (address walletAddress, string nationalID, string fullName, bool isVerified, uint8 role, uint256 verifiedAt)",
  "event IdentityRegistered(address indexed user, string fullName)",
  "event IdentityVerified(address indexed user, address indexed verifier)",
  "event RoleAssigned(address indexed user, uint8 role)",
];

export const LAND_REGISTRY_ABI = [
  "function identityRegistry() view returns (address)",
  "function registerLand(string plotNumber, string gpsCoordinates, string district, uint256 areaSqMeters, uint256 registeredValue) public returns (uint256)",
  "function verifierApprove(uint256 landID) public",
  "function governmentApprove(uint256 landID) public",
  "function flagDispute(uint256 landID, string reason) public",
  "function getLand(uint256 landID) public view returns (tuple(uint256 landID, address currentOwner, string plotNumber, string gpsCoordinates, string district, uint256 areaSqMeters, uint256 registeredValue, uint8 status, uint256 registrationDate, bool governmentApproved, bool verifierApproved))",
  "function getOwnershipHistory(uint256 landID) public view returns (tuple(address owner, uint256 timestamp, string transactionType, uint256 price)[])",
  "function getLandsByOwner(address owner) public view returns (uint256[])",
  "function landCount() public view returns (uint256)",
  "event LandRegistered(uint256 indexed landID, address indexed owner, string plotNumber)",
  "event LandApproved(uint256 indexed landID, address indexed official)",
];

export const LAND_MARKET_ABI = [
  "function listLand(uint256 landID, uint256 askingPrice) public",
  "function buyLand(uint256 landID) public payable",
  "function cancelListing(uint256 landID) public",
  "function calculateStampDuty(uint256 price) public view returns (uint256)",
  "function listings(uint256) public view returns (uint256 landID, address seller, uint256 askingPrice, bool isActive, uint256 listedAt)",
  "event LandListed(uint256 indexed landID, address indexed seller, uint256 price)",
  "event LandSold(uint256 indexed landID, address indexed seller, address indexed buyer, uint256 price, uint256 stampDuty)",
];

export const ROLE_NAMES = {
  0: "None",
  1: "Citizen",
  2: "Verifier",
  3: "Government",
  4: "Admin",
};

export const STATUS_NAMES = {
  0: "Unregistered",
  1: "Pending Verification",
  2: "Verified",
  3: "Disputed",
  4: "For Sale",
};

export const STATUS_COLORS = {
  0: "#6b7280",
  1: "#f59e0b",
  2: "#10b981",
  3: "#ef4444",
  4: "#3b82f6",
};
