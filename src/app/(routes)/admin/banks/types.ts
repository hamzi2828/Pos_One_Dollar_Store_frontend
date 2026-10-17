export interface Bank {
  _id: string;
  name: string;
  accountNumber: string;
  accountTitle: string;
  branch: string;
  iban: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RawBank {
  _id: string | number;
  name?: string;
  accountNumber?: string;
  accountTitle?: string;
  branch?: string;
  iban?: string;
  notes?: string;
  isActive?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateBankData {
  name: string;
  accountNumber: string;
  accountTitle: string;
  branch?: string;
  iban?: string;
  notes?: string;
}

export interface UpdateBankData {
  name?: string;
  accountNumber?: string;
  accountTitle?: string;
  branch?: string;
  iban?: string;
  notes?: string;
  isActive?: boolean;
}
