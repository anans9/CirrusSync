import {
  FileSpreadsheet,
  FileImage,
  FileText,
  File,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCog,
  Mail,
  Database,
  Package,
  PlayCircle,
  Image as ImageIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import CirrusSync from "../assets/logo.svg";

export const FILE_TYPES = {
  IMAGE: [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "tiff",
    "webp",
    "heic",
    "heif",
    "raw",
    "cr2",
    "nef",
    "arw",
    "dng",
    "raf",
    "svg",
    "ai",
    "psd",
    "xcf",
  ],
  VIDEO: [
    "mp4",
    "mov",
    "avi",
    "wmv",
    "flv",
    "mkv",
    "webm",
    "3gp",
    "m4v",
    "mpeg",
    "mpg",
    "qt",
    "asf",
    "ogv",
    "rm",
    "vob",
    "m2ts",
    "mts",
  ],
  AUDIO: [
    "mp3",
    "wav",
    "ogg",
    "wma",
    "aac",
    "flac",
    "m4a",
    "opus",
    "aiff",
    "alac",
    "mid",
    "midi",
    "amr",
    "ape",
    "wv",
    "mka",
  ],
  DOCUMENT: [
    "doc",
    "docx",
    "odt",
    "rtf",
    "txt",
    "pdf",
    "epub",
    "mobi",
    "azw",
    "azw3",
    "djvu",
    "pages",
    "tex",
    "wpd",
    "wps",
  ],
  SPREADSHEET: [
    "xls",
    "xlsx",
    "csv",
    "ods",
    "numbers",
    "xlsm",
    "xltx",
    "xltm",
    "xlsb",
    "tsv",
  ],
  PRESENTATION: [
    "ppt",
    "pptx",
    "odp",
    "key",
    "pps",
    "ppsx",
    "pptm",
    "potx",
    "potm",
    "sldx",
    "sldm",
  ],
  ARCHIVE: [
    "zip",
    "rar",
    "7z",
    "tar",
    "gz",
    "bz2",
    "xz",
    "iso",
    "dmg",
    "tgz",
    "tbz",
    "z",
    "lz",
    "tlz",
    "txz",
    "cab",
  ],
  CODE: [
    "py",
    "js",
    "jsx",
    "ts",
    "tsx",
    "html",
    "css",
    "php",
    "java",
    "cpp",
    "c",
    "cs",
  ],
  CONFIG: [
    "json",
    "xml",
    "yaml",
    "yml",
    "ini",
    "conf",
    "config",
    "env",
    "cfg",
    "toml",
  ],
  EMAIL: ["eml", "msg", "ics", "vcf", "emlx"],
  DATABASE: ["db", "sql", "sqlite", "mdb", "accdb", "dbf", "mdf"],
  FONT: ["ttf", "otf", "woff", "woff2", "eot", "pfm", "pfb"],
  THREED: ["obj", "fbx", "blend", "3ds", "c4d", "max", "ma", "mb"],
  MOBILE: ["ipa", "apk", "aab", "xapk"],
} as const;

export const ICON_COLORS = {
  image: "text-purple-500",
  video: "text-pink-500",
  audio: "text-green-500",
  document: "text-blue-500",
  spreadsheet: "text-emerald-500",
  presentation: "text-orange-500",
  archive: "text-yellow-500",
  code: "text-cyan-500",
  config: "text-gray-500",
  email: "text-indigo-500",
  database: "text-red-500",
  font: "text-violet-500",
  threed: "text-amber-500",
  mobile: "text-lime-500",
  default: "text-gray-400",
} as const;

export type FileTypes = typeof FILE_TYPES;
export type FileCategory = keyof typeof FILE_TYPES;
export type FileExtension = (typeof FILE_TYPES)[FileCategory][number];
export type IconColor = (typeof ICON_COLORS)[keyof typeof ICON_COLORS];

interface FileIconProps {
  filename: string;
  size?: "small" | "large";
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  className?: string;
}

interface ThumbnailProps {
  url: string;
  type: "image" | "video" | "pdf";
  className?: string;
  size?: "small" | "large";
}

export const getFileTypeCategory = (extension: string): FileCategory => {
  const ext = extension.toLowerCase();

  const entries = Object.entries(FILE_TYPES) as [
    FileCategory,
    readonly string[],
  ][];

  for (const [category, extensions] of entries) {
    if (extensions.includes(ext)) {
      return category;
    }
  }

  return "CODE";
};

const Thumbnail: React.FC<ThumbnailProps> = ({
  url,
  type,
  className,
  size,
}) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadThumbnail = async () => {
      try {
        setThumbnail(url);
      } catch (err) {
        setError(true);
      }
    };

    loadThumbnail();
  }, [url, type]);

  if (error || !thumbnail) {
    return type === "video" ? (
      <PlayCircle className={className} />
    ) : (
      <ImageIcon className={className} />
    );
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <img
        src={thumbnail}
        alt="thumbnail"
        className={`bg-white w-full h-full object-cover ${
          size === "small" ? "rounded" : "rounded-t-lg"
        }`}
      />
      {type === "video" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <PlayCircle className="w-8 h-8 text-white" />
        </div>
      )}
    </div>
  );
};

