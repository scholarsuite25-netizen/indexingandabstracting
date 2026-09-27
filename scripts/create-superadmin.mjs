import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = 'superadmin@lis815.edu';
  const password = 'SuperAdmin123!';

  console.log('Creating user...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
  });

  if (error) {
    if (error.code === 'email_exists' || error.message.includes('registered')) {
        console.log('User already exists. Updating password and role...');
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const user = users.find(u => u.email === email);
        if (user) {
            // Forcibly update the password to match what we told the user
            await supabase.auth.admin.updateUserById(user.id, { password: password });
            await makeSuperadmin(user.id);
        } else {
            console.error('User exists but could not be found in listUsers().');
        }
    } else {
        console.error('Error creating user:', error);
    }
    return;
  }
  
  await makeSuperadmin(data.user.id);
}

async function makeSuperadmin(userId) {
  // 1. Get the superadmin role ID
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id')
    .eq('code', 'superadmin')
    .single();

  if (rolesError || !roles) {
    console.error('Error finding superadmin role:', rolesError);
    return;
  }

  const roleId = roles.id;

  // 2. Insert into user_roles
  const { error: insertError } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role_id: roleId });
    
  if (insertError) {
    console.error('Error assigning superadmin role:', insertError);
  } else {
    console.log('Superadmin role applied successfully!');
    console.log('--- CREDENTIALS ---');
    console.log('Email: superadmin@lis815.edu');
    console.log('Password: SuperAdmin123!');
  }
}

main();
