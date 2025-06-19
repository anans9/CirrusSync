import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApiService } from "../services/ApiService";
import keyManager from "./KeyManager";
import secureStorage from "../services/SecureStorageService";
import { LoadingIndicator } from "../components/LoadingIndicator";
import SRPClient from "../services/SrpService";

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const loginPageRef = useRef<boolean>(false);
  const frontendReadyRef = useRef<boolean>(false);

  const authStateRef = useRef<{
    isInitializing: boolean;
    isCheckingAuth: boolean;
    hasCheckedAuth: boolean;
  }>({
    isInitializing: false,
    isCheckingAuth: false,
    hasCheckedAuth: false,
  });

  useEffect(() => {
    // Handle resize window
    if (!loginPageRef.current && !loading) {
      loginPageRef.current = true;

      setTimeout(() => {
        invoke("resize_window", {
          session: !!session,
        });
      }, 100);
    }

    // Handle frontend ready notification
    if (
      !frontendReadyRef.current &&
      !loading &&
      !authStateRef.current.isCheckingAuth
    ) {
      frontendReadyRef.current = true;

      setTimeout(() => {
        invoke("frontend_ready");
      }, 300);
    }
  }, [session, loading]);

  useEffect(() => {
    if (authStateRef.current.isInitializing) return;

    authStateRef.current.isInitializing = true;

    invoke("initialize_app")
      .then(() => {
        if (!authStateRef.current.isCheckingAuth) {
          checkAuth();
        }
      })
      .catch(() => {
        setLoading(false);
        authStateRef.current.isInitializing = false;
      });

    const handleSessionUpdate = () => {
      if (session?.expiresAt && session.expiresAt * 1000 <= Date.now()) {
        authStateRef.current.hasCheckedAuth = false;
        checkAuth();
      }
    };

    window.addEventListener("sessionUpdate", handleSessionUpdate);

    return () => {
      window.removeEventListener("sessionUpdate", handleSessionUpdate);
    };
  }, []);

  useEffect(() => {
    if (session?.expiresAt) {
      const expiresAtMs = session.expiresAt * 1000;
      const timeUntilExpiration = expiresAtMs - Date.now();

      if (timeUntilExpiration < 60000) {
        authStateRef.current.hasCheckedAuth = false;
        checkAuth();
      }
    }
  }, [session]);

  const getAuthToken = async () => {
    try {
      const authDataStr = await invoke<string>("get_store_value", {
        key: "auth_data",
      });
      if (!authDataStr) return null;

      return JSON.parse(authDataStr) as {
        token: string;
        refreshToken: string;
        expiresIn: number;
        userId: string;
      };
    } catch (error) {
      return null;
    }
  };

  const storeAuthToken = async (authData: {
    token: string;
    refreshToken: string;
    expiresIn: number;
    userId: string;
  }) => {
    try {
      const authDataStr = JSON.stringify(authData);
      await invoke("set_store_value", { key: "auth_data", value: authDataStr });
    } catch (error) {
      throw error;
    }
  };

  const clearAuthToken = async () => {
    try {
      await invoke("delete_store_value", { key: "auth_data" });
    } catch (error) {
      throw error;
    }
  };

  const getSessionDerivedKey = async ({ userId }: { userId: string }) => {
    try {
      return await secureStorage.getDerivedKey(userId);
    } catch (error) {
      return null;
    }
  };

  const storeSession = async ({
    userId,
    derivedKey,
  }: {
    userId: string;
    derivedKey: string;
  }) => {
    try {
      await secureStorage.storeDerivedKey(userId, derivedKey);
    } catch (error) {
      throw error;
    }
  };

  const clearSession = async ({ userId }: { userId: string }) => {
    try {
      await secureStorage.deleteDerivedKey(userId);
    } catch (error) {
      throw error;
    }
  };

  const checkAuth = async () => {
    if (authStateRef.current.isCheckingAuth) {
      return;
    }

    if (authStateRef.current.hasCheckedAuth) {
      return;
    }

    try {
      authStateRef.current.isCheckingAuth = true;
      setLoading(true);

      const authData = await getAuthToken();
      if (!authData) {
        setUser(null);
        setSession(null);
        return;
      }

      const { userId } = authData;
      const derivedKey = await getSessionDerivedKey({ userId });
      if (!derivedKey) {
        await clearSession({ userId });
        setUser(null);
        setSession(null);
        return;
      }

      const [sessionResponse, userResponse] = await Promise.all([
        ApiService.currentSession(),
        ApiService.user(),
      ]);

      if (sessionResponse?.code === 1000) {
        setSession(sessionResponse.session as Session);
        setUser(userResponse.user as User);
        authStateRef.current.hasCheckedAuth = true;
      } else {
        await handleAuthError();
      }
    } catch (error) {
      await handleAuthError();
    } finally {
      authStateRef.current.isCheckingAuth = false;
      setLoading(false);
    }
  };

  const handleAuthError = async () => {
    try {
      const authData = await getAuthToken();

      if (authData?.userId) {
        await clearSession({ userId: authData.userId });
      }

      await clearAuthToken();
    } finally {
      setUser(null);
      setSession(null);
      authStateRef.current.hasCheckedAuth = false;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      authStateRef.current.hasCheckedAuth = false;

      const srpClient = new SRPClient(email);
      const startAuthData = srpClient.startAuthentication();

      const challengeResponse = await ApiService.loginInit({
        email: email,
        clientPublic: startAuthData.clientPublic,
      });

      if (challengeResponse.code !== 2010) {
        throw {
          code: challengeResponse.code,
          detail: challengeResponse.detail || "Failed to get server challenge",
        };
      }

      const { salt, serverPublic, sessionId } = challengeResponse;
      const clientProof = await srpClient.processChallenge(
        salt,
        serverPublic,
        password,
      );

      const { seed } = await keyManager.hashPassword(password, salt);

      if (!seed) {
        throw new Error("Invalid password");
      }

      const loginPayload = {
        email,
        clientProof: clientProof,
        sessionId,
      };

      const response = await ApiService.loginCommit(loginPayload);

      if (response.serverProof) {
        await srpClient.verifyServer(response.serverProof);
      }

      await storeAuthToken({
        token: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn,
        userId: String(response.user.id),
      });

      await storeSession({
        userId: String(response.user.id),
        derivedKey: String(seed),
      });

      await checkAuth();

      loginPageRef.current = false;
      return true;
    } catch (error) {
      await handleAuthError();
      throw error;
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    try {
      const srpClient = new SRPClient(email);

      const srpCredentials =
        await srpClient.generateRegistrationCredentials(password);

      const userKeys = await keyManager.generateSignupKeys(
        email,
        username,
        password,
        srpCredentials.salt,
      );

      const signupData = {
        email: userKeys.email,
        username: userKeys.username,
        keys: userKeys.keys,
        salt: srpCredentials.salt,
        verifier: srpCredentials.verifier,
      };

      await ApiService.createUser(signupData);

      return { recoveryPhrase: userKeys.recoveryPhrase };
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      setLoading(true);

      const authData = await getAuthToken();
      if (authData?.userId) {
        await Promise.all([
          clearSession({ userId: authData.userId }),
          clearAuthToken(),
          ApiService.logout(),
        ]);
      }

      loginPageRef.current = false;
    } catch (error) {
      throw error;
    } finally {
      authStateRef.current.hasCheckedAuth = false;
      setUser(null);
      setSession(null);
      setLoading(false);
    }
  };

  const value = {
    user,
    setUser,
    session,
    loading,
    login,
    signup,
    logout,
    getSessionDerivedKey,
    isAuthenticated: !!session,
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