export const FileIcon: React.FC<FileIconProps> = ({
  filename,
  size = "large",
  url,
  thumbnailUrl,
  className = "",
}) => {
  const extension = filename?.split(".").pop()?.toLowerCase() || "";
  const iconSize = size === "small" ? "w-6 h-6" : "w-12 h-12";
  const fullClassName = `${iconSize} ${className}`;

  const category = getFileTypeCategory(extension);
  const colorKey = category.toLowerCase() as keyof typeof ICON_COLORS;
  const color = ICON_COLORS[colorKey] || ICON_COLORS.default;

  if (thumbnailUrl || url) {
    if (
      category === "IMAGE" ||
      category === "VIDEO" ||
      (category === "DOCUMENT" && extension === "pdf")
    ) {
      return (
        <Thumbnail
          url={thumbnailUrl || url || ""}
          type={
            category === "IMAGE"
              ? "image"
              : category === "VIDEO"
                ? "video"
                : "pdf"
          }
          className={fullClassName}
          size={size}
        />
      );
    }
  }

  const codeIcons: Record<string, React.JSX.Element> = {
    py: <Package className={`${fullClassName} ${color}`} />,
    js: <File className={`${fullClassName} ${color}`} />,
    jsx: <File className={`${fullClassName} ${color}`} />,
    ts: <File className={`${fullClassName} ${color}`} />,
    tsx: <File className={`${fullClassName} ${color}`} />,
  };

  if (extension in codeIcons) {
    return codeIcons[extension];
  }

  switch (category) {
    case "IMAGE":
      return <FileImage className={`${fullClassName} ${color}`} />;
    case "VIDEO":
      return <FileVideo className={`${fullClassName} ${color}`} />;
    case "AUDIO":
      return <FileAudio className={`${fullClassName} ${color}`} />;
    case "DOCUMENT":
      return <FileText className={`${fullClassName} ${color}`} />;
    case "SPREADSHEET":
      return <FileSpreadsheet className={`${fullClassName} ${color}`} />;
    case "PRESENTATION":
      return <FileText className={`${fullClassName} ${color}`} />;
    case "ARCHIVE":
      return <FileArchive className={`${fullClassName} ${color}`} />;
    case "CODE":
    case "CONFIG":
      return <FileCog className={`${fullClassName} ${color}`} />;
    case "EMAIL":
      return <Mail className={`${fullClassName} ${color}`} />;
    case "DATABASE":
      return <Database className={`${fullClassName} ${color}`} />;
    case "FONT":
      return <FileText className={`${fullClassName} ${color}`} />;
    case "THREED":
    case "MOBILE":
      return <Package className={`${fullClassName} ${color}`} />;
    default:
      return <File className={`${fullClassName} ${ICON_COLORS.default}`} />;
  }
};

