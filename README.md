# AI-Powered Audit Risk Analysis Platform

**Live Demo : (ai-powered-audit-risk-analysis.vercel.app)**

An end-to-end audit analytics and risk assessment platform that combines **rule-based audit checks, machine learning anomaly detection, vendor network analytics, automated reporting, and an AI Audit Copilot using Retrieval-Augmented Generation (RAG)**.

The platform is designed to help auditors analyze transaction datasets, identify potentially risky transactions, investigate unusual patterns and vendor relationships, prioritize findings, and obtain contextual audit guidance while keeping the **final audit decision with the human auditor**.

---

## Project Overview

Auditors often work with large transaction datasets where manually identifying unusual transactions, applying audit rules, examining vendor relationships, and prioritizing observations can be time-consuming.

The **AI-Powered Audit Risk Analysis Platform** provides a centralized workflow for:

- Client management
- Dataset upload and management
- Configurable audit rules
- Rule-based transaction analysis
- Machine learning anomaly detection
- Risk scoring and prioritization
- Audit findings investigation
- Vendor network analysis
- Audit report generation
- AI-assisted audit investigation
- Role-Based Access Control (RBAC)

The system is designed as an **audit decision-support platform**.

A transaction flagged by the platform represents an item requiring further review and **does not constitute proof of fraud or misconduct**.

---

# Key Features

## 1. Client Management

The platform supports multiple audit clients and maintains client-specific audit configurations.

Depending on the user's role and permissions, the system supports:

- Creating clients
- Viewing client information
- Managing client configurations
- Managing client-specific audit rules
- Deleting clients

This allows audit analysis to be organized independently for different clients.

---

## 2. Dataset Management

Users can upload and manage structured transaction datasets through the platform.

The dataset workflow supports:

- Dataset upload
- Dataset listing
- Dataset selection
- Dataset deletion
- Dataset-level analysis
- Association of datasets with audit clients

Uploaded datasets are processed by the FastAPI backend and passed through the audit analysis pipeline.

---

## 3. Configurable Audit Rule Engine

The platform contains a configurable rule engine for identifying transactions that satisfy predefined or client-specific audit conditions.

Examples of supported audit checks include:

- High-value transactions
- Round-number transactions
- Large cash-out or transfer activity
- Transaction threshold violations
- Custom rule conditions

The rule architecture supports:

1. **Default rules**
2. **Customized client rules**
3. **New custom rules**

This architecture allows audit logic to be adapted to different client requirements without modifying the complete analysis pipeline.

---

## 4. Machine Learning Anomaly Detection

Rule-based analysis is supplemented with unsupervised machine learning for identifying unusual transaction behaviour.

The implemented ML pipeline uses:

- **Isolation Forest**
- **Local Outlier Factor (LOF)**
- **StandardScaler**

Known transaction identifiers and fraud/target columns are excluded from model features to reduce data leakage.

The ML component identifies behavioural anomalies such as:

- Transactions showing unusual patterns compared with the overall dataset
- Transactions differing materially from neighbouring observations
- Unusually large transaction amounts relative to the dataset

Isolation Forest and LOF contribute anomaly signals to the broader risk-analysis pipeline rather than independently determining whether a transaction is fraudulent.

---

# ML Evaluation

The anomaly-detection component was separately evaluated using a labelled fraud dataset to examine how the unsupervised anomaly indicators correspond with known fraud labels.

## Evaluation Results

| Metric | Result |
|---|---:|
| Total Rows | 12,713 |
| Actual Positive/Fraud Rows | 8,213 |
| Predicted Positive/Anomaly Rows | 4,547 |
| Precision | 0.5896 |
| Recall | 0.3264 |
| F1 Score | 0.4202 |
| Accuracy | 0.4181 |
| Balanced Accuracy | 0.4559 |
| ROC-AUC | 0.4557 |
| PR-AUC | 0.6274 |

## Confusion Matrix

| | Predicted Normal | Predicted Anomaly |
|---|---:|---:|
| **Actual Normal** | 2,634 | 1,866 |
| **Actual Fraud** | 5,532 | 2,681 |

### Interpretation

These results must be interpreted according to the purpose of the ML component.

The implemented Isolation Forest and Local Outlier Factor models are **unsupervised anomaly-detection algorithms**, not supervised fraud classifiers.

Therefore, the ML component is used to identify unusual behavioural patterns and contribute additional risk signals to the overall audit assessment.

The final platform combines:

- Rule-based audit observations
- ML anomaly indicators
- Transaction characteristics
- Risk-scoring logic
- Vendor relationship indicators

This hybrid approach allows transactions to be prioritized for audit review without treating an ML anomaly prediction as definitive evidence of fraud.

