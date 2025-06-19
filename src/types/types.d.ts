// Base interfaces
interface BaseResponse {
  code: number;
  message?: string;
  detail?: string;
}

interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

// User related interfaces
interface Onboarding {
  driveSetup: {
    completed: boolean;
  };
  rootFolder: {
    completed: boolean;
  };
}

interface Key {
  id: string;
  version: number;
  primary: boolean;
  privateKey: string;
  passphrase: string;
  passphraseSignature: string;
  fingerprint: string;
  active: boolean;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  companyName: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  currency: string;
  credit: number;
  type: number;
  createTime: number;
  maxDriveSpace: number;
  usedDriveSpace: number;
  subscribed: number;
  role: number;
  delinquent: number;
  billed: number;
  keys: Key[];
  stripeUser: boolean;
  stripeUserExists: boolean;
  retentionFlag: {
    eligible: boolean;
    reason: string;
  };
  onboardingFlags: Onboarding;
}

interface UserResponse extends BaseResponse {
  user: User;
}

// Auth related interfaces
interface AuthError {
  response: {
    data: {
      detail: string;
    };
  };
  code: number;
}

interface AuthChallenge extends BaseResponse {
  serverChallenge:
    | {
        challenge: string;
        challengeId: string;
        challengeToken: string;
        fingerprintVerified: boolean;
        serverAuthSolution: string;
        expiresIn: number;
        isSignup: false;
      }
    | {
        serverAuthSolution: string;
        isSignup: true;
      };
}

interface LoginInitResponse extends BaseResponse {
  detail: string;
  username: string;
  salt: string;
  serverPublic: string;
  sessionId: string;
  sessionTtl: number;
  attemptsRemaining: number;
}

interface LoginInitRequest {
  email: string;
  clientPublic: string;
}

interface LoginCommitRequest {
  email: string;
  clientProof: string;
  sessionId: string;
}

interface BaseAuthResponse extends BaseResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: Partial<User>;
}

interface LoginCommitResponse extends BaseAuthResponse {
  serverProof: string;
}

// Session related interfaces
interface Session {
  id: string;
  userId: string;
  email?: string;
  username?: string;
  deviceId: string;
  deviceName: string;
  appVersion: string;
  userAgent?: string;
  expiresAt: number;
  createdAt: number;
  lastActive: number;
  ipAddress?: string;
  isCurrent: boolean;
}

interface SessionsResponse extends BaseResponse {
  sessions: Session[];
  pagination: Pagination;
}

// Device and location interfaces
interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  appVersion: string;
  userAgent: string;
  ipAddress: string;
}

interface Location {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
}

// Security and events
interface SecurityEvent {
  id: string;
  userId: string;
  eventType: string;
  success: boolean;
  metadata: {
    device: DeviceInfo;
    description: string;
    method?: string;
    attempts?: number;
    location: Location;
    nonce: string;
  };
  createdAt: number;
}

interface SecurityEventsResponse extends BaseResponse {
  events: SecurityEvent[];
  pagination: Pagination;
}

interface SecuritySettings {
  darkWebMonitoring: boolean;
  detailedEvents: boolean;
  suspiciousActivityDetection: boolean;
  twoFactorRequired: boolean;
  trustedDevices: string[];
}

interface SecuritySettingsResponse extends BaseResponse {
  security: SecuritySettings;
}

// MFA and Recovery interfaces
interface MFAMethod {
  enabled: boolean;
  verified: boolean;
  lastUsed: number | null;
}

interface TOTPMethod extends MFAMethod {
  secret: string | null;
}

interface MFASettings {
  methods: {
    email?: MFAMethod;
    phone?: MFAMethod;
    totp?: TOTPMethod;
  };
  preferredMethod: string | null;
}

interface MFASettingsResponse extends BaseResponse {
  mfa: MFASettings | null;
}

interface MFAMethodUpdate {
  enabled: boolean;
}

interface TOTPMethodUpdate extends MFAMethodUpdate {
  verified?: boolean;
  secret?: string | null;
}

interface BaseRecovery {
  enabled: boolean;
  lastUsed: number | null;
  createdAt: number;
  modifiedAt: number;
}

interface EmailRecovery extends BaseRecovery {
  email: string | null;
  emailVerified: boolean;
}

