import React, { lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import { ThemeProvider } from "./context/ThemeContext";
import { AppTitleProvider } from "./context/AppTitleContext";
import ForgotPasswordPage from "./pages/ForgotPassword";
import SessionListener from "./context/SessionListener";
import { DriveCacheProvider } from "./context/DriveManager";
import { ErrorBoundary } from "react-error-boundary";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import EmailVerificationPage from "./pages/EmailVerificationPage";
import OnboardingPage from "./pages/Onboarding";

// Lazy-loaded pages
const DrivePage = lazy(() => import("./pages/DrivePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));

const ErrorFallback = ({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) => {
  return (
    <div className="bg-white dark:bg-[#0e0d12] select-none flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-red-700 dark:text-red-400 text-lg font-semibold mb-2">
          Something went wrong
        </h2>
        <p className="text-red-600 dark:text-red-300 mb-4 text-sm">
          {error.message || "An unexpected error occurred"}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
};

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_CLIENT_SECRET);

const App = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Router>
        <AppTitleProvider>
          <ThemeProvider>
            <Elements stripe={stripePromise}>
              <AuthProvider>
                <DriveCacheProvider>
                  <SessionListener />
                  <React.Suspense fallback={<LoadingIndicator />}>
                    <main className="app-container bg-white dark:bg-[#0e0d12] select-none">
                      <Routes>
                        {/* Public routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route
                          path="/verify"
                          element={<EmailVerificationPage />}
                        />
                        <Route
                          path="/forgot-password"
                          element={<ForgotPasswordPage />}
                        />

                        {/* Root redirect */}
                        <Route
                          path="/"
                          element={
                            <ProtectedRoute redirectToDrive={true}>
                              <LoadingIndicator />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/user/welcome/onboarding"
                          element={
                            <ProtectedRoute>
                              <OnboardingPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Protected routes within dashboard layout */}
                        <Route
                          element={
                            <ProtectedRoute>
                              <DashboardLayout />
                            </ProtectedRoute>
                          }
                        >
                          {/* Drive routes - preserve path hierarchy */}
                          <Route
                            path="u/:shareId/folders/:folderId"
                            element={<DrivePage />}
                          />
                          <Route path="u/:shareId" element={<DrivePage />} />
                          {/* <Route path="/shared" element={<SharedFilesPage />} />
                          <Route
                            path="/shared-with-me"
                            element={<SharedFilesPage />}
                          /> */}

                          {/* Other dashboard routes */}
                          <Route path="trash" element={<TrashPage />} />
                          <Route path="settings" element={<SettingsPage />} />
                          <Route path="*" element={<div>404 Not Found</div>} />
                        </Route>

                        {/* Catch-all 404 route */}
                        <Route path="*" element={<div>404 Not Found</div>} />
                      </Routes>
                    </main>
                  </React.Suspense>
                </DriveCacheProvider>
              </AuthProvider>
            </Elements>
          </ThemeProvider>
        </AppTitleProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
