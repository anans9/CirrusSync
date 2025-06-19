// import { Navigate, useLocation, useParams } from "react-router-dom";
// import { useContext } from "react";
// import { AuthContext } from "../context/AuthContext";
// import { useDriveCache } from "../context/DriveManager";
// import { ReactNode } from "react";
// import { LoadingIndicator } from "./LoadingIndicator";

// interface ProtectedRouteProps {
//   children: ReactNode;
//   redirectToDrive?: boolean;
// }

// const ProtectedRoute = ({
//   children,
//   redirectToDrive = false,
// }: ProtectedRouteProps) => {
//   const location = useLocation();
//   const params = useParams();

//   // Get auth context safely
//   const authContext = useContext(AuthContext);

//   // If auth context isn't available yet (still initializing), show loading
//   if (!authContext) {
//     return <LoadingIndicator />;
//   }

//   const { isAuthenticated, loading } = authContext;

//   // Try to access drive cache, but continue if not available
//   let driveCache;
//   try {
//     driveCache = useDriveCache();
//   } catch (error) {
//     // Drive cache might not be ready - this is fine, we'll handle it
//   }

//   // Handle basic auth loading state
//   if (loading) {
//     return <LoadingIndicator />;
//   }

//   // Handle unauthenticated users
//   if (!isAuthenticated) {
//     // Store the current path to return to after login
//     return <Navigate to="/login" state={{ from: location.pathname }} replace />;
//   }

//   // Check if we're already in a deeper file/folder path
//   const isInSubfolder =
//     location.pathname.includes("/folders/") ||
//     location.pathname.includes("/files/");

//   // If we're in a subfolder, don't redirect even if redirectToDrive is true
//   if (isInSubfolder) {
//     return <>{children}</>;
//   }

//   // Only redirect to drive root if:
//   // 1. We're supposed to redirect to drive
//   // 2. Drive cache is initialized
//   // 3. We're at the exact root or "/u" path
//   // 4. We have a root share ID
//   const shouldRedirectToDrive =
//     redirectToDrive &&
//     driveCache?.isInitialized &&
//     (location.pathname === "/" || location.pathname === "/u") &&
//     !params.shareId;

//   if (shouldRedirectToDrive) {
//     const shareId = driveCache?.getRootShareId();
//     if (shareId) {
//       return <Navigate to={`/u/${shareId}`} replace />;
//     }
//   }

//   // If drive cache isn't ready but we need it, show loading
//   const isDriveLoading =
//     redirectToDrive &&
//     (!driveCache?.isInitialized || !driveCache?.getRootShareId());

//   if (isDriveLoading) {
//     return <LoadingIndicator />;
//   }

//   // All checks passed, render the protected content
//   return <>{children}</>;
// };

// export default ProtectedRoute;

import { Navigate, useLocation, useParams } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useDriveCache } from "../context/DriveManager";
import { ReactNode } from "react";
import { LoadingIndicator } from "./LoadingIndicator";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectToDrive?: boolean;
}

const ProtectedRoute = ({
  children,
  redirectToDrive = false,
}: ProtectedRouteProps) => {
  const location = useLocation();
  const params = useParams();

  // Get auth context safely
  const authContext = useContext(AuthContext);

  // If auth context isn't available yet (still initializing), show loading
  if (!authContext) {
    return <LoadingIndicator />;
  }

  const { isAuthenticated, loading, user } = authContext;

  // Try to access drive cache, but continue if not available
  let driveCache;
  try {
    driveCache = useDriveCache();
  } catch (error) {
    // Drive cache might not be ready - this is fine, we'll handle it
  }

  // Handle basic auth loading state
  if (loading) {
    return <LoadingIndicator />;
  }

  // Handle unauthenticated users
  if (!isAuthenticated) {
    // Store the current path to return to after login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Check onboarding flags if user exists
  if (user && user.onboardingFlags) {
    const onboardingFlags = user.onboardingFlags;

    // Check if any of the required onboarding steps are not completed
    const needsOnboarding = !(
      onboardingFlags.driveSetup?.completed === true &&
      onboardingFlags.rootFolder?.completed === true
    );

    // If onboarding is needed and we're not already on the onboarding page, redirect
    if (
      needsOnboarding &&
      !location.pathname.includes("/user/welcome/onboarding")
    ) {
      return <Navigate to="/user/welcome/onboarding" replace />;
    }
  }

  // Check if we're already in a deeper file/folder path
  const isInSubfolder =
    location.pathname.includes("/folders/") ||
    location.pathname.includes("/files/");

  // If we're in a subfolder, don't redirect even if redirectToDrive is true
  if (isInSubfolder) {
    return <>{children}</>;
  }

  // Only redirect to drive root if:
  // 1. We're supposed to redirect to drive
  // 2. Drive cache is initialized
  // 3. We're at the exact root or "/u" path
  // 4. We have a root share ID
  const shouldRedirectToDrive =
    redirectToDrive &&
    driveCache?.isInitialized &&
    (location.pathname === "/" || location.pathname === "/u") &&
    !params.shareId;

  if (shouldRedirectToDrive) {
    const shareId = driveCache?.getRootShareId();
    if (shareId) {
      return <Navigate to={`/u/${shareId}`} replace />;
    }
  }

  // If drive cache isn't ready but we need it, show loading
  const isDriveLoading =
    redirectToDrive &&
    (!driveCache?.isInitialized || !driveCache?.getRootShareId());

  if (isDriveLoading) {
    return <LoadingIndicator />;
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
