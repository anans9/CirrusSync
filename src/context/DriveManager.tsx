import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
} from "react";
import * as openpgp from "openpgp";
import { ApiService } from "../services/ApiService";
import keyManager from "./KeyManager";
import secureStorage from "../services/SecureStorageService";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

/**
 * WorkerPool class for managing crypto worker threads
 */
class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{
    task: any;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private isInitialized = false;

  /**
   * Get the number of active workers
   */
  get activeWorkersCount(): number {
    return this.workers.length - this.availableWorkers.length;
  }

  /**
   * Get the number of pending tasks
   */
  get pendingTasksCount(): number {
    return this.taskQueue.length;
  }

  /**
   * Create a new WorkerPool
   * @param size Number of worker threads to create (defaults to CPU cores)
   */
  constructor(public size: number = navigator.hardwareConcurrency || 4) {}

  /**
   * Initialize the worker pool
   */
  public initialize() {
    if (this.isInitialized) return;

    // Create web workers
    for (let i = 0; i < this.size; i++) {
      // Create worker using provided URL
      const worker = new Worker(new URL("./cryptoWorker.js", import.meta.url));

      // Set up message handler
      worker.onmessage = (event) => {
        const { id, result, error } = event.data;

        // Find the corresponding task
        const taskIndex = this.taskQueue.findIndex(
          (task) => task.task.id === id,
        );

        if (taskIndex !== -1) {
          const { resolve, reject } = this.taskQueue[taskIndex];

          // Remove the task from queue
          this.taskQueue.splice(taskIndex, 1);

          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }

        // Return worker to available pool
        this.availableWorkers.push(worker);

        // Process next task if available
        this.processNextTask();
      };

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }

    this.isInitialized = true;
  }

  /**
   * Execute a task in a worker thread
   * @param taskType Type of task to perform
   * @param taskData Task data
   * @returns Promise that resolves with task result
   */
  public async executeTask(taskType: string, taskData: any): Promise<any> {
    // Ensure pool is initialized
    if (!this.isInitialized) {
      this.initialize();
    }

    return new Promise((resolve, reject) => {
      const taskId =
        Date.now().toString(36) + Math.random().toString(36).substring(2);

      this.taskQueue.push({
        task: {
          id: taskId,
          type: taskType,
          data: taskData,
        },
        resolve,
        reject,
      });

      this.processNextTask();
    });
  }

  /**
   * Process the next task in the queue
   */
  private processNextTask() {
    // If there are tasks in queue and available workers
    if (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const worker = this.availableWorkers.pop()!;
      const { task } = this.taskQueue[0];

      worker.postMessage(task);
    }
  }

