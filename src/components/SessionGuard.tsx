'use client';

// When the admin signs someone out (backend answers 401 code SESSION_ENDED),
// forget the login and go to the sign-in page at once, not only on reload.
import { useEffect } from 'react';
import axios from 'axios';
import { clearAllAuth } from '@/helper/helper';

const ENDED = 'SESSION_ENDED';

function endSession() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/authentication')) return;
  clearAllAuth();
  window.location.replace('/authentication');
}

export default function SessionGuard() {
  useEffect(() => {
    const id = axios.interceptors.response.use(undefined, (err) => {
      if (err?.response?.status === 401 && err.response.data?.code === ENDED) endSession();
      return Promise.reject(err);
    });

    // Pages that call fetch() directly: peek at 401 answers too.
    const realFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await realFetch(...args);
      if (res.status === 401) {
        res
          .clone()
          .json()
          .then((b) => b?.code === ENDED && endSession())
          .catch(() => {});
      }
      return res;
    };

    return () => {
      axios.interceptors.response.eject(id);
      window.fetch = realFetch;
    };
  }, []);

  return null;
}
