import { UserRegistration } from "@/data/userRegistration";
import { supabaseUrl, supabaseAnonKey, supabase } from "@/lib/supabaseClient";

export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        throw new Error(`Sign-in failed: ${error.message}`);
    }

    return data;
}
export async function signUp(user: UserRegistration) {
    const { data, error } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
            data: {
                first_name: user.first_name,
                contact_number: user.contact_number,
                street: user.address.street,
                city: user.address.city,
                postal_code: user.address.postal_code
            },
        }
    });

    if (error) {
        throw new Error(`Sign-up failed: ${error.message}`);
    }

    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw new Error(`Sign-out failed: ${error.message}`);
    }

    return true;
}
export async function getUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
        throw new Error("User not authenticated");
    }

    return data.user;
}
export async function getSession() {
    const { data: session, error } = await supabase.auth.getSession();

    if (error) {
        throw new Error(`Failed to get session: ${error.message}`);
    }

    return session;
}
export async function resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
        throw new Error(`Password reset failed: ${error.message}`);
    }

    return data;
}
export async function updatePassword(newPassword: string) {
    const { data, error: userError } = await supabase.auth.getUser();

    if (userError || !data?.user) {
        throw new Error("User not authenticated");
    }

    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    });

    if (error) {
        throw new Error(`Password update failed: ${error.message}`);
    }

    return true;
}