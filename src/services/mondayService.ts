import {
  MOCK_DEALS,
  MOCK_DEALS_COLUMNS,
  MOCK_DEALS_MAPPING,
  MOCK_WO,
  MOCK_WO_COLUMNS,
  MOCK_WO_MAPPING
} from "./mockData";

export interface MondayBoardData {
  name: string;
  columns: Array<{ id: string; title: string; type: string }>;
  items: any[];
  columnMapping: Record<string, string>;
}

// Normalize titles for matching
export const normalizeColumnTitle = (title: string): string => {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
};

// No longer needed because backend handles authentication
export const checkMondayConnection = async (): Promise<boolean> => {
  return true;
};

// Fetch board data from backend
export const fetchMondayBoard = async (
  boardId: string,
  expectedTitles: string[]
): Promise<MondayBoardData> => {
  try {
    const API_URL = import.meta.env.VITE_API_URL;

const response = await fetch(
  `${API_URL}/monday/${boardId}`
);

    console.log("HTTP Status:", response.status);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const resJson = await response.json();

    console.log("Backend Response:", resJson);

    if (resJson.errors) {
      throw new Error(
        resJson.errors.map((e: any) => e.message).join(", ")
      );
    }

    const board = resJson.data?.boards?.[0];

    console.log("Board:", board);

    if (!board) {
      throw new Error(`Board with ID ${boardId} not found.`);
    }

    const name = board.name;
    const columns = board.columns || [];
    const items = board.items_page?.items || [];

    const columnMapping: Record<string, string> = {};

    columnMapping["name"] = "name";

    expectedTitles.forEach((canonicalTitle) => {
      const normCanonical = normalizeColumnTitle(canonicalTitle);

      const match = columns.find((col: any) => {
        const normBoard = normalizeColumnTitle(col.title);

        return (
          normBoard === normCanonical ||
          (normCanonical.includes(normBoard) && normBoard.length > 3) ||
          (normBoard.includes(normCanonical) && normCanonical.length > 3)
        );
      });

      if (match) {
        columnMapping[canonicalTitle] = match.id;
      } else {
        const exactMatch = columns.find(
          (col: any) =>
            col.title.toLowerCase() === canonicalTitle.toLowerCase()
        );

        if (exactMatch) {
          columnMapping[canonicalTitle] = exactMatch.id;
        }
      }
    });

    console.log("Column Mapping:", columnMapping);

    return {
      name,
      columns,
      items,
      columnMapping
    };
  } catch (err) {
    console.error("fetchMondayBoard Error:", err);
    throw err;
  }
};

// Demo mode
export const fetchMockBoardData = (
  type: "deals" | "workOrders"
): MondayBoardData => {
  if (type === "deals") {
    return {
      name: "Simulated Deals Board",
      columns: MOCK_DEALS_COLUMNS,
      items: MOCK_DEALS,
      columnMapping: MOCK_DEALS_MAPPING
    };
  }

  return {
    name: "Simulated Work Orders Board",
    columns: MOCK_WO_COLUMNS,
    items: MOCK_WO,
    columnMapping: MOCK_WO_MAPPING
  };
};