interface PhoneRecovery extends BaseRecovery {
  phone: string | null;
  phoneVerified: boolean;
}

interface FileRecovery extends BaseRecovery {
  recoveryKey: string | null;
  recoveryKeySignature: string | null;
}

interface PhraseRecovery extends BaseRecovery {
  // No additional properties
}

interface RecoveryMethod {
  accountRecovery: {
    email: EmailRecovery;
    phone: PhoneRecovery;
  };
  dataRecovery: {
    file: FileRecovery;
    phrase: PhraseRecovery;
  };
  createdAt: number;
  lastUpdated: number;
}

interface RecoveryMethodsResponse extends BaseResponse {
  recoveryMethods: RecoveryMethod;
}

type PartialEmailRecovery = Partial<EmailRecovery>;
type PartialPhoneRecovery = Partial<PhoneRecovery>;
type PartialFileRecovery = Partial<FileRecovery>;
type PartialPhraseRecovery = Partial<PhraseRecovery>;

interface RecoveryMethodUpdate {
  accountRecovery?: {
    email?: PartialEmailRecovery;
    phone?: PartialPhoneRecovery;
  };
  dataRecovery?: {
    file?: PartialFileRecovery;
    phrase?: PartialPhraseRecovery;
  };
}

interface AccountRecovery {
  methods: {
    email: boolean;
    phone: boolean;
    totp: boolean;
  };
  preferredMethod: string | null;
}

// User preferences
type ThemeMode = "light" | "dark" | "system";

interface Preferences {
  themeMode: ThemeMode;
  language: string;
  timezone: string;
  notifications: {
    push: boolean;
    email: boolean;
    security: boolean;
  };
}

interface PreferencesResponse extends BaseResponse {
  preferences: Preferences;
}

// Signup related
interface SignupChallenge {
  email: string;
  clientFingerprint: string;
  intent: string;
}

interface ProcessChallenge extends BaseResponse {
  challengeId: string;
  challengeString: string;
  expiresIn: number;
}

interface ClientProof {
  challengeId: string;
  solution: string;
  clientFingerprint: string;
}

interface SignupRequest {
  username: string;
  email: string;
  keys: {
    version: number;
    publicKey: string;
    privateKey: string;
    passphrase: string;
    passphraseSignature: string;
    fingerprint: string;
  };
  salt: string;
  verifier: string;
}

interface SignupState {
  username: string;
  email: string;
  password: string;
  Credentials?: any;
  userKeys?: any;
  recoveryPhrase?: string;
  challengeToken?: string;
}

// Auth context
interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (
    username: string,
    email: string,
    password: string,
  ) => Promise<{ recoveryPhrase: string }>;
  logout: () => Promise<void>;
  getSessionDerivedKey: ({ userId: string }) => Promise<string | null>;
  isAuthenticated: boolean;
}

// Error and UI helpers
interface ApiError extends Error {
  status?: number;
  data?: any;
}

interface ToastMessage {
  type: "success" | "error" | "warning" | "caution" | "info";
  text: string;
}

interface ToastMessageProps {
  toastMessage: ToastMessage;
  setShowToast: (show: boolean) => void;
  setToastMessage: (message: ToastMessage) => void;
  onUndo?: () => void;
  showUndo?: boolean;
  duration?: number;
}

interface PaginationProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

// Hooks props
interface UseUserUpdateProps {
  user: User | null;
  setUser: (user: User) => void;
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
  setIsSaving: (saving: boolean) => void;
}

interface UseSecurityEventsProps {
  itemsPerPage: number;
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
}

// Drive and file interfaces
interface FileProperties {
  nodeHashKey?: string;
  contentHash?: string;
  contentKeyPacket?: string;
  contentKeySignature?: string;
  uploadStatus?: string;
  modifiedAt?: number;
  activeRevision?: {
    id: string;
    createdAt: number;
    size: number;
    state: number;
    thumbnail: any | null;
    signatureEmail: string;
  };
}

interface FolderProperties {
  nodeHashKey?: string;
}

