import { supabase } from '@/lib/supabase';
import { logoutCurrentDevice } from '@/application/auth/logout';

export const authService = {
    async signInWithOtp(phone: string) {
        const { data, error } = await supabase.auth.signInWithOtp({
            phone: `+91${phone}`,
            options: {
                channel: 'sms',
            },
        });
        if (error) throw error;
        return data;
    },

    async verifyOtp(phone: string, token: string) {
        const { data, error } = await supabase.auth.verifyOtp({
            phone: `+91${phone}`,
            token,
            type: 'sms',
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        await logoutCurrentDevice();
    },

    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
    },
};
