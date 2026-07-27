import {
  MOCK_DEALS,
  MOCK_DEALS_COLUMNS,
  MOCK_DEALS_MAPPING,
  MOCK_WO,
  MOCK_WO_COLUMNS,
  MOCK_WO_MAPPING
} from './mockData';

export interface MondayBoardData {
  name: string;
  columns: Array<{ id: string; title: string; type: string }>;
  items: any[];
  columnMapping: Record<string, string>; // Canonical Title -> Monday ID
}

// Normalized string compare for matching CSV column titles to board columns
export const normalizeColumnTitle = (title: string): string => {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Check if a token is valid on Monday.com
export const checkMondayConnection = async (token: string): Promise<boolean> => {
  if (!token) return false;
  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2023-10'
      },
      body: JSON.stringify({
        query: `
          query {
            me {
              id
              name
            }
          }
        `
      })
    });
    const result = await response.json();
    return !!result.data?.me?.id;
  } catch (error) {
    console.error('Error verifying Monday connection:', error);
    return false;
  }
};

// Fetch board details and all items (including pagination)
export const fetchMondayBoard = async (
  token: string,
  boardId: string,
  expectedTitles: string[]
): Promise<MondayBoardData> => {
  if (!token || !boardId) {
    throw new Error('Monday API Token and Board ID are required.');
  }

  // GraphQL query to fetch board name, schema, and first page of items
  const query = `
    query GetBoard($boardId: [ID!]) {
      boards(ids: $boardId) {
        name
        columns {
          id
          title
          type
        }
        items_page(limit: 100) {
          cursor
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'API-Version': '2023-10'
    },
    body: JSON.stringify({
      query,
      variables: { boardId: [boardId] }
    })
  });

  const resJson = await response.json();
  if (resJson.errors) {
    throw new Error(`Monday API Error: ${resJson.errors.map((e: any) => e.message).join(', ')}`);
  }

  const board = resJson.data?.boards?.[0];
  if (!board) {
    throw new Error(`Board with ID ${boardId} not found in this account.`);
  }

  const name = board.name;
  const columns = board.columns || [];
  let items = board.items_page?.items || [];
  let cursor = board.items_page?.cursor;

  // Handle pagination if there's a cursor (next_items_page)
  while (cursor) {
    const nextQuery = `
      query GetNextPage($cursor: String!) {
        next_items_page(limit: 100, cursor: $cursor) {
          cursor
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    `;

    const nextResponse = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2023-10'
      },
      body: JSON.stringify({
        query: nextQuery,
        variables: { cursor }
      })
    });

    const nextJson = await nextResponse.json();
    const nextData = nextJson.data?.next_items_page;
    if (nextData?.items) {
      items = [...items, ...nextData.items];
    }
    cursor = nextData?.cursor;
  }

  // Resolve column mapping dynamically
  const columnMapping: Record<string, string> = {};
  
  // Set default name field mapping
  columnMapping['name'] = 'name';

  expectedTitles.forEach((canonicalTitle) => {
    const normCanonical = normalizeColumnTitle(canonicalTitle);
    
    // Find matching column in monday board
    const match = columns.find((col: any) => {
      const normBoard = normalizeColumnTitle(col.title);
      // Direct exact normalized match
      if (normBoard === normCanonical) return true;
      // Partial matching for tricky names (like "Sector/service" matching "Sector" or "Service")
      if (normCanonical.includes(normBoard) && normBoard.length > 3) return true;
      if (normBoard.includes(normCanonical) && normCanonical.length > 3) return true;
      return false;
    });

    if (match) {
      columnMapping[canonicalTitle] = match.id;
    } else {
      // Fallback: If not found, let's look for a column by exact title match (case insensitive)
      const exactMatch = columns.find(
        (col: any) => col.title.toLowerCase() === canonicalTitle.toLowerCase()
      );
      if (exactMatch) {
        columnMapping[canonicalTitle] = exactMatch.id;
      }
    }
  });

  return {
    name,
    columns,
    items,
    columnMapping
  };
};

// Retrieve mock data for Demo Mode
export const fetchMockBoardData = (type: 'deals' | 'workOrders'): MondayBoardData => {
  if (type === 'deals') {
    return {
      name: 'Simulated Deals Board',
      columns: MOCK_DEALS_COLUMNS,
      items: MOCK_DEALS,
      columnMapping: MOCK_DEALS_MAPPING
    };
  } else {
    return {
      name: 'Simulated Work Orders Board',
      columns: MOCK_WO_COLUMNS,
      items: MOCK_WO,
      columnMapping: MOCK_WO_MAPPING
    };
  }
};
