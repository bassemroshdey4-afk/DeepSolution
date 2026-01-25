/**
 * API Hooks for Deep Solution
 * 
 * Custom React hooks for data fetching and mutations
 */

import { useState, useEffect, useCallback } from 'react';

// Types
export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  cost: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  category: string | null;
  image_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_address: string;
  city: string;
  total_amount: number;
  shipping_cost: number;
  discount_amount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  payment_method: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment' | 'sale' | 'return';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  products?: { name: string; sku: string };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: Pagination;
  stats?: Record<string, number>;
  error?: string;
}

// Generic fetch hook
export function useApi<T>(
  url: string,
  options?: RequestInit
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch');
      }
      const result = await response.json();
      setData(result.data || result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Products hook
export function useProducts(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  is_active?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.is_active !== undefined) searchParams.set('is_active', params.is_active.toString());

  const url = `/api/products?${searchParams.toString()}`;
  
  const [data, setData] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch products');
      }
      const result = await response.json();
      setData(result.data || []);
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products: data, pagination, loading, error, refetch: fetchProducts };
}

// Orders hook
export function useOrders(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.date_from) searchParams.set('date_from', params.date_from);
  if (params?.date_to) searchParams.set('date_to', params.date_to);

  const url = `/api/orders?${searchParams.toString()}`;
  
  const [data, setData] = useState<Order[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch orders');
      }
      const result = await response.json();
      setData(result.data || []);
      setStats(result.stats || {});
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders: data, stats, pagination, loading, error, refetch: fetchOrders };
}

// Inventory hook
export function useInventory(params?: {
  page?: number;
  limit?: number;
  product_id?: string;
  movement_type?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.product_id) searchParams.set('product_id', params.product_id);
  if (params?.movement_type) searchParams.set('movement_type', params.movement_type);

  const url = `/api/inventory?${searchParams.toString()}`;
  
  const [data, setData] = useState<InventoryMovement[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch inventory');
      }
      const result = await response.json();
      setData(result.data || []);
      setLowStockProducts(result.lowStockProducts || []);
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return { movements: data, lowStockProducts, pagination, loading, error, refetch: fetchInventory };
}

// Mutation hooks
export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (variables: TVariables) => {
    setLoading(true);
    setError(null);
    try {
      const result = await mutationFn(variables);
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationFn]);

  return { mutate, data, loading, error };
}

// Product mutations
export const productApi = {
  create: async (data: Partial<Product>) => {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create product');
    }
    return response.json();
  },
  
  update: async (id: string, data: Partial<Product>) => {
    const response = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update product');
    }
    return response.json();
  },
  
  delete: async (id: string) => {
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete product');
    }
    return response.json();
  },
};

// Order mutations
export const orderApi = {
  create: async (data: {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    shipping_address: string;
    city: string;
    items: { product_id: string; quantity: number }[];
    shipping_cost?: number;
    discount_amount?: number;
    payment_method?: string;
    notes?: string;
  }) => {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create order');
    }
    return response.json();
  },
  
  update: async (id: string, data: Partial<Order>) => {
    const response = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update order');
    }
    return response.json();
  },
  
  delete: async (id: string) => {
    const response = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete order');
    }
    return response.json();
  },
};

// Inventory mutations
export const inventoryApi = {
  adjust: async (data: {
    product_id: string;
    quantity: number;
    movement_type: 'in' | 'out' | 'adjustment';
    notes?: string;
  }) => {
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to adjust inventory');
    }
    return response.json();
  },
};


// Shipping types
export interface Shipment {
  id: string;
  tenant_id: string;
  order_id: string;
  tracking_number: string;
  carrier: string;
  status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
  estimated_delivery: string | null;
  actual_delivery: string | null;
  shipping_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  orders?: { order_number: string; customer_name: string; city: string };
}

// Shipping hook
export function useShipments(params?: {
  page?: number;
  limit?: number;
  status?: string;
  carrier?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.carrier) searchParams.set('carrier', params.carrier);

  const url = `/api/shipping?${searchParams.toString()}`;
  
  const [data, setData] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch shipments');
      }
      const result = await response.json();
      setData(result.data || []);
      setStats(result.stats || {});
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  return { shipments: data, stats, pagination, loading, error, refetch: fetchShipments };
}

// Shipping mutations
export const shippingApi = {
  create: async (data: {
    order_id: string;
    carrier: string;
    tracking_number?: string;
    estimated_delivery?: string;
    shipping_cost?: number;
    notes?: string;
  }) => {
    const response = await fetch('/api/shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create shipment');
    }
    return response.json();
  },
  
  update: async (id: string, data: Partial<Shipment>) => {
    const response = await fetch(`/api/shipping/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update shipment');
    }
    return response.json();
  },
  
  updateStatus: async (id: string, status: string, notes?: string) => {
    const response = await fetch(`/api/shipping/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update status');
    }
    return response.json();
  },
};