  /**
   * Process a batch of items in parallel
   * @param items Items to process
   * @param taskType Type of task to perform
   * @param batchSize Number of items to process in each batch
   * @returns Promise that resolves with processed results
   */
  public processBatch<T, R>(
    items: T[],
    taskType: string,
    batchSize: number = 5,
  ): Promise<R[]> {
    // Process items in batches
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return new Promise((resolve, reject) => {
      const results: R[] = new Array(items.length);
      let completedBatches = 0;

      batches.forEach(async (batch, batchIndex) => {
        try {
          // Process each batch in parallel
          const batchPromises = batch.map((item, itemIndex) =>
            this.executeTask(taskType, item).then((result) => {
              // Store result in the correct position
              const originalIndex = batchIndex * batchSize + itemIndex;
              results[originalIndex] = result;
            }),
          );

          await Promise.all(batchPromises);
          completedBatches++;

          if (completedBatches === batches.length) {
            resolve(results);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Terminate all workers in the pool
   */
  public terminate() {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.isInitialized = false;
  }
}

// Types for drive items
interface EncryptedDriveItem {
  id: string;
  type: "share" | "folder" | "file";
  name: string; // Decrypted name for display
  originalName: string; // Encrypted name from backend
  parentId: string | null;
  path: string | null; // Path to the item (derived)
  createdAt: number;
  modifiedAt: number;
  size: number;
  mimeType: string | null;
  isShared: boolean;
  isTrashed: boolean;
  trashedAt: number | null;
  keyData: {
    privateKey: any;
    keyPacket: string;
    sessionKey?: string;
    contentKey?: string;
    keyPacketId?: string; // ID of the key packet
  };
  original: any; // Original encrypted data
}

interface Folder extends EncryptedDriveItem {
  childIds: string[];
  loaded: boolean;
  lastLoadedOffset: number;
  totalPages: number;
  totalItems: number;
}

interface File extends EncryptedDriveItem {
  revisionId?: string;
  blocks?: any[];
  thumbnailUrl?: string;
}

// Interface for integrity verification
interface IntegrityResult {
  success: boolean;
  verified: boolean;
  errors?: string[];
  unverifiedItems?: Array<{ id: string; type: string; name: string }>;
  verificationChain?: Array<{ id: string; type: string; status: string }>;
}

// State interfaces
interface DriveState {
  isInitialized: boolean;
  isLoading: boolean;
  loadingItems: Record<string, boolean>;
  rootShareId: string | null;
  rootFolderId: string | null;
  currentFolderId: string | null;
  shares: Record<string, EncryptedDriveItem>;
  folders: Record<string, Folder>;
  files: Record<string, File>;
  trashItems: Record<string, { type: string; parentId: string }>;
  expandedFolderIds: string[];
  folderSizes: Record<string, number>;
  decryptedNames: Record<string, string>;
  keyPackets: Record<string, string>;
  sessionKeys: Record<string, string>;
  decryptionErrors: Record<string, { count: number; lastError: string }>;
  isLoadingTrash: boolean;
  trashlastLoadedOffset: number;
  trashTotalPages: number;
  trashTotalItems: number;
  error: string | null;
}

// Create the initial state
const initialDriveState: DriveState = {
  isInitialized: false,
  isLoading: false,
  loadingItems: {},
  rootShareId: null,
  rootFolderId: null,
  currentFolderId: null,
  shares: {},
  folders: {},
  files: {},
  trashItems: {},
  expandedFolderIds: [],
  folderSizes: {},
  decryptedNames: {},
  keyPackets: {},
  sessionKeys: {},
  decryptionErrors: {},
  isLoadingTrash: false,
  trashlastLoadedOffset: 0,
  trashTotalPages: 0,
  trashTotalItems: 0,
  error: null,
};

// Context type with all methods from original implementation
interface DriveCacheContextType {
  state: DriveState;
  actions: {
    initialize: () => Promise<boolean>;
    navigateTo: (folderId: string) => Promise<boolean>;
    navigateToParent: () => Promise<boolean>;
    loadFolderContents: (
      folderId: string,
      page?: number,
      limit?: number,
      appendToExisting?: boolean,
      shouldNotify?: boolean,
    ) => Promise<{
      success: boolean;
      hasMore: boolean;
      totalItems: number;
      totalPages: number;
    }>;
    loadMoreItems: (folderId?: string) => Promise<boolean>;
    createFolder: (
      parentId: string,
      name: string,
      email: string,
    ) => Promise<string | null>;
    updateFolderName: (folderId: string, newName: string) => Promise<boolean>;
    updateFileName: (fileId: string, newName: string) => Promise<boolean>;
    moveToTrash: (
      currentFolder: string,
      itemIds: string[],
      itemTypes: { [id: string]: "folder" | "file" },
    ) => Promise<boolean>;
    restoreFromTrash: (itemIds: string[]) => Promise<boolean>;
    moveItems: (itemIds: string[], targetFolderId: string) => Promise<any>;
    permanentlyDelete: (
      itemId: string,
      itemType: "folder" | "file",
    ) => Promise<boolean>;
    toggleFolderExpanded: (folderId: string) => void;
    addFileToCache: (fileInfo: {
      id: string;
      parentId: string;
    }) => Promise<string | null>;
    decryptFileContent: (
      fileId: string,
      content: string | Uint8Array,
    ) => Promise<Uint8Array>;
    clear: () => void;
    loadFolderTree: (
      folderId: string,
      page: number,
      pageSize: number,
      triggerLoad?: boolean,
      includeDeleted?: boolean,
    ) => Promise<{ success: boolean }>;
    decryptUserPrivateKey: (encryptedKey: string) => Promise<any>;
    loadTrashContents: (
      page?: number,
      limit?: number,
      appendToExisting?: boolean,
    ) => Promise<{
      success: boolean;
      hasMore: boolean;
      totalItems: number;
      totalPages: number;
    }>;
    loadMoreTrashItems: () => Promise<boolean>;
    isLoadingTrash: boolean;
    hasMoreTrashItems: boolean;
  };

  // Essential getters
  getRootShareId: () => string | null;
  getRootFolderId: () => string | null;
  getRootDetails: () => {
    rootFolderId: string | null;
    rootShareId: string | null;
  };
  getDecryptedName: (
    itemId: string,
    type: "folder" | "file",
  ) => Promise<string>;
  getFolder: (folderId: string) => Folder | null;
  getFile: (fileId: string) => File | null;
  getFolderChildren: (
    folderId: string | null,
    triggerLoad?: boolean,
    includeDeleted?: boolean,
  ) => Promise<EncryptedDriveItem[]>;
  getFolderSize: (folderId: string) => number;
  updateFolderSize: (folderId: string) => number;
  updateFolderSizeHierarchy: (folderId: string, sizeDelta?: number) => void;
  verifyIntegrity: (
    itemId: string,
    itemType: "folder" | "file",
    signature_email: string,
  ) => Promise<boolean>;
  verifyFolderTreeIntegrity: (folderId: string) => Promise<IntegrityResult>;
  getPerformanceStats: () => any;
  getDecryptionErrors: () => {
    [key: string]: { count: number; lastError: string };
  };
  clearDecryptionErrors: () => void;
  getTrashedItems: (
    includeFolders?: boolean,
    includeFiles?: boolean,
  ) => Array<{ id: string; type: string; item: EncryptedDriveItem }>;

  // Current state getters
  isInitialized: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  updateCounter: number;
  currentFolder: Folder | null;
  folderItems: EncryptedDriveItem[];
  breadcrumbs: Array<{ id: string; name: string }>;
  hasMoreItems: boolean;
  error: string | null;
}

// Create the context
const DriveCacheContext = createContext<DriveCacheContextType | null>(null);

// Create a reducer for complex state updates
const driveReducer = (state: DriveState, action: any): DriveState => {
  switch (action.type) {
    case "SET_INITIALIZED":
      return { ...state, isInitialized: action.payload };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_LOADING_ITEM":
      return {
        ...state,
        loadingItems: {
          ...state.loadingItems,
          [action.payload.id]: action.payload.isLoading,
        },
      };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_ROOT_IDS":
      return {
        ...state,
        rootShareId: action.payload.shareId,
        rootFolderId: action.payload.folderId,
      };

    case "SET_CURRENT_FOLDER":
      return { ...state, currentFolderId: action.payload };

    case "ADD_SHARE":
      return {
        ...state,
        shares: {
          ...state.shares,
          [action.payload.id]: action.payload,
        },
      };

    case "ADD_FOLDER":
      return {
        ...state,
        folders: {
          ...state.folders,
          [action.payload.id]: action.payload,
        },
      };

    case "UPDATE_FOLDER_CHILDREN":
      // Get existing children IDs and handle undefined/null case
      const existingChildIds =
        state.folders[action.payload.folderId]?.childIds || [];

      // Determine the new childIds based on context
      let newChildIds;

      if (action.payload.replaceChildren === true) {
        // When explicitly told to replace (for reloading)
        newChildIds = action.payload.childIds;
      } else if (action.payload.appendToExisting === true) {
        // When explicitly told to append (for adding files/folders)
        newChildIds = [
          ...new Set([...existingChildIds, ...action.payload.childIds]),
        ];
      } else if (action.payload.page > 1) {
        // When loading additional pages (pagination)
        newChildIds = [
          ...new Set([...existingChildIds, ...action.payload.childIds]),
        ];
      } else {
        // For first page loads or when explicitly replacing
        newChildIds = action.payload.childIds;
      }

      // First check if we're updating a folder in state
      if (state.folders[action.payload.folderId]) {
        return {
          ...state,
          folders: {
            ...state.folders,
            [action.payload.folderId]: {
              ...state.folders[action.payload.folderId],
              childIds: newChildIds,
              loaded: true,
              lastLoadedOffset: action.payload.offset,
              totalPages: action.payload.totalPages,
              totalItems: action.payload.totalItems,
            },
          },
        };
      }

      // If folder doesn't exist, do nothing (this should be rare)
      return state;

    case "ADD_FILE":
      return {
        ...state,
        files: {
          ...state.files,
          [action.payload.id]: action.payload,
        },
      };

    case "TOGGLE_FOLDER_EXPANDED":
      return {
        ...state,
        expandedFolderIds: state.expandedFolderIds.includes(action.payload)
          ? state.expandedFolderIds.filter((id) => id !== action.payload)
          : [...state.expandedFolderIds, action.payload],
      };

    case "MARK_ITEM_DELETED":
      if (action.payload.type === "folder") {
        if (state.folders[action.payload.id]) {
          return {
            ...state,
            folders: {
              ...state.folders,
              [action.payload.id]: {
                ...state.folders[action.payload.id],
                isTrashed: true,
                trashedAt: Math.floor(Date.now() / 1000),
              },
            },
            trashItems: {
              ...state.trashItems,
              [action.payload.id]: {
                type: "folder",
                parentId: state.folders[action.payload.id].parentId || "",
              },
            },
          };
        }
      } else {
        return {
          ...state,
          files: {
            ...state.files,
            [action.payload.id]: {
              ...state.files[action.payload.id],
              isTrashed: true,
              trashedAt: Math.floor(Date.now() / 1000),
            },
          },
          trashItems: {
            ...state.trashItems,
            [action.payload.id]: {
              type: "file",
              parentId: state.files[action.payload.id].parentId || "",
            },
          },
        };
      }
      return state; // Fallback if neither condition matches

    case "RESTORE_ITEM":
      const itemId = action.payload;
      const itemType = state.trashItems[itemId]?.type;
      const newTrashItems = { ...state.trashItems };
      delete newTrashItems[itemId];

      if (itemType === "folder") {
        if (state.folders[itemId]) {
          return {
            ...state,
            folders: {
              ...state.folders,
              [itemId]: {
                ...state.folders[itemId],
                isTrashed: false,
                trashedAt: null,
              },
            },
            trashItems: newTrashItems,
          };
        }
      } else {
        return {
          ...state,
          files: {
            ...state.files,
            [itemId]: {
              ...state.files[itemId],
              isTrashed: false,
              trashedAt: null,
            },
          },
          trashItems: newTrashItems,
        };
      }
      return state; // Fallback if neither condition matches

    case "REMOVE_ITEM":
      if (action.payload.type === "folder") {
        const newFolders = { ...state.folders };

        // Delete folder from state
        if (newFolders[action.payload.id]) {
          delete newFolders[action.payload.id];
        }

        // Also need to remove from parent's childIds if applicable
        if (action.payload.parentId && newFolders[action.payload.parentId]) {
          newFolders[action.payload.parentId] = {
            ...newFolders[action.payload.parentId],
            childIds: newFolders[action.payload.parentId].childIds.filter(
              (id) => id !== action.payload.id,
            ),
          };
        }

        const newTrashItems = { ...state.trashItems };
        delete newTrashItems[action.payload.id];

        return {
          ...state,
          folders: newFolders,
          trashItems: newTrashItems,
        };
      } else {
        const newFiles = { ...state.files };
        delete newFiles[action.payload.id];

        // Also remove from parent's childIds if applicable
        if (action.payload.parentId) {
          // Check if parent exists in state
          if (state.folders[action.payload.parentId]) {
            const newFolders = { ...state.folders };
            newFolders[action.payload.parentId] = {
              ...newFolders[action.payload.parentId],
              childIds: newFolders[action.payload.parentId].childIds.filter(
                (id) => id !== action.payload.id,
              ),
            };

            const newTrashItems = { ...state.trashItems };
            delete newTrashItems[action.payload.id];

            return {
              ...state,
              files: newFiles,
              folders: newFolders,
              trashItems: newTrashItems,
            };
          }
        }

        const newTrashItems = { ...state.trashItems };
        delete newTrashItems[action.payload.id];

        return {
          ...state,
          files: newFiles,
          trashItems: newTrashItems,
        };
      }

    case "UPDATE_FOLDER_SIZE":
      // Update size in folders state
      let updatedState = { ...state };

      if (state.folders[action.payload.folderId]) {
        updatedState = {
          ...updatedState,
          folders: {
            ...updatedState.folders,
            [action.payload.folderId]: {
              ...updatedState.folders[action.payload.folderId],
              size: action.payload.size,
            },
          },
        };
      }

      // Always update the folderSizes map
      return {
        ...updatedState,
        folderSizes: {
          ...updatedState.folderSizes,
          [action.payload.folderId]: action.payload.size,
        },
      };

    case "ADD_DECRYPTED_NAME":
      return {
        ...state,
        decryptedNames: {
          ...state.decryptedNames,
          [action.payload.id]: action.payload.name,
        },
      };

    case "ADD_KEY_PACKET":
      return {
        ...state,
        keyPackets: {
          ...state.keyPackets,
          [action.payload.id]: action.payload.keyPacket,
        },
      };

    case "ADD_SESSION_KEY":
      return {
        ...state,
        sessionKeys: {
          ...state.sessionKeys,
          [action.payload.id]: action.payload.sessionKey,
        },
      };

    case "LOG_DECRYPTION_ERROR":
      const existingError = state.decryptionErrors[action.payload.id] || {
        count: 0,
        lastError: "",
      };
      return {
        ...state,
        decryptionErrors: {
          ...state.decryptionErrors,
          [action.payload.id]: {
            count: existingError.count + 1,
            lastError: action.payload.error,
          },
        },
      };

    case "CLEAR_DECRYPTION_ERRORS":
      return {
        ...state,
        decryptionErrors: {},
      };

    case "SET_LOADING_TRASH":
      return { ...state, isLoadingTrash: action.payload };

    case "SET_TRASH_PAGINATION":
      return {
        ...state,
        trashlastLoadedOffset: action.payload.offset,
        trashTotalPages: action.payload.totalPages,
        trashTotalItems: action.payload.totalItems,
      };

    case "RESET":
      return initialDriveState;

    default:
      return state;
  }
};

// Create the provider
export const DriveCacheProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const workerPool = useRef<WorkerPool>(new WorkerPool());

  // Initialize worker pool on component mount
  useEffect(() => {
    workerPool.current.initialize();

    return () => {
      workerPool.current.terminate();
    };
  }, []);

  // Use useState instead of useReducer for simpler integration
  const [state, setState] = useState<DriveState>(initialDriveState);
  const [updateCounter, setUpdateCounter] = useState<number>(0);

  // Create a dispatch function that updates state immutably
  const dispatch = useCallback((action: any) => {
    setState((prevState) => driveReducer(prevState, action));
    // Increment update counter to help components know when to re-render
    setUpdateCounter((prev) => prev + 1);
  }, []);

  // Auth and routing hooks
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  // Local state for derived data
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [folderItems, setFolderItems] = useState<EncryptedDriveItem[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // References to prevent duplicate operations
  const isInitializing = useRef(false);
  const derivedKey = useRef<string | null>(null);
  const processingFolderIds = useRef<Set<string>>(new Set());

  // New reference-based folder cache for instant access
  const folderCache = useRef<Map<string, Folder>>(new Map());
  const folderPromises = useRef<Map<string, Promise<Folder>>>(new Map());
  const processingPromises = useRef<Map<string, Promise<any>>>(new Map());

  // Cache validation settings
  const CACHE_SETTINGS = {
    PAGE_SIZE: 50,
    KEY_PACKET_CACHE: true,
    MAX_DECRYPTION_RETRIES: 3,
    USE_PATH_CACHE: true,
    FOLDER_PROCESSING_TIMEOUT: 30000, // 30 seconds timeout for folder processing
  };

  // Track initialization
  useEffect(() => {
    if (
      user &&
      user.onboardingFlags.driveSetup.completed &&
      user.onboardingFlags.rootFolder.completed &&
      !state.isInitialized &&
      !isInitializing.current
    ) {
      const initDriveCache = async () => {
        const userDerivedKey = await secureStorage.getDerivedKey(user.id);
        if (userDerivedKey) {
          derivedKey.current = userDerivedKey;
          initialize();
        }
      };

      initDriveCache();
    }
  }, [user, state.isInitialized]);

  // Decrypt user private key
  const decryptUserPrivateKey = async (
    encryptedPrivateKey: string,
  ): Promise<any> => {
    if (!derivedKey.current) {
      throw new Error("Derived key not set");
    }

    try {
      return await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({
          armoredKey: encryptedPrivateKey,
        }),
        passphrase: derivedKey.current,
      });
    } catch (error) {
      logDecryptionError("user-private-key", error);
      throw error;
    }
  };

  // Helper function to log decryption errors
  const logDecryptionError = (id: string, error: any): void => {
    dispatch({
      type: "LOG_DECRYPTION_ERROR",
      payload: {
        id,
        error: error.message || "Unknown error",
      },
    });
  };

  // Initialize the drive cache
  const initialize = async (): Promise<boolean> => {
    if (!user || !derivedKey.current || isInitializing.current) {
      return false;
    }

    isInitializing.current = true;
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Get user's shares
      const sharesResponse = await ApiService.getShares();
      if (!sharesResponse?.shares?.length) {
        dispatch({ type: "SET_ERROR", payload: "No shares found" });
        return false;
      }

      // Get primary share
      const primaryShare = sharesResponse.shares.find(
        (share) => share.type === 1,
      );
      const shareId = primaryShare.id;

      // Get share details
      const shareDetails = await ApiService.getSharesById(shareId);
      if (!shareDetails?.share || !shareDetails?.share.memberships) {
        dispatch({ type: "SET_ERROR", payload: "Invalid share structure" });
        return false;
      }

      const share = shareDetails.share;
      const members = shareDetails.share.memberships;

      const rootFolderResponse = await ApiService.getLinkDetails(
        share.linkId,
        share.id,
      );

      const rootFolder = rootFolderResponse.folder;

      // Find current user's member entry
      const currentUserId = user.id;
      const userMember = members.find(
        (member) =>
          member.userId === currentUserId || member.memberId === currentUserId,
      );

      if (!userMember || !userMember.keyPacket) {
        dispatch({ type: "SET_ERROR", payload: "Member key packet not found" });
        return false;
      }

      // Get user's primary key
      const primaryKey = user.keys.find((key: any) => key.primary);
      if (!primaryKey?.privateKey) {
        dispatch({ type: "SET_ERROR", payload: "User private key not found" });
        return false;
      }

      // Decrypt user private key
      const userPrivateKey = await decryptUserPrivateKey(primaryKey.privateKey);

      // Decrypt member key packet
      const encryptedKeyPacket = await openpgp.readMessage({
        armoredMessage: userMember.keyPacket,
      });

      const decryptedKeyPacket = await openpgp.decrypt({
        message: encryptedKeyPacket,
        decryptionKeys: userPrivateKey,
        format: "utf8",
      });

      // Get session key from key packet
      const keyPacketData = JSON.parse(decryptedKeyPacket.data as string);
      const sessionKey = keyPacketData.sessionKey;

      const decryptSharePrivateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({
          armoredKey: share.shareKey,
        }),
        passphrase: sessionKey,
      });

      const decryptedSharePassphrase = await openpgp.decrypt({
        message: await openpgp.readMessage({
          armoredMessage: share.sharePassphrase,
        }),
        decryptionKeys: decryptSharePrivateKey,
      });

      const shareKeyPacketData = JSON.parse(
        decryptedSharePassphrase.data as string,
      );
      const shareSessionKey = shareKeyPacketData.shareSessionKey;

      if (!sessionKey) {
        dispatch({ type: "SET_ERROR", payload: "Session key not found" });
        return false;
      }

      // Add share to state
      dispatch({
        type: "ADD_SHARE",
        payload: {
          id: share.id,
          type: "share",
          name: "My Files",
          originalName: null,
          parentId: null,
          path: "/",
          keyData: {
            privateKey: decryptSharePrivateKey,
            keyPacket: userMember.keyPacket,
            shareSessionKey,
          },
          original: share,
        },
      });

      // Cache key packet and session key
      dispatch({
        type: "ADD_KEY_PACKET",
        payload: {
          id: share.id,
          keyPacket: userMember.keyPacket,
        },
      });

      dispatch({
        type: "ADD_SESSION_KEY",
        payload: {
          id: share.id,
          sessionKey,
        },
      });

      // Set root IDs
      dispatch({
        type: "SET_ROOT_IDS",
        payload: {
          shareId: share.id,
          folderId: rootFolder.id,
        },
      });

      // Process root folder

      // Decrypt root folder key packet
      const folderNodeKeyPacketMsg = await openpgp.readMessage({
        armoredMessage: rootFolder.folderProperties.nodeHashKey,
      });

      const decryptedNodeKeyPacket = await openpgp.decrypt({
        message: folderNodeKeyPacketMsg,
        passwords: [shareSessionKey],
        format: "binary",
      });

      const folderKeyPacketMsg = await openpgp.readMessage({
        armoredMessage: rootFolder.nodePassphrase,
      });

      const decryptedFolderKeyPacket = await openpgp.decrypt({
        message: folderKeyPacketMsg,
        passwords: [keyManager.arrayToBase64(decryptedNodeKeyPacket.data)],
        format: "utf8",
      });

      // Get folder session key
      const folderKeyPacketData = JSON.parse(
        decryptedFolderKeyPacket.data as string,
      );
      const folderSessionKey = folderKeyPacketData.sessionKey;

      if (!folderSessionKey) {
        dispatch({
          type: "SET_ERROR",
          payload: "Root folder session key not found",
        });
        return false;
      }

      // Decrypt root folder private key
      const rootFolderPrivateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({
          armoredKey: rootFolder.nodeKey,
        }),
        passphrase: folderSessionKey,
      });

      // Decrypt folder name
      let folderName = "My Files";
      try {
        folderName = await keyManager.decryptName(
          rootFolder.name,
          rootFolder.nodeKey,
          folderSessionKey,
        );
      } catch (error) {
        throw error;
      }

      // Add decrypted name to cache
      dispatch({
        type: "ADD_DECRYPTED_NAME",
        payload: {
          id: rootFolder.id,
          name: folderName,
        },
      });

      // Cache folder key packet and session key
      dispatch({
        type: "ADD_KEY_PACKET",
        payload: {
          id: rootFolder.id,
          keyPacket: rootFolder.nodePassphrase,
        },
      });

      dispatch({
        type: "ADD_SESSION_KEY",
        payload: {
          id: rootFolder.id,
          sessionKey: folderSessionKey,
        },
      });

      // Create processed folder object
      const processedRootFolder: Folder = {
        id: rootFolder.id,
        type: rootFolder.type,
        name: folderName,
        originalName: rootFolder.name,
        parentId: rootFolder.parentId || null,
        path: "/",
        createdAt: rootFolder.createdAt,
        modifiedAt: rootFolder.modifiedAt,
        size: rootFolder.size || 0,
        isShared: rootFolder.isShared,
        mimeType: rootFolder.mimeType || null,
        isTrashed: rootFolder.isTrashed || false,
        trashedAt: rootFolder.trashedAt || 0,
        keyData: {
          privateKey: rootFolderPrivateKey,
          keyPacket: rootFolder.nodePassphrase,
          sessionKey: folderSessionKey,
          keyPacketId: folderKeyPacketData.id,
        },
        original: rootFolder,
        childIds: [],
        loaded: false,
        lastLoadedOffset: 0,
        totalPages: 1,
        totalItems: 0,
      };

      // Add to both state and in-memory cache
      dispatch({
        type: "ADD_FOLDER",
        payload: processedRootFolder,
      });

      // Add to fast-access memory cache
      folderCache.current.set(rootFolder.id, processedRootFolder);

      // Update folder size
      dispatch({
        type: "UPDATE_FOLDER_SIZE",
        payload: {
          folderId: rootFolder.id,
          size: rootFolder.size || 0,
        },
      });

      // Set current folder to root
      dispatch({ type: "SET_CURRENT_FOLDER", payload: rootFolder.id });

      // Load root folder contents
      await loadFolderContents(rootFolder.id);

      // Set initialized
      dispatch({ type: "SET_INITIALIZED", payload: true });
      isInitializing.current = false;
      dispatch({ type: "SET_LOADING", payload: false });

      // Update breadcrumbs and folder items
      updateBreadcrumbs();
      updateFolderItems();

      return true;
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to initialize drive" });
      isInitializing.current = false;
      dispatch({ type: "SET_LOADING", payload: false });
      return false;
    }
  };

