import { Bug, HelpCircle, LogOut, UserCog } from "lucide-react";

interface UserMenuModalProps {
  user: Partial<User>;
  onAccountSettings: () => void;
  onSignOut: () => void;
}

const UserMenuModal: React.FC<UserMenuModalProps> = ({
  user,
  onAccountSettings,
  onSignOut,
}) => {
  return (
    <div
      className="absolute top-full right-0  w-80 bg-white dark:bg-[#0e0d12] rounded-xl shadow-lg border border-slate-200/50 dark:border-[#343140] z-[9999]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b border-slate-200/50 dark:border-[#343140]">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500
              dark:from-emerald-600 dark:to-blue-700 flex items-center justify-center text-white text-lg font-semibold"
          >
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {(user?.username?.charAt(0).toUpperCase() || "") +
                (user?.username?.slice(1) || "")}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      <div className="py-2">
        <button
          onClick={onAccountSettings}
          className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-[#343140] transition-colors cursor-pointer"
        >
          <UserCog className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-800 dark:text-white">
            Account Settings
          </span>
        </button>

        <button
          onClick={onSignOut}
          className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-[#343140] transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5 text-red-500" />
          <span className="text-sm text-red-600">Sign Out</span>
        </button>
      </div>

      <div className="border-t border-slate-200/50 dark:border-[#343140] py-2">
        <button className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-[#343140] transition-colors cursor-pointer">
          <HelpCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-800 dark:text-white">Help</span>
        </button>

        <button className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-[#343140] transition-colors cursor-pointer">
          <Bug className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-800 dark:text-white">
            Report a Problem
          </span>
        </button>
      </div>
    </div>
  );
};
export default UserMenuModal;
