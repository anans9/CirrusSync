interface SwitchProps {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export const Switch = ({
  enabled,
  onChange,
  disabled = false,
}: SwitchProps) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      disabled
        ? "opacity-60 cursor-not-allowed bg-slate-200 dark:bg-[#343140]"
        : "cursor-pointer " +
          (enabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-[#343140]")
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        enabled ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);