export const PythonIcon = ({
  className = "w-12 h-12",
}: {
  className?: string;
}) => (
  <svg
    className={className}
    viewBox="0 0 256 255"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid"
  >
    <defs>
      <linearGradient
        x1="12.959%"
        y1="12.039%"
        x2="79.639%"
        y2="78.201%"
        id="python-a"
      >
        <stop stopColor="#387EB8" offset="0%" />
        <stop stopColor="#366994" offset="100%" />
      </linearGradient>
      <linearGradient
        x1="19.128%"
        y1="20.579%"
        x2="90.742%"
        y2="88.429%"
        id="python-b"
      >
        <stop stopColor="#FFE052" offset="0%" />
        <stop stopColor="#FFC331" offset="100%" />
      </linearGradient>
    </defs>
    <path
      d="M126.916.072c-64.832 0-60.784 28.115-60.784 28.115l.072 29.128h61.868v8.745H41.631S.145 61.355.145 126.77c0 65.417 36.21 63.097 36.21 63.097h21.61v-30.356s-1.165-36.21 35.632-36.21h61.362s34.475.557 34.475-33.319V33.97S194.67.072 126.916.072zM92.802 19.66a11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13 11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.13z"
      fill="url(#python-a)"
    />
    <path
      d="M128.757 254.126c64.832 0 60.784-28.115 60.784-28.115l-.072-29.127H127.6v-8.745h86.441s41.486 4.705 41.486-60.712c0-65.416-36.21-63.096-36.21-63.096h-21.61v30.355s1.165 36.21-35.632 36.21h-61.362s-34.475-.557-34.475 33.32v56.013s-5.235 33.897 62.518 33.897zm34.114-19.586a11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.131 11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13z"
      fill="url(#python-b)"
    />
  </svg>
);

export const JavaScriptIcon = ({
  className = "w-12 h-12",
}: {
  className?: string;
}) => (
  <svg
    className={className}
    viewBox="0 0 256 256"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid"
  >
    <path d="M0 0h256v256H0V0z" fill="#F7DF1E" />
    <path
      d="M67.312 213.932l19.59-11.856c3.78 6.701 7.218 12.371 15.465 12.371 7.905 0 12.89-3.092 12.89-15.12v-81.798h24.057v82.138c0 24.917-14.606 36.259-35.916 36.259-19.245 0-30.416-9.967-36.087-21.996M152.381 211.354l19.588-11.341c5.157 8.421 11.859 14.607 23.715 14.607 9.969 0 16.325-4.984 16.325-11.858 0-8.248-6.53-11.17-17.528-15.98l-6.013-2.58c-17.357-7.387-28.87-16.667-28.87-36.257 0-18.044 13.747-31.792 35.228-31.792 15.294 0 26.292 5.328 34.196 19.247L210.29 147.43c-4.125-7.389-8.591-10.31-15.465-10.31-7.046 0-11.514 4.468-11.514 10.31 0 7.217 4.468 10.14 14.778 14.608l6.014 2.577c20.45 8.765 31.963 17.7 31.963 37.804 0 21.654-17.012 33.51-39.867 33.51-22.339 0-36.774-10.654-43.819-24.574"
      fill="#000000"
    />
  </svg>
);

export const TypeScriptIcon = ({
  className = "w-12 h-12",
}: {
  className?: string;
}) => (
  <svg
    className={className}
    viewBox="0 0 256 256"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid"
  >
    <rect width="256" height="256" rx="0" ry="0" fill="#3178C6" />
    <path
      d="M56.611 128.85l-.081 10.483h33.32v94.68H113.42v-94.68h33.32v-10.28c0-5.69-.122-10.444-.284-10.566-.122-.162-20.399-.244-44.983-.203l-44.739.122-.122 10.443zm149.955-10.742c6.501 1.625 11.459 4.51 16.01 9.224 2.357 2.52 5.851 7.112 6.136 8.209.08.325-11.053 7.802-17.798 11.987-.244.163-1.22-.894-2.317-2.52-3.291-4.794-6.745-6.867-12.028-7.232-7.76-.529-12.759 3.535-12.718 10.32 0 1.992.284 3.17 1.097 4.795 1.707 3.536 4.876 5.649 14.832 9.956 18.326 7.883 26.168 13.084 31.045 20.48 5.445 8.249 6.664 21.415 2.966 31.208-4.063 10.646-14.14 17.88-28.323 20.277-4.388.772-14.79.65-19.504-.203-10.28-1.829-20.033-6.908-26.047-13.572-2.357-2.601-6.949-9.387-6.664-9.875.122-.162 1.178-.812 2.356-1.503 1.138-.65 5.446-3.13 9.509-5.485l7.355-4.267 1.544 2.276c2.154 3.291 6.867 7.802 9.712 9.305 8.167 4.308 19.383 3.698 24.909-1.26 2.357-2.153 3.332-4.388 3.332-7.68 0-2.966-.366-4.266-1.91-6.5-1.99-2.845-6.054-5.242-17.595-10.24-13.206-5.69-18.895-9.225-24.096-14.833-3.007-3.25-5.852-8.452-7.03-12.8-.975-3.616-1.22-12.678-.447-16.335 2.723-12.76 12.353-21.658 26.25-24.3 4.51-.853 14.994-.528 19.424.569z"
      fill="#FFFFFF"
    />
  </svg>
);

