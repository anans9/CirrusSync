import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  memo,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import useTauriEventListeners from "../../hooks/useTauriEventListeners";
import { ApiError, ApiService } from "../../services/ApiService";
import keyManager from "../../context/KeyManager";
import { useDriveCache } from "../../context/DriveManager";
import { useAuth } from "../../context/AuthContext";
import {
  X,
  Upload,
  Minimize2,
  AlertCircle,
  StopCircle,
  Folder,
  File,
  RefreshCw,
} from "lucide-react";

interface FileInitResponse {
  transfer_id: string;
  response: {
    file_id: string;
    revision_id: string;
    total_blocks: number;
    block_size: number;
    upload_urls: Array<{
      block_id: string;
      index: number;
      url: string;
      expires_in: number;
    }>;
    content_key: string;
    thumbnail?: {
      id: string;
      url: string;
      expires_in: number;
      content_key: string;
    };
  };
}

interface TransferItem {
  id: string;
  name: string;
  type: string;
  progress: number;
  status: string;
  message?: string;
  speed?: number;
  remaining_time?: number;
  size?: number;
}

interface QueueStatus {
  queue_size: number;
  processing: string | null;
  completed: number;
  failed: number;
  paused: boolean;
  elapsedTime: number;
}

interface TransferHandlerProps {
  isVisible: boolean;
  onClose: () => void;
}

const MAX_CONTENT_UPDATE_RETRIES = 3;
const MAX_TRANSFERS_IN_MEMORY = 50;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const CLEANUP_INTERVAL = 60000; // 60 seconds

