# How to Run Project Resilient Pulp (Pulp Pulse)

This guide provides step-by-step instructions to set up, start, and run both the **Backend** (FastAPI) and **Frontend** (React + Vite).

---

## 🚀 Quick Start (At a Glance)

Open **two separate terminal windows** from the project root directory (`pulp_pulse`):

### Terminal 1: Backend (FastAPI)
```powershell
# From project root:
python -m backend.app.main
```
> Backend runs at: **`http://127.0.0.1:8000`**  
> Interactive API Documentation: **`http://127.0.0.1:8000/docs`**

---

### Terminal 2: Frontend (React + Vite)
```powershell
# Navigate into frontend folder:
cd frontend
npm install
npm run dev
```
> Frontend runs at: **`http://localhost:5173`**

---

## 📋 Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Python**: Version `3.11` or newer (`python --version`)
- **Node.js**: Version `18.x` or newer (`node --version`)
- **npm**: Version `9.x` or newer (`npm --version`)

---

## 🛠️ Detailed Setup Instructions

### 1. Backend Setup & Startup

The backend is built with FastAPI, SQLAlchemy (SQLite), and LangGraph. On startup, it automatically creates the local SQLite database, loads initial synthetic telemetry data, and seeds the 31 KPI monitoring thresholds.

#### Step 1.1: (Optional but Recommended) Create a Virtual Environment
From the project root:
```powershell
# Create a virtual environment
python -m venv .venv

# Activate on Windows (PowerShell):
.venv\Scripts\Activate.ps1

# (Or Command Prompt):
# .venv\Scripts\activate.bat

# (Or macOS/Linux):
# source .venv/bin/activate
```

#### Step 1.2: Install Backend Dependencies
```powershell
pip install -r backend/requirements.txt
```

#### Step 1.3: Start the Backend Server
```powershell
# From the project root:
python -m backend.app.main
```
Alternatively, you can run directly with Uvicorn:
```powershell
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Step 1.4: Verify the Backend
- **Health Check**: Visit [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) — should return `{"status":"healthy",...}`.
- **Swagger Docs**: Visit [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) to test API endpoints.

---

### 2. Frontend Setup & Startup

The frontend is a React application built with Vite and Tailwind CSS.

> ⚠️ **Important**: `package.json` is located inside the `frontend` folder. You must `cd frontend` before running npm commands.

#### Step 2.1: Navigate into the Frontend Directory
```powershell
cd frontend
```

#### Step 2.2: Install Dependencies
```powershell
npm install
```

#### Step 2.3: Start the Development Server
```powershell
npm run dev
```
- Open [http://localhost:5173](http://localhost:5173) in your browser.
- The Vite dev server proxies API calls and WebSocket connections directly to the backend at `http://127.0.0.1:8000`.

---

## 📦 Production Build & Unified Serving

If you want to serve both frontend and backend together from a single server (port 8000):

1. **Build the Frontend**:
   ```powershell
   cd frontend
   npm run build
   cd ..
   ```
   This generates the production bundle into `frontend/dist/`.

2. **Start the Backend**:
   ```powershell
   python -m backend.app.main
   ```
   FastAPI will automatically serve the built frontend at **`http://127.0.0.1:8000/`**.

---

## 🧪 Running Automated Tests

To run the backend test suite:
```powershell
# From project root:
python -m pytest backend/tests/test_backend.py -v
```

Tests cover:
- Backend health check
- KPI scorecard generation and history drilldowns
- Multi-agent threshold breach detection and alert routing
- 1-click approvals and overrides with rationale
- Depot inventory and commercial freshness clocks (Day 18 / Day 30)
- Inter-depot stock transfers
- End-to-end scenario replay

---

## ❓ Troubleshooting & Common Errors

### 1. `npm error enoent Could not read package.json`
- **Cause**: You ran `npm` from the root folder instead of the `frontend` directory.
- **Fix**: Change into the frontend folder first:
  ```powershell
  cd frontend
  npm run dev
  ```
  Or pass `--prefix`:
  ```powershell
  npm --prefix frontend run dev
  ```

### 2. `Execution of scripts is disabled on this system` (PowerShell)
- **Cause**: PowerShell script execution policy restricts activating virtual environments.
- **Fix**: Run in PowerShell as Administrator:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

### 3. Port 8000 or 5173 is already in use
- **Fix**: Identify and terminate the process holding the port:
  ```powershell
  # Find process using port 8000:
  Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess
  Stop-Process -Id <PID> -Force
  ```