interface DriveItemBase {
  id: string;
  parentId: string;
  shareId: string;
  volumeId: string;
  type: number; // 1 for folder, 2 for file
  name: string;
  mimeType: string;
  hash: string;
  size: number;
  totalSize: number | null;
  state: number;
  signatureEmail: string;
  nodeKey: string;
  nodePassphrase: string;
  nodePassphraseSignature: string;
  createdAt: number;
  modifiedAt: number;
  isTrashed: boolean;
  trashTime: number | null;
  isShared: boolean;
  sharingDetails: any | null;
  shareUrls: any | null;
  shareIds: any | null;
  nbUrls: any | null;
  activeUrls: any | null;
  urlsExpired: any | null;
  xAttrs: string | null;
}

interface FolderItem extends DriveItemBase {
  type: 1;
  fileProperties: null;
  folderProperties: FolderProperties;
}

interface FileItem extends DriveItemBase {
  type: 2;
  fileProperties: FileProperties;
  folderProperties: null;
}

type DriveItem = FileItem | FolderItem;

interface DriveItemsResponse extends BaseResponse {
  items: DriveItem[];
  pagination: {
    offset: number;
    limit: number;
    totalItems: number;
    sortBy: string;
    sortDir: string;
  };
}

interface DraggedItemType {
  id: string;
  type: string;
  name: string;
}

interface DraggableItemProps {
  item: FolderItem | FileItem;
  onSelect: (id?: string, forceSingle?: boolean) => void;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDrop: (draggedItem: DraggedItemType, targetId: string) => void;
  downloadItem: (id: string) => void;
  moveToTrash: () => void;
  setIsMoveFolderModalOpen: (isOpen: boolean) => void;
  renameItem: (itemId: string) => void;
  user: User;
  setShowPreview: (show: boolean) => void;
  setShowDetailsModal: (show: boolean) => void;
}

interface PreviewProps {
  isOpen: boolean;
  onClose: () => void;
  currentItem: any; // FileDetails type not defined in provided code
  nextItem?: () => void;
  prevItem?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  formatFileSize: (size: number) => string;
  currentIndex: number;
  totalItems: number;
  downloadItem: (id: string) => void;
}

// Subscription and billing interfaces
type PlanId = "free" | "plus" | "pro" | "max";
type PlanType = "individual" | "family" | "business";
type BillingCycle = "monthly" | "yearly" | null;

interface PlanFeature {
  id: string;
  name: string;
  description: string;
  icon?: string;
  features: string[];
  storage: number;
  price: {
    monthly: number;
    yearly: number;
  };
  tier: number;
  available: boolean;
  popular?: boolean;
}

interface FeaturedPlans {
  individual: PlanFeature[];
  family: PlanFeature | null;
  business: PlanFeature | null;
}

interface Subscription {
  id: string;
  planId: string;
  planType: string;
  status: string;
  billingCycle: BillingCycle;
  autoRenew: boolean;
  currentPeriodStart: number;
  currentPeriodEnd: number | null;
  trialInfo?: {
    start: number;
    end: number;
    isActive: boolean;
    daysLeft: number;
  } | null;
  isCancelable: boolean;
  isUpgradable: boolean;
  storage: {
    baseQuota: number;
    additional: number;
    total: number;
  };
  nextInvoice?: {
    amount: number;
    currency: string;
    date: number;
  };
}

interface SubscriptionsResponse extends BaseResponse {
  subscription: Subscription;
  paymentStatus?: string;
  clientSecret?: string;
  subscriptionId?: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  billingName?: string;
  billingCountry?: string;
  billingPostalCode?: string;
  createdAt: number;
  lastUsed: number;
  expiryStatus: string;
}

interface BillingHistory {
  id: string;
  date: number;
  amount: number;
  status: "paid" | "failed" | "pending" | "refunded";
  paymentMethod: string;
  invoiceUrl?: string;
  planId: PlanId;
}

// Component props interfaces
interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  setSubscription: React.Dispatch<React.SetStateAction<Subscription | null>>;
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
  availablePlans?: FeaturedPlans | null;
}

interface BillingHistorySectionProps {
  billingHistory: BillingHistory[];
}

interface DashboardProps {
  user: User | null;
  subscription: Subscription | null;
  setSubscription: React.Dispatch<React.SetStateAction<Subscription | null>>;
  availablePlans: FeaturedPlans | null;
  formatBytes: (bytes: number) => string;
  preferences: Preferences | null;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences | null>>;
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
}

// System identifiers
interface SystemIdentifier {
  hash: string;
  os_name: string;
  os_long_version: string;
}
