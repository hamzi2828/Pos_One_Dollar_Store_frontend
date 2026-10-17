import axios from "axios";
import { getAuthHeader } from "@/helper/helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface CarMake {
  id: string;
  name: string;
  logoUrl: string;
  active: boolean;
}

export interface CarModel {
  id: string;
  makeId: string;
  name: string;
  active: boolean;
}

export interface CarVariant {
  id: string;
  modelId: string;
  name: string;
  yearStart: number | null;
  yearEnd: number | null;
  active: boolean;
}

export interface UserCar {
  _id: string;
  makeId: string;
  modelId: string;
  variantId: string | null;
  makeName: string;
  makeLogoUrl?: string;
  modelName: string;
  variantName: string;
  createdAt?: string;
}

const jsonHeaders = () => ({
  "Content-Type": "application/json",
  ...getAuthHeader(),
});

// ── Catalog (shared with admin CarsTab endpoints) ────────────────────────────

export async function listCarMakes(): Promise<CarMake[]> {
  const res = await axios.get(`${API_BASE_URL}/car-makes`, { headers: jsonHeaders() });
  const raw = res.data?.data ?? [];
  return (raw as Array<{ _id: string; name: string; logoUrl?: string; active: boolean }>)
    .filter((m) => m.active !== false)
    .map((m) => ({
      id: m._id,
      name: m.name,
      logoUrl: m.logoUrl || "",
      active: m.active,
    }));
}

export async function listCarModels(makeId: string): Promise<CarModel[]> {
  const res = await axios.get(
    `${API_BASE_URL}/car-models?makeId=${encodeURIComponent(makeId)}`,
    { headers: jsonHeaders() }
  );
  const raw = res.data?.data ?? [];
  return (raw as Array<{ _id: string; makeId: string; name: string; active: boolean }>)
    .filter((m) => m.active !== false)
    .map((m) => ({ id: m._id, makeId: m.makeId, name: m.name, active: m.active }));
}

export async function listCarVariants(modelId: string): Promise<CarVariant[]> {
  const res = await axios.get(
    `${API_BASE_URL}/car-variants?modelId=${encodeURIComponent(modelId)}`,
    { headers: jsonHeaders() }
  );
  const raw = res.data?.data ?? [];
  return (raw as Array<{
    _id: string;
    modelId: string;
    name?: string;
    yearStart?: number | null;
    yearEnd?: number | null;
    active: boolean;
  }>)
    .filter((v) => v.active !== false)
    .map((v) => ({
      id: v._id,
      modelId: v.modelId,
      name: v.name || "",
      yearStart: v.yearStart ?? null,
      yearEnd: v.yearEnd ?? null,
      active: v.active,
    }));
}

// ── User Garage (multi-car) ──────────────────────────────────────────────────

export interface SaveCarPayload {
  makeId: string;
  modelId: string;
  variantId?: string | null;
}

export async function listMyCars(): Promise<UserCar[]> {
  const res = await axios.get(`${API_BASE_URL}/user/cars`, { headers: jsonHeaders() });
  const data = res.data?.data ?? [];
  return Array.isArray(data) ? (data as UserCar[]) : [];
}

export async function addMyCar(payload: SaveCarPayload): Promise<UserCar[]> {
  const res = await axios.post(`${API_BASE_URL}/user/cars`, payload, { headers: jsonHeaders() });
  const data = res.data?.data ?? [];
  return Array.isArray(data) ? (data as UserCar[]) : [];
}

export async function updateMyCar(carId: string, payload: SaveCarPayload): Promise<UserCar[]> {
  const res = await axios.put(`${API_BASE_URL}/user/cars/${carId}`, payload, { headers: jsonHeaders() });
  const data = res.data?.data ?? [];
  return Array.isArray(data) ? (data as UserCar[]) : [];
}

export async function removeMyCar(carId: string): Promise<UserCar[]> {
  const res = await axios.delete(`${API_BASE_URL}/user/cars/${carId}`, { headers: jsonHeaders() });
  const data = res.data?.data ?? [];
  return Array.isArray(data) ? (data as UserCar[]) : [];
}
