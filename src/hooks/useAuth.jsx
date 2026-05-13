import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (u) => {
    if (!u) {
      setLoading(false);
      return;
    }
    
    // Instant Admin check for the specific user requested
    if (u.email === 'digital@crm.com') {
      setRole('Admin');
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
      } else {
        setRole('Employee');
      }
    } catch (err) {
      console.error('Error fetching role:', err);
      setRole('Employee');
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

    // 2. If valid, we need to sign them in. 
    // In a real app, each staff would have a Supabase user linked to their key.
    // For this prototype, we'll use a generic staff email based on the key if no user_id is linked.
    const staffEmail = `staff_${key}@crm.com`;
    const staffPassword = `password_${key}`; // Simple derivation for prototype

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: staffEmail, 
        password: staffPassword 
      });
      if (error) throw error;
      return data;
    } catch (err) {
      // If user doesn't exist, try to sign up
      const { data, error } = await supabase.auth.signUp({
        email: staffEmail,
        password: staffPassword,
        options: { data: { full_name: keyData.full_name || 'Staff Member' } }
      });
      
      if (error) throw error;
      
      // Update key with user_id
      await supabase.from('staff_keys').update({ user_id: data.user.id }).eq('id', keyData.id);
      
      // Ensure role is set in user_roles
      await supabase.from('user_roles').upsert({
        user_id: data.user.id,
        role: role,
        full_name: keyData.full_name || 'Staff Member',
        email: staffEmail
      });

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
