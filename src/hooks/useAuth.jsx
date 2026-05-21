import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userFullName, setUserFullName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRole = async (u) => {
    if (!u) {
      setLoading(false);
      return;
    }
    
    // Instant Admin check for the specific user requested
    if (u.email === 'digital@crm.com') {
      setRole('Admin');
      setUserFullName('Admin User');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, full_name')
        .eq('user_id', u.id)
        .single();
      
      if (data) {
        setRole(data.role);
        setUserFullName(data.full_name || u.user_metadata?.full_name);
      } else {
        setRole('Employee');
        setUserFullName(u.user_metadata?.full_name);
      }
    } catch (err) {
      console.error('Error fetching role:', err);
      setRole('Employee');
      setUserFullName(u.user_metadata?.full_name);
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
    // Map username 'digital' to a dummy email for Supabase Auth
    const email = username === 'digital' ? 'digital@crm.com' : username;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const staffLogin = async (username, key, role) => {
    // 1. Verify key and role in staff_keys table
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

    // 2. Use the unique key-row UUID (keyData.id) — NOT the 6-digit key — to derive the
    //    Supabase Auth email. This prevents account collisions when a 6-digit key is
    //    deleted and re-issued to a different employee (e.g. haris → ali).
    const staffEmail = `staff_${keyData.id}@crm.com`;
    const staffPassword = `staffpass_${keyData.id}`;

    const syncUserRoles = async (userId) => {
      // Always keep user_roles in sync so the dashboard shows correct identity
      await supabase.from('user_roles').upsert(
        {
          user_id: userId,
          role: keyData.role,
          full_name: keyData.full_name || 'Staff Member',
          email: staffEmail,
        },
        { onConflict: 'user_id' }
      );
      // Link staff_keys row to auth user if not already linked
      if (!keyData.user_id) {
        await supabase.from('staff_keys').update({ user_id: userId }).eq('id', keyData.id);
      }
    };

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: staffEmail,
        password: staffPassword,
      });
      if (error) throw error;

      // Always sync on every login so name/role changes are reflected immediately
      await syncUserRoles(data.user.id);
      return data;
    } catch (err) {
      // Auth user doesn't exist yet — sign up first
      const { data, error } = await supabase.auth.signUp({
        email: staffEmail,
        password: staffPassword,
        options: { data: { full_name: keyData.full_name || 'Staff Member' } },
      });

      if (error) throw error;

      await syncUserRoles(data.user.id);
      return data;
    }
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
