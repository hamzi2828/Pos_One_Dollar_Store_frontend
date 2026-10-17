// POS Customer Service
import { getAuthHeader } from "@/helper/helper";
import { GetUsersResponse, POSCustomer } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

/**
 * Search customers/users
 */
export async function searchCustomers(query: string): Promise<POSCustomer[]> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/customers/search?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to search customers' }));
    throw new Error(error.message || 'Failed to search customers');
  }

  const response: GetUsersResponse = await res.json();
  return response.data || [];
}

/**
 * Get all customers/users
 */
export async function getAllCustomers(): Promise<POSCustomer[]> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/customers`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch customers' }));
    throw new Error(error.message || 'Failed to fetch customers');
  }

  const response: GetUsersResponse = await res.json();
  return response.data || [];
}

/**
 * Get customer by ID
 */
export async function getCustomerById(id: string): Promise<POSCustomer | null> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/customers/${id}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    return null;
  }

  const response = await res.json();
  return response.data || null;
}

/**
 * Create or find customer from POS
 */
export interface CreateCustomerData {
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  vehicleName: string;
}

export interface CreateCustomerResponse {
  success: boolean;
  data: POSCustomer;
  message: string;
  isNew: boolean;
}

export async function addCarToCustomer(
  customerId: string,
  car: { brand: string; model: string; numberPlate?: string }
): Promise<POSCustomer> {
  if (!API_BASE_URL) throw new Error('Missing NEXT_PUBLIC_BACKEND_URL');
  const res = await fetch(`${API_BASE_URL}/api/pos/customers/${customerId}/cars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(car),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to add car' }));
    throw new Error(err.message || 'Failed to add car');
  }
  const json = await res.json();
  return json.data as POSCustomer;
}

export async function createOrFindCustomer(data: CreateCustomerData): Promise<CreateCustomerResponse> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/customers`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to create customer' }));
    throw new Error(error.message || 'Failed to create customer');
  }

  return await res.json();
}
