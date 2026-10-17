export interface LoadEntry {
  _id: string;
  amount: number;
  provider: string;
  reference: string;
  note: string;
  at: string;
}

/** One network's balance sheet for a single calendar day. */
export interface NetworkDay {
  _id: string | null;
  network: string;
  /** 'YYYY-MM-DD' */
  date: string;
  openingBalance: number;
  /** null until the day has been closed off */
  closingBalance: number | null;
  loads: LoadEntry[];
  notes: string;

  // Derived server-side from the fields above — never sent back up.
  loadTotal: number;
  /** openingBalance + loadTotal — what we should hold before sales */
  expectedBalance: number;
  /** openingBalance + loadTotal - closingBalance, or null while open */
  sold: number | null;
  isClosed: boolean;
}

export interface Network {
  _id: string;
  name: string;
  code: string;
  color: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Position for the date the list was requested for */
  today: NetworkDay;
}

export interface CreateNetworkData {
  name: string;
  code?: string;
  color?: string;
  notes?: string;
}

export interface UpdateNetworkData {
  name?: string;
  code?: string;
  color?: string;
  notes?: string;
  isActive?: boolean;
}

export interface UpsertDayData {
  openingBalance?: number;
  closingBalance?: number | null;
  notes?: string;
}

export interface AddLoadData {
  amount: number;
  provider?: string;
  reference?: string;
  note?: string;
}