export const PdfIcon = ({
  className = "w-10 h-10",
}: {
  className?: string;
}) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    fillOpacity="0.1"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" />

    <path d="M14 2V8H20" />

    <path
      d="M10.5 13.5C10.5 13.5 11.5 12.5 13 12.5C14.5 12.5 15.5 13.5 15.5 13.5"
      strokeWidth="1"
    />
    <path d="M8.5 11.5V15.5" strokeWidth="1" />
    <path d="M16.5 11.5V15.5" strokeWidth="1" />
  </svg>
);

export const FolderIcon = ({
  className = "w-12 h-12",
}: {
  className?: string;
}) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 5h-8.586L9.707 3.293A.997.997 0 0 0 9 3H4c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V7c0-1.103-.897-2-2-2z" />
  </svg>
);

export const Logo = () => (
  <div className="flex items-center justify-center">
    {/* <div className="inline-flex items-center bg-gradient-to-br from-emerald-400 to-blue-500 p-1.5 rounded-lg shadow-md">
      <Folder className="w-4 h-4 text-white" />
    </div> */}
    <img src={CirrusSync} alt="CirrusSync" className="w-12 h-12" />
    <div className="text-xl font-semibold ml-2">
      <span className="text-gray-800 dark:text-white">Cirrus</span>
      <span className="bg-gradient-to-r from-emerald-500 to-blue-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
        Sync
      </span>
    </div>
  </div>
);

