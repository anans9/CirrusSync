import { useState, useCallback } from "react";
import { ApiService } from "../services/ApiService";

interface UseSessionsProps {
  itemsPerPage: number;
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
}

export const useSessions = ({
  itemsPerPage,
  setToastMessage,
  setShowToast,
}: UseSessionsProps) => {
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [sessionPage, setSessionPage] = useState<number>(1);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSessions = useCallback(
    async (page: number) => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * itemsPerPage;
        const response = await ApiService.sessions({
          limit: itemsPerPage,
          offset,
        });
        setActiveSessions(response.sessions);
        setTotalSessions(response.pagination.total);
        setSessionPage(page);
        return response.sessions;
      } catch (error) {
        setToastMessage({
          type: "error",
          text: "Error fetching sessions. Please try again.",
        });
        setShowToast(true);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [itemsPerPage, setToastMessage, setShowToast],
  );

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await ApiService.revokeSession(sessionId);
      setActiveSessions((prevSessions) =>
        prevSessions.filter((session) => session.id !== sessionId),
      );
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Error revoking session. Please try again.",
      });
      setShowToast(true);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (activeSessions.length <= 1) return;

    try {
      await ApiService.revokeAllSessions();
      setActiveSessions((prevSessions) =>
        prevSessions.filter((session) => session.is_current),
      );
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Error revoking all sessions. Please try again.",
      });
      setShowToast(true);
    }
  };

  return {
    activeSessions,
    sessionPage,
    totalSessions,
    isLoading,
    fetchSessions,
    handleRevokeSession,
    handleRevokeAllSessions,
  };
};
