# Decision Log - Monday.com Business Intelligence Agent

This document outlines the key assumptions, architectural choices, trade-offs, and future improvements made during the development of the Monday.com Business Intelligence Agent.

---

## 1. Key Assumptions Made

*   **Data Scale and Context Window**:
    *   *Assumption*: The target boards (Deals and Work Orders) represent typical organizational operational trackers, containing hundreds (rather than millions) of rows. Our analysis showed Deals had ~350 records and Work Orders had ~180 records.
    *   *Impact*: Because the consolidated size of both datasets is less than 100KB, it fits comfortably within the 1-million-token context window of Gemini 1.5 Flash. We assumed that fetching the full, clean dataset and executing queries directly in-context via LLM reasoning is superior to writing fragile, dynamic GraphQL queries or server-side relational databases.
*   **Column Setup Inconsistency**:
    *   *Assumption*: When a Monday.com administrator imports the provided CSV files, the generated board column IDs are arbitrary (e.g. `status4`, `text5`, `numeric2`) and may vary from one account setup to another.
    *   *Impact*: We assumed that hardcoding column IDs would fail immediately in user testing. Therefore, we designed the agent to retrieve column metadata (`columns { id title type }`) and dynamically map IDs to canonical titles using robust text normalizations.
*   **Target User & Interaction**:
    *   *Assumption*: The primary audience is executive-level leadership (founders, COOs, VPs) who lack the time to run local servers, configure complex environments, or write code.
    *   *Impact*: The agent interface is designed as an accessible, responsive, single-page web app. It provides pre-set founder query shortcuts and instant copyable reports.

---

## 2. Technical Tech Stack & Trade-offs

### A. 100% Client-Side Web Architecture (Vite + React + TypeScript)
*   **Decision**: Run all data processing, connection logic, and Gemini API calls directly in the user's browser without a dedicated backend server.
*   **Pros**:
    *   *Security*: Highly secure. The founder's Monday.com API Token and Gemini API Keys are stored locally in the browser's secure `localStorage`. They are never sent to a third-party server, avoiding leaks or key exposures.
    *   *No Infrastructure Overhead*: Hosting is serverless. The application compiles to static HTML/JS/CSS, which can be deployed instantly for free on Netlify, Vercel, or GitHub Pages.
    *   *No Cost Run*: Direct peer-to-peer fetching with Monday and Gemini means zero server compute costs.
*   **Cons & Mitigation**:
    *   *CORS*: If an API service enforces strict CORS blocking browser requests, it would fail. Fortunately, both Monday.com's API and the Google Generative Language API (Gemini) support browser-origin requests when valid developer tokens are provided in headers.

### B. In-Context LLM Calculations vs. Structured SQL/Code-Interpreter
*   **Decision**: Supply the entire cleaned JSON dataset in the system context of the LLM and let it query, join, and aggregate values directly, rather than building a custom JS query execution engine or spinning up a database.
*   **Pros**:
    *   *Flexibility*: The user can ask highly unstructured questions (e.g., "Which sectors seem to take the longest to invoice after work orders are completed?") that would be extremely difficult to parse into structured SQL or custom JS filters.
    *   *Cross-Board Joins*: Allows natural joins between Deals and Work Orders based on fuzzy matching of names (e.g., `dealName`) without defining a strict relational database schema.
*   **Cons & Mitigation**:
    *   *Factual Arithmetic Precision*: LLMs can occasionally make math rounding errors when counting or adding large lists of items.
    *   *Mitigation*: We set the Gemini generation `temperature` to `0.1` to enforce maximum determinism, and structured the system instructions to encourage tabular calculations. In the future, we could add a sandboxed JS code execution layer, but for this scale, low-temperature prompt guidance proved highly accurate.

---

## 3. Interpretation of "Leadership Updates" (Optional Requirement)

We interpreted "help prepare data for leadership updates" as the need for **instant executive communication builders**. When founders present reports to stakeholders, they do not copy-paste raw logs or screenshots of charts; they compile written summaries containing:
1.  **High-Level KPI Progress**: Total won pipeline, billed receivables, outstanding collection balances.
2.  **Top Strategic Achievements**: Highlight major won accounts (e.g. deals over a certain value) and operation execution status.
3.  **Active Operational & AR Risks**: Specific callouts of high-priority outstanding accounts receivable (AR Priority) where work orders are completed but invoices remain uncollected.
4.  **Action Items**: Structured recommendations.

To implement this, we built a dedicated **Leadership Updates Pane**:
*   Provides pre-set executive report options (Quarterly Brief, AR Audit, Sector Review).
*   Allows the user to input a "custom prompt refinement" to tailor the report.
*   Generates a structured, professional markdown summary.
*   Includes a one-click **"Copy Markdown"** button, allowing the user to paste a polished brief directly into an email, Slack update, or slide deck.

---

## 4. What We'd Do Differently With More Time

1.  **Local Sandboxed Execution (JSON-to-SQL / WASM-SQLite)**:
    For datasets with tens of thousands of rows, loading them entirely into the LLM context is expensive and exceeds limits. We would load the datasets into an in-browser SQLite database (via WebAssembly) and let the Gemini agent write and execute SQLite queries locally to aggregate data before writing summaries.
2.  **Dynamic Interactive Charts**:
    Add visual charts (Bar, Pie, Line) using `Recharts` or `Chart.js` directly within the chat screen, rendering them dynamically based on JSON structured data returned by the LLM.
3.  **Monday.com OAuth Integration**:
    Instead of asking users to manually paste their Developer API token, implement Monday.com OAuth to authorize access with a single click.
