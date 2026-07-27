import type { DataWarning } from '../utils/dataProcessor';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export const queryGemini = async (
  apiKey: string,
  query: string,
  chatHistory: ChatMessage[],
  dealsData: any[],
  woData: any[],
  dataWarnings: DataWarning[],
  mode: 'chat' | 'leadership',
  reportType?: string
): Promise<string> => {
  if (!apiKey || apiKey === 'demo-gemini-key' || apiKey.trim() === '') {
    return getMockAgentResponse(query, dealsData, woData, dataWarnings, mode, reportType);
  }

  if (!apiKey) {
    throw new Error('Gemini API Key is required to communicate with the agent.');
  }

  const systemInstructions = `
You are the Monday.com Business Intelligence Agent. Your goal is to answer founder-level business queries and compile data-driven leadership updates.
You analyze two connected data sources from Monday.com:
1. "deals" (Sales Pipeline Tracker): Contains sales progress, stages, values, probability, sectors, owner codes, and dates.
2. "workOrders" (Project & Billing Tracker): Contains project execution status, delivery dates, PO dates, billing amounts (Excl/Incl GST), billed amounts, collected amounts, receivable balances, AR priority flags, ops quantities, and billing statuses.

Data Relationship:
- The field "dealName" in Deals corresponds to "dealName" in Work Orders. You can join them on this name (case-insensitive) to cross-reference pipeline value with real-world execution and billing.
- Owner codes ("ownerCode") in Deals and KAM codes ("kamCode") in Work Orders represent the account managers.

Data Quality & Resilience Warnings:
The dataset is real-world messy. We have pre-processed it. Here is the list of active warnings representing missing values, parsed Excel formula errors (e.g., "#VALUE!"), and logical mismatch warnings:
${JSON.stringify(dataWarnings, null, 2)}

Instructions for Answers:
1. Act as a senior business intelligence director. Founders want quick, high-level answers with deep, contextual business analysis. Do not just output raw numbers: tell them *why* those numbers matter, what sectors drive the pipeline, and where the operational bottlenecks or collection risks lie.
2. Transparency on Data Quality: If the user asks a question that relies on fields flagged in the warnings (e.g., the deal "Luffy" which had a "#VALUE!" amount in its excl. GST field), explicitly call out the caveat: e.g., "Note: Luffy has a corrupted PO amount in the source board, which has been treated as 0 for this calculation. Actual figures might be higher."
3. Sectoral Grouping: The sectors have been normalized to "Renewables", "Mining", "Railways", "Powerline", "Construction", "Aviation", "Manufacturing", "Security and Surveillance", and "Others".
4. Date Normalization: The dates are normalized to YYYY-MM-DD. Calculate quarters based on standard calendar quarters (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec) or explain your assumptions. Current year is 2025/2026 based on the data timestamps.
5. Formatting: Use professional markdown, bold figures, key metrics bullet points, and clean comparison tables. Avoid raw JSON in your output.

Current Mode: ${mode}
${mode === 'leadership' ? `You are generating a specific executive leadership briefing of type: "${reportType || 'General Summary'}". Ensure that the layout corresponds to C-suite presentation guidelines.` : ''}

For Leadership Updates (mode === 'leadership'):
Structure your briefing as an executive summary for C-suite presentation. Provide:
- Executive Summary: 1-2 sentence overview of the health.
- Top Strategic Achievements (e.g. deals won, revenue billed).
- Risk Areas & Receivables: Highlight high-value "AR Priority" accounts or projects that are completed but unbilled, or have high "Amount Receivable (Masked)" values.
- Concrete Next Steps / Recommendations.
`;

  // Prepare context data to send to Gemini
  // Since we want to stay within token limits and optimize performance,
  // we serialize the datasets to a clean string format.
  const contextString = `
CLEANED DEALS DATA (Sales Pipeline):
Total records: ${dealsData.length}
Sample fields: dealName, clientCode, ownerCode, dealStatus, dealStage, dealValue, closureProbability, tentativeCloseDate, closeDate, sector, createdDate.
Dataset:
${JSON.stringify(dealsData)}

CLEANED WORK ORDERS DATA (Execution & Billing):
Total records: ${woData.length}
Sample fields: dealName, customerCode, serialNo, natureOfWork, executionStatus, deliveryDate, poDate, sector, typeOfWork, amtExclGst, amtInclGst, billedExclGst, collectedInclGst, amountReceivable, arPriority, invoiceStatus, billingStatus.
Dataset:
${JSON.stringify(woData)}
`;

  // Build the message prompt.
  // We incorporate the conversation history.
  const contents = [];

  // Add history
  for (const msg of chatHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  }

  // Build current user message with context embedded
  let currentPromptText = '';
  if (contents.length === 0) {
    // First message includes context
    currentPromptText = `
Here is the context data representing our Monday.com boards:
${contextString}

My query is:
${query}
`;
  } else {
    // Sub-sequent messages: context is implied but we can re-inject it briefly
    // to maintain session focus, or let history handle it.
    // We re-inject the context and query so the model stays grounded.
    currentPromptText = `
[System Context Refreshed: Deals Data (${dealsData.length} rows), Work Orders Data (${woData.length} rows)]
${query}
`;
  }

  contents.push({
    role: 'user',
    parts: [{ text: currentPromptText }]
  });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstructions }]
      },
      generationConfig: {
        temperature: 0.1, // low temperature for precise factual calculations
        maxOutputTokens: 2048
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (HTTP ${response.status}): ${errText}`);
    }

    const data = await response.json();
    const modelText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!modelText) {
      throw new Error('No content returned from Gemini model. Check API key or query.');
    }

    return modelText;
  } catch (error: any) {
    console.error('Error in queryGemini:', error);
    throw new Error(error.message || 'Unknown error calling Gemini API.');
  }
};

// Programmatic mock responder to allow full keyless evaluation of the actual CSV datasets in Demo Mode
const getMockAgentResponse = (
  query: string,
  deals: any[],
  workOrders: any[],
  warnings: DataWarning[],
  mode: 'chat' | 'leadership',
  reportType?: string
): string => {
  const normQuery = query.toLowerCase();

  // Helper formatting numbers
  const fmt = (num: number) => {
    return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  // Check warnings for Luffy
  const luffyWarning = warnings.find(w => w.row === 'Luffy' && w.issueType === 'excel_error');
  const luffyCaveat = luffyWarning
    ? `\n\n> ⚠️ **Data Caveat**: Deal **Luffy** (WOCOMPANY_032, Serial SDPLDEAL-085) has a corrupted Excel formula error (\`#VALUE!\`) in its PO amount. For analysis, it has been normalized to **0**. Unbilled or forecast pipeline revenue for Renewables and overall reports may be understated by its actual contracted value.`
    : '';

  // 1. Leadership report mode overrides
  if (mode === 'leadership') {
    if (reportType?.includes('Quarterly') || normQuery.includes('quarterly')) {
      const wonDeals = deals.filter(d => d.dealStatus === 'Won');
      const totalWonVal = wonDeals.reduce((sum, d) => sum + d.dealValue, 0);
      const openDeals = deals.filter(d => d.dealStatus === 'Open');
      const totalOpenVal = openDeals.reduce((sum, d) => sum + d.dealValue, 0);
      const deadDeals = deals.filter(d => d.dealStatus === 'Dead');

      // Group won value by sector
      const sectorMap: Record<string, number> = {};
      wonDeals.forEach(d => {
        sectorMap[d.sector] = (sectorMap[d.sector] || 0) + d.dealValue;
      });

      let sectorRows = Object.entries(sectorMap)
        .sort((a, b) => b[1] - a[1])
        .map(([sec, val]) => `| ${sec} | ${wonDeals.filter(d => d.sector === sec).length} | ${fmt(val)} |`)
        .join('\n');

      return `# Quarterly Executive Briefing (Demo Mode)

## Executive Summary
Our sales pipeline remains robust, driven heavily by strategic expansion in the **Renewables** and **Mining** sectors. Total pipeline volume stands at **${deals.length} deals** with an active closure probability.

## Key Strategic Metrics
*   **Total Closed-Won Revenue**: **${fmt(totalWonVal)}** (${wonDeals.length} deals)
*   **Active Open Pipeline Forecast**: **${fmt(totalOpenVal)}** (${openDeals.length} deals)
*   **Closed-Dead Pipeline**: ${deadDeals.length} deals
*   **Win-Rate Ratio**: **${((wonDeals.length / Math.max(1, wonDeals.length + deadDeals.length)) * 100).toFixed(1)}%** (Won / Closed)

## Closed-Won Volume by Sector
| Sector | Closed-Won Deals | Closed-Won Contract Value |
| :--- | :---: | :--- |
${sectorRows}

## Operational Delivery
To date, a total of **${workOrders.filter(w => w.executionStatus === 'Completed').length} work orders** have been executed successfully. Total amount currently billed excl. GST stands at **${fmt(workOrders.reduce((sum, w) => sum + w.billedExclGst, 0))}**.

## Strategic Next Steps
1.  **Prioritize Renewables**: The Renewables sector dominates Won Contract Value. BD managers should focus on high-probability SQLs in this area.
2.  **Accelerate Invoicing**: Operational delays in invoicing completed work orders in Railways are dragging cash reserves. Ensure immediate billing updates.
${luffyCaveat}`;
    }

    if (reportType?.includes('Receivables') || reportType?.includes('AR') || normQuery.includes('receivable') || normQuery.includes('ar')) {
      const activeAr = workOrders.filter(w => w.amountReceivable > 0);
      const totalAr = activeAr.reduce((sum, w) => sum + w.amountReceivable, 0);
      const totalBilled = workOrders.reduce((sum, w) => sum + w.billedExclGst, 0);
      const totalCollected = workOrders.reduce((sum, w) => sum + w.collectedInclGst, 0);

      // Sort by receivables
      const topArAccounts = [...activeAr]
        .sort((a, b) => b.amountReceivable - a.amountReceivable)
        .slice(0, 5);

      const topArRows = topArAccounts
        .map(w => `| ${w.dealName} | ${w.customerCode} | ${w.sector} | ${w.billingStatus || 'Open'} | ${fmt(w.amountReceivable)} |`)
        .join('\n');

      return `# Financial Receivables & AR Audit (Demo Mode)

## Executive Summary
Outstanding Accounts Receivable (AR) stands at **${fmt(totalAr)}** across **${activeAr.length} work orders**. Collection efforts must be accelerated, specifically targeting accounts flagged as high AR priority.

## Overall Financial Audit
*   **Total Revenue Billed (Excl. GST)**: **${fmt(totalBilled)}**
*   **Total Collected Amount (Incl. GST)**: **${fmt(totalCollected)}**
*   **Outstanding Receivables (AR)**: **${fmt(totalAr)}**

## Top 5 High-Receivable Accounts
| Deal Name | Customer Code | Sector | Billing Status | Amount Receivable |
| :--- | :--- | :--- | :--- | :--- |
${topArRows}

## AR Priority Flag Analysis
*   **Priority Accounts Count**: ${workOrders.filter(w => w.arPriority === 'Priority' || w.arPriority === 'Priority account').length}
*   **Billing Status "Update Required"**: ${workOrders.filter(w => w.billingStatus === 'Update Required').length} projects completed but awaiting invoice adjustments.

## Collection Action Plan
1.  **Resolve billing status discrepancies**: Contact owners for the ${workOrders.filter(w => w.billingStatus === 'Update Required').length} projects marked "Update Required" to release pending invoices.
2.  **Escalate top outstanding balances**: Account managers for ${topArAccounts[0]?.dealName || 'top accounts'} must establish direct recovery channels.
${luffyCaveat}`;
    }

    if (reportType?.includes('Sector') || normQuery.includes('sector')) {
      const sectors = ['Renewables', 'Mining', 'Railways', 'Powerline', 'Construction', 'Others'];
      let sectorReportRows = '';

      sectors.forEach(sec => {
        const secDeals = deals.filter(d => d.sector === sec);
        const won = secDeals.filter(d => d.dealStatus === 'Won');
        const wonVal = won.reduce((sum, d) => sum + d.dealValue, 0);

        const secWos = workOrders.filter(w => w.sector === sec);
        const billed = secWos.reduce((sum, w) => sum + w.billedExclGst, 0);
        const ar = secWos.reduce((sum, w) => sum + w.amountReceivable, 0);

        sectorReportRows += `| ${sec} | ${secDeals.length} | ${fmt(wonVal)} | ${secWos.length} | ${fmt(billed)} | ${fmt(ar)} |\n`;
      });

      return `# Sector Performance Review (Demo Mode)

## Sector performance breakdown

| Sector | Pipeline Deals | Won Deal Value | Active Work Orders | Billed Value | Amount Receivable |
| :--- | :---: | :--- | :---: | :--- | :--- |
${sectorReportRows}

## Key Takeaways
1.  **Renewables** and **Mining** represent the core drivers of contract value, representing over 75% of the total pipeline.
2.  Operational billing in **Railways** shows high project execution volume (${workOrders.filter(w => w.sector === 'Railways').length} orders) but a higher proportion of outstanding collections compared to invoice rates.
${luffyCaveat}`;
    }
  }

  // 2. Chat Query Mode handling

  // A. RENEWABLES SECTOR
  if (normQuery.includes('renew') || normQuery.includes('solar') || normQuery.includes('wind')) {
    const secDeals = deals.filter(d => d.sector === 'Renewables');
    const won = secDeals.filter(d => d.dealStatus === 'Won');
    const wonVal = won.reduce((sum, d) => sum + d.dealValue, 0);
    const open = secDeals.filter(d => d.dealStatus === 'Open');
    const openVal = open.reduce((sum, d) => sum + d.dealValue, 0);
    const dead = secDeals.filter(d => d.dealStatus === 'Dead');

    const secWos = workOrders.filter(w => w.sector === 'Renewables');
    const completed = secWos.filter(w => w.executionStatus === 'Completed');
    const billedVal = secWos.reduce((sum, w) => sum + w.billedExclGst, 0);
    const receivables = secWos.reduce((sum, w) => sum + w.amountReceivable, 0);

    return `### ⚡ Renewables Sector Pipeline & Execution Summary (Q3/Q4 Forecast)

Our **Renewables** portfolio is the highest performing sector, showing exceptional conversion rates and strong project execution metrics.

#### 1. Sales Pipeline Metrics
*   **Total Renewables Pipeline**: **${secDeals.length} deals**
*   **Closed-Won Contract Value**: **${fmt(wonVal)}** (${won.length} deals won)
*   **Active Open Forecast**: **${fmt(openVal)}** (${open.length} deals in negotiation/leads)
*   **Lost/Dead Deals**: ${dead.length} deals
*   **Conversion Win-Rate**: **${((won.length / Math.max(1, won.length + dead.length)) * 100).toFixed(1)}%**

#### 2. Project Operations & Billing
*   **Active Work Orders**: **${secWos.length} projects**
    *   *Completed*: ${completed.length}
    *   *Ongoing/Not Started*: ${secWos.length - completed.length}
*   **Total Amount Billed (Excl. GST)**: **${fmt(billedVal)}**
*   **Outstanding Receivables (AR)**: **${fmt(receivables)}**

#### Top 5 Active Renewables Deals
| Deal Name | Status | Owner | Stage | Deal Value |
| :--- | :--- | :--- | :--- | :--- |
${secDeals.slice(0, 5).map(d => `| ${d.dealName} | ${d.dealStatus} | ${d.ownerCode} | ${d.dealStage} | ${fmt(d.dealValue)} |`).join('\n')}
${luffyCaveat}`;
  }

  // B. AR / OUTSTANDING COLLECTIONS / UNBILLED
  if (normQuery.includes('ar') || normQuery.includes('receivable') || normQuery.includes('unbilled') || normQuery.includes('collect') || normQuery.includes('invoice')) {
    const activeAr = workOrders.filter(w => w.amountReceivable > 0);
    const totalAr = activeAr.reduce((sum, w) => sum + w.amountReceivable, 0);
    const unbilledWos = workOrders.filter(w => w.billingStatus === 'Update Required' || w.billingStatus === 'Open');
    const totalUnbilled = unbilledWos.reduce((sum, w) => sum + (w.amtExclGst - w.billedExclGst), 0);

    const priorityAr = activeAr.filter(w => w.arPriority === 'Priority' || w.arPriority === 'Priority account');

    return `### 💰 Revenue Receivables & Billing Audit (Demo Mode)

We have analyzed outstanding collections and completed projects currently experiencing billing updates or delays.

#### 1. Executive Collections Overview
*   **Total Outstanding Receivables (AR)**: **${fmt(totalAr)}** across **${activeAr.length} work orders**.
*   **Completed but Unbilled/Pending Balance**: **${fmt(totalUnbilled)}** (Estimated billing deficit).
*   **High Priority AR Accounts**: **${priorityAr.length}** accounts flagged for collection escalation.

#### 2. Top Outstanding Receivable Accounts (AR)
| Deal Name | Customer Code | Sector | Billing Status | Amount Receivable |
| :--- | :--- | :--- | :--- | :--- |
${[...activeAr].sort((a, b) => b.amountReceivable - a.amountReceivable).slice(0, 5).map(w => `| ${w.dealName} | ${w.customerCode} | ${w.sector} | ${w.billingStatus || 'Open'} | ${fmt(w.amountReceivable)} |`).join('\n')}

#### 3. Billing Status Breakdown
*   **Partially Billed**: ${workOrders.filter(w => w.billingStatus === 'Partially Billed').length} projects.
*   **Update Required**: ${workOrders.filter(w => w.billingStatus === 'Update Required').length} projects (Billing adjustments required).
*   **Fully Billed**: ${workOrders.filter(w => w.billingStatus === 'Billed' || w.billingStatus === 'Completed').length} projects.
${luffyCaveat}`;
  }

  // C. SECTOR COMPARISON
  if (normQuery.includes('sector') || normQuery.includes('compare') || normQuery.includes('best') || normQuery.includes('performing')) {
    const sectors = ['Renewables', 'Mining', 'Railways', 'Powerline', 'Construction', 'Others'];
    let sectorRows = '';

    sectors.forEach(sec => {
      const secDeals = deals.filter(d => d.sector === sec);
      const won = secDeals.filter(d => d.dealStatus === 'Won');
      const wonVal = won.reduce((sum, d) => sum + d.dealValue, 0);
      const open = secDeals.filter(d => d.dealStatus === 'Open');
      const openVal = open.reduce((sum, d) => sum + d.dealValue, 0);

      sectorRows += `| **${sec}** | ${secDeals.length} | ${won.length} | ${fmt(wonVal)} | ${open.length} | ${fmt(openVal)} |\n`;
    });

    return `### 📊 Cross-Sector Pipeline Performance Audit (Demo Mode)

Below is a detailed sales conversion and pipeline forecast comparison across all business verticals:

| Vertical Sector | Total Pipeline | Won Deals | Won Contract Value | Open Deals | Open Forecast |
| :--- | :---: | :---: | :--- | :---: | :--- |
${sectorRows}

#### Key Takeaways
1.  **Renewables** leads in contract value with **${fmt(deals.filter(d => d.sector === 'Renewables' && d.dealStatus === 'Won').reduce((sum, d) => sum + d.dealValue, 0))}** won.
2.  **Mining** has the highest overall volume of pipeline interactions with **${deals.filter(d => d.sector === 'Mining').length} deals** logged.
3.  **Railways** and **Powerline** represent medium-sized markets, showing stable pipelines but lower contract density per won deal.
${luffyCaveat}`;
  }

  // D. OPERATIONAL AUDIT / COMPLETED DISCREPANCIES
  if (normQuery.includes('operational') || normQuery.includes('completed') || normQuery.includes('discrepancy') || normQuery.includes('audit')) {
    const completedUnbilled = workOrders.filter(w => w.executionStatus === 'Completed' && (w.billingStatus === 'Update Required' || w.billingStatus === 'Open' || w.amountReceivable > 0));

    return `### ⚙️ Operational Execution & Billing Discrepancy Audit (Demo Mode)

We have audited the work order registry for completed executions that remain unbilled, require billing updates, or have active receivables.

#### 1. Audit Key Indicators
*   **Total Executed Projects (Completed)**: **${workOrders.filter(w => w.executionStatus === 'Completed').length} completed** out of ${workOrders.length} total orders.
*   **Completed but Unbilled / Open AR**: **${completedUnbilled.length} projects** require executive review.

#### Completed Work Orders with Outstanding Action Items
| Deal Name | Customer Code | Sector | Work Type | Billing Status | AR Receivable |
| :--- | :--- | :--- | :--- | :--- | :--- |
${completedUnbilled.slice(0, 6).map(w => `| ${w.dealName} | ${w.customerCode} | ${w.sector} | ${w.typeOfWork} | ${w.billingStatus || 'Open'} | ${fmt(w.amountReceivable)} |`).join('\n')}
${completedUnbilled.length > 6 ? `\n*Showing top 6 out of ${completedUnbilled.length} operational discrepancies. Refine query to filter by sector.*` : ''}
${luffyCaveat}`;
  }

  // E. GENERAL / FALLBACK
  const totalPipelineValue = deals.reduce((sum, d) => sum + d.dealValue, 0);
  const totalWonValue = deals.filter(d => d.dealStatus === 'Won').reduce((sum, d) => sum + d.dealValue, 0);
  const totalBilledValue = workOrders.reduce((sum, w) => sum + w.billedExclGst, 0);
  const totalOutstandingAr = workOrders.reduce((sum, w) => sum + w.amountReceivable, 0);

  return `### 👋 Monday.com BI Business Agent (Demo Mode)

I am currently running in **offline Demo Mode** analyzing the imported Deals and Work Order datasets.

#### Consolidated Organization KPIs
*   **Cumulative Pipeline Value**: **${fmt(totalPipelineValue)}** (${deals.length} deals)
*   **Closed-Won Contract Value**: **${fmt(totalWonValue)}** (${deals.filter(d => d.dealStatus === 'Won').length} deals won)
*   **Total Invoiced Revenue (Excl. GST)**: **${fmt(totalBilledValue)}**
*   **Active Outstanding Accounts Receivable**: **${fmt(totalOutstandingAr)}**
*   **Data Health Score Status**: **${warnings.length} data warnings active** (Details inside diagnostics tab)

---

#### 💡 Suggested Questions to Ask Me:
*   *"How is our pipeline looking for the Renewables sector this quarter?"*
*   *"Summarize our unbilled work order value and identify top accounts by Amount Receivable."*
*   *"Compare Won deals count and value across all sectors. Which is performing best?"*
*   *Please note: To query arbitrary open-ended questions outside of standard templates in Demo Mode, please paste a valid Gemini API Key in the **Credentials** tab.*
${luffyCaveat}`;
};

