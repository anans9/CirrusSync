// BillingHistorySection.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  CreditCard,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Check,
  XCircle,
  Clock,
  Filter,
  Search,
  FileText,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Receipt,
  Info,
  CreditCard as CreditCardIcon,
} from "lucide-react";
import { ApiService } from "../../services/ApiService";

// Interface definitions
interface PaymentMethod {
  type?: string;
  last4?: string;
  brand?: string;
}

interface TransactionFlags {
  is_prorated?: boolean;
  proration_credits?: number;
  proration_charges?: number;
  unused_credits?: string[];
  billing_reason?: string;
}

interface Transaction {
  id: string;
  date: number;
  amount: number;
  currency: string;
  status: string;
  description: string;
  payment_method?: PaymentMethod;
  invoice_url?: string;
  receipt_url?: string;
  period_start?: number;
  period_end?: number;
  plan_id?: string;
  flags?: TransactionFlags;
}

interface PaginationData {
  page: number;
  total_pages: number;
  total_records: number;
  per_page: number;
}

interface BillingHistorySectionProps {
  availablePlans?: FeaturedPlans | null;
  onPageChange?: () => void; // New prop for parent scrolling control
}

// Main component
const BillingHistorySection: React.FC<BillingHistorySectionProps> = ({
  availablePlans,
  onPageChange, // New prop for parent scrolling control
}) => {
  const [timeRange, setTimeRange] = useState<string>("3months");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    total_pages: 1,
    total_records: 0,
    per_page: 5,
  });
  const [sortConfig, setSortConfig] = useState({
    sort_by: "date",
    sort_dir: "desc" as "asc" | "desc",
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [dataLoadState, setDataLoadState] = useState<
    "initial" | "loading" | "loaded" | "error"
  >("initial");

  const tableRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef(false);

  useEffect(() => {
    mountRef.current = true;

    return () => {
      mountRef.current = false;
    };
  }, []);

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "succeeded", label: "Paid" },
    { value: "pending", label: "Pending" },
    { value: "failed", label: "Failed" },
    { value: "refunded", label: "Refunded" },
  ];

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case "succeeded":
        return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
      case "failed":
        return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
      case "pending":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400";
      case "refunded":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
      default:
        return "bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400";
    }
  };

  const getStatusIcon = (status: string): React.JSX.Element => {
    switch (status.toLowerCase()) {
      case "succeeded":
        return <Check className="h-3 w-3" />;
      case "failed":
        return <XCircle className="h-3 w-3" />;
      case "pending":
        return <Clock className="h-3 w-3" />;
      case "refunded":
        return <Receipt className="h-3 w-3" />;
      default:
        return <Check className="h-3 w-3" />;
    }
  };

  // Time range options
  const timeRangeOptions = [
    { value: "3months", label: "3 Months" },
    { value: "6months", label: "6 Months" },
    { value: "1year", label: "1 Year" },
    { value: "all", label: "All Time" },
  ];

  // Get plan name from transaction description
  const getPlanNameFromDescription = (transaction: Transaction): string => {
    const { description, plan_id } = transaction;

    // If there's a planId in the transaction data and we have availablePlans, use it
    if (plan_id && availablePlans) {
      // Check individual plans
      const individualPlan = availablePlans.individual?.find(
        (p) => p.id === plan_id,
      );
      if (individualPlan) return individualPlan.name;

      // Check family plan
      if (availablePlans.family && availablePlans.family.id === plan_id)
        return availablePlans.family.name;

      // Check business plan
      if (availablePlans.business && availablePlans.business.id === plan_id)
        return availablePlans.business.name;
    }

    // Otherwise try to extract from description
    if (description) {
      // Try to extract plan info from description like "Plus individual Plan - monthly"
      const planMatch = description.match(/^([A-Za-z]+)\s+([a-z]+)\s+Plan/i);
      if (planMatch) {
        return `${planMatch[1]} ${
          planMatch[2].charAt(0).toUpperCase() + planMatch[2].slice(1)
        } Plan`;
      }

      // For storage purchases
      if (description.includes("Additional storage")) {
        return "Storage Purchase";
      }

      // For subscription descriptions
      if (description.includes("Subscription")) {
        return "Subscription";
      }
    }

    return "Transaction";
  };

  // Reset only the horizontal scroll of the table
  const resetTableHorizontalScroll = () => {
    if (tableRef.current) {
      tableRef.current.scrollLeft = 0;
    }
  };

  // Fetch transactions from API with query parameters
  const fetchTransactions = useCallback(
    async (isInitialRequest = false): Promise<void> => {
      try {
        setIsLoading(true);
        if (isInitialRequest) {
          setDataLoadState("loading");
        } else if (searchTerm) {
          setIsSearching(true);
        }

        setError(null);

        const queryParams = new URLSearchParams({
          page: currentPage.toString(),
          per_page: pagination.per_page.toString(),
          time_range: timeRange,
          sort_by: sortConfig.sort_by,
          sort_dir: sortConfig.sort_dir,
        });

        if (searchTerm) {
          queryParams.append("search", searchTerm);
        }

        if (statusFilter !== "all") {
          queryParams.append("status", statusFilter);
        }

        // Call the API with the constructed query parameters
        const response = await ApiService.getTransactions(queryParams);

        if (response.code === 1000) {
          setTransactions(response.transactions || []);
          setPagination({
            page: response.pagination.page,
            total_pages: response.pagination.total_pages,
            total_records: response.pagination.total_records,
            per_page: response.pagination.per_page,
          });
          setCurrentPage(response.pagination.page);
          setDataLoadState("loaded");

          // After data is loaded, reset the horizontal scroll
          setTimeout(() => {
            resetTableHorizontalScroll();
          }, 100);
        } else {
          throw new Error(response?.detail || "Failed to load transactions");
        }
      } catch (err) {
        setError("Failed to load billing history. Please try again later.");
        setDataLoadState("error");
      } finally {
        setTimeout(() => {
          setIsLoading(false);
          setIsSearching(false);
        }, 500);
      }
    },
    [
      currentPage,
      pagination.per_page,
      sortConfig.sort_by,
      sortConfig.sort_dir,
      searchTerm,
      statusFilter,
      timeRange,
    ],
  );

  // Effect for initial data loading - only runs once when component mounts
  useEffect(() => {
    fetchTransactions(true);
  }, []);

  // Effect for handling filter changes
  useEffect(() => {
    // Skip during initial mount - we already have a dedicated effect for that
    if (dataLoadState === "initial") {
      return;
    }

    // Reset to page 1 when filters change (but not when page changes)
    setCurrentPage(1);

    // Debounce the request
    const timer = setTimeout(() => {
      fetchTransactions(false);
    }, 500);

    // Clean up timeout
    return () => {
      clearTimeout(timer);
    };
  }, [timeRange, statusFilter, sortConfig, searchTerm]);

  // Effect for handling page changes
  useEffect(() => {
    // Skip during initial mount
    if (dataLoadState === "initial") {
      return;
    }

    // Notify parent component about page change - this is the key addition
    if (onPageChange && typeof onPageChange === "function") {
      onPageChange();
    }

    // Debounce the request
    const timer = setTimeout(() => {
      fetchTransactions(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentPage, onPageChange]);

  // Handle page change
  const handlePageChange = (newPage: number): void => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setCurrentPage(newPage);
    }
  };

  // Handle sort change
  const handleSort = (key: string): void => {
    setSortConfig({
      sort_by: key,
      sort_dir:
        sortConfig.sort_by === key && sortConfig.sort_dir === "asc"
          ? "desc"
          : "asc",
    });
  };

  // Format currency with proper symbol
  const formatCurrency = (amount: number, currency: string = "usd"): string => {
    const currencySymbols: Record<string, string> = {
      usd: "$",
      eur: "€",
      gbp: "£",
    };

    const symbol = currencySymbols[currency.toLowerCase()] || "$";

    // Return formatted amount with 2 decimal places
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
  };

  // Check if transaction is prorated or has credits applied
  const isProrationOrCredit = (transaction: Transaction): boolean => {
    return Boolean(
      transaction.flags?.is_prorated ||
        transaction.flags?.unused_credits?.length ||
        transaction.flags?.billing_reason === "subscription_update" ||
        (transaction.amount === 0 &&
          transaction.status.toLowerCase() === "succeeded"),
    );
  };

  // Format payment method display with proper capitalization
  const formatPaymentMethod = (payment: Transaction): React.JSX.Element => {
    // For prorated transactions or credits, show a more informative message
    if (isProrationOrCredit(payment)) {
      return (
        <div className="flex flex-col">
          <div className="flex items-center text-blue-600 dark:text-blue-400">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            <span className="text-sm font-medium">Credit</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Plan Change
          </span>
        </div>
      );
    }

    if (!payment.payment_method) {
      return (
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
          <CreditCardIcon className="h-4 w-4 mr-1.5" />
          <span>Payment Method</span>
        </div>
      );
    }

    const { brand, last4 } = payment.payment_method;

    // Card brand display
    const renderCardBrand = () => {
      switch ((brand || "").toLowerCase()) {
        case "visa":
          return (
            <div className="text-blue-600 dark:text-blue-400 font-bold text-lg tracking-wider">
              VISA
            </div>
          );
        case "mastercard":
          return (
            <div className="flex">
              <div className="w-6 h-6 rounded-full bg-red-500 opacity-90"></div>
              <div className="w-6 h-6 rounded-full bg-yellow-500 opacity-90 -ml-3"></div>
            </div>
          );
        case "amex":
          return (
            <div className="text-blue-600 dark:text-blue-400 font-bold text-sm">
              AMEX
            </div>
          );
        case "discover":
          return (
            <div className="text-orange-600 dark:text-orange-400 font-bold text-sm">
              DISCOVER
            </div>
          );
        default:
          return (
            <CreditCard className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          );
      }
    };

    // Card details
    const cardBrand = brand
      ? brand.charAt(0).toUpperCase() + brand.slice(1)
      : payment.payment_method.type
        ? payment.payment_method.type.charAt(0).toUpperCase() +
          payment.payment_method.type.slice(1)
        : "Card";

    const cardNumber = last4 ? `•••• ${last4}` : "••••";

    return (
      <div className="flex flex-col lg:flex-row sm:items-center">
        {/* Card Brand Icon - Larger on small screens */}
        <div className="mb-1 sm:mb-0 sm:mr-2">{renderCardBrand()}</div>

        {/* Card Details - Stacked on small screens */}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {cardBrand}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {cardNumber}
          </span>
        </div>
      </div>
    );
  };

  // Format date with options
  const formatDate = (
    timestamp: number,
    options?: Intl.DateTimeFormatOptions,
  ): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(
      undefined,
      options || {
        year: "numeric",
        month: "short",
        day: "numeric",
      },
    );
  };

  // Get billing period text
  const getBillingPeriod = (tx: Transaction): string => {
    if (tx.period_start && tx.period_end) {
      return `${formatDate(tx.period_start, {
        month: "short",
        day: "numeric",
      })} - ${formatDate(tx.period_end, { month: "short", day: "numeric" })}`;
    }
    return "";
  };

  // Generate pagination items with ellipsis
  const renderPaginationItems = (): (number | string)[] => {
    const totalPages = pagination.total_pages;
    const currentPageNum = currentPage;

    if (totalPages <= 7) {
      // If 7 or fewer pages, show all
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always include first and last page
    const items: (number | string)[] = [];

    if (currentPageNum <= 3) {
      // Near the start
      items.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (currentPageNum >= totalPages - 2) {
      // Near the end
      items.push(
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      );
    } else {
      // In the middle
      items.push(
        1,
        "...",
        currentPageNum - 1,
        currentPageNum,
        currentPageNum + 1,
        "...",
        totalPages,
      );
    }

    return items;
  };

  // Define skeleton row component for loading state
  const SkeletonRow = () => (
    <tr className="animate-pulse border-b border-[#e1e1e6]/60 dark:border-[#343140]/60">
      {/* Date column */}
      <td className="px-5 py-4">
        <div className="h-5 w-24 bg-gray-200 dark:bg-[#343140] rounded mb-1.5"></div>
        <div className="h-3 w-16 bg-gray-200 dark:bg-[#343140] rounded"></div>
      </td>

      {/* Description column */}
      <td className="px-5 py-4">
        <div className="h-5 w-32 bg-gray-200 dark:bg-[#343140] rounded mb-1.5"></div>
        <div className="h-3 w-40 bg-gray-200 dark:bg-[#343140] rounded"></div>
      </td>

      {/* Payment Method column */}
      <td className="px-5 py-4">
        <div className="flex items-center">
          <div className="h-5 w-5 bg-gray-200 dark:bg-[#343140] rounded-full mr-2"></div>
          <div className="flex flex-col">
            <div className="h-4 w-16 bg-gray-200 dark:bg-[#343140] rounded mb-1"></div>
            <div className="h-3 w-10 bg-gray-200 dark:bg-[#343140] rounded"></div>
          </div>
        </div>
      </td>

      {/* Status column */}
      <td className="px-5 py-4">
        <div className="h-6 w-20 bg-gray-200 dark:bg-[#343140] rounded-full"></div>
      </td>

      {/* Amount column */}
      <td className="px-5 py-4 text-right">
        <div className="h-5 w-16 bg-gray-200 dark:bg-[#343140] rounded ml-auto"></div>
      </td>

      {/* Receipt column */}
      <td className="px-5 py-4 text-right">
        <div className="h-4 w-4 bg-gray-200 dark:bg-[#343140] rounded-full ml-auto"></div>
      </td>
    </tr>
  );

  // Create array of skeleton rows
  const skeletonRows = Array(5)
    .fill(0)
    .map((_, index) => <SkeletonRow key={`skeleton-${index}`} />);

  // Render proration details with simplified display (no tooltip)
  // Replace just the renderProrationDetails function with this improved version that keeps the tooltip
  const hasProrationDetails = (transaction: Transaction): boolean => {
    return Boolean(
      transaction.flags?.is_prorated ||
        transaction.flags?.unused_credits ||
        transaction.flags?.billing_reason === "subscription_update",
    );
  };

  const renderProrationDetails = (
    transaction: Transaction,
  ): React.JSX.Element | null => {
    if (!hasProrationDetails(transaction)) return null;

    const { flags } = transaction;
    if (!flags) return null;

    return (
      <div className="mt-2 flex items-start">
        <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full px-2 py-0.5 flex items-center">
          <RefreshCw className="h-3 w-3 mr-1" />
          Prorated
          {/* Fixed tooltip with proper positioning */}
          <div className="relative inline-block ml-1">
            <div className="relative group">
              <button className="p-0.5">
                <Info className="h-3 w-3 cursor-pointer" />
              </button>
              <div
                className="opacity-0 invisible group-hover:opacity-100 group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-1 w-60 px-3 py-2 bg-white dark:bg-[#1c1b23] shadow-lg rounded-md border border-[#e1e1e6]/60 dark:border-[#343140]/60 text-xs text-gray-700 dark:text-gray-300 z-50 transition-opacity duration-200"
                style={{ pointerEvents: "none" }}
              >
                {flags.proration_credits && flags.proration_credits > 0 && (
                  <div className="mb-1">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      Credit:{" "}
                    </span>
                    {formatCurrency(
                      flags.proration_credits,
                      transaction.currency,
                    )}
                  </div>
                )}
                {typeof flags?.proration_charges === "number" && (
                  <div className="mb-1">
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      Charge:{" "}
                    </span>
                    {formatCurrency(
                      flags.proration_charges,
                      transaction.currency,
                    )}
                  </div>
                )}
                {flags.unused_credits && flags.unused_credits.length > 0 && (
                  <div>
                    <span className="font-medium">Description: </span>
                    {flags.unused_credits}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Get transaction amount display with credits indicator
  const getTransactionAmount = (
    transaction: Transaction,
  ): React.JSX.Element => {
    const { amount, currency, flags } = transaction;
    const isZeroAmount = amount === 0;

    // If it's a zero amount but has proration details
    if (isZeroAmount && flags?.is_prorated) {
      return (
        <div>
          <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(0, currency)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Credits applied
          </div>
        </div>
      );
    }

    return (
      <div className="text-sm font-semibold text-gray-900 dark:text-white">
        {formatCurrency(amount, currency)}
      </div>
    );
  };

  // Render method
  return (
    <div className="w-full max-w-full">
      {/* Search & Filters Bar */}
      <div className="pb-5 p-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pl-10 pr-4 text-xs rounded-md bg-[#f9f9fb] dark:bg-[#2c2934] text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Filters Button */}
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className="flex items-center gap-1 py-2 px-4 bg-[#f9f9fb] dark:bg-[#2c2934] hover:bg-[#f0f0f5] dark:hover:bg-[#343140] rounded-md text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
            </button>

            {/* Time Range Selector */}
            <div className="flex items-center overflow-hidden bg-[#f9f9fb] dark:bg-[#2c2934] rounded-md">
              {timeRangeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeRange(option.value)}
                  className={`px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    timeRange === option.value
                      ? "bg-emerald-500 text-white"
                      : "hover:bg-[#f0f0f5] dark:hover:bg-[#343140] text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Expanded Filters */}
        {isFiltersOpen && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Status:
            </div>
            <div className="flex flex-wrap gap-1">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                    statusFilter === option.value
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-[#f9f9fb] dark:bg-[#2c2934] hover:bg-[#f0f0f5] dark:hover:bg-[#343140] text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col justify-center items-center py-16">
          <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            Unable to load transactions
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {error}
          </span>
          <button
            onClick={() => fetchTransactions(true)}
            className="mt-4 px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-md flex items-center"
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Try Again
          </button>
        </div>
      ) : (
        <div
          ref={tableRef}
          className="border border-[#e1e1e6]/60 dark:border-[#343140]/60 rounded-md overflow-x-auto"
        >
          <table
            style={{ borderCollapse: "separate", borderSpacing: 0 }}
            className="min-w-full border-0"
          >
            <thead>
              <tr className="bg-[#f9f9fb] dark:bg-[#2c2934] border-b border-[#e1e1e6]/60 dark:border-[#343140]/60">
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  <button
                    className="flex items-center cursor-pointer focus:outline-none disabled:cursor-default"
                    onClick={() => handleSort("date")}
                    disabled={isLoading}
                  >
                    <span>Date</span>
                    {sortConfig.sort_by === "date" && (
                      <span className="inline-block ml-1 text-emerald-500">
                        {sortConfig.sort_dir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  <button
                    className="flex items-center cursor-pointer focus:outline-none disabled:cursor-default"
                    onClick={() => handleSort("description")}
                    disabled={isLoading}
                  >
                    <span>Description</span>
                    {sortConfig.sort_by === "description" && (
                      <span className="inline-block ml-1 text-emerald-500">
                        {sortConfig.sort_dir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  <span>Method</span>
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  <button
                    className="flex items-center cursor-pointer focus:outline-none disabled:cursor-default"
                    onClick={() => handleSort("status")}
                    disabled={isLoading}
                  >
                    <span>Status</span>
                    {sortConfig.sort_by === "status" && (
                      <span className="inline-block ml-1 text-emerald-500">
                        {sortConfig.sort_dir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-5 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  <button
                    className="flex items-center cursor-pointer focus:outline-none disabled:cursor-default ml-auto"
                    onClick={() => handleSort("amount")}
                    disabled={isLoading}
                  >
                    <span>Amount</span>
                    {sortConfig.sort_by === "amount" && (
                      <span className="inline-block ml-1 text-emerald-500">
                        {sortConfig.sort_dir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-5 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                skeletonRows
              ) : transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-[#f9f9fb] dark:hover:bg-[#2c2934]/50 transition-colors border-b border-[#e1e1e6]/60 dark:border-[#343140]/60"
                  >
                    {/* Date */}
                    <td className="px-5 py-4 align-top">
                      <div className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {formatDate(transaction.date)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {getBillingPeriod(transaction)}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-5 py-4 align-top">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {getPlanNameFromDescription(transaction)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[250px] line-clamp-2">
                        {transaction.description}
                      </div>
                      {renderProrationDetails(transaction)}
                    </td>

                    {/* Payment Method */}
                    <td className="px-5 py-4 align-top">
                      {formatPaymentMethod(transaction)}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 align-top">
                      <div
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          transaction.status,
                        )}`}
                      >
                        {getStatusIcon(transaction.status)}
                        <span className="ml-1 capitalize">
                          {transaction.status}
                        </span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-4 text-right align-top">
                      {getTransactionAmount(transaction)}
                    </td>

                    {/* Invoice/Receipt */}
                    <td className="px-5 py-4 text-right align-top">
                      {(transaction.invoice_url || transaction.receipt_url) && (
                        <a
                          href={
                            transaction.receipt_url || transaction.invoice_url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4 inline-block" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-gray-500 dark:text-gray-400 border-b border-[#e1e1e6]/60 dark:border-[#343140]/60"
                  >
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-70 text-emerald-500 dark:text-emerald-500" />
                    <p className="text-sm">No transactions found</p>
                    <p className="text-xs mt-1">
                      Try adjusting your search or filters
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!error && transactions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <div>
            Showing{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {Math.min(
                (pagination.page - 1) * pagination.per_page + 1,
                pagination.total_records,
              )}
              -
              {Math.min(
                pagination.page * pagination.per_page,
                pagination.total_records,
              )}
            </span>{" "}
            of{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {pagination.total_records}
            </span>{" "}
            transactions
          </div>

          <div className="flex items-center space-x-1 mt-3 sm:mt-0">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className="p-1.5 rounded-md bg-[#f9f9fb] dark:bg-[#2c2934] hover:bg-[#f0f0f5] dark:hover:bg-[#343140] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {renderPaginationItems().map((item, index) => (
              <React.Fragment key={`page-${index}`}>
                {typeof item === "string" ? (
                  <span className="px-3 py-1.5">...</span>
                ) : (
                  <button
                    onClick={() => handlePageChange(item)}
                    disabled={isLoading}
                    className={`px-3 py-1.5 rounded-md ${
                      currentPage === item
                        ? "bg-emerald-500 text-white"
                        : "bg-[#f9f9fb] dark:bg-[#2c2934] hover:bg-[#f0f0f5] dark:hover:bg-[#343140] text-gray-700 dark:text-gray-300 cursor-pointer"
                    } transition-colors`}
                  >
                    {item}
                  </button>
                )}
              </React.Fragment>
            ))}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === pagination.total_pages || isLoading}
              className="p-1.5 rounded-md bg-[#f9f9fb] dark:bg-[#2c2934] hover:bg-[#f0f0f5] dark:hover:bg-[#343140] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && transactions.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-[#1c1b23] shadow-lg rounded-md px-4 py-2 flex items-center z-10 border border-[#e1e1e6]/60 dark:border-[#343140]/60">
          <Loader2 className="h-4 w-4 text-emerald-500 animate-spin mr-2" />
          <span className="text-xs text-gray-700 dark:text-gray-300">
            Loading...
          </span>
        </div>
      )}

      {/* Searching Indicator */}
      {isSearching && isLoading && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-[#1c1b23] shadow-lg rounded-md px-4 py-2 flex items-center z-10 border border-[#e1e1e6]/60 dark:border-[#343140]/60">
          <Loader2 className="h-4 w-4 text-emerald-500 animate-spin mr-2" />
          <span className="text-xs text-gray-700 dark:text-gray-300">
            Searching...
          </span>
        </div>
      )}
    </div>
  );
};

export default BillingHistorySection;
