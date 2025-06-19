# Contributing to CirrusSync

First off, thank you for considering contributing to CirrusSync! 🎉

CirrusSync is a secure cloud storage application that prioritizes user privacy through end-to-end encryption. We welcome contributions from the community to help make CirrusSync better for everyone.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Security Considerations](#security-considerations)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Community](#community)

## 🤝 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

### Our Pledge

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Prioritize user privacy and security
- Maintain professional communication

## 🛠️ How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/anans9/CirrusSync/issues) to avoid duplicates.

**Great Bug Reports Include:**
- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs. actual behavior
- Screenshots or videos (if applicable)
- Environment details (OS, version, etc.)
- Error logs or console output

Use the bug report template:

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
What you expected to happen.

**Environment:**
- OS: [e.g., Windows 11, macOS 13, Ubuntu 22.04]
- CirrusSync Version: [e.g., 0.1.0]
- Browser (if applicable): [e.g., Chrome 120]

**Additional context**
Any other context about the problem.
```

### 💡 Suggesting Features

We love feature suggestions! Please:

1. Check if the feature already exists or is planned
2. Consider if it aligns with CirrusSync's security-first philosophy
3. Provide detailed use cases and examples
4. Consider implementation complexity and user impact

### 🔧 Code Contributions

We welcome code contributions! Areas where we especially need help:

- **Frontend Components**: React components and UI improvements
- **Backend Features**: Rust backend functionality
- **Security Enhancements**: Encryption, authentication improvements
- **Cross-Platform Support**: Platform-specific features
- **Performance Optimizations**: Speed and memory improvements
- **Documentation**: Code comments, user guides, API docs
- **Testing**: Unit tests, integration tests, E2E tests

## 🚀 Development Setup

### Prerequisites

Ensure you have the required tools installed:

- **Node.js** (v18+)
- **Rust** (latest stable)
- **Git**
- Platform-specific dependencies (see README.md)

### Quick Start

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/CirrusSync.git
   cd CirrusSync
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd src-tauri && cargo fetch && cd ..
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Development**
   ```bash
   npm run tauri dev
   ```

### Docker Development

For a consistent development environment:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Run with specific profiles
docker-compose -f docker-compose.dev.yml --profile tools up
```

## 🔄 Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical production fixes

### Feature Development

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/awesome-feature
   ```

2. **Development Cycle**
   ```bash
   # Make changes
   git add .
   git commit -m "feat: add awesome feature"

   # Keep branch updated
   git fetch origin
   git rebase origin/develop
   ```

3. **Testing**
   ```bash
   # Run all tests
   npm run test
   npm run test:e2e
   cd src-tauri && cargo test

   # Check code quality
   npm run lint
   npm run type-check
   cargo fmt --check
   cargo clippy
   ```

4. **Submit Pull Request**

### Commit Message Guidelines

We follow [Conventional Commits](https://conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Adding/updating tests
- `chore` - Maintenance tasks
- `security` - Security improvements

**Examples:**
```
feat(auth): add multi-factor authentication
fix(upload): resolve file corruption issue
docs(api): update encryption documentation
security(crypto): upgrade AES implementation
```

## 📝 Coding Standards

### TypeScript/React Standards

```typescript
// Use TypeScript strict mode
// Prefer function components with hooks
// Use proper prop types and interfaces

interface ComponentProps {
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
}

const Component: React.FC<ComponentProps> = ({ title, onClose, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Prefer early returns
  if (!title) {
    return null;
  }

  return (
    <div className="component">
      <h1>{title}</h1>
      {children}
    </div>
  );
};
```

### Rust Standards

```rust
// Follow Rust conventions
// Use proper error handling
// Document public APIs

/// Encrypts data using AES-256-GCM
///
/// # Arguments
/// * `data` - The data to encrypt
/// * `key` - The encryption key (32 bytes)
///
/// # Returns
/// * `Result<Vec<u8>, CryptoError>` - Encrypted data or error
pub fn encrypt_data(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, CryptoError> {
    // Implementation
    Ok(encrypted_data)
}

// Use proper error types
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Invalid key length: {0}")]
    InvalidKeyLength(usize),
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
}
```

### CSS/Styling Guidelines

- Use Tailwind CSS utilities primarily
- Follow mobile-first responsive design
- Maintain consistent spacing and colors
- Use CSS custom properties for theme variables

```css
/* Use Tailwind utilities */
.button {
  @apply px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500;
}

/* Custom properties for themes */
:root {
  --color-primary: #3b82f6;
  --color-secondary: #6b7280;
}
```

## 🧪 Testing Guidelines

### Frontend Testing

```typescript
// Unit tests with Jest/React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { Component } from './Component';

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component title="Test" onClose={jest.fn()} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle user interactions', () => {
    const onClose = jest.fn();
    render(<Component title="Test" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

### Backend Testing

```rust
// Unit tests in Rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_data() {
        let data = b"test data";
        let key = [0u8; 32];

        let result = encrypt_data(data, &key);
        assert!(result.is_ok());

        let encrypted = result.unwrap();
        assert_ne!(encrypted, data);
    }

    #[tokio::test]
    async fn test_async_function() {
        let result = async_function().await;
        assert!(result.is_ok());
    }
}
```

### Test Requirements

- **Unit Tests**: Test individual functions/components
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Security Tests**: Test encryption/authentication
- **Performance Tests**: Test with large files/datasets

## 🔒 Security Considerations

Security is paramount in CirrusSync. When contributing:

### Security Guidelines

- **Never log sensitive data** (passwords, keys, personal info)
- **Validate all inputs** on both client and server
- **Use secure defaults** for all configurations
- **Follow OWASP guidelines** for web security
- **Test security features thoroughly**

### Encryption Standards

- Use only approved cryptographic libraries
- Implement proper key derivation (Argon2)
- Use authenticated encryption (AES-GCM)
- Ensure forward secrecy where applicable

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Email security issues to: [security@cirrussync.me](mailto:security@cirrussync.me)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fixes (if any)

## 📚 Documentation

### Code Documentation

```typescript
/**
 * Encrypts file data before upload
 *
 * @param file - The file to encrypt
 * @param userKey - User's encryption key
 * @returns Promise<EncryptedFile> - Encrypted file data
 * @throws {EncryptionError} When encryption fails
 *
 * @example
 * ```typescript
 * const encrypted = await encryptFile(file, userKey);
 * ```
 */
export async function encryptFile(
  file: File,
  userKey: CryptoKey
): Promise<EncryptedFile> {
  // Implementation
}
```

```rust
/// Handles file upload with encryption
///
/// This function takes a file, encrypts it using the user's key,
/// and stores it securely on the server.
///
/// # Arguments
/// * `file_data` - The raw file data
/// * `user_id` - ID of the user uploading
/// * `encryption_key` - User's encryption key
///
/// # Returns
/// * `Result<FileMetadata, UploadError>` - File metadata or error
///
/// # Security
/// This function ensures that file data is encrypted before storage
/// and that the server never has access to the unencrypted content.
#[tauri::command]
pub async fn upload_file(
    file_data: Vec<u8>,
    user_id: String,
    encryption_key: String,
) -> Result<FileMetadata, UploadError> {
    // Implementation
}
```

### User Documentation

- Keep user guides simple and clear
- Include screenshots and examples
- Cover common use cases
- Explain security features clearly

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] No merge conflicts with target branch
- [ ] Security considerations addressed

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Security improvement

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Security testing performed

## Screenshots (if applicable)
Add screenshots of UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console errors/warnings
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests
2. **Code Review**: Maintainers review code quality
3. **Security Review**: Security-related changes get extra scrutiny
4. **Testing**: Changes are tested in development environment
5. **Approval**: At least one maintainer approval required
6. **Merge**: Squash and merge into target branch

## 🐛 Issue Reporting

### Bug Reports

Use the bug report template and include:

- **Environment Details**: OS, version, browser
- **Reproduction Steps**: Clear, numbered steps
- **Expected vs Actual**: What should happen vs what happens
- **Logs/Screenshots**: Relevant error messages or visuals
- **Workarounds**: Any temporary solutions found

### Feature Requests

- **Use Case**: Why is this feature needed?
- **Acceptance Criteria**: What defines "done"?
- **Mockups/Examples**: Visual or code examples
- **Security Impact**: How does this affect security?
- **Priority**: How important is this feature?

### Labels

We use labels to categorize issues:

- `bug` - Something isn't working
- `enhancement` - New feature request
- `security` - Security-related issue
- `help wanted` - Good for new contributors
- `good first issue` - Great for beginners
- `documentation` - Documentation improvements
- `performance` - Performance-related
- `ui/ux` - User interface improvements

## 🌟 Recognition

Contributors are recognized in:

- **README.md**: Major contributors listed
- **CHANGELOG.md**: Contributions noted in releases
- **GitHub**: Contributor graphs and statistics
- **Discord**: Special contributor roles

## 💬 Community

### Communication Channels

- **GitHub Discussions**: General discussions, Q&A
- **GitHub Issues**: Bug reports, feature requests
- **Discord**: Real-time chat, development coordination
- **Email**: Direct contact for sensitive issues

### Community Guidelines

- **Be Respectful**: Treat everyone with respect
- **Be Patient**: Help newcomers learn
- **Be Constructive**: Provide helpful feedback
- **Stay On Topic**: Keep discussions relevant
- **Follow Guidelines**: Adhere to community standards

## 🎯 Getting Started

### For New Contributors

1. **Start Small**: Look for `good first issue` labels
2. **Ask Questions**: Don't hesitate to ask for help
3. **Read Documentation**: Familiarize yourself with the codebase
4. **Join Community**: Connect with other contributors
5. **Follow Process**: Use the established workflow

### Mentorship

Experienced contributors mentor newcomers:

- **Code Reviews**: Detailed feedback on PRs
- **Pair Programming**: Direct collaboration
- **Q&A Sessions**: Regular community calls
- **Documentation**: Comprehensive guides and examples
---

Thank you for contributing to CirrusSync! Together, we're building a more secure and private way to store and share files. 🚀

*This document is living and will be updated as the project evolves. Last updated: January 2024*
