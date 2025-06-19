// src/hooks/useServerChallenge.ts
import { useState, useCallback } from "react";
import ServerChallengeHandlerInstance from "../services/ServerChallengeHandler";

interface ChallengeData {
  challenge_id: string;
  challenge_string: string;
  expires_in: number;
}

interface ProcessChallengeResult {
  challenge_id: string;
  solution: string;
}

interface ChallengeSolution {
  challenge_id: string;
  solution: string;
  client_fingerprint: string;
}

/**
 * Custom hook for handling server challenges in React components
 */
export const useServerChallenge = () => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clear any existing error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Get device fingerprint for additional security
   */
  const deviceFingerprint = useCallback(async () => {
    try {
      return await ServerChallengeHandlerInstance.getDeviceFingerprint();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get fingerprint";
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Process a challenge received from the server
   */
  const processChallenge = useCallback(
    async (challengeData: ChallengeData): Promise<ProcessChallengeResult> => {
      try {
        setError(null);

        // Validate the challenge data
        if (!challengeData.challenge_id || !challengeData.challenge_string) {
          throw new Error("Invalid challenge data received from server");
        }

        // Process the challenge using the handler
        return await ServerChallengeHandlerInstance.processChallenge(
          challengeData,
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to process challenge";
        setError(errorMessage);
        throw err;
      }
    },
    [],
  );

  /**
   * Solve a challenge and get the solution
   */
  const solveChallenge = useCallback(
    async (challenge_id: string): Promise<ChallengeSolution> => {
      setIsProcessing(true);
      setError(null);

      try {
        if (!challenge_id) {
          throw new Error("Invalid challenge ID");
        }

        // Get solution from handler
        const solution =
          await ServerChallengeHandlerInstance.solveChallenge(challenge_id);

        // Get device fingerprint
        const fingerprint =
          await ServerChallengeHandlerInstance.getDeviceFingerprint();

        return {
          challenge_id,
          solution,
          client_fingerprint: fingerprint,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to solve challenge";
        setError(errorMessage);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  /**
   * Clear a challenge
   */
  const clearChallenge = useCallback((challenge_id: string): void => {
    try {
      if (!challenge_id) {
        throw new Error("Invalid challenge ID");
      }

      ServerChallengeHandlerInstance.clearChallenge(challenge_id);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to clear challenge";
      setError(errorMessage);
    }
  }, []);

  return {
    processChallenge,
    solveChallenge,
    clearChallenge,
    deviceFingerprint,
    isProcessing,
    error,
    clearError,
  };
};
