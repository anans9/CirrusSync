<div align="center">
  <h1>🌩️ CirrusSync</h1>
  <p><strong>Secure Cloud Storage with End-to-End Encryption</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Tauri-2.0-blue?style=flat-square&logo=tauri" alt="Tauri">
    <img src="https://img.shields.io/badge/React-19.1.0-61dafb?style=flat-square&logo=react" alt="React">
    <img src="https://img.shields.io/badge/TypeScript-5.6.2-3178c6?style=flat-square&logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/Rust-2024-ce422b?style=flat-square&logo=rust" alt="Rust">
    <img src="https://img.shields.io/badge/Vite-6.0.3-646cff?style=flat-square&logo=vite" alt="Vite">
  </p>
</div>

## 📋 Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Security](#security)
- [API Integration](#api-integration)
- [Contributing](#contributing)
- [License](#license)

## 🚀 About

CirrusSync is a secure, cross-platform cloud storage application that prioritizes user privacy through end-to-end encryption. Built with Tauri, it combines the performance of Rust with the flexibility of modern web technologies to deliver a native desktop experience.

### Key Highlights

- **Zero-Knowledge Architecture**: Your files are encrypted before they leave your device
- **Cross-Platform**: Native desktop app for Windows, macOS, and Linux
- **Modern UI**: Clean, responsive interface with dark/light theme support
- **Secure Sharing**: Share files and folders with advanced permission controls
- **Offline Access**: Access your files even when offline
- **Performance**: Built with Rust for optimal speed and memory efficiency

## ✨ Features

### Core Functionality
- 🔐 **End-to-End Encryption** - AES-256-GCM encryption with client-side key derivation
- 📁 **File Management** - Upload, download, organize files and folders
- 🗑️ **Trash System** - Safely delete and restore files
- 🔗 **Secure Sharing** - Share files with expiration dates and access controls
- 👥 **Collaboration** - Share files and folders with other users

### User Experience
- 🎨 **Dark/Light Theme** - Seamless theme switching
- 📱 **Responsive Design** - Optimized for different screen sizes
- ⚡ **Real-time Updates** - Instant file synchronization
- 📊 **Storage Analytics** - Monitor storage usage and file statistics
- 🎯 **Drag & Drop** - Intuitive file upload experience

### Security & Privacy
- 🔑 **BIP39 Seed Phrases** - Secure key generation and recovery
- 🛡️ **Zero-Knowledge** - Server never sees your unencrypted data
- 🔒 **Secure Authentication** - Multi-factor authentication support
- 📧 **Email Verification** - Secure account verification process
- 🔐 **Password Recovery** - Secure password reset functionality

### Integration
- 💳 **Stripe Integration** - Secure payment processing
- 🔌 **Plugin Architecture** - Extensible with Tauri plugins
- 🌐 **Cross-Origin Security** - Comprehensive CSP and CORS policies

## 🛠️ Tech Stack

### Frontend
- **React 19.1.0** - Modern React with latest features
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS 4.0** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **React Router** - Client-side routing
- **Lucide React** - Beautiful icon library

### Backend
- **Tauri 2.0** - Rust-based desktop app framework
- **Rust** - Systems programming language for performance
- **Tokio** - Asynchronous runtime for Rust
- **Serde** - Serialization/deserialization framework
- **Reqwest** - HTTP client for Rust

### Security & Encryption
- **AES-GCM** - Authenticated encryption
- **OpenPGP** - Public key cryptography
- **Argon2** - Password hashing
- **BIP39** - Mnemonic seed phrase generation
- **SHA2** - Cryptographic hash functions

### External Services
- **Stripe** - Payment processing
- **Custom API** - Backend services for sync and sharing

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Rust** (latest stable) - [Install](https://rustup.rs/)
- **Git** - [Download](https://git-scm.com/)

### Platform-Specific Requirements

#### Windows
- **Microsoft Visual Studio C++ Build Tools** or **Visual Studio 2022**
- **Windows 10 SDK**

#### macOS
- **Xcode Command Line Tools**
```bash
xcode-select --install
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

#### Linux (Fedora)
```bash
sudo dnf install webkit2gtk4.0-devel \
    openssl-devel \
    curl \
    wget \
    file \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

## 🚀 Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/CirrusSync.git
cd CirrusSync
```

2. **Install dependencies**
```bash
npm install
```

3. **Install Rust dependencies**
```bash
cd src-tauri
cargo fetch
cd ..
```

4. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

## 🔧 Development

### Start Development Server

```bash
# Start the development server
npm run dev

# Or use Tauri's development command
npm run tauri dev
```

This will:
- Start the Vite development server on `http://localhost:1420`
- Launch the Tauri desktop application
- Enable hot-reload for both frontend and backend changes

### Available Scripts

```bash
# Frontend development
npm run dev          # Start Vite dev server
npm run build        # Build frontend for production
npm run preview      # Preview production build

# Tauri commands
npm run tauri dev    # Start Tauri development
npm run tauri build  # Build production app
npm run tauri info   # Show Tauri info
```

### Development Tools

- **DevTools**: Enabled in development mode (`F12` to open)
- **Hot Reload**: Automatic reload on file changes
- **Type Checking**: Real-time TypeScript error checking
- **Linting**: ESLint integration for code quality

## 📦 Building for Production

### Build for Current Platform

```bash
npm run tauri build
```

### Build for Specific Platforms

```bash
# Build for Windows
npm run tauri build -- --target x86_64-pc-windows-msvc

# Build for macOS
npm run tauri build -- --target x86_64-apple-darwin
npm run tauri build -- --target aarch64-apple-darwin

# Build for Linux
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

### Build Artifacts

Built applications will be available in:
- `src-tauri/target/release/bundle/`
- Platform-specific installers (`.msi`, `.dmg`, `.deb`, `.AppImage`)

## 📁 Project Structure

```
CirrusSync/
├── public/                 # Static assets
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── context/           # React context providers
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page components
│   ├── services/          # API services
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # Application entry point
│   └── global.css         # Global styles
├── src-tauri/             # Tauri backend
│   ├── src/               # Rust source code
│   ├── icons/             # Application icons
│   ├── capabilities/      # Tauri capabilities
│   ├── Cargo.toml         # Rust dependencies
│   ├── tauri.conf.json    # Tauri configuration
│   └── build.rs           # Build script
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
└── tailwind.config.js     # Tailwind CSS configuration
```

### Key Directories

- **`src/components/`** - Reusable UI components
- **`src/pages/`** - Application pages and routes
- **`src/context/`** - Global state management
- **`src/services/`** - API integration and external services
- **`src-tauri/src/`** - Rust backend logic and native APIs

## 🔒 Security

CirrusSync implements multiple layers of security:

### Encryption
- **Client-Side Encryption**: All files encrypted before upload
- **AES-256-GCM**: Industry-standard authenticated encryption
- **Key Derivation**: Secure key generation using Argon2
- **Zero-Knowledge**: Server never accesses unencrypted data

### Authentication
- **Secure Session Management**: JWT-based authentication
- **Password Hashing**: Argon2 for password storage
- **Email Verification**: Secure account verification
- **Multi-Factor Authentication**: Additional security layer

### Application Security
- **Content Security Policy**: Strict CSP headers
- **CORS Protection**: Comprehensive cross-origin policies
- **Input Validation**: Sanitization of all user inputs
- **Secure Storage**: Encrypted local storage

### Privacy
- **Minimal Data Collection**: Only essential data is collected
- **GDPR Compliant**: Respects user privacy rights
- **Audit Logs**: Comprehensive activity logging
- **Data Portability**: Export your data anytime

## 🔌 API Integration

### Stripe Integration
```typescript
// Configure Stripe
const stripePromise = loadStripe(process.env.STRIPE_PUBLISHABLE_KEY);

// Usage in components
<Elements stripe={stripePromise}>
  <PaymentForm />
</Elements>
```

### Backend API
```typescript
// API service example
import { invoke } from '@tauri-apps/api/tauri';

export const uploadFile = async (file: File) => {
  return await invoke('upload_file', { file });
};
```

### Tauri Commands
```rust
// Rust backend command
#[tauri::command]
async fn upload_file(file: FileData) -> Result<UploadResponse, String> {
    // Implementation
}
```

## 🤝 Contributing

We welcome contributions to CirrusSync! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Test thoroughly**
   ```bash
   npm run test
   npm run tauri build
   ```
5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Code Style

- **TypeScript**: Follow strict TypeScript patterns
- **Rust**: Use `cargo fmt` and `cargo clippy`
- **React**: Follow React best practices and hooks patterns
- **CSS**: Use Tailwind CSS utilities, avoid custom CSS when possible

### Testing

- Write unit tests for new features
- Test on multiple platforms before submitting
- Ensure security features work correctly
- Verify encryption/decryption processes

### Documentation

- Update README for new features
- Add JSDoc comments for complex functions
- Document API changes
- Include examples for new functionality

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - For the amazing desktop app framework
- [React](https://reactjs.org/) - For the robust frontend framework
- [Rust](https://www.rust-lang.org/) - For the performance and safety
- [Tailwind CSS](https://tailwindcss.com/) - For the utility-first CSS framework
- [Stripe](https://stripe.com/) - For secure payment processing

## 📞 Support

- **Documentation**: [docs.cirrussync.me](https://docs.cirrussync.me)
- **Issues**: [GitHub Issues](https://github.com/yourusername/CirrusSync/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/CirrusSync/discussions)
- **Email**: support@cirrussync.me

---

<div align="center">
  <p>
    <a href="https://cirrussync.me">Website</a> •
    <a href="https://docs.cirrussync.me">Documentation</a> •
    <a href="https://github.com/anans9/CirrusSync">Source Code</a>
  </p>
</div>
