const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7002/api/v1';

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  currentSubscription?: {
    tier: string;
    status: string;
  };
}

export interface ApiResponse<T = Record<string, unknown>> {
  status: string;
  message: string;
  data?: T;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

// Helper function for making requests
async function makeRequest<T>(
  baseURL: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseURL}${endpoint}`;

  // Get access token from localStorage for authenticated requests
  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  // Add Authorization header if token exists
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const config: RequestInit = {
    headers,
    ...options,
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

// API client object
export const apiClient = {
  // Auth endpoints
  signup: (email: string): Promise<ApiResponse> =>
    makeRequest(API_BASE_URL, '/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resendOtp: (email: string): Promise<ApiResponse> =>
    makeRequest(API_BASE_URL, '/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, otp: string): Promise<ApiResponse<AuthResponse>> =>
    makeRequest(API_BASE_URL, '/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  refreshToken: (): Promise<ApiResponse<{ accessToken: string }>> =>
    makeRequest(API_BASE_URL, '/auth/refresh', {
      method: 'POST',
    }),

  logout: (): Promise<ApiResponse> =>
    makeRequest(API_BASE_URL, '/auth/logout', {
      method: 'POST',
    }),

  getMe: (): Promise<ApiResponse<{ user: User }>> =>
    makeRequest(API_BASE_URL, '/auth/me'),
};
