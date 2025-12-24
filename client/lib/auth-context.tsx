/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, User } from './api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signup: (email: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

interface AuthTokens {
  accessToken: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  });
  const queryClient = useQueryClient();

  // Query to get current user
  const { data: userData, isLoading, error } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      if (!accessToken) return null;
      const response = await apiClient.getMe();
      return response.data?.user || null;
    },
    enabled: !!accessToken,
    retry: false,
  });

  // Update user state when query data changes
  useEffect(() => {
    if (userData) {
      
      setUser(userData);
    } else if (error && accessToken) {
      // Token is invalid, clear auth
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('accessToken');
    }
  }, [userData, error, accessToken]);

  // Mutations
  const signupMutation = useMutation({
    mutationFn: apiClient.signup,
  });

  const resendOtpMutation = useMutation({
    mutationFn: apiClient.resendOtp,
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      apiClient.verifyOtp(email, otp),
    onSuccess: (data) => {
      const tokenData = data.data!;
      setAccessToken(tokenData.accessToken);
      localStorage.setItem('accessToken', tokenData.accessToken);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: apiClient.logout,
    onSuccess: () => {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('accessToken');
      queryClient.clear();
    },
  });

  const refreshTokenMutation = useMutation({
    mutationFn: apiClient.refreshToken,
    onSuccess: (data) => {
      const tokenData = data.data!;
      setAccessToken(tokenData.accessToken);
      localStorage.setItem('accessToken', tokenData.accessToken);
    },
  });

  const signup = async (email: string) => {
    await signupMutation.mutateAsync(email);
  };

  const resendOtp = async (email: string) => {
    await resendOtpMutation.mutateAsync(email);
  };

  const verifyOtp = async (email: string, otp: string) => {
    await verifyOtpMutation.mutateAsync({ email, otp });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const refreshToken = async () => {
    await refreshTokenMutation.mutateAsync();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signup,
    resendOtp,
    verifyOtp,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
