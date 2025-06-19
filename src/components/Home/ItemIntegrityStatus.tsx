import { ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

interface ItemIntegrityProps {
  verified: boolean | undefined;
  lastEditedBy: string;
  isVerifying?: boolean;
  item: any;
}

export const ItemIntegrityStatus: React.FC<ItemIntegrityProps> = ({
  verified,
  lastEditedBy,
  isVerifying = false,
  item,
}) => {
  if (isVerifying) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>
          Verifying signature
          <span className="inline-flex">
            <span className="animate-[dot_1.5s_infinite]">.</span>
            <span className="animate-[dot_1.5s_0.5s_infinite]">.</span>
            <span className="animate-[dot_1.5s_1s_infinite]">.</span>
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {verified ? (
        <>
          <CheckCircle2 className="w-6 h-6" />
          <span>
            Digital signature verified. This{" "}
            {item.type === "folder" ? "folder" : "file"} was securely uploaded
            by <span className="text-[14px] font-semibold">{lastEditedBy}</span>
          </span>
        </>
      ) : (
        <>
          <ShieldAlert className="w-6 h-6" />
          <span>
            We couldn't verify the integrity of this{" "}
            {item.type === "folder" ? "folder" : "file"}.
            {lastEditedBy && (
              <>
                {" "}
                Uploaded by <span className="font-bold">{lastEditedBy}</span>
              </>
            )}
          </span>
        </>
      )}
    </div>
  );
};
