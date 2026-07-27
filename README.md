# Monday.com Business Intelligence Agent - Founder Command Center

An AI-powered Business Intelligence Agent designed for founders and executives to get quick, consolidated answers and compile leadership briefings across sales pipeline (Deals) and project execution (Work Orders) data.

This project is built as a **100% client-side, serverless React application**. It connects directly to the Monday.com GraphQL API and the Google Gemini API from the user's browser, storing all developer credentials safely in local storage.

---

## Key Features

1.  **Conversational BI Agent**: Query sales pipeline health, billing details, and operational performance using natural language.
2.  **Data Quality Diagnostics**: Normalized data cleaning engine that parses dates, handles currency symbols, and handles Excel errors (like `#VALUE!`) while generating transparent warning logs.
3.  **Dynamic Column Schema Resolver**: Queries Monday's board metadata and maps canonical CSV columns dynamically by title, protecting the application against arbitrary Monday column generation.
4.  **Executive Briefing Center**: Pre-compiled templates to build Quarterly Performance summaries, Outstanding AR Audits, and Sector Reviews with one-click clipboard copying.
5.  **Offline Demo Mode**: Instantly testable out-of-the-box. Uses pre-compiled, messy CSV datasets matching the exact schemas of the challenge, allowing full evaluation without a Monday.com setup or Gemini Key.

---

## Directory Structure

*   `src/utils/dataProcessor.ts` - Normalizes dates, strips formatting, fixes Excel errors, calculates data health scores.
*   `src/services/mondayService.ts` - Fetches boards via GraphQL API, manages cursor pagination (`next_items_page`), and maps columns.
*   `src/services/geminiService.ts` - Queries Gemini API with low-temperature prompt formatting and in-context datasets.
*   `src/components/ConfigPanel.tsx` - Form for entering Monday.com tokens, board IDs, Gemini Keys, and toggling Demo Mode.
*   `src/components/ChatInterface.tsx` - Conversational UI, pre-built query shortcuts, and interactive data caveats drawer.
*   `src/components/DataDiagnostics.tsx` - Graphic metrics displaying data health scores, column resolution mappings, and warning logs.
*   `src/components/LeadershipUpdates.tsx` - Executive update compiler, template selectors, and copy tools.

---

## Setup & Deployment Instructions

### Local Setup

1.  **Clone / Unzip** this repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the local development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Monday.com Board Configuration Guide

To test the live Monday.com connection, you must import the provided datasets into your Monday.com account:

1.  **Import Deals Board**:
    *   Create a new board in Monday.com by selecting **Import Data** -> **Excel/CSV**.
    *   Upload `datasets/deal_funnel.csv`.
    *   Assign appropriate types if requested (e.g. set "Masked Deal value" as a Numbers column, "Created Date" as a Date column, etc., or leave them as Text; the Data Processor is resilient to both!).
2.  **Import Work Orders Board**:
    *   Select **Import Data** -> **Excel/CSV**.
    *   Upload `datasets/work_order_tracker.csv`.
    *   *Note*: Ensure that the first empty row of the CSV is skipped during import (usually handled automatically by Monday, or select row 2 as the column headers row).
3.  **Get Board IDs**:
    *   Open each board in your browser.
    *   The Board ID is the numeric code located in the board's URL:
        `https://<your-subdomain>.monday.com/boards/<BOARD_ID>`
4.  **Generate Monday API Token**:
    *   Go to your profile avatar -> **Administration** -> **API**.
    *   Copy your **Personal API Token**.
5.  **Get Gemini API Key**:
    *   Obtain a free developer key from [Google AI Studio](https://aistudio.google.com/).
6.  **Apply Credentials**:
    *   Open the application, turn **OFF** "Demo Mode", paste your keys and board IDs, and click **Apply Credentials**.
