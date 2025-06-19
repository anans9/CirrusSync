import { memo } from "react";

interface CustomCheckBoxProps {
  checked: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export const CustomCheckBox: React.FC<CustomCheckBoxProps> = memo(
  ({ checked, onChange, className = "" }) => {
    return (
      <button
        onClick={() =>
          onChange &&
          onChange({
            target: { checked: !checked },
          } as React.ChangeEvent<HTMLInputElement>)
        }
        className={`w-5 h-5 rounded flex items-center justify-center
        border-slate-600 dark:border-slate-300 cursor-pointer
        ${
          checked
            ? "bg-emerald-400 dark:bg-emerald-500 border-emerald-500 dark:border-emerald-400"
            : "border bg-transparent hover:border-emerald-500 hover:dark:border-emerald-400"
        }
        transition-all duration-200
        ${className}`}
      >
        {checked && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    );
  },
);