---

## 5. Risk Analysis

The analysis pipeline combines audit rules and machine learning signals to generate transaction-level risk findings.

The resulting analysis can contain:

- Triggered audit checks
- ML anomaly indicators
- Supporting reasons
- Risk scores
- Risk classifications
- Detection sources

Transactions can then be prioritized according to their resulting risk assessment.

---

## 6. Audit Findings

The **Findings** module provides transaction-level observations generated by the analysis pipeline.

Auditors can review:

- Transaction identifiers
- Risk levels
- Risk scores
- Triggered audit checks
- Supporting reasons
- Priority transactions
- Detection information

The findings provide a structured starting point for audit investigation and evidence verification.

---

## 7. Vendor Network Analysis

The platform includes network analytics for identifying potentially relevant relationships between vendors.

The network-analysis component can identify relationships involving shared vendor attributes such as:

- Bank accounts
- GST/tax identifiers
- Email addresses
- Other available identifiers

The module provides information such as:

- Connected vendors
- Suspicious vendor relationships
- Vendor clusters
- Shared identifiers
- Network scores
- Transaction-level network observations

Network findings highlight relationships that may require additional investigation.

A shared identifier or network relationship does **not independently establish fraud or wrongdoing**.

---

## 8. AI Audit Copilot

The platform includes an **AI Audit Copilot** that assists auditors in interpreting current audit information.

The Copilot combines:

- Current audit context
- Transaction findings
- Risk information
- Network-analysis results
- Audit guidance
- Retrieval-Augmented Generation
- Large Language Model response generation

The Copilot can assist users with questions such as:

- What are the current audit findings for a client?
- Which transactions require attention first?
- Why does a particular transaction require review?
- Which audit checks are being triggered most frequently?
- What are the current network-analysis results?
- Are priority transactions associated with suspicious vendor relationships?
- What evidence should be obtained from the client?
- What should the auditor review next?
- What are the major concerns that should be communicated to management?

The Copilot is designed to provide **audit assistance and contextual guidance rather than autonomous audit conclusions**.

---

# Retrieval-Augmented Generation

The Audit Copilot uses a Retrieval-Augmented Generation workflow to combine application context with stored audit guidance before generating responses.

```text
User Question
      |
      v
Audit Copilot API
      |
      +----------------------+
      |                      |
      v                      v
Current Audit Context    RAG Retrieval
      |                      |
      |                   ChromaDB
      |                      |
      +----------+-----------+
                 |
                 v
          Context Assembly
                 |
                 v
              Groq LLM
                 |
                 v
       Audit-Oriented Response
```

The retrieved knowledge supplements the current platform data and provides additional audit-oriented context for the Copilot.

---

## 9. Audit Reports

The reporting module converts audit-analysis results into structured reports.

The reporting workflow supports:

- Report data preparation
- Report preview
- Report generation
- Report export

Reports are generated from platform findings and are intended to support subsequent auditor review and communication.

---

# Role-Based Access Control

The platform implements **Role-Based Access Control (RBAC)** across both the frontend and backend.

Supported roles include:

- **Admin**
- **Audit Manager**
- **Auditor**

Public registration is restricted to:

- Auditor
- Audit Manager

Administrator accounts are provisioned separately rather than being available through public registration.

## Authentication and Authorization Flow

```text
Registration / Login
        |
        v
   Supabase Auth
        |
        v
 User Profile + Role
        |
        +----------------------+
        |                      |
        v                      v
 Frontend RBAC            Backend RBAC
        |                      |
        v                      v
Routes / UI Access       API Authorization
```

Frontend route restrictions control what functionality is presented to each user.

Backend authorization independently protects API operations using authenticated bearer tokens and role permissions.

This ensures that frontend visibility is not treated as the application's only security boundary.

---

# Registration and Authentication

The platform uses **Supabase Authentication** for account management.

The registration interface supports:

- Full name
- Email address
- Role selection
- Password
- Password confirmation

Public users can register as either:

- Auditor
- Audit Manager

Admin registration is not exposed publicly.

## Password Validation

Registration enforces password requirements including:

- Minimum 10 characters
- At least one uppercase character
- At least one lowercase character
- At least one number
- At least one special character
- No whitespace
- Matching password confirmation
- Password should not contain the email username

User profile information and role information are maintained separately from authentication credentials.

---

# Technology Stack

## Frontend

- React
- Vite
- React Router
- Axios
- Supabase Auth

## Backend

- Python
- FastAPI
- Uvicorn
- Pydantic

## Data Processing

- Pandas
- NumPy
- OpenPyXL

