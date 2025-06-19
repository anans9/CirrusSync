import { useState, useCallback } from "react";
import { ApiService } from "../services/ApiService";

export const useSecurityEvents = ({
  itemsPerPage,
  setToastMessage,
  setShowToast,
}: UseSecurityEventsProps) => {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [eventPage, setEventPage] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(
    async (page: number) => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * itemsPerPage;
        const response = await ApiService.events({
          limit: itemsPerPage,
          offset,
        });
        setSecurityEvents(response?.events);
        setTotalEvents(response.pagination.total);
        setEventPage(page);
        return response.events;
      } catch (error) {
        setToastMessage({
          type: "error",
          text: "Error fetching events. Please try again.",
        });
        setShowToast(true);
        return [];
      } finally {
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }
    },
    [itemsPerPage, setToastMessage, setShowToast],
  );

  const handleClearEvents = async () => {
    try {
      await ApiService.clearEvents();
      setSecurityEvents([]);
      setTotalEvents(0);
      setEventPage(1);
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Error clearing events. Please try again.",
      });
      setShowToast(true);
    }
  };

  return {
    securityEvents,
    eventPage,
    totalEvents,
    isLoading,
    fetchEvents,
    handleClearEvents,
  };
};
