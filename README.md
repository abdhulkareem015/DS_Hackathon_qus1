# Electronics Manufacturing Defect Analyzer

A full-stack student project for analyzing production defects in electronics manufacturing.  
Upload a CSV, explore patterns, train a Random Forest classifier, and generate evidence-based insights.

> ⚠️ **Observational data caveat** — All findings describe statistical associations.  
> They suggest areas to investigate, not proven root causes. Controlled trials are required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Recharts |
| Backend | Python 3.x, FastAPI, uvicorn |
| ML | scikit-learn RandomForestClassifier, pandas, NumPy |
| Storage | Local filesystem (modular — MongoDB-ready) |

---

## Prerequisites

- Python 3.10+ (tested on 3.14)
- Node.js 18+ and npm

---

## Setup — Windows PowerShell

### 1. Install backend dependencies

```powershell
cd "D:\DS hackathon\backend"
python -m pip install fastapi "uvicorn[standard]" python-multipart pandas numpy scikit-learn joblib scipy python-dotenv aiofiles
```

### 2. Install frontend dependencies

```powershell
cd "D:\DS hackathon\frontend"
npm install
```

---

## Running the App

### Terminal 1 — Backend (keep running)

```powershell
cd "D:\DS hackathon\backend"
python -m uvicorn app.main:app --reload --port 8000
```

Backend: http://localhost:8000  
API docs: http://localhost:8000/docs

### Terminal 2 — Frontend (keep running)

```powershell
cd "D:\DS hackathon\frontend"
npx vite
```

Open: **http://localhost:5173**

---

## Generate Synthetic Demo Dataset

```powershell
cd "D:\DS hackathon\backend"
python generate_demo.py
```

Creates `demo_synthetic_data.csv` (5,000 rows, 100 batches).  
⚠️ **SYNTHETIC DATA ONLY** — patterns are for demo, not factory evidence.

---

## Application Pages

| Route | Nav Label | Description |
|---|---|---|
| `/` | Overview | Hero with brain constellation + dataset metrics + feature overview |
| `/dataset` | Dataset | Upload CSV, validation report, preview, stats, download |
| `/analysis` | Analysis | 4 charts + defect rate tables + high-risk combinations + filters |
| `/model` | Model | Train Random Forest, metrics, confusion matrix, permutation importance |
| `/predict` | Predict | Production parameter form + defect probability result |
| `/insights` | Insights | 5–7 editorial insights + action plan table + HTML report download |

---

## Visual Design (DESIGN.md)

| Token | Value | Role |
|---|---|---|
| Void Canvas | `#000000` | Page & section background — pure black |
| Bone White | `#ffffff` | Headlines, primary text |
| Ash Gray | `#9a9a9a` | Nav labels, secondary text |
| Silver Mist | `#bdbdbd` | Supporting body text |
| Electric Iris | `#8052ff` | Pill buttons, brand accent, data marks |
| Saffron Spark | `#ffb829` | Emphasis labels, defect highlights, amber tags |
| Deep Verdant | `#15846e` | Teal accent — non-defective marks, logo |

**Typography**: Inter 200/400/600. Display headings `clamp(56px,8vw,113px)` weight 400, tracking `-0.04em`.  
**Navigation**: Fixed transparent top bar — no sidebar, no cards, no borders.  
**Constellation**: Procedural Canvas brain-shaped particle cloud. Respects `prefers-reduced-motion`. Pauses when tab hidden.

---

## Four Primary Analytical Charts

1. **Machine Defect-Rate Bar Chart** — violet bars above amber baseline
2. **Raw-Material Batch Bar Chart** — teal/violet bars, gray for small samples, amber baseline
3. **Numeric Conditions Scatter Plot** — violet = defective, teal = non-defective, selectable X/Y axes
4. **Temperature × Machine-Speed Heatmap** — violet intensity cells, count per cell, low-sample warnings

---

## Dataset Contract

Required CSV columns:

```
Batch_ID, Machine_ID, Temperature, Pressure, Machine_Speed,
Raw_Material_Batch, Operator_Shift, Defect_Status
```

Supported `Defect_Status` formats: `0/1`, `Yes/No`, `True/False`, `Defective/Non-Defective`

---

## ML Pipeline

- **Algorithm**: `RandomForestClassifier(n_estimators=200, max_depth=10, class_weight="balanced", random_state=42)`
- **Split**: Batch-aware `GroupShuffleSplit` (80/20) — no batch leakage
- **Preprocessing**: Median imputation + `OneHotEncoder(handle_unknown="ignore")` — fitted on training data only
- **Baseline**: `DummyClassifier(most_frequent)` comparison
- **Importance**: Held-out permutation importance (10 repeats, F1)

---

## Downloads

- Cleaned CSV: `/projects/{id}/download/clean-csv`
- Evaluation JSON: `/projects/{id}/download/evaluation-json`
- HTML Report: `/projects/{id}/download/html-report`

---

## Project Structure

```
DS hackathon/
├── backend/
│   ├── app/
│   │   ├── main.py         FastAPI routes (15 endpoints)
│   │   ├── validation.py   CSV validation & cleaning
│   │   ├── analysis.py     Defect rate tables & chart data
│   │   ├── ml.py           Training, evaluation, prediction
│   │   ├── insights.py     Deterministic insight generation
│   │   ├── storage.py      Modular file storage
│   │   └── config.py       Settings
│   ├── generate_demo.py    Synthetic dataset generator
│   └── .env
└── frontend/
    └── src/
        ├── pages/          OverviewPage DatasetPage AnalysisPage TrainingPage PredictPage InsightsPage
        ├── components/     TopNav Constellation FilterBar DataTable Alert Spinner StatCard
        ├── api.ts          All API calls
        ├── context.tsx     Global project state
        └── types.ts        TypeScript interfaces
```

---

## Verified

| Check | Status |
|---|---|
| Build succeeds (vite build) | ✅ |
| Backend health endpoint | ✅ |
| Upload → analysis → train → predict → insights | ✅ |
| Missing columns rejected (422) | ✅ |
| Ambiguous targets rejected (422) | ✅ |
| Yes/No target mapping | ✅ |
| Batch-aware split (no leakage) | ✅ |
| Unseen categories → warning, no crash | ✅ |
| Out-of-range numerics → warning | ✅ |
| All 3 download endpoints | ✅ |
| Design tokens (#8052ff, #ffb829, #15846e, #000) in compiled CSS | ✅ |
| Constellation component builds | ✅ |
| TopNav replaces sidebar | ✅ |
| Responsive grid collapse at mobile | ✅ |