  // Find the share ID for a folder
  const findShareIdForFolder = (folderId: string): string | null => {
    // First check if this is the root folder
    if (state.rootFolderId === folderId && state.rootShareId) {
      return state.rootShareId;
    }

    // Traverse up the folder hierarchy
    let currentId = folderId;
    let iterations = 0;
    const maxIterations = 20; // Safety limit

    while (iterations < maxIterations) {
      // Check if folder exists in either cache or state
      const folder =
        folderCache.current.get(currentId) || state.folders[currentId];
      if (!folder) return state.rootShareId; // Fallback to root share

      if (!folder.parentId) {
        // This is a root-level folder, use root share
        return state.rootShareId;
      }

      currentId = folder.parentId;
      iterations++;
    }

    // Fallback to root share
    return state.rootShareId;
  };

  // Process folder with optimized synchronization
  const processFolder = async (
    folder: any,
    parentSessionKey: string,
  ): Promise<Folder> => {
    // Check if folder is already fully processed and in memory cache
    const cachedFolder = folderCache.current.get(folder.id);
    if (cachedFolder && cachedFolder.modifiedAt === folder.modifiedAt) {
      return cachedFolder;
    }

    // Check if folder is already in state
    const stateFolder = state.folders[folder.id];
    if (stateFolder && stateFolder.modifiedAt === folder.modifiedAt) {
      // Ensure folder is also in memory cache
      if (!folderCache.current.has(folder.id)) {
        folderCache.current.set(folder.id, stateFolder);
      }
      return stateFolder;
    }

    // Check if there's an existing processing promise to avoid duplicate work
    if (folderPromises.current.has(folder.id)) {
      try {
        return await folderPromises.current.get(folder.id)!;
      } catch (error) {
        // If previous promise failed, continue with new processing
        throw error;
      }
    }

    // Create a new processing promise
    const processingPromise = (async () => {
      processingFolderIds.current.add(folder.id);

      try {
        const folderNodeHashKey = await openpgp.readMessage({
          armoredMessage: folder.folderProperties.nodeHashKey,
        });

        const folderNodePassphrase = await openpgp.decrypt({
          message: folderNodeHashKey,
          passwords: [parentSessionKey],
          format: "utf8",
        });

        // Decrypt folder key packet
        const folderKeyPacketMsg = await openpgp.readMessage({
          armoredMessage: folder.nodePassphrase,
        });

        const decryptedFolderKeyPacket = await openpgp.decrypt({
          message: folderKeyPacketMsg,
          passwords: [folderNodePassphrase.data],
          format: "utf8",
        });

        // Get folder session key
        const folderKeyPacketData = JSON.parse(
          decryptedFolderKeyPacket.data as string,
        );

        const folderSessionKey = folderKeyPacketData.sessionKey;

        if (!folderSessionKey) {
          throw new Error("Folder session key not found");
        }

        // Decrypt folder private key
        const folderPrivateKey = await openpgp.decryptKey({
          privateKey: await openpgp.readPrivateKey({
            armoredKey: folder.nodeKey,
          }),
          passphrase: folderSessionKey,
        });

        // Decrypt folder name
        let folderName = "Unnamed Folder";
        try {
          if (folder.name) {
            folderName = await keyManager.decryptName(
              folder.name,
              folder.nodeKey,
              folderSessionKey,
            );
          }
        } catch (error) {
          throw error;
        }

        // // Calculate content hash
        // const contentHash = await calculateItemHash(folder);

        // Generate path
        let path = "/";
        if (folder.parent_id) {
          // Look for parent in memory cache first, then state
          const parentFolder =
            folderCache.current.get(folder.parentId) ||
            state.folders[folder.parentId];
          if (parentFolder) {
            path =
              parentFolder.path === "/"
                ? `/${parentFolder.name}`
                : `${parentFolder.path}/${parentFolder.name}`;
          }
        }

        // Preserve existing childIds if available
        const existingChildIds =
          folderCache.current.get(folder.id)?.childIds ||
          state.folders[folder.id]?.childIds ||
          [];

        // Create processed folder object
        const processedFolder: Folder = {
          id: folder.id,
          type: "folder",
          name: folderName,
          originalName: folder.name,
          parentId: folder.parentId,
          path,
          createdAt: folder.createdAt,
          modifiedAt: folder.modifiedAt,
          size: folder.size || 0,
          mimeType: folder.mimeType || null,
          isShared: folder.isShared || false,
          isTrashed: folder.isTrashed || false,
          trashedAt: folder.trashedAt,
          keyData: {
            privateKey: folderPrivateKey,
            keyPacket: folder.nodePassphrase,
            sessionKey: folderSessionKey,
            keyPacketId: folderKeyPacketData.id,
          },
          original: folder,
          childIds: existingChildIds,
          loaded:
            folderCache.current.get(folder.id)?.loaded ||
            state.folders[folder.id]?.loaded ||
            false,
          lastLoadedOffset:
            folderCache.current.get(folder.id)?.lastLoadedOffset ||
            state.folders[folder.id]?.lastLoadedOffset ||
            0,
          totalPages:
            folderCache.current.get(folder.id)?.totalPages ||
            state.folders[folder.id]?.totalPages ||
            1,
          totalItems:
            folderCache.current.get(folder.id)?.totalItems ||
            state.folders[folder.id]?.totalItems ||
            0,
        };

        // Immediately add to in-memory cache for instant access
        folderCache.current.set(folder.id, processedFolder);

        // Update state for persistence
        dispatch({
          type: "ADD_FOLDER",
          payload: processedFolder,
        });

        // Update folder size
        dispatch({
          type: "UPDATE_FOLDER_SIZE",
          payload: {
            folderId: folder.id,
            size: folder.size || 0,
          },
        });

        // Add decrypted name to cache
        dispatch({
          type: "ADD_DECRYPTED_NAME",
          payload: {
            id: folder.id,
            name: folderName,
          },
        });

        // Cache key packet and session key
        dispatch({
          type: "ADD_KEY_PACKET",
          payload: {
            id: folder.id,
            keyPacket: folder.nodePassphrase,
          },
        });

        dispatch({
          type: "ADD_SESSION_KEY",
          payload: {
            id: folder.id,
            sessionKey: folderSessionKey,
          },
        });

        // If the folder is deleted, add to trash items
        if (folder.isTrashed) {
          dispatch({
            type: "MARK_ITEM_DELETED",
            payload: {
              id: folder.id,
              type: "folder",
            },
          });
        }

        return processedFolder;
      } catch (error) {
        logDecryptionError(`folder-${folder.id}`, error);
        throw error;
      } finally {
        processingFolderIds.current.delete(folder.id);
        folderPromises.current.delete(folder.id);
      }
    })();

    // Store the promise for reuse
    folderPromises.current.set(folder.id, processingPromise);

    // Add timeout to prevent hung promises
    const timeoutPromise = new Promise<Folder>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`Folder processing timed out for folder ID: ${folder.id}`),
        );
      }, CACHE_SETTINGS.FOLDER_PROCESSING_TIMEOUT);
    });

    // Race between processing and timeout
    return Promise.race([processingPromise, timeoutPromise]);
  };

  // Process a file
  const processFile = async (
    file: any,
    parentSessionKey: string,
  ): Promise<File> => {
    try {
      // Skip if already processed and not modified
      const existingFile = state.files[file.id];
      if (existingFile && existingFile.modifiedAt === file.modifiedAt) {
        return existingFile;
      }

      // Decrypt file with parent's key
      // Decrypt file key packet
      const fileKeyPacketMsg = await openpgp.readMessage({
        armoredMessage: file.node_passphrase,
      });

      const decryptedFileKeyPacket = await openpgp.decrypt({
        message: fileKeyPacketMsg,
        passwords: [parentSessionKey],
        format: "utf8",
      });

      // Get file session key
      const fileKeyPacketData = JSON.parse(
        decryptedFileKeyPacket.data as string,
      );
      const fileSessionKey = fileKeyPacketData.sessionKey;

      if (!fileSessionKey) {
        throw new Error("File session key not found");
      }

      // Decrypt file private key
      const filePrivateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: file.nodeKey }),
        passphrase: fileSessionKey,
      });

      // Decrypt file name
      let fileName = "Unnamed File";
      try {
        if (file.name) {
          fileName = await keyManager.decryptName(file.name, filePrivateKey);
        }
      } catch (error) {
        throw error;
      }

      // Generate path
      let path = "/";
      if (file.parentId) {
        // Look for parent in memory cache first, then state
        const parentFolder =
          folderCache.current.get(file.parentId) ||
          state.folders[file.parentId];
        if (parentFolder) {
          path =
            parentFolder.path === "/"
              ? `/${parentFolder.name}`
              : `${parentFolder.path}/${parentFolder.name}`;
        }
      }

      // Process content key if available
      let contentKey = undefined;
      if (file.fileProperties && file.fileProperties.contentKeyPacket) {
        try {
          const contentKeyMessage = await openpgp.readMessage({
            armoredMessage: file.fileProperties.contentKeyPacket,
          });

          const decryptedContentKey = await openpgp.decrypt({
            message: contentKeyMessage,
            decryptionKeys: filePrivateKey,
            format: "binary",
          });

          contentKey = keyManager.arrayToBase64(
            new Uint8Array(decryptedContentKey.data as ArrayBuffer),
          );
        } catch (error) {
          throw error;
        }
      }

      // Process thumbnail if available
      let thumbnailBlobUrl = null;

      if (
        file.fileProperties &&
        file.fileProperties.activeRevision &&
        file.fileProperties.activeRevision.thumbnail === 1 &&
        file.fileProperties.activeRevision.thumbnailDownloadUrl &&
        contentKey
      ) {
        try {
          // Fetch the encrypted thumbnail
          const response = await fetch(
            file.file_properties.active_revision.thumbnail_download_url,
          );

          if (response.ok) {
            // Get the encrypted data
            const encryptedData = await response.arrayBuffer();

            // Create the same fixed zero nonce used in Rust (12 bytes of zeros)
            const nonceBytes = new Uint8Array(12).fill(0);

            // Convert content key from base64 to array buffer
            const keyBytes = keyManager.base64ToArray(contentKey);

            // Import the key for Web Crypto API
            const cryptoKey = await window.crypto.subtle.importKey(
              "raw",
              keyBytes,
              { name: "AES-GCM", length: 256 },
              false,
              ["decrypt"],
            );

            // Decrypt the thumbnail data
            const decryptedData = await window.crypto.subtle.decrypt(
              {
                name: "AES-GCM",
                iv: nonceBytes,
                tagLength: 128,
              },
              cryptoKey,
              encryptedData,
            );

            // Determine MIME type based on the file's mime_type or default to image/jpeg
            const mimeType =
              file.mime_type && file.mime_type.startsWith("image/")
                ? file.mime_type
                : "image/jpeg";

            // Create a blob from the decrypted data
            const blob = new Blob([decryptedData], { type: mimeType });
            thumbnailBlobUrl = URL.createObjectURL(blob);
          }
        } catch (error) {
          thumbnailBlobUrl = null;
        }
      }

      // Create processed file object
      const processedFile: File = {
        id: file.id,
        type: "file",
        name: fileName,
        originalName: file.name,
        parentId: file.parentId,
        path,
        size: file.size || 0,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        modifiedAt: file.modifiedAt,
        isShared: file.isShared || false,
        isTrashed: file.isTrashed || false,
        trashedAt: file.trashedAt,
        keyData: {
          privateKey: filePrivateKey,
          keyPacket: file.nodePassphrase,
          sessionKey: fileSessionKey,
          contentKey,
          keyPacketId: fileKeyPacketData.id,
        },
        original: file,
        revisionId: file.fileProperties?.activeRevision?.id,
        thumbnailUrl: String(thumbnailBlobUrl),
      };

      // Add decrypted name to cache
      dispatch({
        type: "ADD_DECRYPTED_NAME",
        payload: {
          id: file.id,
          name: fileName,
        },
      });

      // Cache key packet and session key
      dispatch({
        type: "ADD_KEY_PACKET",
        payload: {
          id: file.id,
          keyPacket: file.nodePassphrase,
        },
      });

      dispatch({
        type: "ADD_SESSION_KEY",
        payload: {
          id: file.id,
          sessionKey: fileSessionKey,
        },
      });

      // Add file to state
      dispatch({
        type: "ADD_FILE",
        payload: processedFile,
      });

      // If the file is deleted, add to trash items
      if (file.is_deleted) {
        dispatch({
          type: "MARK_ITEM_DELETED",
          payload: {
            id: file.id,
            type: "file",
          },
        });
      }

      return processedFile;
    } catch (error) {
      logDecryptionError(`file-${file.id}`, error);
      throw error;
    }
  };

  const loadFolderContents = async (
    folderId: string,
    offset: number = 0,
    limit: number = CACHE_SETTINGS.PAGE_SIZE,
    appendToExisting: boolean = false,
    shouldNotify: boolean = true,
  ): Promise<{
    success: boolean;
    hasMore: boolean;
    totalItems: number;
    totalPages: number;
  }> => {
    // Check if folder exists in memory cache first, then state
    const folder = folderCache.current.get(folderId) || state.folders[folderId];
    if (!folder) {
      return { success: false, hasMore: false, totalItems: 0, totalPages: 0 };
    }

    // Create a unique loading key
    const loadingKey = `${folderId}-offset-${offset}`; // Updated to use offset

    // Check if already loading
    if (state.loadingItems[loadingKey]) {
      return { success: false, hasMore: false, totalItems: 0, totalPages: 0 };
    }

    // Mark as loading
    dispatch({
      type: "SET_LOADING_ITEM",
      payload: { id: loadingKey, isLoading: true },
    });

    try {
      // Find the share this folder belongs to
      const shareId = findShareIdForFolder(folderId);
      if (!shareId) {
        dispatch({
          type: "SET_LOADING_ITEM",
          payload: { id: loadingKey, isLoading: false },
        });
        return { success: false, hasMore: false, totalItems: 0, totalPages: 0 };
      }

      // Load folder contents from API
      const response = await ApiService.getFolderContents(
        folderId,
        shareId,
        offset, // Now using offset instead of page
        limit,
      );

      // Get current child IDs
      let childIds = folder.childIds || [];

      // If it's the first batch (offset=0) and we're not explicitly appending, initialize childIds
      if (offset === 0 && !appendToExisting && !folder.loaded) {
        childIds = [];
      }

      // Process all items efficiently
      if (response?.items && response.items.length > 0) {
        // Extract all item IDs
        const newItemIds = response.items.map((item) => item.id);

        // Combine with existing IDs if we're appending
        if (appendToExisting) {
          childIds = [...new Set([...childIds, ...newItemIds])];
        } else if (offset === 0) {
          // First batch uses offset 0 instead of page 1
          childIds = newItemIds;
        } else {
          childIds = [...childIds, ...newItemIds];
        }

        // Process items in batches
        const processPromises = response.items.map((item) => {
          if (item.type === 1) {
            // Folder
            return processFolder(item, folder.keyData.sessionKey || "");
          } else if (item.type === 2) {
            // File
            return processFile(item, folder.keyData.sessionKey || "");
          }
          return Promise.resolve();
        });

        await Promise.all(processPromises);
      }

      // Extract pagination details
      const pagination = response.pagination || {};
      const totalItems = pagination.totalItems || 0;
      const currentOffset = pagination.offset || 0;

      // Calculate total pages
      const totalPages = Math.ceil(totalItems / limit);

      // Calculate if there are more items
      const hasMore = currentOffset + limit < totalItems;

      // Update the folder in memory cache
      const updatedFolder = {
        ...folder,
        childIds,
        loaded: true,
        lastLoadedOffset: currentOffset, // Track by offset instead of page
        totalPages,
        totalItems,
      };
      folderCache.current.set(folderId, updatedFolder);

      // Update folder children in state
      dispatch({
        type: "UPDATE_FOLDER_CHILDREN",
        payload: {
          folderId,
          childIds,
          appendToExisting,
          offset: currentOffset, // Using offset instead of page
          totalPages,
          totalItems,
        },
      });

      // Clear loading marker
      dispatch({
        type: "SET_LOADING_ITEM",
        payload: { id: loadingKey, isLoading: false },
      });

      // Update folder items if this is the current folder
      if (state.currentFolderId === folderId && shouldNotify) {
        updateFolderItems();
      }

      return {
        success: true,
        hasMore,
        totalItems,
        totalPages,
      };
    } catch (error) {
      dispatch({
        type: "SET_LOADING_ITEM",
        payload: { id: loadingKey, isLoading: false },
      });
      return {
        success: false,
        hasMore: false,
        totalItems: 0,
        totalPages: 0,
      };
    }
  };

  // Helper to update breadcrumbs
  const updateBreadcrumbs = useCallback(() => {
    const breadcrumbsList: Array<{ id: string; name: string }> = [];
    let currentId = state.currentFolderId;

    // Build breadcrumbs from current folder up to root
    while (currentId) {
      // Check memory cache first, then state
      const folder =
        folderCache.current.get(currentId) || state.folders[currentId];
      if (!folder) break;

      breadcrumbsList.unshift({
        id: folder.id,
        name: folder.name,
      });

      currentId = folder.parentId;
    }

    setBreadcrumbs(breadcrumbsList);
  }, [state.currentFolderId, state.folders]);

  // Helper to update folder items
  const updateFolderItems = useCallback(() => {
    if (!state.currentFolderId) {
      setFolderItems([]);
      return;
    }

    // Check memory cache first, then state
    const currentFolder =
      folderCache.current.get(state.currentFolderId) ||
      state.folders[state.currentFolderId];
    if (!currentFolder) {
      setFolderItems([]);
      return;
    }

    // Get all child items
    const items: EncryptedDriveItem[] = currentFolder.childIds
      .map((id) => {
        // Check if it's a folder or file in memory cache or state
        const folder = folderCache.current.get(id) || state.folders[id];
        if (folder) return folder;

        if (state.files[id]) return state.files[id];

        return null;
      })
      .filter(
        (item): item is EncryptedDriveItem =>
          item !== null && (!item.isTrashed || false),
      );

    setFolderItems(items);
  }, [state.currentFolderId, state.folders, state.files]);

  // Update derived data when state changes
  useEffect(() => {
    updateBreadcrumbs();
    updateFolderItems();
  }, [updateBreadcrumbs, updateFolderItems]);

  // Load more items (pagination)
  const loadMoreItems = async (folderId?: string): Promise<boolean> => {
    const id = folderId || state.currentFolderId;
    if (!id) return false;

    // Check memory cache first, then state
    const folder = folderCache.current.get(id) || state.folders[id];
    if (!folder) return false;

    // Get next page
    const offset = folder.lastLoadedOffset + 1;
    if (offset > folder.totalPages) return false;

    setIsLoadingMore(true);
    try {
      const result = await loadFolderContents(
        id,
        offset,
        CACHE_SETTINGS.PAGE_SIZE,
        true,
      );
      return result.success;
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Navigate to a folder
  const navigateTo = async (folderId: string): Promise<boolean> => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Check if folder exists in memory cache or state
      const folderExists =
        folderCache.current.has(folderId) || !!state.folders[folderId];

      if (folderExists) {
        dispatch({ type: "SET_CURRENT_FOLDER", payload: folderId });

        // Get folder from memory cache or state
        const folder =
          folderCache.current.get(folderId) || state.folders[folderId];

        // Load folder contents if not loaded
        if (!folder.loaded) {
          await loadFolderContents(folderId);
        }

        // Update URL
        const rootShareId = state.rootShareId;
        const rootFolderId = state.rootFolderId;

        if (rootShareId) {
          if (folderId === rootFolderId) {
            navigate(`/u/${rootShareId}`);
          } else {
            navigate(`/u/${rootShareId}/folders/${folderId}`);
          }
        }

        dispatch({ type: "SET_LOADING", payload: false });
        return true;
      }

      // Folder not in state, need to load it
      if (!state.rootShareId) {
        dispatch({ type: "SET_LOADING", payload: false });
        return false;
      }

      // Fetch folder from API
      const folderResponse = await ApiService.getLinkDetails(
        folderId,
        state.rootShareId,
      );

      if (!folderResponse?.folder) {
        dispatch({ type: "SET_LOADING", payload: false });
        return false;
      }

      const folder = folderResponse.folder;

      // Build path to root by loading parent folders
      const folderChain: any[] = [];
      let currentFolder = folder;

      // Add target folder first
      folderChain.push(currentFolder);

      // Then work up parent chain until we reach a known folder
      while (
        currentFolder.parentId &&
        !folderCache.current.has(currentFolder.parentId) &&
        !state.folders[currentFolder.parentId]
      ) {
        const parentResponse = await ApiService.getLinkDetails(
          currentFolder.parentId,
          state.rootShareId,
        );

        if (!parentResponse?.folder) break;

        currentFolder = parentResponse.folder;
        folderChain.unshift(currentFolder);
      }

      // Find the key of the last known parent
      let sessionKey;
      const firstFolder = folderChain[0];

      if (firstFolder.parentId) {
        // Check memory cache first, then state
        const parentFolder =
          folderCache.current.get(firstFolder.parentId) ||
          state.folders[firstFolder.parentId];
        if (parentFolder) {
          sessionKey = parentFolder.keyData.sessionKey;
        } else {
          // Use share key
          const share = state.shares[state.rootShareId!];
          sessionKey = share?.keyData.sessionKey;
        }
      } else {
        // Use share key
        const share = state.shares[state.rootShareId!];
        sessionKey = share?.keyData.sessionKey;
      }

      if (!sessionKey) {
        dispatch({ type: "SET_LOADING", payload: false });
        return false;
      }

      // Process each folder in chain
      for (const folderItem of folderChain) {
        await processFolder(folderItem, sessionKey);

        // Update session key for next folder - check memory cache first
        const processedFolder =
          folderCache.current.get(folderItem.id) ||
          state.folders[folderItem.id];
        if (processedFolder) {
          sessionKey = processedFolder.keyData.sessionKey!;
        }
      }

      // Set current folder
      dispatch({ type: "SET_CURRENT_FOLDER", payload: folderId });

      // Load folder contents
      await loadFolderContents(folderId);

      // Update URL
      if (state.rootShareId) {
        navigate(`/u/${state.rootShareId}/folders/${folderId}`);
      }

      dispatch({ type: "SET_LOADING", payload: false });
      return true;
    } catch (error) {
      dispatch({ type: "SET_LOADING", payload: false });
      return false;
    }
  };

  // Navigate to parent folder
  const navigateToParent = async (): Promise<boolean> => {
    // Check memory cache first, then state
    const currentFolder =
      folderCache.current.get(state.currentFolderId!) ||
      state.folders[state.currentFolderId!];
    if (!currentFolder || !currentFolder.parentId) {
      return false;
    }

    return navigateTo(currentFolder.parentId);
  };

  // Toggle folder expanded state
  const toggleFolderExpanded = (folderId: string) => {
    dispatch({
      type: "TOGGLE_FOLDER_EXPANDED",
      payload: folderId,
    });
  };

  // Create a folder
  const createFolder = async (
    parentId: string,
    name: string,
    email: string,
  ): Promise<string | null> => {
    try {
      // Check folder in memory cache first, then state
      const parentFolder =
        folderCache.current.get(parentId) || state.folders[parentId];
      if (!parentFolder) {
        throw new Error(`Parent folder ${parentId} not found`);
      }

      const shareId = state.rootShareId;
      if (!shareId) {
        throw new Error("Share ID not found");
      }

      const parentPrivateKey = await openpgp.readPrivateKey({
        armoredKey: parentFolder.original.nodeKey,
      });

      // Generate folder keys with hierarchical encryption
      const folderKeys = await keyManager.generateSubFolderKeys(
        name,
        email,
        String(user?.username),
        parentPrivateKey.armor(),
        await parentFolder.keyData.privateKey.armor(),
        parentFolder.keyData.keyPacket,
        parentFolder.original.nodePassphraseSignature,
        String(parentFolder.keyData.sessionKey),
        String(parentFolder.keyData.keyPacketId),
      );

      // Create folder on server
      const response = await ApiService.createFolder(shareId, {
        name: folderKeys.name,
        hash: folderKeys.hash,
        parentId: parentId,
        nodeKey: folderKeys.nodeKey,
        nodePassphrase: folderKeys.nodePassphrase,
        nodePassphraseSignature: folderKeys.nodePassphraseSignature,
        nodeHashKey: folderKeys.nodeHashKey,
        nodeHashKeySignature: folderKeys.nodeHashKeySignature,
        signatureEmail: email,
      });

      if (!response?.folder?.id) {
        throw new Error("Failed to create folder");
      }

      // Fetch the newly created folder
      const folderResponse = await ApiService.getLinkDetails(
        response.folder.id,
        shareId,
      );

      if (!folderResponse?.folder) {
        throw new Error("Failed to get details of newly created folder");
      }

      // Process the new folder
      await processFolder(
        folderResponse.folder,
        String(parentFolder.keyData.sessionKey),
      );

      // Get the updated parent folder from memory cache
      const updatedParentFolder =
        folderCache.current.get(parentId) || state.folders[parentId];
      if (updatedParentFolder) {
        // Make sure we don't duplicate the child ID
        const newChildIds = [
          ...new Set([...updatedParentFolder.childIds, response.folder.id]),
        ];

        // Update memory cache
        folderCache.current.set(parentId, {
          ...updatedParentFolder,
          childIds: newChildIds,
          totalItems: updatedParentFolder.totalItems + 1,
        });

        // Update state
        dispatch({
          type: "UPDATE_FOLDER_CHILDREN",
          payload: {
            folderId: parentId,
            childIds: newChildIds,
            offset: updatedParentFolder.lastLoadedOffset,
            totalPages: updatedParentFolder.totalPages,
            totalItems: updatedParentFolder.totalItems + 1,
            appendToExisting: true,
          },
        });
      }

      // Force update folder items if this is in the current folder
      if (state.currentFolderId === parentId) {
        updateFolderItems();
      }

      return response.folder.id;
    } catch (error) {
      throw error;
    }
  };

  // Update folder name
  const updateFolderName = async (
    folderId: string,
    newName: string,
  ): Promise<boolean> => {
    try {
      // Check memory cache first, then state
      const folder =
        folderCache.current.get(folderId) || state.folders[folderId];
      if (!folder) {
        throw new Error(`Folder ${folderId} not found`);
      }

      const shareId = state.rootShareId;
      if (!shareId) {
        throw new Error("Share ID not found");
      }

      // Get public key from private key
      const publicKey = folder.keyData.privateKey.toPublic();

      // Encrypt the new name
      const nameMessage = await openpgp.createMessage({ text: newName });
      const encryptedName = await openpgp.encrypt({
        message: nameMessage,
        encryptionKeys: publicKey,
        format: "armored",
      });

      // Calculate name hash
      const nameHash = await keyManager.calculateNameHash(newName);

      // Update folder on server
      const response = await ApiService.updateFolderName(shareId, folderId, {
        name: encryptedName,
        hash: nameHash,
        originalNameHash: folder.original.hash,
      });

      if (response?.code !== 1000) {
        throw new Error("Failed to update folder name on server");
      }

      // Fetch updated folder
      const folderResponse = await ApiService.getLinkDetails(folderId, shareId);

      if (!folderResponse?.folder) {
        throw new Error("Failed to get updated folder details");
      }

      const parentFolder =
        folderCache.current.get(folder.parentId!) ||
        state.folders[folder.parentId!];
      if (!parentFolder) {
        throw new Error(`Parent folder for folder ${folder.name} not found`);
      }

      // Process the updated folder
      await processFolder(
        folderResponse.folder,
        String(parentFolder.keyData.sessionKey),
      );

      // Update breadcrumbs if necessary
      updateBreadcrumbs();

      return true;
    } catch (error) {
      throw error;
    }
  };

  // Update file name
  const updateFileName = async (
    fileId: string,
    newName: string,
  ): Promise<boolean> => {
    try {
      const file = state.files[fileId];
      if (!file) {
        throw new Error(`File ${fileId} not found`);
      }

      const shareId = state.rootShareId;
      if (!shareId) {
        throw new Error("Share ID not found");
      }

      // Get public key from private key
      const publicKey = file.keyData.privateKey.toPublic();

      // Encrypt the new name
      const nameMessage = await openpgp.createMessage({ text: newName });
      const encryptedName = await openpgp.encrypt({
        message: nameMessage,
        encryptionKeys: publicKey,
        format: "armored",
      });

      // Calculate name hash
      const nameHash = await keyManager.calculateNameHash(newName);

      // Update file on server
      const response = await ApiService.updateFileName(shareId, fileId, {
        name: encryptedName,
        hash: nameHash,
        originalHash: file.original.hash,
      });

      if (response?.code !== 1000) {
        throw new Error("Failed to update file name on server");
      }

      // Fetch updated file
      const fileResponse = await ApiService.getFileDetails(fileId, shareId);

      if (!fileResponse?.file) {
        throw new Error("Failed to get updated file details");
      }

      // Get parent folder for session key - check memory cache, then state
      const parentFolder =
        folderCache.current.get(file.parentId!) ||
        state.folders[file.parentId!];
      if (!parentFolder) {
        throw new Error(`Parent folder for file ${file.name} not found`);
      }

      // Process the updated file
      await processFile(
        fileResponse.file,
        String(parentFolder.keyData.sessionKey),
      );

      return true;
    } catch (error) {
      return false;
    }
  };

  const loadTrashContents = async (
    offset: number = 1,
    limit: number = CACHE_SETTINGS.PAGE_SIZE,
    appendToExisting: boolean = false,
  ): Promise<{
    success: boolean;
    hasMore: boolean;
    totalItems: number;
    totalPages: number;
  }> => {
    // Don't reload if already loading the same page
    if (state.isLoadingTrash && state.trashlastLoadedOffset === offset) {
      return {
        success: false,
        hasMore: state.trashlastLoadedOffset < state.trashTotalPages,
        totalItems: state.trashTotalItems,
        totalPages: state.trashTotalPages,
      };
    }

    // Don't reload if the page has already been loaded
    // For page 1, always return cached data if we've loaded any trash data before
    // For other pages, only return cached if we've loaded this specific page or higher
    if (
      (offset === 1 && state.trashlastLoadedOffset >= 1) ||
      (offset > 1 && state.trashlastLoadedOffset >= offset)
    ) {
      return {
        success: true,
        hasMore: state.trashlastLoadedOffset < state.trashTotalPages,
        totalItems: state.trashTotalItems,
        totalPages: state.trashTotalPages,
      };
    }

    dispatch({ type: "SET_LOADING_TRASH", payload: true });

    try {
      const shareId = state.rootShareId;
      if (!shareId) {
        dispatch({ type: "SET_LOADING_TRASH", payload: false });
        return { success: false, hasMore: false, totalItems: 0, totalPages: 0 };
      }

      // Load trash contents from API
      const response = await ApiService.getTrashItems(shareId, offset, limit);

      if (!response?.items) {
        dispatch({ type: "SET_LOADING_TRASH", payload: false });
        return { success: false, hasMore: false, totalItems: 0, totalPages: 0 };
      }

      // Get share for initial session key
      const share = state.shares[shareId];
      if (!share?.keyData?.sessionKey) {
        dispatch({ type: "SET_LOADING_TRASH", payload: false });
        return { success: false, hasMore: false, totalItems: 0, totalPages: 0 };
      }

      // Process all items in response
      await Promise.all(
        response.items.map(async (item: any) => {
          try {
            // Skip if already processed and marked as deleted
            const existingItem =
              item.type === 1
                ? folderCache.current.get(item.id) || state.folders[item.id]
                : state.files[item.id];

            if (existingItem && existingItem.isTrashed) return;

            // First, process the path hierarchy (ancestors) in order
            let currentSessionKey = share.keyData.sessionKey;
            const ancestors = item.path || [];

            for (const ancestor of ancestors) {
              // Skip if folder already processed with session key
              const existingFolder =
                folderCache.current.get(ancestor.id) ||
                state.folders[ancestor.id];

              if (!existingFolder || !existingFolder.keyData?.sessionKey) {
                // Process this folder with current session key
                await processFolder(ancestor, String(currentSessionKey));

                // Update session key for next folder in chain
                const updatedFolder =
                  folderCache.current.get(ancestor.id) ||
                  state.folders[ancestor.id];
                if (updatedFolder?.keyData?.sessionKey) {
                  currentSessionKey = updatedFolder.keyData.sessionKey;
                }
              } else {
                // Use existing session key
                currentSessionKey = existingFolder.keyData.sessionKey;
              }
            }

            // Next, process the immediate parent if it exists
            if (item.parent) {
              const parentId = item.parent.id;
              const existingParent =
                folderCache.current.get(parentId) || state.folders[parentId];

              if (!existingParent || !existingParent.keyData?.sessionKey) {
                // Process parent with current session key
                await processFolder(item.parent, String(currentSessionKey));

                // Update session key
                const updatedParent =
                  folderCache.current.get(parentId) || state.folders[parentId];
                if (updatedParent?.keyData?.sessionKey) {
                  currentSessionKey = updatedParent.keyData.sessionKey;
                }
              } else {
                currentSessionKey = existingParent.keyData.sessionKey;
              }
            }

            // Finally, process the trash item itself
            if (item.type === 1) {
              await processFolder(item, String(currentSessionKey));

              // Update memory cache
              if (folderCache.current.has(item.id)) {
                const folder = folderCache.current.get(item.id)!;
                folderCache.current.set(item.id, {
                  ...folder,
                  isTrashed: true,
                  trashedAt: item.trashedAt || Math.floor(Date.now() / 1000),
                });
              }
            } else {
              await processFile(item, String(currentSessionKey));
            }

            // Mark as deleted in state
            dispatch({
              type: "MARK_ITEM_DELETED",
              payload: {
                id: item.id,
                type: item.type === 1 ? "folder" : "file",
                parentId: item.parentId || null,
              },
            });
          } catch (error) {
            throw error;
          }
        }),
      );

      // Extract pagination details
      const pagination = response.pagination || {};
      const totalItems = pagination.totalItems || 0;
      const currentOffset = pagination.offset || 0;

      // Calculate total pages
      const totalPages = Math.ceil(totalItems / limit);

      // Calculate if there are more items
      const hasMore = currentOffset + limit < totalItems;

      dispatch({
        type: "SET_TRASH_PAGINATION",
        payload: { offset: currentOffset, totalPages, totalItems },
      });

      dispatch({ type: "SET_LOADING_TRASH", payload: false });

      setUpdateCounter((prev) => prev + 1);

      return {
        success: true,
        hasMore: hasMore,
        totalItems,
        totalPages,
      };
    } catch (error) {
      dispatch({ type: "SET_LOADING_TRASH", payload: false });
      return { success: false, hasMore: false, totalItems: 0, totalPages: 0 };
    }
  };

  const restoreFromTrash = async (itemIds: string[]): Promise<boolean> => {
    try {
      if (itemIds.length === 0) {
        return true; // Nothing to restore
      }

      const shareId = state.rootShareId;
      if (!shareId) {
        throw new Error("Share ID not found");
      }

      // Call API to restore items in batch - server now handles conflict detection
      const response = await ApiService.restoreItems(shareId, itemIds);

      // Check if the API call was successful
      if (!response) {
        throw new Error(
          "Failed to restore items from trash - no response from server",
        );
      }

      // Check for partial success responses
      if (response.code === 4023) {
        // PARTIAL_SUCCESS code
        // Some items were rejected
        const acceptedIds = response.acceptedIds || [];
        const rejectedIds = response.rejectedIds || {
          invalid: [],
          conflicts: [],
        };

        // If all items were rejected, show error
        if (acceptedIds.length === 0) {
          // Gather names of conflicted items for better error message
          const conflictNames = getItemNames(rejectedIds.conflicts);

          if (rejectedIds.conflicts.length > 0) {
            const pluralSuffix = rejectedIds.conflicts.length !== 1 ? "s" : "";
            throw new Error(
              `Cannot restore ${rejectedIds.conflicts.length} item${pluralSuffix} due to name conflicts. Item${pluralSuffix} with the same name already exist in the destination folder: ${conflictNames}`,
            );
          } else if (rejectedIds.invalid.length > 0) {
            const pluralSuffix = rejectedIds.invalid.length !== 1 ? "s" : "";
            throw new Error(
              `Cannot restore ${rejectedIds.invalid.length} item${pluralSuffix} that ${rejectedIds.invalid.length !== 1 ? "are" : "is"} no longer in trash`,
            );
          } else {
            throw new Error(`Failed to restore items from trash`);
          }
        }

        // For items that were accepted successfully, update UI
        processRestoredItems(acceptedIds);

        // If some items were rejected due to conflicts, show a warning
        if (rejectedIds.conflicts.length > 0) {
          // Collect names of conflicted items
          const conflictNames = getItemNames(rejectedIds.conflicts);

          if (conflictNames) {
            const pluralSuffix = rejectedIds.conflicts.length !== 1 ? "s" : "";
            throw new Error(
              `Successfully restored ${acceptedIds.length} item${acceptedIds.length !== 1 ? "s" : ""}, but ${rejectedIds.conflicts.length} item${pluralSuffix} could not be restored due to name conflicts: ${conflictNames}`,
            );
          }
        }

        // If some items were invalid, show a different warning
        if (rejectedIds.invalid.length > 0) {
          const pluralSuffix = rejectedIds.invalid.length !== 1 ? "s" : "";
          throw new Error(
            `Successfully restored ${acceptedIds.length} item${acceptedIds.length !== 1 ? "s" : ""}, but ${rejectedIds.invalid.length} item${pluralSuffix} could not be restored because ${rejectedIds.invalid.length !== 1 ? "they are" : "it is"} no longer in trash`,
          );
        }

        return true;
      } else if (response.code === 1000) {
        // SUCCESS code
        // All items were accepted
        processRestoredItems(itemIds);
        return true;
      }

      return false;
    } catch (error) {
      throw error; // Re-throw to allow parent function to handle the error
    }
  };

  // Helper function to process restored items
  const processRestoredItems = (acceptedIds: string[]) => {
    // Update caches and sizes for successfully restored items
    for (const itemId of acceptedIds) {
      const trashInfo = state.trashItems[itemId];
      if (!trashInfo) continue;
      const { type, parentId } = trashInfo;

      // Update state for the specific restored item
      dispatch({
        type: "RESTORE_ITEM",
        payload: {
          id: itemId,
          type: type,
        },
      });

      // If it's a folder, update the in-memory cache
      if (type === "folder" && folderCache.current.has(itemId)) {
        const folder = folderCache.current.get(itemId)!;
        folderCache.current.set(itemId, {
          ...folder,
          isTrashed: false,
          trashedAt: null,
        });
      }

      // Add size back to parent folders
      const item =
        type === "folder"
          ? folderCache.current.get(itemId) || state.folders[itemId]
          : state.files[itemId];
      if (parentId && item?.size) {
        updateFolderSizeHierarchy(parentId, item.size);
      }

      // Update folder items if needed
      if (parentId && state.currentFolderId === parentId) {
        updateFolderItems();
      }
    }

    setUpdateCounter((prev) => prev + 1);
  };

  // Move items to trash with enhanced error reporting
  const moveToTrash = async (
    currentFolder: string,
    itemIds: string[],
    itemTypes: { [id: string]: "folder" | "file" },
  ): Promise<boolean> => {
    try {
      const shareId = state.rootShareId;
      if (!shareId) {
        throw new Error("Share ID not found");
      }

      // Call the API with the list of IDs
      const response = await ApiService.trashItems(
        shareId,
        currentFolder,
        itemIds,
      );

      // Check if the API call was successful
      if (!response) {
        throw new Error(
          "Failed to move items to trash - no response from server",
        );
      }

      // Check for partial success responses
      if (response.code === 4023) {
        // PARTIAL_SUCCESS code
        // Some items were rejected
        const acceptedIds = response.acceptedIds || [];
        const rejectedIds = response.rejectedIds || [];
        const conflictCount = response.conflictCount || 0;
        const invalidCount = response.invalidCount || 0;

        // Get names of rejected items for better error messages
        const rejectedItemNames = getItemNames(rejectedIds, itemTypes);

        // If all items were rejected, show detailed error
        if (acceptedIds.length === 0) {
          if (conflictCount > 0) {
            throw new Error(
              `Cannot move to trash due to name conflicts. ${conflictCount} item${conflictCount !== 1 ? "s" : ""} with the same name${conflictCount > 1 ? "s" : ""} already exist in trash: ${rejectedItemNames}`,
            );
          } else if (invalidCount > 0) {
            throw new Error(
              `Cannot move to trash. ${invalidCount} item${invalidCount !== 1 ? "s were" : " was"} not found or not in this folder`,
            );
          } else {
            throw new Error("Could not move any items to trash");
          }
        }

        // For items that were accepted successfully, update UI
        processTrashedItems(acceptedIds, itemTypes);

        // If some items were rejected, throw an error with item names
        if (rejectedIds.length > 0) {
          let errorMessage = "Some items could not be moved to trash. ";

          if (conflictCount > 0) {
            errorMessage += `${conflictCount} item${conflictCount !== 1 ? "s" : ""} ${conflictCount !== 1 ? "have" : "has"} name conflicts in trash`;
            if (invalidCount > 0) {
              errorMessage += ` and ${invalidCount} ${invalidCount !== 1 ? "were" : "was"} not found`;
            }
          } else if (invalidCount > 0) {
            errorMessage += `${invalidCount} item${invalidCount !== 1 ? "s were" : " was"} not found or not in this folder`;
          }

          if (rejectedItemNames) {
            errorMessage += `: ${rejectedItemNames}`;
          }

          throw new Error(errorMessage);
        }

        return true;
      } else if (response.code === 1000) {
        // SUCCESS code
        // All items were accepted
        processTrashedItems(itemIds, itemTypes);
        return true;
      }

      return false;
    } catch (error) {
      throw error; // Re-throw to allow parent function to handle the error
    }
  };

  // Helper function to get item names from IDs
  const getItemNames = (
    itemIds: string[],
    itemTypes?: { [id: string]: "folder" | "file" },
  ): string => {
    if (!itemIds || itemIds.length === 0) return "";

    const names: string[] = [];
    const maxItemsToShow = 3; // Limit the number of items to show in the message

    itemIds.forEach((id) => {
      // Handle trash items (no itemTypes provided)
      if (!itemTypes) {
        const trashInfo = state.trashItems[id];
        if (!trashInfo) return;

        const { type } = trashInfo;
        const item = type === "folder" ? state.folders[id] : state.files[id];

        if (item?.name) {
          names.push(item.name);
        }
        return;
      }

      // Handle regular items (with itemTypes)
      const type = itemTypes[id];
      if (!type) return;

      const item =
        type === "folder"
          ? state.folders[id] || folderCache.current.get(id)
          : state.files[id];

      if (item?.name) {
        names.push(item.name);
      }
    });

    if (names.length === 0) return "";

    // Truncate the list if there are too many items
    if (names.length > maxItemsToShow) {
      return `${names.slice(0, maxItemsToShow).join(", ")} and ${names.length - maxItemsToShow} more`;
    }

    return names.join(", ");
  };

  // Helper function to process deleted items
  const processTrashedItems = (
    acceptedIds: string[],
    itemTypes: { [id: string]: "folder" | "file" },
  ) => {
    // Process all successful items
    acceptedIds.forEach((itemId) => {
      const itemType = itemTypes[itemId];
      const item =
        itemType === "folder"
          ? folderCache.current.get(itemId) || state.folders[itemId]
          : state.files[itemId];

      // Mark item as deleted in state
      dispatch({
        type: "MARK_ITEM_DELETED",
        payload: {
          id: itemId,
          type: itemType,
        },
      });

      // Update memory cache for folders
      if (itemType === "folder" && folderCache.current.has(itemId)) {
        const folder = folderCache.current.get(itemId)!;
        folderCache.current.set(itemId, {
          ...folder,
          isTrashed: true,
          trashedAt: Math.floor(Date.now() / 1000),
        });
      }

      // Calculate size to remove from parent folders
      const sizeDelta = item.size || 0;
      if (sizeDelta > 0 && item.parentId) {
        updateFolderSizeHierarchy(item.parentId, -sizeDelta);
      }

      // Update folder items if needed
      if (item.parentId === state.currentFolderId) {
        updateFolderItems();
      }
    });

    setUpdateCounter((prev) => prev + 1);
  };

  const loadMoreTrashItems = async (): Promise<boolean> => {
    // Get next page
    const offset = state.trashlastLoadedOffset + 1;
    if (offset > state.trashTotalPages) return false;

    try {
      const result = await loadTrashContents(
        offset,
        CACHE_SETTINGS.PAGE_SIZE,
        true,
      );
      return result.success;
    } catch (error) {
      return false;
    }
  };

  const hasMoreTrashItems = useMemo(() => {
    return state.trashlastLoadedOffset < state.trashTotalPages;
  }, [state.trashlastLoadedOffset, state.trashTotalPages]);

  // Permanently delete item
  const permanentlyDelete = async (
    itemId: string,
    itemType: "folder" | "file",
  ): Promise<boolean> => {
    try {
      const item =
        itemType === "folder"
          ? folderCache.current.get(itemId) || state.folders[itemId]
          : state.files[itemId];

      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      const shareId = state.rootShareId;
      if (!shareId) {
        throw new Error("Share ID not found");
      }

      // Call API to delete item
      const response = await ApiService.deleteItem(shareId, itemId, itemType);

      if (!response?.success) {
        throw new Error(`Failed to permanently delete ${itemType}`);
      }

      // Remove item from state
      dispatch({
        type: "REMOVE_ITEM",
        payload: {
          id: itemId,
          type: itemType,
          parentId: item.parentId,
        },
      });

      // If it's a folder, remove from in-memory cache too
      if (itemType === "folder") {
        folderCache.current.delete(itemId);
      }

      // Update folder items if needed
      if (item.parentId === state.currentFolderId) {
        updateFolderItems();
      }

      setUpdateCounter((prev) => prev + 1);

      return true;
    } catch (error) {
      return false;
    }
  };

  // Move multiple items to a different folder
  const moveItems = async (
    itemIds: string[],
    targetFolderId: string,
  ): Promise<any> => {
    try {
      if (itemIds.length === 0) {
        return null; // Nothing to move
      }

      // Get the target folder - check memory cache first, then state
      const targetFolder =
        folderCache.current.get(targetFolderId) ||
        state.folders[targetFolderId];

      if (!targetFolder) {
        throw new Error(`Target folder ${targetFolderId} not found`);
      }

      // Get the target session key
      const targetSessionKey = targetFolder.keyData.sessionKey;
      if (!targetSessionKey) {
        throw new Error("Target folder session key not found");
      }

      // Get the user's email for signature
      const email = user?.email || "";

      // Prepare items payload array
      const itemsPayload = [];
      const itemsToProcess = [];
      const invalidItems = [];

      // Collect data for each item
      for (const itemId of itemIds) {
        // Get the item being moved - check memory cache first, then state
        const item =
          folderCache.current.get(itemId) ||
          state.folders[itemId] ||
          state.files[itemId];

        if (!item) {
          invalidItems.push({ id: itemId, reason: "Item not found" });
          continue;
        }

        // Check if already in the target folder
        if (item.parentId === targetFolderId) {
          invalidItems.push({
            id: itemId,
            reason: "Item is already in the destination folder",
          });
          continue;
        }

        // For folders: prevent circular references
        if (item.type === "folder") {
          // Cannot move a folder into itself
          if (itemId === targetFolderId) {
            invalidItems.push({
              id: itemId,
              reason: "Cannot move a folder into itself",
            });
            continue;
          }

          // Cannot move a folder into one of its descendants
          if (isFolderDescendant(targetFolderId, itemId)) {
            invalidItems.push({
              id: itemId,
              reason: "Cannot move a folder into one of its descendants",
            });
            continue;
          }
        }

        // Create key packet data for this item
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);

        const itemKeyPacketData = {
          sessionKey: item.keyData.sessionKey,
          parentKeyPacketId: targetFolder.keyData.keyPacketId,
          created: new Date().toISOString(),
          version: 1,
          keyType: item.type,
          id: `${timestamp}-${random}`,
        };

        // Encrypt using OpenPGP with target session key as password
        const passMessage = await openpgp.createMessage({
          text: JSON.stringify(itemKeyPacketData),
        });
        const encryptedPassphrase = await openpgp.encrypt({
          message: passMessage,
          passwords: [targetSessionKey],
          format: "armored",
        });

        // Calculate name hash
        const nameHash = await keyManager.calculateNameHash(item.name);

        // Add to payload and processing list
        itemsPayload.push({
          id: itemId,
          name: item.original.name,
          hash: nameHash,
          signatureEmail: email,
          nodePassphrase: encryptedPassphrase,
        });

        itemsToProcess.push({
          id: itemId,
          type: item.type,
          parentId: String(item.parentId), // Original parent
          size: item.size || 0,
        });
      }

      // If nothing to process, return early
      if (itemsPayload.length === 0) {
        throw new Error(
          `Cannot move items: ${invalidItems.map((item) => item.reason).join(", ")}`,
        );
      }

      // First call the API and wait for successful response
      const response = await ApiService.moveItems(
        String(getRootShareId()),
        targetFolderId,
        itemsPayload,
      );

      // Handle partial success responses
      if (response?.code === 4023) {
        // PARTIAL_SUCCESS code
        // Some items were rejected
        const acceptedIds = response.acceptedIds || [];
        const rejectedItems = response.rejecteditems || [];

        if (acceptedIds.length === 0) {
          throw new Error("None of the items could be moved");
        }

        // Filter itemsToProcess to only include accepted items
        const acceptedItems = itemsToProcess
          .filter((item) => acceptedIds.includes(item.id))
          .map((item) => ({
            ...item,
            parentId: item.parentId!,
          }));

        // Process only accepted items
        processMovedItems(acceptedItems, targetFolder);

        // Build error message for rejected items
        if (rejectedItems.length > 0) {
          const rejectedReasons = rejectedItems.map(
            (item) => `${getItemName(item.id)}: ${item.reason}`,
          );
          throw new Error(
            `Some items could not be moved: ${rejectedReasons.join(", ")}`,
          );
        }
      } else if (response?.code === 1000) {
        // SUCCESS code
        // All items were accepted
        processMovedItems(itemsToProcess, targetFolder);
      } else {
        throw new Error(
          `Failed to move items: ${response?.detail || "Unknown error"}`,
        );
      }

      return response;
    } catch (error) {
      throw error;
    }
  };

  // Helper function to process items after moving - fixed for multiple items
  const processMovedItems = (
    items: Array<{ id: string; type: string; parentId: string; size: number }>,
    targetFolder: any,
  ) => {
    if (!items.length) return;

    // Track all affected parent folders for efficient updates
    const affectedFolders = new Map<
      string,
      {
        addedItems: string[];
        removedItems: string[];
        sizeChange: number;
      }
    >();

    // Initialize target folder in affectedFolders if not exists
    if (!affectedFolders.has(targetFolder.id)) {
      affectedFolders.set(targetFolder.id, {
        addedItems: [],
        removedItems: [],
        sizeChange: 0,
      });
    }

    // First, prepare all changes (gather updates for each parent folder)
    for (const item of items) {
      const itemId = item.id;
      const itemType = item.type;
      const originalParentId = item.parentId;
      const itemSize = item.size || 0;

      // Add item to target folder's added items
      const targetFolderChanges = affectedFolders.get(targetFolder.id)!;
      targetFolderChanges.addedItems.push(itemId);
      targetFolderChanges.sizeChange += itemSize;

      // Initialize original parent folder in affectedFolders if not exists and different from target
      if (originalParentId && originalParentId !== targetFolder.id) {
        if (!affectedFolders.has(originalParentId)) {
          affectedFolders.set(originalParentId, {
            addedItems: [],
            removedItems: [],
            sizeChange: 0,
          });
        }

        // Remove item from original parent's children
        const originalFolderChanges = affectedFolders.get(originalParentId)!;
        originalFolderChanges.removedItems.push(itemId);
        originalFolderChanges.sizeChange -= itemSize;
      }

      // Generate new path for the item
      let newPath = "/";
      if (targetFolder.id !== state.rootFolderId) {
        newPath =
          targetFolder.path === "/"
            ? `/${targetFolder.name}`
            : `${targetFolder.path}/${targetFolder.name}`;
      }

      // Update individual item in cache/state
      if (itemType === "folder") {
        // Update folder in memory cache
        if (folderCache.current.has(itemId)) {
          const currentFolder = folderCache.current.get(itemId)!;
          folderCache.current.set(itemId, {
            ...currentFolder,
            parentId: targetFolder.id,
            path: newPath,
          });
        }

        // Update folder in state
        dispatch({
          type: "ADD_FOLDER",
          payload: {
            ...state.folders[itemId],
            parentId: targetFolder.id,
            path: newPath,
          },
        });
      } else if (itemType === "file") {
        // Update file in state
        dispatch({
          type: "ADD_FILE",
          payload: {
            ...state.files[itemId],
            parentId: targetFolder.id,
            path: newPath,
          },
        });
      }
    }

    // Now process all the folder updates at once
    affectedFolders.forEach((changes, folderId) => {
      const folder =
        folderId === targetFolder.id
          ? targetFolder
          : folderCache.current.get(folderId) || state.folders[folderId];

      if (!folder) return;

      // Update folder in memory cache
      if (folderCache.current.has(folderId)) {
        const currentFolder = folderCache.current.get(folderId)!;
        const updatedChildIds = [...currentFolder.childIds];

        // Remove items
        changes.removedItems.forEach((itemId) => {
          const index = updatedChildIds.indexOf(itemId);
          if (index !== -1) {
            updatedChildIds.splice(index, 1);
          }
        });

        // Add items
        changes.addedItems.forEach((itemId) => {
          if (!updatedChildIds.includes(itemId)) {
            updatedChildIds.push(itemId);
          }
        });

        // Update the folder
        folderCache.current.set(folderId, {
          ...currentFolder,
          childIds: updatedChildIds,
          totalItems: updatedChildIds.length,
        });
      }

      // Update folder in state
      const currentChildIds = folder.childIds || [];
      const updatedChildIds = [...currentChildIds];

      // Remove items
      changes.removedItems.forEach((itemId) => {
        const index = updatedChildIds.indexOf(itemId);
        if (index !== -1) {
          updatedChildIds.splice(index, 1);
        }
      });

      // Add items
      changes.addedItems.forEach((itemId) => {
        if (!updatedChildIds.includes(itemId)) {
          updatedChildIds.push(itemId);
        }
      });

      // Dispatch update
      dispatch({
        type: "UPDATE_FOLDER_CHILDREN",
        payload: {
          folderId,
          childIds: updatedChildIds,
          offset: folder.lastLoadedOffset,
          totalPages: folder.totalPages,
          totalItems: updatedChildIds.length,
          appendToExisting: false, // We're providing the complete list
        },
      });

      // Update folder size
      if (changes.sizeChange !== 0) {
        updateFolderSizeHierarchy(folderId, changes.sizeChange);
      }
    });

    // Update folder items if any of the affected folders is the current folder
    if (affectedFolders.has(String(state.currentFolderId))) {
      updateFolderItems();
    }

    // Increment update counter to notify components
    setUpdateCounter((prev) => prev + 1);
  };

  // Helper to get item name for error messages
  const getItemName = (itemId: string): string => {
    const item =
      folderCache.current.get(itemId) ||
      state.folders[itemId] ||
      state.files[itemId];

    return item?.name || itemId;
  };

  // Helper to check if a folder is a descendant of another folder
  const isFolderDescendant = (
    potentialDescendantId: string,
    ancestorId: string,
  ): boolean => {
    // Check if potentialDescendant is directly the ancestor
    if (potentialDescendantId === ancestorId) {
      return true;
    }

    // Get the potential descendant folder
    const folder =
      folderCache.current.get(potentialDescendantId) ||
      state.folders[potentialDescendantId];
    if (!folder) return false;

    // If it has no parent, it can't be a descendant
    if (!folder.parentId) return false;

    // Check if the parent is the ancestor
    if (folder.parentId === ancestorId) {
      return true;
    }

    // Recursively check the parent
    return isFolderDescendant(folder.parentId, ancestorId);
  };

  // Add file to cache
  const addFileToCache = async (fileInfo: {
    id: string;
    parentId: string;
  }): Promise<string | null> => {
    try {
      const { id, parentId } = fileInfo;

      const shareId = state.rootShareId;
      if (!shareId) {
        throw new Error("Share ID not found");
      }

      // Fetch file details
      const fileResponse = await ApiService.getFileDetails(id, shareId);

      if (!fileResponse?.file) {
        throw new Error("Failed to get file details");
      }

      // Get parent folder - check memory cache first, then state
      const parentFolder =
        folderCache.current.get(parentId) || state.folders[parentId];

      // Now check if we found the folder anywhere
      if (!parentFolder) {
        throw new Error(`Parent folder ${parentId} not found in state`);
      }

      // Process the file
      await processFile(
        fileResponse.file,
        String(parentFolder.keyData.sessionKey),
      );

      // Update memory cache
      if (folderCache.current.has(parentId)) {
        const folder = folderCache.current.get(parentId)!;
        folderCache.current.set(parentId, {
          ...folder,
          childIds: [...new Set([...folder.childIds, id])],
          totalItems: folder.totalItems + 1,
        });
      }

      // Update parent folder's children
      dispatch({
        type: "UPDATE_FOLDER_CHILDREN",
        payload: {
          folderId: parentId,
          childIds: [...new Set([...parentFolder.childIds, id])],
          offset: parentFolder.lastLoadedOffset,
          totalPages: parentFolder.totalPages,
          totalItems: parentFolder.totalItems + 1,
          appendToExisting: true,
        },
      });

      // Update folder size
      if (fileResponse.file.size) {
        updateFolderSizeHierarchy(parentId, fileResponse.file.size);

        setUser((prev) => {
          if (!prev) return null;

          return {
            ...prev,
            used_drive_space: prev.usedDriveSpace + fileResponse.file.size,
          };
        });
      }

      // Update folder items if this is in the current folder
      if (state.currentFolderId === parentId) {
        updateFolderItems();
      }

      return id;
    } catch (error) {
      return null;
    }
  };

  // Decrypt file content
  const decryptFileContent = async (
    fileId: string,
    content: string | Uint8Array,
  ): Promise<Uint8Array> => {
    try {
      const file = state.files[fileId];
      if (!file) {
        throw new Error(`File ${fileId} not found`);
      }

      // Check for content key
      if (!file.keyData.contentKey) {
        // If not in file object, check file_properties
        if (!file.original.fileProperties?.contentKeyPacket) {
          throw new Error(`No content key packet found for file ${fileId}`);
        }

        // Decrypt the content key packet
        const contentKeyMessage = await openpgp.readMessage({
          armoredMessage: file.original.fileProperties.contentKeyPacket,
        });

        const decryptedContentKey = await openpgp.decrypt({
          message: contentKeyMessage,
          decryptionKeys: file.keyData.privateKey,
          format: "binary",
        });

        // Update file with content key
        const contentKey = keyManager.arrayToBase64(
          new Uint8Array(decryptedContentKey.data as ArrayBuffer),
        );

        // Update file in state with content key
        dispatch({
          type: "ADD_FILE",
          payload: {
            ...file,
            keyData: {
              ...file.keyData,
              contentKey,
            },
          },
        });

        // Use KeyManager to decrypt content
        // return await keyManager.decryptFileContent(content, contentKey);
      }

      // Use KeyManager to decrypt content with existing content key
      // return await keyManager.decryptFileContent(
      //   content,
      //   file.keyData.contentKey,
      // );
    } catch (error) {
      throw error;
    }
  };

  // Clear the state
  const clear = () => {
    dispatch({ type: "RESET" });
    isInitializing.current = false;
    derivedKey.current = null;
    processingFolderIds.current.clear();
    folderCache.current.clear();
    folderPromises.current.clear();
    processingPromises.current.clear();
    setBreadcrumbs([]);
    setFolderItems([]);
    setUpdateCounter(0);
  };

  // Load folder tree (for navigation sidebar)
  const loadFolderTree = async (
    folderId: string,
    offset: number,
    pageSize: number,
    triggerLoad: boolean = true,
    includeDeleted: boolean = false,
  ): Promise<{ success: boolean }> => {
    // Skip if already processing this folder
    if (processingFolderIds.current.has(folderId)) {
      return { success: false };
    }

    processingFolderIds.current.add(folderId);

    try {
      const result = await loadFolderContents(
        folderId,
        offset,
        pageSize,
        false,
        false,
      );

      // Only mark as success if we got results and the folder exists
      const success =
        result.success &&
        !!(folderCache.current.has(folderId) || state.folders[folderId]);

      return { success };
    } finally {
      processingFolderIds.current.delete(folderId);
    }
  };

  // Verify integrity of an item
  const verifyIntegrity = async (
    itemId: string,
    itemType: "folder" | "file",
    signatureEmail: string,
  ): Promise<boolean> => {
    try {
      // Get the item - check memory cache first, then state
      const item =
        itemType === "folder"
          ? folderCache.current.get(itemId) || state.folders[itemId]
          : state.files[itemId];

      if (!item) {
        throw new Error(`Item ${itemId} not found in cache`);
      }

      // Helper function to perform verification with consistent key ID and email checks
      const verifySignature = async (
        messageText: string,
        armoredSignature: string,
        verificationKey: any,
        expectedKeyID?: string,
      ): Promise<boolean> => {
        try {
          const message = await openpgp.createMessage({ text: messageText });
          const signature = await openpgp.readSignature({ armoredSignature });

          const verified = await openpgp.verify({
            message,
            signature,
            verificationKeys: verificationKey,
          });

          // Check if signature is verified
          if (!verified.signatures[0].verified) {
            return false;
          }

          // Check key ID match if expected key ID is provided
          if (
            expectedKeyID &&
            verified.signatures[0].keyID.toHex() !== expectedKeyID
          ) {
            return false;
          }

          // Extract email from user ID using regex to handle any format
          const userID = verificationKey.toPublic().getUserIDs()[0];
          const emailMatch = userID.match(/<([^>]+)>/);

          if (!emailMatch || emailMatch[1] !== signatureEmail) {
            return false;
          }

          return true;
        } catch (error) {
          return false;
        }
      };

      const parentId = item.parentId;

      // For root items without parent, verify against share
      if (!parentId) {
        if (!state.rootShareId) {
          return false;
        }

        const share = state.shares[state.rootShareId];
        if (!share) {
          return false;
        }

        const sharePrivateKey = share.keyData.privateKey;
        const shareKeyPacket = share.keyData.keyPacket;
        const sharePassphraseSignature = share.original.sharePassphrase;

        if (!sharePrivateKey || !shareKeyPacket) {
          return false;
        }

        // Create an array to hold verification promises
        const verificationPromises = [];

        // Add share passphrase verification if available
        if (sharePassphraseSignature) {
          verificationPromises.push(
            verifySignature(
              shareKeyPacket,
              sharePassphraseSignature,
              sharePrivateKey,
            ),
          );
        }

        // Add node passphrase verification if available
        if (item.original.node_passphrase_signature) {
          const itemKeyID = item.keyData.privateKey
            .toPublic()
            .getKeyID()
            .toHex();
          verificationPromises.push(
            verifySignature(
              item.original.nodePassphrase,
              item.original.nodePassphraseSignature,
              item.keyData.privateKey,
              itemKeyID,
            ),
          );
        }

        // If there are no verification promises, return false
        if (verificationPromises.length === 0) {
          return false;
        }

        // Execute all verifications in parallel
        const results = await Promise.all(verificationPromises);

        // All verifications must pass
        return results.every((result) => result === true);
      }

      // For items with parent, verify against parent - check memory cache first, then state
      const parentFolder =
        folderCache.current.get(parentId) || state.folders[parentId];
      if (!parentFolder) {
        return false;
      }

      // Verify using parent's private key
      const parentPrivateKey = parentFolder.keyData.privateKey;
      const parentKeyPacket = parentFolder.keyData.keyPacket;
      const parentPassphraseSignature =
        parentFolder.original.nodePassphraseSignature;

      if (!parentPrivateKey || !parentKeyPacket) {
        return false;
      }

      // Create an array to hold verification promises
      const verificationPromises = [];

      // Add parent passphrase verification if available
      if (parentPassphraseSignature) {
        verificationPromises.push(
          verifySignature(
            parentKeyPacket,
            parentPassphraseSignature,
            parentPrivateKey,
          ),
        );
      }

      // Add node passphrase verification if available
      if (item.original.nodePassphraseSignature) {
        const itemKeyID = item.keyData.privateKey.toPublic().getKeyID().toHex();
        verificationPromises.push(
          verifySignature(
            item.original.nodePassphrase,
            item.original.nodePassphraseSignature,
            item.keyData.privateKey,
            itemKeyID,
          ),
        );
      }

      // If there are no verification promises, return false
      if (verificationPromises.length === 0) {
        return false;
      }

      // Execute all verifications in parallel
      const results = await Promise.all(verificationPromises);

      // All verifications must pass
      return results.every((result) => result === true);
    } catch (error) {
      return false;
    }
  };

  // Verify integrity of a folder tree
  const verifyFolderTreeIntegrity = async (
    folderId: string,
  ): Promise<IntegrityResult> => {
    const result: IntegrityResult = {
      success: true,
      verified: true,
      errors: [],
      unverifiedItems: [],
      verificationChain: [],
    };

    try {
      // Check memory cache first, then state
      const folder =
        folderCache.current.get(folderId) || state.folders[folderId];
      if (!folder) {
        result.success = false;
        result.verified = false;
        result.errors = ["Folder not found in cache"];
        return result;
      }

      // Verify the root folder itself
      const rootVerified = await verifyIntegrity(folderId, "folder", "");
      result.verificationChain!.push({
        id: folderId,
        type: "folder",
        status: rootVerified ? "verified" : "failed",
      });

      if (!rootVerified) {
        result.verified = false;
        result.unverifiedItems!.push({
          id: folderId,
          type: "folder",
          name: folder.name,
        });
      }

      // If the folder isn't loaded, load it first
      if (!folder.loaded) {
        await loadFolderContents(
          folderId,
          0,
          CACHE_SETTINGS.PAGE_SIZE,
          false,
          false,
        );
      }

      // Get the folder again as it might have been updated
      const updatedFolder =
        folderCache.current.get(folderId) || state.folders[folderId];
      if (!updatedFolder) {
        result.success = false;
        result.verified = false;
        result.errors!.push("Folder disappeared during verification");
        return result;
      }

      // Collect all items for verification
      const verificationTasks: Promise<{
        id: string;
        type: string;
        verified: boolean;
      }>[] = [];

      // Check each child item
      updatedFolder.childIds.forEach((itemId) => {
        // Check memory cache first, then state
        const type =
          folderCache.current.has(itemId) || state.folders[itemId]
            ? "folder"
            : "file";

        verificationTasks.push(
          (async () => {
            const isVerified = await verifyIntegrity(
              itemId,
              type as "folder" | "file",
              "",
            );
            return { id: itemId, type, verified: isVerified };
          })(),
        );
      });

      // Wait for all verification tasks to complete
      const verificationResults = await Promise.all(verificationTasks);

      // Process results
      for (const item of verificationResults) {
        result.verificationChain!.push({
          id: item.id,
          type: item.type,
          status: item.verified ? "verified" : "failed",
        });

        if (!item.verified) {
          result.verified = false;
          // Get item from memory cache first, then state
          const itemObj =
            item.type === "folder"
              ? folderCache.current.get(item.id) || state.folders[item.id]
              : state.files[item.id];

          result.unverifiedItems!.push({
            id: item.id,
            type: item.type,
            name: itemObj?.name || "Unknown",
          });
        }
      }

      return result;
    } catch (error: any) {
      result.success = false;
      result.verified = false;
      result.errors = [error.message || "Unknown error during verification"];
      return result;
    }
  };

  // Get folder size
  const getFolderSize = useCallback(
    (folderId: string): number => {
      if (state.folderSizes[folderId] !== undefined) {
        return state.folderSizes[folderId];
      }

      // Check memory cache first, then state
      const folder =
        folderCache.current.get(folderId) || state.folders[folderId];
      if (!folder) return 0;

      return folder.size || 0;
    },
    [state.folderSizes, state.folders],
  );

  // Recalculate folder size
  const updateFolderSize = useCallback(
    (folderId: string): number => {
      // Check memory cache first, then state
      const folder =
        folderCache.current.get(folderId) || state.folders[folderId];
      if (!folder) return 0;

      let totalSize = 0;

      // Sum up sizes of all children
      folder.childIds.forEach((childId) => {
        // Check memory cache first, then state for folders
        const childFolder =
          folderCache.current.get(childId) || state.folders[childId];

        if (childFolder && !childFolder.isTrashed) {
          totalSize += updateFolderSize(childId);
        } else if (state.files[childId] && !state.files[childId].isTrashed) {
          totalSize += state.files[childId].size || 0;
        }
      });

      // Update folder size in state
      dispatch({
        type: "UPDATE_FOLDER_SIZE",
        payload: {
          folderId,
          size: totalSize,
        },
      });

      // Update in-memory cache
      if (folderCache.current.has(folderId)) {
        const currentFolder = folderCache.current.get(folderId)!;
        folderCache.current.set(folderId, {
          ...currentFolder,
          size: totalSize,
        });
      }

      return totalSize;
    },
    [state.folders, state.files],
  );

  // Update folder size hierarchy
  const updateFolderSizeHierarchy = useCallback(
    (folderId: string, sizeDelta: number = 0) => {
      if (!folderId || sizeDelta === 0) return;

      let currentFolderId = folderId;
      const processed = new Set<string>();

      while (currentFolderId && !processed.has(currentFolderId)) {
        processed.add(currentFolderId);

        // Check memory cache first, then state
        const folder =
          folderCache.current.get(currentFolderId) ||
          state.folders[currentFolderId];
        if (!folder) break;

        const currentSize = folder.size || 0;
        const newSize = Math.max(0, currentSize + sizeDelta);

        // Update folder size in state
        dispatch({
          type: "UPDATE_FOLDER_SIZE",
          payload: {
            folderId: currentFolderId,
            size: newSize,
          },
        });

        // Update in-memory cache
        if (folderCache.current.has(currentFolderId)) {
          const currentFolder = folderCache.current.get(currentFolderId)!;
          folderCache.current.set(currentFolderId, {
            ...currentFolder,
            size: newSize,
          });
        }

        // Move up to parent
        currentFolderId = folder.parentId as string;
      }
    },
    [state.folders],
  );

  // Get folder children
  const getFolderChildren = useCallback(
    async (
      folderId: string | null = null,
      triggerLoad: boolean = true,
      includeDeleted: boolean = false,
    ): Promise<EncryptedDriveItem[]> => {
      const id = folderId || state.currentFolderId;
      if (!id) return [];

      // Check memory cache first, then state
      const folder = folderCache.current.get(id) || state.folders[id];
      if (!folder) return [];

      // If folder is not loaded and triggerLoad is true, load it
      if (triggerLoad && !folder.loaded) {
        await loadFolderContents(id, 0, CACHE_SETTINGS.PAGE_SIZE, false, false);
      }

      // Get updated folder after potential loading - check memory cache first, then state
      const updatedFolder = folderCache.current.get(id) || state.folders[id];
      if (!updatedFolder) return [];

      // Get children
      return updatedFolder.childIds
        .map((childId) => {
          // Check memory cache first, then state for folders
          const childFolder =
            folderCache.current.get(childId) || state.folders[childId];
          if (childFolder) return childFolder;

          if (state.files[childId]) return state.files[childId];
          return null;
        })
        .filter(
          (item): item is EncryptedDriveItem =>
            item !== null && (includeDeleted || !item.isTrashed),
        );
    },
    [state.folders, state.files, state.currentFolderId],
  );

  // Get decrypted name
  const getDecryptedName = useCallback(
    async (itemId: string, type: "folder" | "file"): Promise<string> => {
      // Check cache first
      if (state.decryptedNames[itemId]) {
        return state.decryptedNames[itemId];
      }

      // Check memory cache first, then state for folders
      const item =
        type === "folder"
          ? folderCache.current.get(itemId) || state.folders[itemId]
          : state.files[itemId];

      if (!item) return "Unknown";

      return item.name;
    },
    [state.decryptedNames, state.folders, state.files],
  );

  // Get all trashed items
  const getTrashedItems = useCallback(
    (
      includeFolders: boolean = true,
      includeFiles: boolean = true,
    ): Array<{ id: string; type: string; item: EncryptedDriveItem }> => {
      const result: Array<{
        id: string;
        type: string;
        item: EncryptedDriveItem;
      }> = [];

      // Go through all trash items
      Object.entries(state.trashItems).forEach(([id, info]) => {
        if (info.type === "folder" && includeFolders) {
          // Check memory cache first, then state
          const folder = folderCache.current.get(id) || state.folders[id];
          if (folder && folder.isTrashed) {
            result.push({ id, type: "folder", item: folder });
          }
        } else if (info.type === "file" && includeFiles) {
          const file = state.files[id];
          if (file && file.isTrashed) {
            result.push({ id, type: "file", item: file });
          }
        }
      });

      // Sort by deletion date, newest first
      return result;
    },
    [state.trashItems, state.folders, state.files],
  );

  // Get decryption errors
  const getDecryptionErrors = useCallback(() => {
    return state.decryptionErrors;
  }, [state.decryptionErrors]);

  // Clear decryption errors
  const clearDecryptionErrors = useCallback(() => {
    dispatch({ type: "CLEAR_DECRYPTION_ERRORS" });
  }, []);

  // Get performance stats
  const getPerformanceStats = useCallback(() => {
    // Format size for display
    const formatSize = (bytes: number): string => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    return {
      cacheSize: {
        shares: Object.keys(state.shares).length,
        folders: Object.keys(state.folders).length,
        memoryFolders: folderCache.current.size,
        files: Object.keys(state.files).length,
        trash: Object.keys(state.trashItems).length,
        folderSizes: Object.keys(state.folderSizes).length,
        decryptedNames: Object.keys(state.decryptedNames).length,
        keyPackets: Object.keys(state.keyPackets).length,
        sessionKeys: Object.keys(state.sessionKeys).length,
        loadingItems: Object.keys(state.loadingItems).length,
        pendingFolderPromises: folderPromises.current.size,
        processingPromises: processingPromises.current.size,
      },
      currentFolder: state.currentFolderId,
      rootDetails: {
        rootFolderId: state.rootFolderId,
        rootShareId: state.rootShareId,
      },
      expandedFolders: state.expandedFolderIds.length,
      decryptionErrors: {
        total: Object.keys(state.decryptionErrors).length,
        sample: Object.entries(state.decryptionErrors)
          .slice(0, 5)
          .map(([id, info]) => ({
            id,
            count: info.count,
            lastError: info.lastError,
          })),
      },
      processingStats: {
        activeFolderProcessing: processingFolderIds.current.size,
        activeProcessingIds: Array.from(processingFolderIds.current),
      },
      memorySample: {
        driveCacheState: formatSize(JSON.stringify(state).length),
        folderCacheSize: formatSize(
          JSON.stringify(Array.from(folderCache.current.keys())).length,
        ),
      },
    };
  }, [state]);

  // Root ID getters
  const getRootShareId = useCallback((): string | null => {
    return state.rootShareId;
  }, [state.rootShareId]);

  const getRootFolderId = useCallback((): string | null => {
    return state.rootFolderId;
  }, [state.rootFolderId]);

  const getRootDetails = useCallback(() => {
    return {
      rootFolderId: state.rootFolderId,
      rootShareId: state.rootShareId,
    };
  }, [state.rootFolderId, state.rootShareId]);

  const getFolder = useCallback(
    (folderId: string): Folder | null => {
      // Fast path: check memory cache first for O(1) access time
      if (folderCache.current.has(folderId)) {
        return folderCache.current.get(folderId)!;
      }

      // Check state as fallback
      if (state.folders[folderId]) {
        const folder = state.folders[folderId];
        // Add to memory cache for future fast access
        folderCache.current.set(folderId, folder);
        return folder;
      }

      return null;
    },
    [state.folders],
  );

  // Optimized file getter
  const getFile = useCallback(
    (fileId: string): File | null => {
      return state.files[fileId] || null;
    },
    [state.files],
  );

  // Calculate if hasMoreItems
  const hasMoreItems = useMemo(() => {
    if (!state.currentFolderId) return false;

    // Check memory cache first, then state
    const folder =
      folderCache.current.get(state.currentFolderId) ||
      state.folders[state.currentFolderId];
    if (!folder) return false;

    return folder.lastLoadedOffset < folder.totalPages;
  }, [state.currentFolderId, state.folders]);

  // Get current folder - check memory cache first, then state
  const currentFolder = useMemo(() => {
    if (!state.currentFolderId) return null;
    return (
      folderCache.current.get(state.currentFolderId) ||
      state.folders[state.currentFolderId] ||
      null
    );
  }, [state.currentFolderId, state.folders]);

  // Create context value
  const contextValue: DriveCacheContextType = {
    state,
    actions: {
      initialize,
      navigateTo,
      navigateToParent,
      loadFolderContents,
      loadMoreItems,
      createFolder,
      updateFolderName,
      updateFileName,
      moveItems,
      moveToTrash,
      restoreFromTrash,
      permanentlyDelete,
      toggleFolderExpanded,
      addFileToCache,
      decryptFileContent,
      clear,
      loadFolderTree,
      decryptUserPrivateKey,
      loadTrashContents,
      loadMoreTrashItems,
      isLoadingTrash: state.isLoadingTrash,
      hasMoreTrashItems,
    },

    // Essential getters
    getRootShareId,
    getRootFolderId,
    getRootDetails,
    getDecryptedName,
    getFolder,
    getFile,
    getFolderChildren,
    getFolderSize,
    updateFolderSize,
    updateFolderSizeHierarchy,
    verifyIntegrity,
    verifyFolderTreeIntegrity,
    getPerformanceStats,
    getDecryptionErrors,
    clearDecryptionErrors,
    getTrashedItems,

    // Current state properties
    isInitialized: state.isInitialized,
    isLoading: state.isLoading,
    isLoadingMore,
    updateCounter,
    currentFolder,
    folderItems,
    breadcrumbs,
    hasMoreItems,
    error: state.error,
  };

  return (
    <DriveCacheContext.Provider value={contextValue}>
      {children}
    </DriveCacheContext.Provider>
  );
};

// Custom hook to use the context
export const useDriveCache = () => {
  const context = useContext(DriveCacheContext);
  if (!context) {
    throw new Error("useDriveCache must be used within a DriveCacheProvider");
  }
  return context;
};

// Export the types
export type { EncryptedDriveItem, Folder, File, IntegrityResult };

export default useDriveCache;
