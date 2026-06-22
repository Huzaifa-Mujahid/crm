import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

// ─── Crypto-secure random password generator ────────────────────────────────
// Generates a 32-character base64url string using the Web Crypto API.
// This is NOT stored in source code — it is stored in the staff_keys table.
const generateSecurePassword = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userFullName, setUserFullName] = useState('');
  const [loading, setLoading] = useState(true);

  // ─── Role fetcher — ONLY from database, no hardcoded checks ────────────────
  const fetchRole = async (u) => {
    if (!u) {
      setLoading(false);
      return;
    }

    // ✅ SECURITY FIX #1: No hardcoded email checks here.
    // Role is determined solely by the user_roles table in the database.
    // Supabase RLS on user_roles ensures only the correct data is returned.
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, full_name')
        .eq('user_id', u.id)
        .single();

      if (data) {
        setRole(data.role);
        setUserFullName(data.full_name || u.user_metadata?.full_name || '');
      } else {
        // No role record found → deny access, do NOT default to any role
        setRole(null);
        setUserFullName('');
      }
    } catch (err) {
      // Silently fail — do not expose error details or grant a fallback role
      setRole(null);
      setUserFullName('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchRole(u);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchRole(u);
      } else {
        setRole(null);
        setUserFullName('');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;

    // Create role entry
    if (data?.user) {
      await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: 'Employee',
        full_name: fullName,
        email: email
      });
    }

    return data;
  };

  const adminLogin = async (username, password) => {
    // Map username 'digital' to the admin email for Supabase Auth
    const email = username === 'digital' ? 'digital@crm.com' : username;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  // ─── Staff Login ──────────────────────────────────────────────────────────
  const staffLogin = async (username, key, role) => {
    // 1. Verify the 6-digit key + role + username in the staff_keys table
    const { data: keyData, error: keyError } = await supabase
      .from('staff_keys')
      .select('*')
      .eq('username', username)
      .eq('key', key)
      .eq('role', role)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      throw new Error('Invalid Username, Password, or Role selection.');
    }

    // ✅ SECURITY FIX #2: Staff Supabase Auth password is NO LONGER derived
    // from a predictable formula. Instead:
    //   - If staff_keys row already has an auth_password → use it (same account, reuse)
    //   - If not → generate a cryptographically random 32-char password, store it in
    //     the DB, and create the Supabase Auth account with it.
    // The password formula is NEVER in source code or the compiled JS bundle.
    const staffEmail = `staff_${keyData.id}@crm.com`;

    const syncUserRoles = async (userId) => {
      // Always keep user_roles in sync so the dashboard shows correct identity
      const { error: upsertErr } = await supabase.from('user_roles').upsert(
        {
          user_id: userId,
          role: keyData.role,
          full_name: keyData.full_name || 'Staff Member',
          email: staffEmail,
        },
        { onConflict: 'user_id' }
      );
      if (upsertErr) console.error("Error syncing user_roles:", upsertErr);

      // Link staff_keys row to auth user if not already linked
      if (!keyData.user_id) {
        await supabase.from('staff_keys').update({ user_id: userId }).eq('id', keyData.id);
      }
    };

    // Case A: This staff member already has a Supabase Auth account
    if (keyData.auth_password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: staffEmail,
          password: keyData.auth_password,
        });
        if (error) throw error;
        await syncUserRoles(data.user.id);
        
        // Fix Race Condition: Force the correct role into React state
        // because onAuthStateChange might have fetched it before upsert finished
        setRole(keyData.role);
        setUserFullName(keyData.full_name);
        
        return data;
      } catch (err) {
        // Auth account may have been deleted — fall through to re-create
      }
    }

    // Case B: First-time login for this staff row
    const securePassword = generateSecurePassword();

    await supabase
      .from('staff_keys')
      .update({ auth_password: securePassword })
      .eq('id', keyData.id);

    const { data, error } = await supabase.auth.signUp({
      email: staffEmail,
      password: securePassword,
      options: { data: { full_name: keyData.full_name || 'Staff Member' } },
    });

    if (error) {
      await supabase.from('staff_keys').update({ auth_password: null }).eq('id', keyData.id);
      throw error;
    }

    await syncUserRoles(data.user.id);
    
    // Fix Race Condition: Force the correct role into React state
    setRole(keyData.role);
    setUserFullName(keyData.full_name);

    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    role,
    userFullName,
    isAdmin: role === 'Admin',
    isManager: role === 'Manager',
    signIn,
    adminLogin,
    staffLogin,
    signUp,
    signOut,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
