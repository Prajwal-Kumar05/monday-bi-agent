export interface DataWarning {
  board: 'Deals' | 'Work Orders';
  row: string; // Deal name or row index
  column: string;
  issueType: 'missing' | 'format' | 'excel_error' | 'logical';
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface CleanedData {
  deals: any[];
  workOrders: any[];
  warnings: DataWarning[];
  diagnostics: {
    dealsHealthScore: number;
    woHealthScore: number;
    totalDeals: number;
    totalWorkOrders: number;
    cleanedDealsCount: number;
    cleanedWorkOrdersCount: number;
    missingValuesCount: number;
    excelErrorsCount: number;
    formatErrorsCount: number;
  };
}

// Normalized helper to clean text whitespace
const cleanText = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

// Normalize numeric fields
const cleanNumeric = (
  val: any,
  board: 'Deals' | 'Work Orders',
  rowName: string,
  colName: string,
  warnings: DataWarning[],
  isRequired = false
): number | null => {
  const strVal = cleanText(val);
  if (!strVal) {
    if (isRequired) {
      warnings.push({
        board,
        row: rowName,
        column: colName,
        issueType: 'missing',
        message: `Missing value for required numeric field "${colName}". Defaulting to 0.`,
        severity: 'warning'
      });
    }
    return null;
  }

  if (strVal.includes('#VALUE!') || strVal.includes('#REF!') || strVal.includes('#DIV/0!')) {
    warnings.push({
      board,
      row: rowName,
      column: colName,
      issueType: 'excel_error',
      message: `Excel error "${strVal}" found in column "${colName}". Resetting value to 0.`,
      severity: 'warning'
    });
    return 0;
  }

  // Remove commas, currency symbols, and whitespace
  const sanitized = strVal.replace(/[$,₹,A-Z,a-z,\s]/g, '').trim();
  const parsed = parseFloat(sanitized);

  if (isNaN(parsed)) {
    warnings.push({
      board,
      row: rowName,
      column: colName,
      issueType: 'format',
      message: `Failed to parse numeric value "${strVal}" in column "${colName}". Defaulting to 0.`,
      severity: 'warning'
    });
    return 0;
  }

  return parsed;
};

// Normalize dates to YYYY-MM-DD
const cleanDate = (
  val: any,
  board: 'Deals' | 'Work Orders',
  rowName: string,
  colName: string,
  warnings: DataWarning[]
): string | null => {
  const strVal = cleanText(val);
  if (!strVal || strVal.toLowerCase() === 'null' || strVal === '-') {
    return null;
  }

  // Try parsing the date
  const dateObj = new Date(strVal);
  if (isNaN(dateObj.getTime())) {
    warnings.push({
      board,
      row: rowName,
      column: colName,
      issueType: 'format',
      message: `Invalid date format "${strVal}" in column "${colName}". Storing raw text.`,
      severity: 'info'
    });
    return strVal;
  }

  // Format as YYYY-MM-DD
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Normalize sector names
const cleanSector = (sector: string): string => {
  const clean = sector.trim().toLowerCase();
  if (clean.includes('mining')) return 'Mining';
  if (clean.includes('renew') || clean.includes('solar') || clean.includes('wind')) return 'Renewables';
  if (clean.includes('rail')) return 'Railways';
  if (clean.includes('power')) return 'Powerline';
  if (clean.includes('construct')) return 'Construction';
  if (clean.includes('aviation')) return 'Aviation';
  if (clean.includes('manufacturing')) return 'Manufacturing';
  if (clean.includes('security')) return 'Security and Surveillance';
  if (!clean || clean === 'nan' || clean === 'others' || clean === 'others/service') return 'Others';
  return sector.trim(); // fallback to original casing if unknown
};

export const cleanAndNormalizeData = (
  rawDeals: any[],
  rawWorkOrders: any[],
  dealsMapping: Record<string, string>, // Maps canonical title -> Monday column ID
  woMapping: Record<string, string> // Maps canonical title -> Monday column ID
): CleanedData => {
  const warnings: DataWarning[] = [];
  const cleanedDeals: any[] = [];
  const cleanedWorkOrders: any[] = [];

  let missingValuesCount = 0;
  let excelErrorsCount = 0;
  let formatErrorsCount = 0;

  // Process Deals
  rawDeals.forEach((item, idx) => {
    // Helper to get raw column text
    const getValueByTitle = (title: string) => {
      const colId = dealsMapping[title];
      if (!colId) return null;
      // Monday raw items are often [{ id, text }] or key-value
      const colVal = item.column_values?.find((cv: any) => cv.id === colId);
      return colVal ? colVal.text : item[colId] || item[title];
    };

    const dealName = cleanText(item.name || getValueByTitle('Deal Name'));

    // Filter out empty rows or repeated headers
    if (!dealName || dealName.toLowerCase() === 'deal name' || dealName === 'Deal Name') {
      return;
    }

    const ownerCode = cleanText(getValueByTitle('Owner code'));
    const clientCode = cleanText(getValueByTitle('Client Code'));
    const dealStatus = cleanText(getValueByTitle('Deal Status'));
    const dealStage = cleanText(getValueByTitle('Deal Stage'));
    const productDeal = cleanText(getValueByTitle('Product deal'));
    const rawSector = cleanText(getValueByTitle('Sector/service'));
    const sector = cleanSector(rawSector);

    // Track missing values
    if (!clientCode) warnings.push({ board: 'Deals', row: dealName || `Row ${idx}`, column: 'Client Code', issueType: 'missing', message: 'Client Code is missing.', severity: 'warning' });
    if (!dealStatus) warnings.push({ board: 'Deals', row: dealName || `Row ${idx}`, column: 'Deal Status', issueType: 'missing', message: 'Deal Status is missing.', severity: 'info' });

    // Numeric and dates
    const dealValue = cleanNumeric(getValueByTitle('Masked Deal value'), 'Deals', dealName, 'Masked Deal value', warnings);
    const closeProbabilityStr = getValueByTitle('Closure Probability');
    // Probability might be string percentage like "50%" or decimal "0.5" or just number
    let probability: number | null = null;
    if (closeProbabilityStr) {
      const cleanProb = cleanText(closeProbabilityStr).replace('%', '');
      const parsedProb = parseFloat(cleanProb);
      if (!isNaN(parsedProb)) {
        probability = parsedProb > 1 ? parsedProb / 100 : parsedProb;
      }
    }

    const closeDate = cleanDate(getValueByTitle('Close Date (A)'), 'Deals', dealName, 'Close Date (A)', warnings);
    const tentativeCloseDate = cleanDate(getValueByTitle('Tentative Close Date'), 'Deals', dealName, 'Tentative Close Date', warnings);
    const createdDate = cleanDate(getValueByTitle('Created Date'), 'Deals', dealName, 'Created Date', warnings);

    cleanedDeals.push({
      id: item.id || `deal_${idx}`,
      dealName,
      ownerCode,
      clientCode,
      dealStatus: dealStatus || 'Unknown',
      dealStage: dealStage || 'Unknown',
      dealValue: dealValue || 0,
      closureProbability: probability,
      closeDate,
      tentativeCloseDate,
      productDeal,
      sector,
      rawSector,
      createdDate
    });
  });

  // Process Work Orders
  rawWorkOrders.forEach((item, idx) => {
    const getValueByTitle = (title: string) => {
      const colId = woMapping[title];
      if (!colId) return null;
      const colVal = item.column_values?.find((cv: any) => cv.id === colId);
      return colVal ? colVal.text : item[colId] || item[title];
    };

    const dealName = cleanText(item.name || getValueByTitle('Deal name masked'));

    // Filter out header duplicates
    if (!dealName || dealName.toLowerCase() === 'deal name masked' || dealName === 'Deal name masked') {
      return;
    }

    const customerCode = cleanText(getValueByTitle('Customer Name Code'));
    const serialNo = cleanText(getValueByTitle('Serial #'));
    const natureOfWork = cleanText(getValueByTitle('Nature of Work'));
    const executionStatus = cleanText(getValueByTitle('Execution Status'));
    const docType = cleanText(getValueByTitle('Document Type'));
    const kamCode = cleanText(getValueByTitle('BD/KAM Personnel code'));
    const rawSector = cleanText(getValueByTitle('Sector'));
    const sector = cleanSector(rawSector);
    const typeOfWork = cleanText(getValueByTitle('Type of Work'));
    const isSoftwareDeliverable = cleanText(getValueByTitle('Is any Skylark software platform part of the client deliverables in this deal?'));
    const invoiceNo = cleanText(getValueByTitle('latest invoice no.'));
    const arPriority = cleanText(getValueByTitle('AR Priority account'));
    const invoiceStatus = cleanText(getValueByTitle('Invoice Status'));
    const billingStatus = cleanText(getValueByTitle('Billing Status'));
    const billingMonthExpected = cleanText(getValueByTitle('Expected Billing Month'));
    const billingMonthActual = cleanText(getValueByTitle('Actual Billing Month'));
    const collectionMonthActual = cleanText(getValueByTitle('Actual Collection Month'));
    const woStatusBilled = cleanText(getValueByTitle('WO Status (billed)'));
    const collectionStatus = cleanText(getValueByTitle('Collection status'));

    // Numeric calculations
    const amtExclGst = cleanNumeric(getValueByTitle('Amount in Rupees (Excl of GST) (Masked)'), 'Work Orders', dealName, 'Amount in Rupees (Excl of GST) (Masked)', warnings);
    const amtInclGst = cleanNumeric(getValueByTitle('Amount in Rupees (Incl of GST) (Masked)'), 'Work Orders', dealName, 'Amount in Rupees (Incl of GST) (Masked)', warnings);
    const billedExclGst = cleanNumeric(getValueByTitle('Billed Value in Rupees (Excl of GST.) (Masked)'), 'Work Orders', dealName, 'Billed Value in Rupees (Excl of GST.) (Masked)', warnings);
    const billedInclGst = cleanNumeric(getValueByTitle('Billed Value in Rupees (Incl of GST.) (Masked)'), 'Work Orders', dealName, 'Billed Value in Rupees (Incl of GST.) (Masked)', warnings);
    const collectedInclGst = cleanNumeric(getValueByTitle('Collected Amount in Rupees (Incl of GST.) (Masked)'), 'Work Orders', dealName, 'Collected Amount in Rupees (Incl of GST.) (Masked)', warnings);
    const toBillExclGst = cleanNumeric(getValueByTitle('Amount to be billed in Rs. (Exl. of GST) (Masked)'), 'Work Orders', dealName, 'Amount to be billed in Rs. (Exl. of GST) (Masked)', warnings);
    const toBillInclGst = cleanNumeric(getValueByTitle('Amount to be billed in Rs. (Incl. of GST) (Masked)'), 'Work Orders', dealName, 'Amount to be billed in Rs. (Incl. of GST) (Masked)', warnings);
    const amountReceivable = cleanNumeric(getValueByTitle('Amount Receivable (Masked)'), 'Work Orders', dealName, 'Amount Receivable (Masked)', warnings);

    // Quantity data
    const qtyOps = cleanText(getValueByTitle('Quantity by Ops'));
    const qtyPo = cleanText(getValueByTitle('Quantities as per PO'));
    const qtyBilled = cleanText(getValueByTitle('Quantity billed (till date)'));
    const qtyBalance = cleanText(getValueByTitle('Balance in quantity'));

    // Dates
    const deliveryDate = cleanDate(getValueByTitle('Data Delivery Date'), 'Work Orders', dealName, 'Data Delivery Date', warnings);
    const poDate = cleanDate(getValueByTitle('Date of PO/LOI'), 'Work Orders', dealName, 'Date of PO/LOI', warnings);
    const probStartDate = cleanDate(getValueByTitle('Probable Start Date'), 'Work Orders', dealName, 'Probable Start Date', warnings);
    const probEndDate = cleanDate(getValueByTitle('Probable End Date'), 'Work Orders', dealName, 'Probable End Date', warnings);
    const lastInvoiceDate = cleanDate(getValueByTitle('Last invoice date'), 'Work Orders', dealName, 'Last invoice date', warnings);
    const collectionDate = cleanDate(getValueByTitle('Collection Date'), 'Work Orders', dealName, 'Collection Date', warnings);
    const recurringMonth = cleanText(getValueByTitle('Last executed month of recurring project'));

    // Check logical validation: Billed + To Bill should match Total PO Value (approx)
    if (amtExclGst && billedExclGst && toBillExclGst) {
      const sum = billedExclGst + toBillExclGst;
      const difference = Math.abs(amtExclGst - sum);
      if (difference > 10) { // allow small rounding errors
        warnings.push({
          board: 'Work Orders',
          row: dealName,
          column: 'Financial Alignment',
          issueType: 'logical',
          message: `Sum of Billed (${billedExclGst.toLocaleString()}) and To Be Billed (${toBillExclGst.toLocaleString()}) does not match Total Amount Excl GST (${amtExclGst.toLocaleString()}). Diff: ${difference.toFixed(2)}`,
          severity: 'info'
        });
      }
    }

    cleanedWorkOrders.push({
      id: item.id || `wo_${idx}`,
      dealName,
      customerCode,
      serialNo,
      natureOfWork,
      executionStatus: executionStatus || 'Unknown',
      deliveryDate,
      poDate,
      docType,
      probStartDate,
      probEndDate,
      kamCode,
      sector,
      rawSector,
      typeOfWork,
      isSoftwareDeliverable,
      lastInvoiceDate,
      invoiceNo,
      amtExclGst: amtExclGst || 0,
      amtInclGst: amtInclGst || 0,
      billedExclGst: billedExclGst || 0,
      billedInclGst: billedInclGst || 0,
      collectedInclGst: collectedInclGst || 0,
      toBillExclGst: toBillExclGst || 0,
      toBillInclGst: toBillInclGst || 0,
      amountReceivable: amountReceivable || 0,
      arPriority,
      qtyOps,
      qtyPo,
      qtyBilled,
      qtyBalance,
      invoiceStatus,
      billingStatus,
      billingMonthExpected,
      billingMonthActual,
      collectionMonthActual,
      woStatusBilled,
      collectionStatus,
      collectionDate,
      recurringMonth
    });
  });

  // Calculate diagnostic counts
  warnings.forEach(w => {
    if (w.issueType === 'missing') missingValuesCount++;
    else if (w.issueType === 'excel_error') excelErrorsCount++;
    else if (w.issueType === 'format') formatErrorsCount++;
  });

  // Calculate health scores (simple percentage of warning-free fields)
  // Total potential fields = dealsCount * 12 + workOrdersCount * 38
  const totalDealsFields = cleanedDeals.length * 12;
  const totalWoFields = cleanedWorkOrders.length * 38;
  
  const dealWarnings = warnings.filter(w => w.board === 'Deals').length;
  const woWarnings = warnings.filter(w => w.board === 'Work Orders').length;

  const dealsHealthScore = Math.max(0, Math.min(100, Math.round(((totalDealsFields - dealWarnings) / Math.max(1, totalDealsFields)) * 100)));
  const woHealthScore = Math.max(0, Math.min(100, Math.round(((totalWoFields - woWarnings) / Math.max(1, totalWoFields)) * 100)));

  return {
    deals: cleanedDeals,
    workOrders: cleanedWorkOrders,
    warnings,
    diagnostics: {
      dealsHealthScore,
      woHealthScore,
      totalDeals: rawDeals.length,
      totalWorkOrders: rawWorkOrders.length,
      cleanedDealsCount: cleanedDeals.length,
      cleanedWorkOrdersCount: cleanedWorkOrders.length,
      missingValuesCount,
      excelErrorsCount,
      formatErrorsCount
    }
  };
};
