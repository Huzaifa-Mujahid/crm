import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const SetupAdmin = () => {
  const [status, setStatus] = useState('Click the button to create your admin account.');
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    setStatus('Creating admin account...');

    try {
      // 1. Sign up the user via Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email: 'digital@crm.com',
        password: 'admin123',
        options: {
          data: { full_name: 'Main Admin' }
        }
      });

      if (authError) {
        throw new Error(`Auth Error: ${authError.message}`);
      }

      if (!data.user) {
        throw new Error('User was not created. Check your Supabase email rate limits or dashboard settings.');
      }

      setStatus('Account created in Auth. Assigning Admin role...');

      // 2. Insert into user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: data.user.id,
          role: 'Admin',
          full_name: 'Main Admin',
          email: 'digital@crm.com'
        }, { onConflict: 'user_id' });

      if (roleError) {
        throw new Error(`Role Error: ${roleError.message}`);
      }

      setStatus('✅ Success! Admin account created. You can now go to /login and login with digital / admin123.');

    } catch (err) {
      setStatus(`❌ Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, textAlign: 'center', background: '#07090f', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ marginBottom: 20 }}>Emergency Admin Setup</h1>
      <p style={{ marginBottom: 20 }}>{status}</p>
      <button 
        onClick={handleSetup} 
        disabled={loading}
        style={{
          padding: '12px 24px',
          background: '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 16,
          fontWeight: 'bold'
        }}
      >
        {loading ? 'Processing...' : 'Create Admin Account (digital / admin123)'}
      </button>
    </div>
  );
};

export default SetupAdmin;
