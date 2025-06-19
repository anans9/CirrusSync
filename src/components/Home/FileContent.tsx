import { useState, useEffect } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { UnsupportedFileView } from "./Preview";

interface FileContentProps {
  data: Uint8Array | null;
  name: string;
  size: number;
  currentItem: FileDetails;
  downloadItem: (id: string) => void;
}

export const FileContent: React.FC<FileContentProps> = ({
  data,
  name,
  size,
  currentItem,
  downloadItem,
}) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isTextFile =
    /\.(txt|md|json|csv|xml|html|css|js|ts|jsx|tsx|yml|yaml|conf|ini|log|pem|env|sh)$/i.test(
      name
    );
  const isCodeFile = /\.(py|java|cpp|c|cs|go|rb|php|swift|kt|rs|sql)$/i.test(
    name
  );

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopied(false);
    }
  };

  useEffect(() => {
    const processContent = async () => {
      try {
        setLoading(true);
        if (!data) {
          setError("No data available");
          return;
        }
        if ((isTextFile || isCodeFile) && size < 5 * 1024 * 1024) {
          const decoder = new TextDecoder("utf-8");
          const text = decoder.decode(data);
          setContent(text);
        }
      } catch (err) {
        setError("Failed to decode file content");
      } finally {
        setLoading(false);
      }
    };
    processContent();
  }, [data, size, isTextFile, isCodeFile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[90vh] bg-gray-50 dark:bg-[#121117]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <UnsupportedFileView
        currentItem={currentItem}
        downloadItem={downloadItem}
      />
    );
  }

  if (!isTextFile && !isCodeFile) {
    return (
      <UnsupportedFileView
        currentItem={currentItem}
        downloadItem={downloadItem}
      />
    );
  }

  return (
    <div className="h-[80vh] w-[100vh] flex flex-col bg-white dark:bg-[#121117] border border-slate-200/50 dark:border-[#343140] rounded shadow-lg">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-[#1c1b23] z-10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({(size / 1024).toFixed(1)} KB)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyContent}
            className="p-2 hover:bg-gray-100 dark:hover:bg-[#2c2934] rounded-lg transition-colors"
            title="Copy content"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            )}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-white dark:bg-[#121117]">
        <pre className="p-6 text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          <code className="block min-w-full">{content}</code>
        </pre>
      </div>
    </div>
  );
};