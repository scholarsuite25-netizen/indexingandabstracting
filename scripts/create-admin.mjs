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
  const email = 'admin@lis815.edu';
  const password = 'AdminPassword123!';

  console.log('Creating admin user...');
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
            await supabase.auth.admin.updateUserById(user.id, { password: password });
            await makeAdmin(user.id);
        }
    } else {
        console.error('Error creating user:', error);
    }
    return;
  }
  
  await makeAdmin(data.user.id);
}

async function makeAdmin(userId) {
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id')
    .eq('code', 'admin')
    .single();

  if (rolesError || !roles) {
    console.error('Error finding admin role:', rolesError);
    return;
  }

  const roleId = roles.id;

  const { error: insertError } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role_id: roleId });
    
  if (insertError) {
    console.error('Error assigning admin role:', insertError);
  } else {
    console.log('Admin role applied successfully!');
    console.log('--- CREDENTIALS ---');
    console.log('Email: admin@lis815.edu');
    console.log('Password: AdminPassword123!');
  }
}

main();