const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined || bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const TransferHandler = memo(
  forwardRef<
    {
      uploadFiles: (filePaths: string[]) => void;
      uploadFolder: (folderPath: string) => void;
    },
    TransferHandlerProps
  >(({ isVisible = true, onClose }, ref) => {
    const [transfers, setTransfers] = useState<TransferItem[]>([]);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState("all");
    const [backendHealthy, setBackendHealthy] = useState(true);
    const { user } = useAuth();
    const {
      getFolder,
      currentFolder,
      getRootShareId,
      actions: { createFolder, addFileToCache },
    } = useDriveCache();

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const autoScrollRef = useRef<boolean>(true);

    // Individual refs for tracking different request types with timestamps
    const processedFileRequestIds = useRef<{
      [id: string]: { time: number; processed: boolean };
    }>({});
    const processedFolderRequestIds = useRef<{
      [id: string]: { time: number; processed: boolean };
    }>({});
    const completedTransferIds = useRef<{ [id: string]: boolean }>({});
    const processedBlockIds = useRef<{ [id: string]: boolean }>({});
    const contentUpdateIds = useRef<{ [id: string]: boolean }>({});

    // New ref for parent folders that are being processed
    const processingParentFolders = useRef<Map<string, Folder>>(new Map());

    const isCheckingQueueStatus = useRef<boolean>(false);
    const queueEmptyDetected = useRef<boolean>(false);
    const statusCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const transfersInProgress = useRef<number>(0);
    const currentFolderIdRef = useRef<string | null | undefined>(null);
    const rootShareIdRef = useRef<string | null | undefined>(null);

    // Use the custom event listeners hook
    const eventManager = useTauriEventListeners();

    // Health check and cleanup intervals
    const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      rootShareIdRef.current = getRootShareId();
      currentFolderIdRef.current = currentFolder?.id;
    }, [getRootShareId, currentFolder]);

    const handleScroll = useCallback(() => {
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } =
          scrollContainerRef.current;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20;
        autoScrollRef.current = isAtBottom;
      }
    }, []);

    const smoothScrollToBottom = useCallback((duration = 300) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const targetPosition = container.scrollHeight - container.clientHeight;
      const startPosition = container.scrollTop;
      const distance = targetPosition - startPosition;

      if (distance <= 0) return;

      let startTime: number | null = null;

      const animateScroll = (currentTime: number) => {
        if (startTime === null) startTime = currentTime;
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);

        const easeProgress = progress * (2 - progress);

        if (container) {
          container.scrollTop = startPosition + distance * easeProgress;
        }

        if (progress < 1) {
          window.requestAnimationFrame(animateScroll);
        } else {
          if (container) container.scrollTop = targetPosition;
        }
      };

      window.requestAnimationFrame(animateScroll);
    }, []);

    useEffect(() => {
      if (autoScrollRef.current && scrollContainerRef.current) {
        setTimeout(() => {
          smoothScrollToBottom();
        }, 0);
      }
    }, [transfers, smoothScrollToBottom]);

    const sleep = (ms: number) => {
      return new Promise((resolve) => setTimeout(resolve, ms));
    };

    // Health check function for backend communication
    const checkBackendHealth = useCallback(async () => {
      try {
        const health = await invoke<{ status: string; timestamp: number }>(
          "check_transfer_health",
        );
        const healthy = health.status === "healthy";
        setBackendHealthy(healthy);

        if (!healthy) {
          console.warn("Transfer backend health check failed!");
        }

        // If there are any pending requests that are too old, clean them up
        const now = Date.now();
        const TIMEOUT_THRESHOLD = 30000; // 30 seconds

        // Check for stale file requests
        for (const [id, data] of Object.entries(
          processedFileRequestIds.current,
        )) {
          if (!data.processed && now - data.time > TIMEOUT_THRESHOLD) {
            console.warn(
              `File request ${id} has been pending for too long, cleaning up`,
            );
            delete processedFileRequestIds.current[id];
          }
        }

        // Check for stale folder requests
        for (const [id, data] of Object.entries(
          processedFolderRequestIds.current,
        )) {
          if (!data.processed && now - data.time > TIMEOUT_THRESHOLD) {
            console.warn(
              `Folder request ${id} has been pending for too long, cleaning up`,
            );
            delete processedFolderRequestIds.current[id];
          }
        }

        // Also ask the backend to clean up any stuck transfers
        await invoke("cleanup_stuck_transfers");
      } catch (error) {
        console.error("Health check error:", error);
        setBackendHealthy(false);
      }
    }, []);

    const checkQueueStatus = useCallback(async () => {
      if (isCheckingQueueStatus.current) return;

      isCheckingQueueStatus.current = true;
      if (statusCheckTimeoutRef.current) {
        clearTimeout(statusCheckTimeoutRef.current);
        statusCheckTimeoutRef.current = null;
      }

      try {
        const status = await invoke<QueueStatus>("get_queue_status");

        const hasActiveTransfers =
          status.queue_size > 0 || status.processing !== null;
        setIsProcessing(hasActiveTransfers);

        if (!hasActiveTransfers && !queueEmptyDetected.current) {
          queueEmptyDetected.current = true;
        } else if (hasActiveTransfers) {
          queueEmptyDetected.current = false;
        }
      } catch (error) {
        // Silent error handling
        console.warn("Error checking queue status:", error);
      } finally {
        statusCheckTimeoutRef.current = setTimeout(() => {
          isCheckingQueueStatus.current = false;
        }, 100);
      }
    }, []);

    const limitTransfersInMemory = useCallback(() => {
      setTransfers((prev) => {
        if (prev.length <= MAX_TRANSFERS_IN_MEMORY) return prev;

        const sorted = [...prev].sort((a, b) => {
          const aActive = a.status === "preparing" || a.status === "uploading";
          const bActive = b.status === "preparing" || b.status === "uploading";

          if (aActive && !bActive) return -1;
          if (!aActive && bActive) return 1;
          if (a.status === "failed" && b.status !== "failed") return -1;
          if (b.status === "failed" && a.status !== "failed") return 1;
          return 0;
        });

        return sorted.slice(0, MAX_TRANSFERS_IN_MEMORY);
      });
    }, []);

    useEffect(() => {
      // Set up periodic health checks
      if (healthCheckIntervalRef.current === null) {
        healthCheckIntervalRef.current = setInterval(
          checkBackendHealth,
          HEALTH_CHECK_INTERVAL,
        );
      }

      // Set up periodic cleanup
      if (cleanupIntervalRef.current === null) {
        cleanupIntervalRef.current = setInterval(async () => {
          try {
            const result = await invoke<{ cleaned_count: number }>(
              "cleanup_stuck_transfers",
            );
            if (result.cleaned_count > 0) {
              console.log(`Cleaned up ${result.cleaned_count} stuck transfers`);
            }
          } catch (error) {
            console.warn("Error during cleanup:", error);
          }
        }, CLEANUP_INTERVAL);
      }

      // Initial health check
      checkBackendHealth();

      return () => {
        // Clean up intervals
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
          healthCheckIntervalRef.current = null;
        }

        if (cleanupIntervalRef.current) {
          clearInterval(cleanupIntervalRef.current);
          cleanupIntervalRef.current = null;
        }
      };
    }, [checkBackendHealth]);

    // Set up all event listeners with the new pattern
    useEffect(() => {
      const setupListeners = async () => {
        const limitTransfersHelper = (
          transfers: TransferItem[],
        ): TransferItem[] => {
          const active = transfers.filter(
            (t) => t.status === "preparing" || t.status === "uploading",
          );
          const others = transfers.filter(
            (t) => t.status !== "preparing" && t.status !== "uploading",
          );

          const remainingSlots = MAX_TRANSFERS_IN_MEMORY - active.length;
          if (remainingSlots <= 0) return active;

          return [...active, ...others.slice(0, remainingSlots)];
        };

        // 1. Register Transfer progress listener
        await eventManager.registerListener<TransferItem>(
          "transferProgress",
          "transfer-progress",
          (event) => {
            setTransfers((prev) => {
              const exists = prev.some((t) => t.id === event.payload.id);

              if (
                event.payload.status === "uploading" ||
                event.payload.status === "preparing"
              ) {
                transfersInProgress.current += 1;
              } else if (
                exists &&
                (event.payload.status === "completed" ||
                  event.payload.status === "failed")
              ) {
                transfersInProgress.current = Math.max(
                  0,
                  transfersInProgress.current - 1,
                );
                setTimeout(() => checkQueueStatus(), 500);
              }

              let newTransfers = exists
                ? prev.map((t) =>
                    t.id === event.payload.id ? event.payload : t,
                  )
                : [...prev, event.payload];

              if (newTransfers.length > MAX_TRANSFERS_IN_MEMORY + 10) {
                newTransfers = limitTransfersHelper(newTransfers);
              }

              return newTransfers;
            });

            setIsProcessing(true);
          },
        );

        // 2. Register Transfer error listener
        await eventManager.registerListener<string>(
          "transferError",
          "transfer-error",
          () => {
            setTimeout(() => checkQueueStatus(), 500);
          },
        );

        // 3. Register Init file upload listener - UPDATED to handle new properties
        await eventManager.registerListener<{
          id: string;
          name: string;
          path: string;
          parent_id: string;
          share_id: string;
          size: number;
          xattrs: any;
          mime_type: string; // New: MIME type from backend
          modified_date?: number; // New: File modified date
          needs_thumbnail: boolean; // New: Flag for thumbnail generation
        }>("initFileUpload", "init-file-upload", async (event) => {
          try {
            const {
              id,
              name,
              parent_id,
              share_id,
              size,
              xattrs,
              mime_type, // Added from backend
              modified_date, // Added from backend
              needs_thumbnail, // Added from backend
            } = event.payload;

            // Check if already processed
            if (processedFileRequestIds.current[id]?.processed) {
              return;
            }

            // Mark this request as being processed with timestamp
            processedFileRequestIds.current[id] = {
              time: Date.now(),
              processed: false,
            };

            try {
              // First check if we have this parent in our processing cache
              let folder = processingParentFolders.current.get(parent_id);

              // If not in processing cache, try to fetch from DriveCacheContext
              if (!folder) {
                folder = getFolder(parent_id);

                // If folder was found, add to processing cache
                if (folder) {
                  processingParentFolders.current.set(parent_id, folder);
                }
              }

              if (!folder) {
                throw new Error(`Folder not found with ID: ${parent_id}`);
              }

              const folderPrivateKeyArmored =
                await folder.keyData.privateKey.armor();
              const fileKeys = await keyManager.generateFileKeys(
                name,
                String(user?.email),
                folderPrivateKeyArmored,
                folder.original.node_passphrase,
                folder.original.node_passphrase_signature,
                String(folder.keyData.sessionKey),
                String(folder.keyData.keyPacketId),
                xattrs,
              );

              // Use the MIME type from the backend instead of detecting it here
              // This is more accurate and consistent with the file's actual content

              // Create API request with thumbnail support if needed
              const uploadRequest = {
                parent_id,
                name: fileKeys.folder_name,
                name_hash: fileKeys.name_hash,
                mime_type: mime_type,
                size,
                node_key: fileKeys.node_key,
                node_passphrase: fileKeys.node_passphrase,
                node_passphrase_signature: fileKeys.node_passphrase_signature,
                content_key_packet: fileKeys.content_key_packet,
                content_key_signature: fileKeys.content_key_signature,
                content_hash: null,
                xattrs: fileKeys.xattrs,
                has_thumbnail: needs_thumbnail, // Add thumbnail flag
                modified_date: modified_date, // Add modified date if available
              };

              const response = await ApiService.initializeFileUpload(
                share_id,
                uploadRequest,
              );

              const responseData: FileInitResponse = {
                transfer_id: id,
                response: {
                  file_id: response.file_id,
                  revision_id: response.revision_id,
                  total_blocks: response.total_blocks,
                  block_size: response.block_size,
                  upload_urls: response.upload_urls,
                  content_key: fileKeys.content_key,
                },
              };

              if (response.thumbnail) {
                responseData.response.thumbnail = {
                  id: response.thumbnail.id,
                  url: response.thumbnail.url,
                  expires_in: response.thumbnail.expires_in,
                  content_key: fileKeys.content_key, // Add the same encryption key
                };
              }

              // Mark as processed before sending response
              if (processedFileRequestIds.current[id]) {
                processedFileRequestIds.current[id].processed = true;
              }

              await invoke("upload_urls_response", {
                payload: responseData,
              });
            } catch (error) {
              console.error(`Error processing file request ${id}:`, error);

              // Mark as processed even if there's an error
              if (processedFileRequestIds.current[id]) {
                processedFileRequestIds.current[id].processed = true;
              }

              await invoke("upload_error_response", {
                payload: {
                  transfer_id: id,
                  error: error instanceof Error ? error.message : String(error),
                },
              });

              setTimeout(() => checkQueueStatus(), 500);
            }

            smoothScrollToBottom();
          } catch (error) {
            console.error("Unexpected error handling file upload:", error);
            setTimeout(() => checkQueueStatus(), 500);
          }
        });

        await eventManager.registerListener<{
          thumbnail_id: string;
          hash: string;
          size: number;
        }>("thumbnailComplete", "thumbnail-complete", async (event) => {
          try {
            const { thumbnail_id, hash, size } = event.payload;

            console.log(
              `Received thumbnail completion: id=${thumbnail_id}, hash=${hash}, size=${size}`,
            );

            // Create a unique key to prevent duplicate processing
            const thumbnailKey = `thumbnail:${thumbnail_id}`;

            // Check if already processed
            if (processedBlockIds.current[thumbnailKey]) {
              console.log(
                `Thumbnail ${thumbnail_id} already processed, skipping`,
              );
              return;
            }

            // Mark as processed
            processedBlockIds.current[thumbnailKey] = true;

            try {
              // Call API to update thumbnail information
              await ApiService.completeThumbnailUpload(thumbnail_id, {
                hash,
                size,
              });

              console.log(
                `Thumbnail ${thumbnail_id} successfully updated on server`,
              );
            } catch (error) {
              console.warn(
                `Error completing thumbnail ${thumbnail_id}:`,
                error,
              );
              // We'll still continue with the main file upload even if thumbnail update fails
            }
          } catch (error) {
            console.warn(
              "Unexpected error in thumbnail complete handler:",
              error,
            );
          }
        });

        // 4. Register Create folder listener
        await eventManager.registerListener<{
          id: string;
          name: string;
          path: string;
          parent_id: string;
          share_id: string;
        }>("createFolder", "create-folder", async (event) => {
          try {
            const { id, name, parent_id } = event.payload;

            // Check if already processed
            if (processedFolderRequestIds.current[id]?.processed) {
              return;
            }

            // Mark this request as being processed with timestamp
            processedFolderRequestIds.current[id] = {
              time: Date.now(),
              processed: false,
            };

            try {
              // First execute create folder
              const newFolderId = await createFolder(
                parent_id,
                name,
                String(user?.email),
              );

              // If successful, get the folder now and add to our cache for instant access
              // during future operations (like when a subfolder or file is uploaded to this folder)
              if (newFolderId) {
                const newFolder = getFolder(newFolderId);
                if (newFolder) {
                  processingParentFolders.current.set(newFolderId, newFolder);
                }
              }

              // Mark as processed before sending response
              if (processedFolderRequestIds.current[id]) {
                processedFolderRequestIds.current[id].processed = true;
              }

              await invoke("folder_created_response", {
                transferId: id,
                response: {
                  folder_id: newFolderId,
                },
              });
            } catch (error) {
              // Mark as processed even if there's an error
              if (processedFolderRequestIds.current[id]) {
                processedFolderRequestIds.current[id].processed = true;
              }

              await invoke("folder_error_response", {
                transferId: id,
                error:
                  error instanceof ApiError ? error.message : String(error),
              });

              setTimeout(() => checkQueueStatus(), 500);
            }
          } catch (error) {
            console.error("Unexpected error handling folder creation:", error);
            setTimeout(() => checkQueueStatus(), 500);
          }
        });

        // 5. Register Block complete listener
        await eventManager.registerListener<{
          block_id: string;
          hash: string;
          index: number;
          file_id: string;
        }>("blockComplete", "block-complete", async (event) => {
          try {
            const { block_id, hash, index } = event.payload;

            const blockKey = `${block_id}:${index}`;

            // Check if already processed
            if (processedBlockIds.current[blockKey]) {
              return;
            }

            // Mark as processed
            processedBlockIds.current[blockKey] = true;

            try {
              await ApiService.completeBlockUpload(block_id, { hash });
            } catch (error) {
              console.warn(`Error completing block ${blockKey}:`, error);
              // Continue to next block, don't retry failed blocks
            }
          } catch (error) {
            console.warn("Unexpected error in block complete handler:", error);
          }
        });

        // 6. Register Finalize transfer listener
        await eventManager.registerListener<{
          id: string;
          name: string;
          size: number;
          content_hash: string;
          file_id: string;
          parent_id: string;
          revision_id: string;
        }>("finalizeTransfer", "finalize-transfer", async (event) => {
          try {
            const { content_hash, file_id, parent_id, id } = event.payload;

            // Check if already processed
            if (contentUpdateIds.current[file_id]) {
              await invoke("finalize_transfer_complete", {
                transferId: id,
                fileId: file_id,
                parentId: parent_id,
                success: true,
              });
              return;
            }

            // Mark as processed
            contentUpdateIds.current[file_id] = true;

            let success = false;
            let errorMessage = "";

            for (
              let attempt = 1;
              attempt <= MAX_CONTENT_UPDATE_RETRIES;
              attempt++
            ) {
              try {
                await sleep(500);
                await ApiService.updateFileContent(file_id, { content_hash });
                success = true;
                break;
              } catch (error) {
                errorMessage =
                  error instanceof Error ? error.message : String(error);
                console.warn(
                  `Content update attempt ${attempt} failed:`,
                  errorMessage,
                );

                if (attempt < MAX_CONTENT_UPDATE_RETRIES) {
                  await sleep(1000 * attempt); // Exponential backoff
                }
              }
            }

            await invoke("finalize_transfer_complete", {
              transferId: id,
              fileId: file_id,
              parentId: parent_id,
              success,
              error: success ? undefined : errorMessage,
            });

            setTimeout(() => checkQueueStatus(), 500);
          } catch (error) {
            console.error("Unexpected error finalizing transfer:", error);

            await invoke("finalize_transfer_complete", {
              transferId: event.payload.id,
              fileId: event.payload.file_id,
              parentId: event.payload.parent_id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });

            setTimeout(() => checkQueueStatus(), 500);
          }
        });

        // 7. Register Transfer complete listener
        await eventManager.registerListener<{
          id: string;
          name: string;
          file_id: string;
          parent_id: string;
          status: string;
          message?: string;
        }>("transferComplete", "transfer-complete", async (event) => {
          try {
            const { id, status, message, file_id, parent_id } = event.payload;

            // Check if already processed
            if (completedTransferIds.current[id]) {
              return;
            }

            // Mark as completed
            completedTransferIds.current[id] = true;

            setTransfers((prev) => {
              return prev.map((t) => {
                if (t.id === id) {
                  return {
                    ...t,
                    status: status || "completed",
                    message: message || "Upload complete",
                  };
                }
                return t;
              });
            });

            if (file_id && parent_id) {
              const fileInfo = {
                id: file_id,
                parentId: parent_id,
              };

              addFileToCache(fileInfo);
            }

            // Clear from processed files
            if (processedFileRequestIds.current[id]) {
              delete processedFileRequestIds.current[id];
            }

            setTimeout(() => checkQueueStatus(), 500);
            setTimeout(checkQueueStatus, 2000);
          } catch (error) {
            console.error(
              "Unexpected error handling transfer completion:",
              error,
            );
            setTimeout(() => checkQueueStatus(), 500);
          }
        });
      };

      setupListeners();

      const statusInterval = setInterval(async () => {
        if (isProcessing && !isCheckingQueueStatus.current) {
          await checkQueueStatus();
        }
      }, 5000);

      // Cleanup interval for processing parent folders cache
      const processingCacheCleanupInterval = setInterval(
        () => {
          // We don't have timestamps in the cache, so we'll just clear it periodically
          // when transfers aren't active
          if (!isProcessing && processingParentFolders.current.size > 0) {
            processingParentFolders.current.clear();
          }
        },
        10 * 60 * 1000,
      ); // Every 10 minutes

      return () => {
        clearInterval(statusInterval);
        clearInterval(processingCacheCleanupInterval);
        if (statusCheckTimeoutRef.current) {
          clearTimeout(statusCheckTimeoutRef.current);
        }
        // No need to manually clean up listeners - the hook handles it
      };
    }, [
      eventManager,
      isProcessing,
      checkQueueStatus,
      getFolder,
      createFolder,
      user?.email,
      limitTransfersInMemory,
      addFileToCache,
      smoothScrollToBottom,
    ]);

    const uploadFiles = useCallback(
      async (filePath: string[] | string) => {
        try {
          queueEmptyDetected.current = false;
          isCheckingQueueStatus.current = false;

          const paths = Array.isArray(filePath) ? filePath : [filePath];

          const shareId = rootShareIdRef.current;
          const parentId = currentFolderIdRef.current;

          await invoke("select_files", {
            paths,
            shareId,
            parentId,
          });

          setTimeout(() => checkQueueStatus(), 500);
        } catch (error) {
          console.error("Error uploading files:", error);
        }
      },
      [checkQueueStatus],
    );

    const uploadFolder = useCallback(
      async (folderPath: string) => {
        try {
          queueEmptyDetected.current = false;
          isCheckingQueueStatus.current = false;

          const paths = [folderPath.toString()];

          const shareId = rootShareIdRef.current;
          const parentId = currentFolderIdRef.current;

          await invoke("select_folders", {
            paths,
            shareId,
            parentId,
          });

          setTimeout(() => checkQueueStatus(), 500);
        } catch (error) {
          console.error("Error uploading folder:", error);
        }
      },
      [checkQueueStatus],
    );

    const handleRemoveTransfer = useCallback(
      async (id: string) => {
        try {
          setTransfers((prev) => prev.filter((t) => t.id !== id));

          // Clean up refs
          delete processedFileRequestIds.current[id];
          delete processedFolderRequestIds.current[id];
          delete completedTransferIds.current[id];

          setTimeout(() => checkQueueStatus(), 500);
        } catch (error) {
          console.error("Error removing transfer:", error);
        }
      },
      [checkQueueStatus],
    );

    const handleCancelAll = useCallback(async () => {
      try {
        await invoke("cancel_all_transfers");

        // Clear all tracking refs
        processedFileRequestIds.current = {};
        processedFolderRequestIds.current = {};
        completedTransferIds.current = {};
        processedBlockIds.current = {};
        contentUpdateIds.current = {};
        processingParentFolders.current.clear();

        queueEmptyDetected.current = true;
        transfersInProgress.current = 0;
        setIsProcessing(false);

        setTimeout(() => checkQueueStatus(), 500);
      } catch (error) {
        console.error("Error cancelling all transfers:", error);
      }
    }, [checkQueueStatus]);

    const handleClearCompleted = useCallback(() => {
      setTransfers((prev) => {
        const completedIds = prev
          .filter((t) => t.status === "completed")
          .map((t) => t.id);

        // Clear completed from refs
        completedIds.forEach((id) => {
          delete processedFileRequestIds.current[id];
          delete processedFolderRequestIds.current[id];
          delete completedTransferIds.current[id];
        });

        return prev.filter((t) => t.status !== "completed");
      });
    }, []);

    const handleClearFailed = useCallback(() => {
      setTransfers((prev) => {
        const failedIds = prev
          .filter((t) => t.status === "failed")
          .map((t) => t.id);

        // Clear failed from refs
        failedIds.forEach((id) => {
          delete processedFileRequestIds.current[id];
          delete processedFolderRequestIds.current[id];
          delete completedTransferIds.current[id];
        });

        return prev.filter((t) => t.status !== "failed");
      });
    }, []);

    // Function to force clean up any stuck transfers
    const handleForceCleanup = useCallback(async () => {
      try {
        await invoke<{ cleaned_count: number }>("cleanup_stuck_transfers");

        setTimeout(() => checkQueueStatus(), 500);
      } catch (error) {
        console.error("Error during forced cleanup:", error);
      }
    }, [checkQueueStatus]);

    // Removed the getMimeType function as we're now relying on the backend

    const formatSpeed = (bytesPerSecond?: number): string => {
      if (bytesPerSecond === undefined || bytesPerSecond <= 0) return "0 B/s";

      if (bytesPerSecond < 1024) {
        return `${Math.round(bytesPerSecond)} B/s`;
      } else if (bytesPerSecond < 1024 * 1024) {
        return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
      } else {
        return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
      }
    };

    const formatTime = (seconds?: number): string => {
      if (!seconds || seconds <= 0) return "--:--";

      if (seconds > 86400) {
        return ">1 day";
      } else if (seconds < 60) {
        return `${Math.round(seconds)}s`;
      } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs}s`;
      } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
      }
    };

    const filteredTransfers = (() => {
      switch (activeTab) {
        case "active":
          return transfers.filter((t) =>
            ["preparing", "uploading"].includes(t.status),
          );
        case "completed":
          return transfers.filter((t) => t.status === "completed");
        case "failed":
          return transfers.filter((t) => t.status === "failed");
        default:
          return transfers;
      }
    })();

    useImperativeHandle(
      ref,
      () => ({
        uploadFiles,
        uploadFolder,
      }),
      [uploadFiles, uploadFolder],
    );

    const handleTabClick = (tab: string) => {
      setActiveTab(tab);

      setTimeout(() => {
        autoScrollRef.current = true;
        smoothScrollToBottom();
      }, 50);
    };

    const stats = {
      active: transfers.filter(
        (t) => t.status === "preparing" || t.status === "uploading",
      ).length,
      completed: transfers.filter((t) => t.status === "completed").length,
      failed: transfers.filter((t) => t.status === "failed").length,
      total: transfers.length,
    };

    if (!isVisible) return null;

    return (
      <div className="fixed bottom-0 right-4 w-[500px] bg-white dark:bg-[#1c1b1f] rounded-lg shadow-xl z-50 animate-in slide-in-from-right-5 duration-200">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#28262c] border-b border-gray-200 dark:border-[#2c2c2c] rounded-t-xl">
          <div className="flex items-center">
            <span className="text-sm text-gray-900 dark:text-white font-medium">
              {stats.total > 0
                ? `${stats.total} ${
                    stats.total === 1 ? "transfer" : "transfers"
                  } (${stats.active} active${
                    stats.failed > 0 ? `, ${stats.failed} failed` : ""
                  })`
                : "No transfers"}
            </span>
            {!backendHealthy && (
              <span className="ml-2 text-xs text-red-500 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                Connection issues
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!backendHealthy && (
              <button
                onClick={handleForceCleanup}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                aria-label="Force cleanup"
                title="Force cleanup"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsMinimized((prev) => !prev)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
              aria-label={isMinimized ? "Expand" : "Minimize"}
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="flex border-b border-gray-200 dark:border-[#2c2c2c]">
              {["all", "active", "completed", "failed"].map((tab) => {
                let count = 0;

                if (tab === "all") {
                  count = stats.total;
                } else if (tab === "active") {
                  count = stats.active;
                } else if (tab === "completed") {
                  count = stats.completed;
                } else {
                  count = stats.failed;
                }

                return (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className={`px-4 py-2 text-sm capitalize ${
                      activeTab === tab
                        ? "text-[#03DAC6] dark:text-[#03DAC6] border-b-2 border-[#03DAC6]"
                        : "text-gray-500 dark:text-gray-400"
                    } cursor-pointer`}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>

            <div
              ref={scrollContainerRef}
              className="max-h-[300px] overflow-y-auto"
              onScroll={handleScroll}
            >
              {filteredTransfers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                  <p>
                    No {activeTab !== "all" ? activeTab : ""} transfers to
                    display
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-[#2c2c2c]">
                  {filteredTransfers.map((transfer) => (
                    <div key={transfer.id} className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 flex-shrink-0 bg-gray-100 dark:bg-[#2c2c2c] rounded flex items-center justify-center mt-1">
                          {transfer.status === "failed" ? (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          ) : transfer.type === "folder" ? (
                            <Folder className="w-4 h-4 text-gray-900 dark:text-white" />
                          ) : transfer.status === "completed" ? (
                            <File className="w-4 h-4 text-gray-900 dark:text-white" />
                          ) : (
                            <Upload className="w-4 h-4 text-gray-900 dark:text-white" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-900 dark:text-white truncate mr-2">
                              {transfer.name}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <p>
                              {transfer.type === "folder" ? "Folder" : "File"}
                              {transfer.type === "file" && transfer.size && (
                                <span> ({formatFileSize(transfer.size)})</span>
                              )}
                              {transfer.status !== "failed" && (
                                <span> • {transfer.message}</span>
                              )}
                            </p>
                          </div>

                          {["uploading", "preparing"].includes(
                            transfer.status,
                          ) && (
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                              <span>
                                {transfer.status === "preparing"
                                  ? "Preparing..."
                                  : formatSpeed(transfer.speed)}
                              </span>
                              <span>{formatTime(transfer.remaining_time)}</span>
                            </div>
                          )}

                          <div className="w-full bg-gray-200 dark:bg-[#2c2c2c] rounded-full h-1.5 mt-2">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                transfer.status === "failed"
                                  ? "bg-red-500"
                                  : "bg-[#03DAC6]"
                              }`}
                              style={{
                                width: `${
                                  transfer.status === "failed"
                                    ? 100
                                    : transfer.progress * 100
                                }%`,
                              }}
                            />
                          </div>

                          {transfer.status === "failed" && transfer.message && (
                            <div className="text-xs text-red-500 mt-1">
                              {transfer.message}
                            </div>
                          )}
                        </div>
                        {(transfer.status === "completed" ||
                          transfer.status === "failed") && (
                          <button
                            onClick={() => handleRemoveTransfer(transfer.id)}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                            aria-label="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-[#28262c] border-t border-gray-200 dark:border-[#2c2c2c] flex justify-between items-center">
              <div className="flex gap-2">
                {stats.active > 0 && (
                  <button
                    onClick={handleCancelAll}
                    className="px-3 py-1.5 flex items-center gap-1 bg-gray-200 dark:bg-[#3c3c3c] hover:bg-gray-300 dark:hover:bg-[#4c4c4c] text-gray-800 dark:text-gray-200 rounded text-sm cursor-pointer"
                  >
                    <StopCircle className="w-3 h-3" />
                    <span>Stop All</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {stats.completed > 0 && (
                  <button
                    onClick={handleClearCompleted}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                  >
                    Clear Completed
                  </button>
                )}
                {stats.failed > 0 && (
                  <button
                    onClick={handleClearFailed}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                  >
                    Clear Failed
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }),
);

export default TransferHandler;