## Machine Learning

- Scikit-learn
- Isolation Forest
- Local Outlier Factor
- StandardScaler

## AI and RAG

- Groq
- ChromaDB
- Sentence Transformers
- Hugging Face ecosystem

## Network Analytics

- NetworkX

## Database and Authentication

- Supabase
- PostgreSQL
- Supabase Authentication

## Reporting

- ReportLab

## Development and Deployment

- Docker
- Git
- GitHub
- Vercel
- Render

---

# System Architecture

```text
                         USER
                           |
                           v
                +----------------------+
                |   React / Vite UI    |
                +----------+-----------+
                           |
                           v
                    Supabase Auth
                           |
                           v
                +----------------------+
                |   FastAPI Backend    |
                +----------+-----------+
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
     Rule Engine      ML Anomaly       Network
                       Detection        Analytics
          |                |                |
          +----------------+----------------+
                           |
                           v
                    Risk Assessment
                           |
                           v
                     Audit Findings
                           |
                +----------+----------+
                |                     |
                v                     v
          Audit Reports          Audit Copilot
                                      |
                                      v
                                  RAG Layer
                                      |
                         +------------+------------+
                         |                         |
                         v                         v
                     ChromaDB                  Groq LLM
```

---

# Application Workflow

```text
Login / Register
       |
       v
Dashboard
       |
       v
Client Management
       |
       v
Dataset Upload / Selection
       |
       v
Audit Rule Configuration
       |
       v
Run Analysis
       |
       +----------------+
       |                |
       v                v
Rule Analysis      ML Analysis
       |                |
       +-------+--------+
               |
               v
          Risk Findings
               |
       +-------+---------+
       |                 |
       v                 v
Network Analysis     Investigation
       |                 |
       +-------+---------+
               |
               v
         Audit Reports
               |
               v
          Audit Copilot
```

# Local Installation

## Prerequisites

Ensure the following are installed:

- Git
- Python 3.11+
- Node.js
- npm
- Docker Desktop

---

## 1. Clone the Repository

```bash
git clone <YOUR-GITHUB-REPOSITORY-URL>
cd ai-audit-risk-analysis-platform
```

---

## 2. Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI backend:

```bash
uvicorn app.main:app --reload
```

The API will normally run at:

```text
http://localhost:8000
```

### Health Check

```text
http://localhost:8000/health
```

Expected response:

```json
{
  "status": "healthy"
}
```

### API Documentation

FastAPI Swagger documentation is available at:

```text
http://localhost:8000/docs
```

---

## 3. Frontend Setup

Open another terminal and navigate to:

```bash
cd frontend
```

Install packages:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The frontend will normally run at:

```text
http://localhost:5173
```

If that port is occupied, Vite may automatically use another available port.

---

# Docker Setup

The application backend can also be built and executed using Docker.

From the project root:

```bash
docker compose build
```

Start the containers:

```bash
docker compose up
```

Or:

```bash
docker compose up --build
```

After startup, verify the backend using the `/health` endpoint.

To stop the containers:

```bash
docker compose down
```

---

# Environment Variables

Sensitive configuration must be stored using environment variables.

Credentials and `.env` files must **never be committed to the repository**.

## Frontend Environment

Example:

```env
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_API_BASE_URL=<your-fastapi-backend-url>
```

## Backend Environment

Configure the required backend credentials for:

- Supabase
- Groq
- Other application configuration required by the backend

Example structure:

```env
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_KEY=<your-key>
GROQ_API_KEY=<your-groq-api-key>
```

Use the exact environment-variable names expected by the application configuration.

---

# Deployment Architecture

The deployed application uses a cloud architecture consisting of:

```text
                     GitHub
                       |
            +----------+----------+
            |                     |
            v                     v
         Vercel                 Render
     React Frontend         FastAPI Backend
            |                     |
            +----------+----------+
                       |
                       v
                    Supabase
             PostgreSQL + Auth
                       |
                       v
               Application Data
```

---

## Frontend Deployment

The React/Vite frontend is deployed using **Vercel**.

The frontend communicates with the deployed FastAPI backend through the configured API base URL.

---

## Backend Deployment

The FastAPI backend is deployed using **Render**.

The backend provides REST API endpoints for:

- Dashboard
- Clients
- Rules
- Datasets
- Analysis
- Findings
- Network analysis
- Reports
- Audit Copilot

---

## Database and Authentication

**Supabase** provides:

- PostgreSQL database
- Authentication
- User sessions
- User profile information

---

# CORS Configuration

The FastAPI backend must allow requests from the deployed Vercel frontend domain.

Development origins may include:

