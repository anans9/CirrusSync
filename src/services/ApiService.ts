import axios, { AxiosInstance, AxiosError } from "axios";
import { invoke } from "@tauri-apps/api/core";
import ServerChallengeHandlerInstance from "./ServerChallengeHandler";

export class ApiError extends Error {
  status?: number;
  code?: string;
  data?: any;

  constructor(message: string, status?: number, code?: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

const API_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:8000/api/v1"
    : import.meta.env.VITE_API_URL;

let refreshTokenPromise: Promise<BaseAuthResponse> | null = null;

class CsrfTokenCache {
  private token: string | null = null;
  private fetchPromise: Promise<string> | null = null;
  private lastFetched: number = 0;
  private maxAge: number = 60 * 60 * 1000;

  constructor(private api: AxiosInstance) {}

  async getToken(): Promise<string> {
    const now = Date.now();

    if (this.token && now - this.lastFetched >= this.maxAge) {
      this.invalidate();
    }

    if (this.token) {
      return this.token;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this.fetchNewToken();
    const token = await this.fetchPromise;
    this.fetchPromise = null;
    return token;
  }

  async fetchNewToken(): Promise<string> {
    try {
      const response = await this.api.get("/csrf");
      this.token = response.data.token;
      this.lastFetched = response.data.expires_at * 1000;
      return this.token as string;
    } catch (error) {
      this.token = null;
      throw new ApiError("Failed to fetch CSRF token", 500);
    }
  }

  invalidate(): void {
    this.token = null;
    this.fetchPromise = null;
  }

  isValid(): boolean {
    return !!this.token && Date.now() - this.lastFetched < this.maxAge;
  }
}

const createSessionUpdateEvent = () => new CustomEvent("sessionUpdate");
const createSessionExpiredEvent = () => new CustomEvent("sessionExpired");

export async function createApiInstance(): Promise<AxiosInstance> {
  try {
    const systemId = await invoke<SystemIdentifier>(
      "generate_system_identifier",
    );

    const api: AxiosInstance = axios.create({
      baseURL: API_URL,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
        "X-App-Version": systemId.os_name,
        "X-Client-UID": systemId.hash,
        "X-Client-Name": systemId.os_long_version,
      },
    });

    api._csrfCache = new CsrfTokenCache(api);
    setupInterceptors(api);

    return api;
  } catch (error) {
    const api: AxiosInstance = axios.create({
      baseURL: API_URL,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    });

    api._csrfCache = new CsrfTokenCache(api);
    setupInterceptors(api);

    return api;
  }
}

function setupInterceptors(api: AxiosInstance): void {
  api.interceptors.request.use(
    async (config) => {
      if (
        config.method &&
        ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())
      ) {
        try {
          const token = await api._csrfCache.getToken();

          config.headers = config.headers || {};
          config.headers["X-CSRF-TOKEN"] = token;
        } catch (error) {
          console.error("Error setting CSRF token:", error);
        }
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config;

      if (
        error.response?.status === 403 &&
        (error.response?.data as { error: string })?.error ===
          "CSRF token mismatch" &&
        originalRequest &&
        !originalRequest._csrf_retry
      ) {
        originalRequest._csrf_retry = true;

        api._csrfCache.invalidate();

        try {
          const newToken = await api._csrfCache.getToken();
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers["X-CSRF-TOKEN"] = newToken;

          return api(originalRequest);
        } catch (csrfError) {
          return Promise.reject(csrfError);
        }
      }

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        !originalRequest.url?.includes("/auth/refresh")
      ) {
        originalRequest._retry = true;

        try {
          if (!refreshTokenPromise) {
            refreshTokenPromise = (async () => {
              try {
                const response = await api.post<BaseAuthResponse>(
                  "/auth/refresh",
                  {},
                );
                window.dispatchEvent(createSessionUpdateEvent());
                return response.data;
              } catch (refreshError) {
                window.dispatchEvent(createSessionExpiredEvent());
                throw refreshError;
              }
            })();

            refreshTokenPromise.finally(() => {
              refreshTokenPromise = null;
            });
          }

          await refreshTokenPromise;
          return api(originalRequest);
        } catch (refreshError) {
          window.dispatchEvent(createSessionExpiredEvent());
          throw new ApiError("Session expired. Please login again.", 401);
        }
      }

      if (
        error.response?.status === 401 &&
        originalRequest?.url?.includes("/auth/refresh")
      ) {
        window.dispatchEvent(createSessionExpiredEvent());
      }

      const errorResponse = error.response?.data as any;
      const status = error.response?.status || 500;
      const message =
        errorResponse?.message ||
        errorResponse?.detail ||
        errorResponse?.error ||
        error.message ||
        "An unexpected error occurred";
      const code = errorResponse?.code;

      throw new ApiError(message, status, code, errorResponse);
    },
  );
}

let apiInstance: AxiosInstance | null = null;

export async function getApi(): Promise<AxiosInstance> {
  if (!apiInstance) {
    apiInstance = await createApiInstance();
  }
  return apiInstance;
}

const handleApiRequest = async <T>(
  requestFn: () => Promise<T>,
  fallbackErrorMsg: string = "An error occurred",
): Promise<T> => {
  try {
    return await requestFn();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(fallbackErrorMsg, 500);
  }
};

export const ApiService = {
  refreshCsrfToken: async (): Promise<string> => {
    const api = await getApi();
    api._csrfCache.invalidate();
    return api._csrfCache.getToken();
  },

  loginInit: async (payload: LoginInitRequest): Promise<LoginInitResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post<LoginInitResponse>(`/auth/login/init`, payload)
          .then((res) => res.data),
      "Failed to get login challenge",
    );
  },

  loginCommit: async (
    payload: LoginCommitRequest,
  ): Promise<LoginCommitResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post<LoginCommitResponse>("/auth/login/verify", payload)
          .then((res) => res.data),
      "Failed to login. Please try again.",
    );
  },

  sendEmail: async (payload: {
    email: string;
    username: string;
    intent: string;
  }): Promise<{
    code: number;
    detail: string;
    data: {
      success: boolean;
      remaining_requests: number;
      reset_time: string;
    };
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post<{
            code: number;
            detail: string;
            data: {
              success: boolean;
              remaining_requests: number;
              reset_time: string;
            };
          }>("/mfa/email/challenge", payload)
          .then((res) => res.data),
      "Failed to verify email. Please try again.",
    );
  },

  verifyEmail: async (payload: {
    token: string;
  }): Promise<{ email: number; verified: string }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get("/mfa/email/verify?token=" + encodeURIComponent(payload.token))
          .then((res) => res.data),
      "Failed to verify email. Please try again.",
    );
  },

  checkEmailVerificationStatus: async (payload: {
    email: string;
  }): Promise<{
    code: number;
    detail: string;
    data: {
      verified: boolean;
      email: string;
    };
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get<{
            code: number;
            detail: string;
            data: {
              verified: boolean;
              email: string;
            };
          }>("/mfa/email/check?email=" + encodeURIComponent(payload.email))
          .then((res) => res.data),
      "Failed to verify email. Please try again.",
    );
  },

  createUser: async (payload: SignupRequest): Promise<BaseResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api.post<BaseResponse>("/auth/signup", payload).then((res) => res.data),
      "Failed to create account. Please try again.",
    );
  },

  currentSession: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get("/sessions/current").then((res) => res.data),
      "Failed to get current session",
    );
  },

  logout: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.post("/auth/logout").then((res) => res.data),
      "Failed to logout",
    );
  },

  generateTOTPSecret: async (): Promise<{
    code: number;
    setup_session_id: string;
    qr_code: string;
    expires_in: number;
    detail?: string;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post("/users/@me/security/settings/mfa/totp/setup")
          .then((res) => res.data),
      "Failed to request TOTP",
    );
  },

  verifyTOTP: async (
    sessionId: string,
    code: string,
  ): Promise<{
    code: number;
    method: string;
    backup_codes: string[];
    user?: User;
    detail?: string;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post("/users/@me/security/settings/mfa/totp/verify", {
            setup_session_id: sessionId,
            code,
          })
          .then((res) => res.data),
      "Failed to verify TOTP",
    );
  },

  user: async (): Promise<{ code: string; user: User }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get<{ code: string; user: User }>("/users/@me")
          .then((res) => res.data),
      "Failed to get user information",
    );
  },

  MFASettings: async (): Promise<MFASettingsResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get("/users/@me/security/settings/mfa").then((res) => res.data),
      "Failed to get MFA settings",
    );
  },

  updateMFASettings: async (updates: Partial<MFASettings>): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .patch<any>(`/users/@me/security/settings/mfa`, updates)
          .then((res) => res.data),
      "Failed to update MFA settings",
    );
  },

  securitySettings: async (): Promise<SecuritySettingsResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get("/users/@me/security/settings").then((res) => res.data),
      "Failed to get security settings",
    );
  },

  updateSecuritySettings: async (
    updates: Partial<SecuritySettings>,
  ): Promise<SecuritySettingsResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .patch<SecuritySettingsResponse>(
            `/users/@me/security/settings`,
            updates,
          )
          .then((res) => res.data),
      "Failed to update security settings",
    );
  },

  events: async (params: { limit: number; offset: number }) => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get<SecurityEventsResponse>("/events", { params })
          .then((res) => res.data),
      "Failed to fetch events",
    );
  },

  sessions: async (params: { limit: number; offset: number }) => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get<SessionsResponse>("/sessions", { params })
          .then((res) => res.data),
      "Failed to fetch sessions",
    );
  },

  revokeSession: async (id: string) => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .delete(`/sessions/end`, { data: { session_id: id } })
          .then((res) => res.data),
      "Failed to revoke session",
    );
  },

  revokeAllSessions: async () => {
    const api = await getApi();
    return handleApiRequest(
      () => api.delete(`/sessions/end?q=all`).then((res) => res.data),
      "Failed to revoke all sessions",
    );
  },

  clearEvents: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.delete("/events/clear").then((res) => res.data),
      "Failed to clear events",
    );
  },

  getSecurityEventTypes: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get("/events/types").then((res) => res.data),
      "Failed to get security event types",
    );
  },

  downloadSecurityEvents: async (options: any): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.post("/events/download", options).then((res) => res.data),
      "Failed to download security events",
    );
  },

  getDownloadHistory: async (params = {}): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get("/events/downloads", { params }).then((res) => res.data),
      "Failed to get download history",
    );
  },

  getDownloadStatus: async (downloadId: string): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get(`/events/downloads/${downloadId}`).then((res) => res.data),
      "Failed to check download status",
    );
  },

  getDownloadUrl: async (downloadId: string): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get(`/events/downloads/${downloadId}/download`)
          .then((res) => res.data),
      "Failed to get download URL",
    );
  },

  recoveryMethods: async (): Promise<RecoveryMethodsResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get<RecoveryMethodsResponse>("/users/@me/recovery/methods")
          .then((res) => res.data),
      "Failed to get recovery methods",
    );
  },

  updateRecoveryMethods: async (
    updates: RecoveryMethodUpdate,
  ): Promise<RecoveryMethodsResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .patch<RecoveryMethodsResponse>(
            `/users/@me/recovery/methods`,
            updates,
          )
          .then((res) => res.data),
      "Failed to update recovery methods",
    );
  },

  updateUser: async (userData: Partial<User>): Promise<UserResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api.patch<UserResponse>("/users/@me", userData).then((res) => res.data),
      "Failed to update user information",
    );
  },

  preferences: async (): Promise<PreferencesResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get<PreferencesResponse>("/users/@me/account/preferences")
          .then((res) => res.data),
      "Failed to get user preferences",
    );
  },

  updatePreferences: async (
    updates: Partial<Preferences>,
  ): Promise<PreferencesResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .patch<PreferencesResponse>(`/users/@me/account/preferences`, updates)
          .then((res) => res.data),
      "Failed to update user preferences",
    );
  },

  createFolder: async (
    share_id: string,
    data: any,
  ): Promise<{
    success: boolean;
    folderId: string;
    folder: FileItem;
    parentPath: string;
    error?: string;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post(`/drive/shares/${share_id}/folders/create`, data)
          .then((res) => res.data),
      "Failed to create folder",
    );
  },

  updateFolderName: async (
    share_id: string,
    folder_id: string,
    payload: {
      name: string;
      name_hash: string;
      original_name_hash: string;
    },
  ): Promise<{
    code: number;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .patch(
            `/drive/shares/${share_id}/folders/${folder_id}/rename`,
            payload,
          )
          .then((res) => res.data),
      "Failed to update folder",
    );
  },

  updateFileName: async (
    share_id: string,
    file_id: string,
    payload: {
      name: string;
      name_hash: string;
      original_name_hash: string;
    },
  ): Promise<{
    code: number;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .patch(`/drive/shares/${share_id}/files/${file_id}/rename`, payload)
          .then((res) => res.data),
      "Failed to update folder",
    );
  },

  initalizeDrive: async (data: any): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.post("/drive/volumes/create", data).then((res) => res.data),
      "Failed to initalize drive",
    );
  },

  getFolderContents: async (
    folderId: string,
    shareId: string,
    offset: number = 0,
    limit: number = 50,
  ): Promise<DriveItemsResponse> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get<DriveItemsResponse>(
            `/drive/shares/${shareId}/folders/${folderId}/children?offset=${offset}&limit=${limit}`,
          )
          .then((res) => res.data),
      "Failed to get folders",
    );
  },

  getShares: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get(`/drive/shares`).then((res) => res.data),
      "Failed to get shares",
    );
  },

  getSharesById: async (share_id: string): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get(`/drive/shares/${share_id}`).then((res) => res.data),
      "Failed to get shares",
    );
  },

  plan: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get(`/users/@me/plan`).then((res) => res.data),
      "Failed to get plan",
    );
  },

  getLinkDetails: async (linkId: string, shareId: string): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get(`/drive/shares/${shareId}/links/${linkId}`)
          .then((res) => res.data),
      "Failed to get folder details",
    );
  },

  initializeFileUpload: async (
    shareId: string,
    fileData: {
      parent_id: string;
      name: string;
      name_hash: string;
      mime_type: string;
      size: number;
      node_key: string;
      node_passphrase: string;
      node_passphrase_signature: string;
      content_key_packet: string;
      content_key_signature: string;
      content_hash: string | null;
      xattrs?: string | null;
      has_thumbnail?: boolean;
      modified_date?: number;
    },
  ): Promise<{
    code: number;
    file_id: string;
    revision_id: string;
    total_blocks: number;
    block_size: number;
    upload_urls: Array<{
      url: string;
      index: number;
      block_id: string;
      expires_in: number;
    }>;
    thumbnail?: {
      id: string;
      url: string;
      expires_in: number;
    };
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post(`/drive/shares/${shareId}/upload/init`, fileData)
          .then((res) => res.data),
      "Failed to initialize file upload",
    );
  },

  completeThumbnailUpload: async (
    thumbnail_id: string,
    data: {
      hash: string;
      size: number;
    },
  ): Promise<{
    code: number;
    block_id: string;
    upload_complete: boolean;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post(`/drive/thumbnails/${thumbnail_id}/complete`, data)
          .then((res) => res.data),
      "Failed to complete thumbnail upload",
    );
  },

  completeBlockUpload: async (
    blockId: string,
    data: {
      hash: string;
    },
  ): Promise<{
    code: number;
    block_id: string;
    upload_complete: boolean;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post(`/drive/blocks/${blockId}/complete`, data)
          .then((res) => res.data),
      "Failed to complete block upload",
    );
  },

  updateFileContent: async (
    fileId: string,
    data: {
      content_hash: string;
    },
  ): Promise<{
    code: number;
    file_id: string;
    success: boolean;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post(`/drive/files/${fileId}/update-content`, data)
          .then((res) => res.data),
      "Failed to update file content",
    );
  },

  getFileDownloadUrls: async (
    fileId: string,
  ): Promise<{
    code: number;
    file_id: string;
    revision_id: string;
    download_urls: Array<{
      url: string;
      index: number;
      block_id: string;
      expires_in: number;
    }>;
    content_key_packet: string;
    content_key_signature: string;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get(`/drive/files/${fileId}/download`).then((res) => res.data),
      "Failed to get download URLs",
    );
  },

  getFileDetails: async (
    fileId: string,
    shareId: string,
  ): Promise<{
    code: number;
    file: {
      id: string;
      type: number;
      name: string;
      mime_type: string;
      size: number;
      created_at: number;
      modified_at: number;
      node_key: string;
      node_passphrase: string;
      node_passphrase_signature: string;
      file_properties: {
        content_hash: string;
        active_revision: string;
      };
    };
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get(`/drive/shares/${shareId}/files/${fileId}`)
          .then((res) => res.data),
      "Failed to get file details",
    );
  },

  getTrashItems: async (shareId: string, page: number, limit: number) => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get(`/drive/volumes/${shareId}/trash?page=${page}&limit=${limit}`)
          .then((res) => res.data),
      "Failed to get trash details",
    );
  },

  trashItems: async (
    shareId: string,
    folderId: string,
    childrenIds: string[],
  ): Promise<{
    code: number;
    success: boolean;
    items_count: number;
    accepted_ids: string[];
    rejected_ids: string[];
    conflict_count: number;
    invalid_count: number;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .put(`/drive/shares/${shareId}/folders/${folderId}/trash`, {
            children_ids: childrenIds,
          })
          .then((res) => res.data),
      `Failed to trash item${childrenIds.length > 1 && "s"}`,
    );
  },

  restoreItems: async (
    shareId: string,
    childrenIds: string[],
  ): Promise<{
    code: number;
    success: boolean;
    items_count: number;
    accepted_ids: string[];
    rejected_ids: {
      invalid: string[];
      conflicts: string[];
    };
  }> => {
    console.log(childrenIds);
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .put(`/drive/volumes/${shareId}/restore`, {
            children_ids: childrenIds,
          })
          .then((res) => res.data),
      `Failed to restore items from trash`,
    );
  },

  deleteItem: async (
    shareId: string,
    itemId: string,
    itemType: "folder" | "file",
  ): Promise<{
    code: number;
    success: boolean;
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .delete(`/drive/shares/${shareId}/${itemType}s/${itemId}`)
          .then((res) => res.data),
      `Failed to delete ${itemType}`,
    );
  },

  getPaymentMethod: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get("/payments/method").then((res) => res.data),
      "Failed to retrieve payment method",
    );
  },

  addPaymentMethod: async (methodData: {
    token: string;
    billing_name?: string;
    billing_address?: string;
    billing_country?: string;
    billing_postal_code?: string;
  }): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.post("/payments/method", methodData).then((res) => res.data),
      "Failed to add payment method",
    );
  },

  removePaymentMethod: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.delete("/payments/method").then((res) => res.data),
      "Failed to remove payment method",
    );
  },

  getAvailablePlans: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get("/payments/plans").then((res) => res.data),
      "Failed to retrieve available plans",
    );
  },

  // Subscriptions
  getSubscriptionStatus: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.get("/payments/subscriptions").then((res) => res.data),
      "Failed to retrieve subscription status",
    );
  },

  createSubscription: async (subscriptionData: {
    plan_id: string;
    plan_type?: string;
    billing_cycle?: string;
    payment_method_id?: string;
    auto_renew?: boolean;
    coupon_code?: string;
  }): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post("/payments/subscriptions", subscriptionData)
          .then((res) => res.data),
      "Failed to create subscription",
    );
  },

  confirmSubscription: async (confirmData: {
    subscription_id: string;
    payment_intent_id: string;
  }): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post("/payments/subscriptions/confirm", confirmData)
          .then((res) => res.data),
      "Failed to confirm subscription",
    );
  },

  cancelSubscription: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.post("/payments/subscriptions/cancel").then((res) => res.data),
      "Failed to cancel subscription",
    );
  },

  resumeSubscription: async (): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () => api.post("/payments/subscriptions/resume").then((res) => res.data),
      "Failed to resume subscription",
    );
  },

  // Additional storage
  purchaseStorage: async (amountGB: number): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post("/payments/storage", { amount_gb: amountGB })
          .then((res) => res.data),
      "Failed to purchase storage",
    );
  },

  confirmStoragePurchase: async (paymentIntentId: string): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post("/payments/storage/confirm", {
            payment_intent_id: paymentIntentId,
          })
          .then((res) => res.data),
      "Failed to confirm storage purchase",
    );
  },

  // Transaction history
  getTransactions: async (queryParams: URLSearchParams): Promise<any> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .get("/payments/transactions", { params: queryParams })
          .then((res) => res.data),
      "Failed to retrieve transactions",
    );
  },

  initCredit: async (amount: number, description: string, source: string) => {
    const api = await getApi();
    const fingerprint =
      await ServerChallengeHandlerInstance.getDeviceFingerprint();
    return handleApiRequest(
      () =>
        api
          .post("/payments/credits/init", {
            amount: amount,
            description: description,
            source: source,
            client_fingerprint: fingerprint,
          })
          .then((res) => res.data),
      "Failed to initiate credit request",
    );
  },

  // Step 2: Verify challenge and apply credit
  commitCredit: async (challengeId: string, solution: string) => {
    const api = await getApi();
    const fingerprint =
      await ServerChallengeHandlerInstance.getDeviceFingerprint();
    return handleApiRequest(
      () =>
        api
          .post("/payments/credits/commit", {
            challenge_id: challengeId,
            solution: solution,
            client_fingerprint: fingerprint,
          })
          .then((res) => res.data),
      "Failed to verify and apply credit",
    );
  },

  redeemVoucher: async (voucherValue: string) => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .post("/vouchers/redeem", {
            value: voucherValue,
          })
          .then((res) => res.data),
      "Failed to verify the voucher",
    );
  },

  updateUserKeys: async (payload: Partial<Key>) => {
    const api = await getApi();
    return handleApiRequest(
      () => api.patch("/users/@me/keys", payload).then((res) => res.data),
      "Failed to update keys",
    );
  },

  moveItems: async (
    share_id: string,
    parent_id: string,
    payload: {
      name: string;
      name_hash: string;
      signature_email: string;
      node_passphrase: string;
    }[],
  ): Promise<{
    code: number;
    detail: string;
    accepted_ids: string[];
    rejected_items: {
      id: string;
      reason: string;
    }[];
  }> => {
    const api = await getApi();
    return handleApiRequest(
      () =>
        api
          .put(`/drive/shares/${share_id}/items/move`, {
            parent_id: parent_id,
            items: payload,
          })
          .then((res) => res.data),
      "Failed to move items",
    );
  },
};

declare module "axios" {
  interface AxiosInstance {
    _csrfCache: CsrfTokenCache;
  }

  interface InternalAxiosRequestConfig {
    _csrf_retry?: boolean;
    _retry?: boolean;
  }
}

export default getApi;
