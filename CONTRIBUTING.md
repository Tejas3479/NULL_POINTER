# Contributing to NULL_POINTER

Thank you for your interest in contributing to the **NULL_POINTER** project! We welcome code contributions, documentation, bug reports, and enhancements.

---

## 🛠️ Local Environment Setup

The codebase consists of a **FastAPI backend** and a **Next.js/TypeScript frontend**.

### Prerequisites
* **Python**: 3.10 or higher
* **Node.js**: v18 or higher (v20+ recommended)
* **Package Manager**: npm or yarn

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the placeholder configuration and set your environment keys:
   ```bash
   cp env.placeholder .env
   ```
5. Spin up the FastAPI server from the repository root:
   ```bash
   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
   Or, if running from within the `backend` directory, define the `PYTHONPATH` path variable before launching:
   ```bash
   # On Windows (PowerShell):
   $env:PYTHONPATH=".."
   python main.py

   # On Linux/macOS:
   PYTHONPATH=.. python main.py
   ```
   The API will be available at `http://localhost:8000`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Launch the Next.js development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to access the console dashboard.

---

## 🧪 Testing & Code Quality

Always verify your changes compile and pass test suites prior to staging a commit.

### Backend Tests
* Run python unit tests:
  ```bash
  pytest backend/tests/
  ```

### Frontend Type Validation
* Verify TypeScript correctness:
  ```bash
  npx tsc --noEmit
  ```
* Run eslint formatting auditor:
  ```bash
  npm run lint
  ```

---

## 📦 Pull Request Process

1. **Create a Branch**: Fork the repo and create your branch from `main`:
   ```bash
   git checkout -b feat/your-awesome-feature
   ```
2. **Commit Standard**: Write clean, descriptive commit messages matching standard conventions:
   * `feat(component): add feature`
   * `fix(module): resolve bug`
   * `style(scope): refine layouts`
   * `docs(readme): update guide`
3. **Submit PR**: Open a pull request against the `main` branch. Ensure the description follows our Pull Request template, referencing any related open issues.
4. **CI Checks**: Ensure all GitHub Actions pipelines pass successfully. A code owner will review your submission shortly!