```text
http://localhost:5173
http://localhost:5174
http://127.0.0.1:5173
http://127.0.0.1:5174
```

The deployed Vercel application domain must also be included in the backend CORS configuration.

---

# Security Considerations

The platform incorporates multiple application-level security controls.

These include:

- Supabase authentication
- Authenticated bearer tokens
- Role-Based Access Control
- Frontend route protection
- Backend API authorization
- User profile validation
- Account status validation
- Restricted public role registration
- Separate administrator provisioning
- Password validation
- Environment-based secrets
- CORS restrictions
- Protected API routes

Frontend permissions are primarily used for navigation and user experience.

Backend RBAC independently validates whether the authenticated role is permitted to perform protected API operations.

---

# Audit Interpretation and Human Oversight

The platform is designed as a **decision-support system for auditors**.

Automated analysis helps identify transactions and relationships that may require additional review.

However:

> A high risk score, anomaly flag, triggered audit rule, or suspicious vendor relationship does not independently establish fraud, misconduct, or regulatory violation.

Before reaching an audit conclusion, auditors should inspect relevant supporting evidence.


---

# Current Implementation Status

| Module | Status |
|---|---|
| Authentication | Implemented |
| User Registration | Implemented |
| Role-Based Access Control | Implemented |
| Client Management | Implemented |
| Dataset Management | Implemented |
| Dataset Upload | Implemented |
| Configurable Audit Rules | Implemented |
| Rule-Based Analysis | Implemented |
| ML Anomaly Detection | Implemented |
| Risk Scoring | Implemented |
| Audit Findings | Implemented |
| Vendor Network Analysis | Implemented |
| Network Visualization | Implemented |
| Audit Reporting | Implemented |
| AI Audit Copilot | Implemented |
| RAG Audit Guidance | Implemented |
| ML Evaluation Pipeline | Implemented |
| Docker Configuration | Implemented |
| Frontend Cloud Deployment | Implemented |
| Backend Cloud Deployment | Implemented |

---

# Production Hardening / Future Work

Further production-level improvements can include:

- Automated backend testing
- Automated frontend testing
- Extended RBAC test coverage
- API integration testing
- Expanded ML benchmarking
- Model monitoring
- Application monitoring and observability
- Centralized logging
- Audit activity logs
- Rate limiting
- Extended security testing
- Additional audit-rule libraries
- Model and rule version tracking
- Expanded explainability
- Additional network-analysis methods
- Additional report templates

---

# Limitations

The current system has several important limitations.

### Unsupervised ML

Isolation Forest and Local Outlier Factor identify statistical anomalies rather than directly learning confirmed fraud behaviour.

An anomalous transaction may therefore be legitimate, while fraudulent behaviour that resembles normal transaction patterns may not necessarily be identified.

### Dataset Dependency

Analysis quality depends on the quality, completeness, and structure of the uploaded transaction data.

### Rule Dependency

Rule-based findings depend on the configured audit rules and thresholds.

### Network Analysis

Vendor relationship indicators depend on the identifiers available in the uploaded dataset.

Shared identifiers can have legitimate explanations and require verification.

### AI Copilot

LLM-generated responses are intended to assist interpretation and investigation.

They should not replace source evidence, professional judgment, or formal audit procedures.

---

# Future Enhancements

Potential extensions of the platform include:

- Additional fraud and anomaly-detection models
- Supervised fraud classification when suitable labelled datasets are available
- Adaptive risk scoring
- Additional audit and compliance rule libraries
- Rule versioning
- Model versioning
- Explainable AI integration
- Advanced graph analytics
- Temporal transaction analysis
- Enhanced vendor/entity resolution
- Audit activity tracking
- Notification workflows
- Expanded management dashboards
- Additional report templates
- Model monitoring and drift detection
- Production-scale automated testing
- MLOps integration

---

# Responsible Use

The platform should be used for:

- Audit analytics
- Transaction screening
- Risk prioritization
- Anomaly identification
- Relationship analysis
- Audit investigation support

It should **not** be used as an autonomous system for declaring that an individual, vendor, organization, or transaction is fraudulent.

Human review and appropriate audit evidence remain necessary.

---

# Author

**Rajyasri S**  
M.Sc. Data Science

---

# Disclaimer

This project was developed as an academic and technical implementation of an AI-assisted audit risk analysis system.

The software is intended for **analysis, risk prioritization, investigation support, and educational/research purposes**.

Risk scores, anomaly indicators, network relationships, rule violations, and AI-generated responses produced by the platform should not be interpreted as definitive evidence of fraud, misconduct, or regulatory non-compliance.

Professional judgment and appropriate supporting evidence are required before reaching an audit conclusion.
