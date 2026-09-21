import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "../config/publicConfig.js";

export const supabaseClient = createClient(
  publicConfig.supabaseUrl,
  publicConfig.supabasePublishableKey,
);
