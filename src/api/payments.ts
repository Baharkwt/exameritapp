import { api, toApiError } from './client';

/** GET /api/plans (backend/routes/payments.js) */
export interface PlanItem {
  id: number;
  name?: string;
  display_name: string;
  description: string | null;
  monthly_price: string | number;
  yearly_price: string | number;
  features: string[] | Record<string, unknown> | null;
  category_access: string[] | null;
  limits: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
}

/** GET /api/subscriptions/me */
export interface MySubscription {
  id: number;
  user_id: number;
  plan_id: number;
  status: 'active' | 'cancelled' | 'expired' | string;
  billing_cycle: 'monthly' | 'yearly' | string;
  starts_at?: string;
  expires_at?: string | null;
  created_at: string;
  plan_name: string;
  plan_description: string | null;
  monthly_price: string | number;
  yearly_price: string | number;
  features: string[] | Record<string, unknown> | null;
  category_access: string[] | null;
}

/** POST /api/coupons/validate */
export interface CouponValidationResponse {
  valid: boolean;
  coupon_id: number;
  code: string;
  discount_type: 'percent' | 'fixed' | string;
  discount_value: number;
  discount_amount: number;
  applicable_to: string | null;
}

/** GET /api/payments/history */
export interface PaymentHistoryRow {
  id: number;
  user_id: number;
  subscription_id: number | null;
  amount: string | number;
  currency?: string;
  status: string;
  payment_method?: string | null;
  transaction_id?: string | null;
  billing_cycle?: string | null;
  plan_name?: string | null;
  created_at: string;
}

export async function getPlans(): Promise<PlanItem[]> {
  try {
    const { data } = await api.get<PlanItem[]>('/plans');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getMySubscription(): Promise<MySubscription | null> {
  try {
    const { data } = await api.get<MySubscription | null>('/subscriptions/me');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function cancelMySubscription(): Promise<{ ok: boolean; subscription: MySubscription }> {
  try {
    const { data } = await api.post<{ ok: boolean; subscription: MySubscription }>('/subscriptions/cancel');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function validateCoupon(body: {
  code: string;
  order_amount: number;
}): Promise<CouponValidationResponse> {
  try {
    const { data } = await api.post<CouponValidationResponse>('/coupons/validate', body);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getPaymentHistory(): Promise<PaymentHistoryRow[]> {
  try {
    const { data } = await api.get<PaymentHistoryRow[]>('/payments/history');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function createSubscriptionOrder(body: {
  plan_id: number;
  billing_cycle: 'monthly' | 'yearly';
  coupon_code?: string;
  payment_method: string;
}): Promise<Record<string, unknown>> {
  try {
    const { data } = await api.post<Record<string, unknown>>('/subscriptions/create', body);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function verifySubscriptionPayment(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const { data } = await api.post<Record<string, unknown>>('/subscriptions/verify', body);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