export const CloudStorageIllustration = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 400 500"
    className="w-full h-auto"
  >
    <defs>
      <linearGradient id="cloudGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#34d399" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
      </filter>

      {/* Animation definitions */}
      <animate
        xlinkHref="#backgroundCircle1"
        attributeName="r"
        values="180;185;180"
        dur="4s"
        repeatCount="indefinite"
      />
      <animate
        xlinkHref="#backgroundCircle2"
        attributeName="r"
        values="140;145;140"
        dur="4s"
        repeatCount="indefinite"
        begin="1s"
      />
    </defs>

    <circle
      id="backgroundCircle1"
      cx="200"
      cy="250"
      r="180"
      fill="url(#bgGradient)"
      opacity="0.3"
      className="animate-pulse"
    >
      <animate
        attributeName="opacity"
        values="0.3;0.4;0.3"
        dur="4s"
        repeatCount="indefinite"
      />
    </circle>
    <circle
      id="backgroundCircle2"
      cx="200"
      cy="250"
      r="140"
      fill="url(#bgGradient)"
      opacity="0.2"
      className="animate-pulse"
    >
      <animate
        attributeName="opacity"
        values="0.2;0.3;0.2"
        dur="4s"
        repeatCount="indefinite"
        begin="1s"
      />
    </circle>

    <g filter="url(#glow)" className="animate-pulse">
      <path
        d="M120,220 C100,220 80,240 80,270 C80,300 100,320 130,320 L270,320 C300,320 320,300 320,270 C320,240 300,220 280,220 C280,180 250,150 210,150 C170,150 140,180 140,220 C140,220 130,220 120,220"
        fill="url(#cloudGradient)"
        stroke="#34d399"
        strokeWidth="2"
        opacity="0.9"
      >
        <animate
          attributeName="d"
          dur="6s"
          repeatCount="indefinite"
          values="
            M120,220 C100,220 80,240 80,270 C80,300 100,320 130,320 L270,320 C300,320 320,300 320,270 C320,240 300,220 280,220 C280,180 250,150 210,150 C170,150 140,180 140,220 C140,220 130,220 120,220;
            M120,225 C100,225 80,245 80,275 C80,305 100,325 130,325 L270,325 C300,325 320,305 320,275 C320,245 300,225 280,225 C280,185 250,155 210,155 C170,155 140,185 140,225 C140,225 130,225 120,225;
            M120,220 C100,220 80,240 80,270 C80,300 100,320 130,320 L270,320 C300,320 320,300 320,270 C320,240 300,220 280,220 C280,180 250,150 210,150 C170,150 140,180 140,220 C140,220 130,220 120,220"
          calcMode="spline"
          keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
        />
      </path>
    </g>

    <g
      className="animate-bounce-slow"
      style={{ transformOrigin: "180px 220px" }}
    >
      <g transform="translate(160, 210)">
        <rect
          x="0"
          y="0"
          width="40"
          height="50"
          rx="5"
          fill="#34d399"
          opacity="0.8"
        >
          <animate
            attributeName="opacity"
            values="0.8;0.9;0.8"
            dur="3s"
            repeatCount="indefinite"
          />
        </rect>
        <rect
          x="5"
          y="10"
          width="30"
          height="4"
          rx="2"
          fill="white"
          opacity="0.6"
        />
        <rect
          x="5"
          y="20"
          width="20"
          height="4"
          rx="2"
          fill="white"
          opacity="0.6"
        />
      </g>
    </g>

    <g
      className="animate-bounce-slow"
      style={{ transformOrigin: "220px 200px", animationDelay: "0.5s" }}
    >
      <g transform="translate(200, 190)">
        <rect
          x="0"
          y="0"
          width="40"
          height="50"
          rx="5"
          fill="#3b82f6"
          opacity="0.8"
        >
          <animate
            attributeName="opacity"
            values="0.8;0.9;0.8"
            dur="3s"
            repeatCount="indefinite"
            begin="0.5s"
          />
        </rect>
        <rect
          x="5"
          y="10"
          width="30"
          height="4"
          rx="2"
          fill="white"
          opacity="0.6"
        />
        <rect
          x="5"
          y="20"
          width="20"
          height="4"
          rx="2"
          fill="white"
          opacity="0.6"
        />
      </g>
    </g>

    <g
      className="animate-bounce-slow"
      style={{ transformOrigin: "180px 230px", animationDelay: "1s" }}
    >
      <g transform="translate(180, 230)">
        <rect
          x="0"
          y="0"
          width="40"
          height="50"
          rx="5"
          fill="#34d399"
          opacity="0.8"
        >
          <animate
            attributeName="opacity"
            values="0.8;0.9;0.8"
            dur="3s"
            repeatCount="indefinite"
            begin="1s"
          />
        </rect>
        <rect
          x="5"
          y="10"
          width="30"
          height="4"
          rx="2"
          fill="white"
          opacity="0.6"
        />
        <rect
          x="5"
          y="20"
          width="20"
          height="4"
          rx="2"
          fill="white"
          opacity="0.6"
        />
      </g>
    </g>

    {/* Animated Connection Lines */}
    <g opacity="0.2" stroke="url(#cloudGradient)" strokeWidth="1">
      <path d="M180,235 L200,255" className="animate-dash">
        <animate
          attributeName="opacity"
          values="0.2;0.4;0.2"
          dur="3s"
          repeatCount="indefinite"
        />
      </path>
      <path d="M220,215 L200,255" className="animate-dash">
        <animate
          attributeName="opacity"
          values="0.2;0.4;0.2"
          dur="3s"
          repeatCount="indefinite"
          begin="0.5s"
        />
      </path>
    </g>

    <g filter="url(#glow)">
      <circle
        cx="160"
        cy="200"
        r="3"
        fill="#34d399"
        opacity="0.6"
        className="animate-pulse"
      >
        <animate
          attributeName="r"
          values="3;4;3"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx="240"
        cy="200"
        r="3"
        fill="#3b82f6"
        opacity="0.6"
        className="animate-pulse"
      >
        <animate
          attributeName="r"
          values="3;4;3"
          dur="2s"
          repeatCount="indefinite"
          begin="0.5s"
        />
      </circle>
      <circle
        cx="200"
        cy="320"
        r="3"
        fill="#34d399"
        opacity="0.6"
        className="animate-pulse"
      >
        <animate
          attributeName="r"
          values="3;4;3"
          dur="2s"
          repeatCount="indefinite"
          begin="1s"
        />
      </circle>
    </g>

    <circle
      cx="200"
      cy="250"
      r="160"
      stroke="url(#cloudGradient)"
      strokeWidth="1"
      fill="none"
      opacity="0.2"
    >
      <animate
        attributeName="r"
        values="160;165;160"
        dur="4s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0.2;0.3;0.2"
        dur="4s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);
