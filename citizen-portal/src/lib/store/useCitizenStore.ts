'use client';

import { useState, useEffect, useCallback } from 'react';
import { ReliefRequest } from '../types';
import { INITIAL_REQUESTS } from '../data/initialScenario';

const STORAGE_KEY = 'resqgrid_citizen_requests_v1';

export function useCitizenStore() {
  const [requests, setRequests] = useState<ReliefRequest[]>(INITIAL_REQUESTS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize from localStorage or seed initial requests
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRequests(parsed);
          setIsLoaded(true);
          return;
        }
      }
      // If nothing stored, seed with initial scenario requests
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REQUESTS));
      setRequests(INITIAL_REQUESTS);
    } catch (e) {
      console.warn('LocalStorage access error, falling back to in-memory state', e);
      setRequests(INITIAL_REQUESTS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Fetch live requests from Neon PostgreSQL database on mount and keep synced
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/requests', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setRequests(data);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (_) {}
          }
        }
      } catch (e) {
        console.warn('Could not fetch requests from Neon DB in citizen store:', e);
      }
    };

    fetchLatest();
  }, []);

  // Save new request
  const submitRequest = useCallback((newReq: ReliefRequest) => {
    setRequests((prev) => {
      const updated = [newReq, ...prev.filter((r) => r.id !== newReq.id)];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        // Dispatch storage event for other components/tabs
        window.dispatchEvent(new Event('resqgrid_storage_updated'));
      } catch (e) {
        console.error('Failed to save to localStorage', e);
      }
      return updated;
    });
  }, []);

  // Find request by ID (case-insensitive)
  const getRequestById = useCallback(
    (id: string): ReliefRequest | undefined => {
      if (!id) return undefined;
      const cleanId = id.trim().toUpperCase();
      return requests.find((r) => r.id.toUpperCase() === cleanId);
    },
    [requests]
  );

  // Reset to initial scenario
  const resetDemoState = useCallback(() => {
    setRequests(INITIAL_REQUESTS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REQUESTS));
      window.dispatchEvent(new Event('resqgrid_storage_updated'));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Listen for storage sync across browser tabs/components
  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setRequests(JSON.parse(stored));
        }
      } catch (e) {
        console.error(e);
      }
    };

    window.addEventListener('resqgrid_storage_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('resqgrid_storage_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  return {
    requests,
    isLoaded,
    submitRequest,
    getRequestById,
    resetDemoState,
  };
}
