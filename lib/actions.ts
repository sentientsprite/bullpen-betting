"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clampPrice } from "@/lib/money";
import type {
  OutcomeSide,
  PaymentConnection,
  PaymentProvider,
  Profile,
  WalletMode,
} from "@/lib/types";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  // Back-compat if migration not applied yet
  return {
    ...(data as Profile),
    wallet_mode: (data as Profile).wallet_mode ?? "free",
  };
}

export async function getPaymentConnections(): Promise<PaymentConnection[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("payment_connections")
    .select("*")
    .eq("user_id", user.id)
    .order("connected_at", { ascending: false });

  return (data ?? []) as PaymentConnection[];
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email) {
    return { error: "Email is required." };
  }

  const supabase = await createClient();

  const { data: invited, error: inviteError } = await supabase.rpc(
    "check_invite",
    { p_email: email },
  );

  if (inviteError) {
    return { error: inviteError.message };
  }
  if (!invited) {
    return {
      error:
        "This email is not invited. Ask a Floor admin to send you an invite.",
    };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { ok: true as const };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function inviteEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_email", { p_email: email });
  if (error) return { error: error.message };

  revalidatePath("/admin/invites");
  return { ok: true as const };
}

export async function createMarket(formData: FormData) {
  const question = String(formData.get("question") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const side = String(formData.get("side") ?? "yes") as OutcomeSide;
  const price = clampPrice(Number(formData.get("price") ?? 50));
  const qty = Math.max(1, Math.floor(Number(formData.get("qty") ?? 1)));

  if (question.length < 8) {
    return { error: "Question must be at least 8 characters." };
  }
  if (side !== "yes" && side !== "no") {
    return { error: "Pick Yes or No." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_market_with_order", {
    p_question: question,
    p_description: description,
    p_side: side,
    p_price_cents: price,
    p_qty: qty,
  });

  if (error) return { error: error.message };

  const marketId =
    (data as { market?: { id?: string } })?.market?.id ??
    (data as { order?: { market_id?: string } })?.order?.market_id;

  revalidatePath("/dashboard");
  if (marketId) {
    redirect(`/markets/${marketId}`);
  }
  return { ok: true as const, data };
}

export async function placeOrder(formData: FormData) {
  const marketId = String(formData.get("market_id") ?? "");
  const side = String(formData.get("side") ?? "yes") as OutcomeSide;
  const price = clampPrice(Number(formData.get("price") ?? 50));
  const qty = Math.max(1, Math.floor(Number(formData.get("qty") ?? 1)));

  if (!marketId) return { error: "Missing market." };
  if (side !== "yes" && side !== "no") return { error: "Pick Yes or No." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_market_id: marketId,
    p_side: side,
    p_price_cents: price,
    p_qty: qty,
  });

  if (error) return { error: error.message };

  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
  return { ok: true as const, data };
}

export async function cancelOrder(formData: FormData): Promise<void> {
  const orderId = String(formData.get("order_id") ?? "");
  const marketId = String(formData.get("market_id") ?? "");
  if (!orderId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);

  if (marketId) revalidatePath(`/markets/${marketId}`);
  revalidatePath("/portfolio");
}

export async function resolveMarket(formData: FormData) {
  const marketId = String(formData.get("market_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "") as OutcomeSide;
  const note = String(formData.get("note") ?? "").trim();

  if (!marketId) return { error: "Missing market." };
  if (outcome !== "yes" && outcome !== "no") {
    return { error: "Pick Yes or No." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_market", {
    p_market_id: marketId,
    p_outcome: outcome,
    p_note: note || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
  return { ok: true as const };
}

export async function updateDisplayName(formData: FormData): Promise<void> {
  const name = String(formData.get("display_name") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name || null })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/portfolio");
}

export async function setWalletMode(formData: FormData) {
  const mode = String(formData.get("mode") ?? "") as WalletMode;
  if (mode !== "free" && mode !== "linked") {
    return { error: "Pick Free mode or Linked." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_wallet_mode", { p_mode: mode });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/portfolio");
  revalidatePath("/dashboard");
  revalidatePath("/markets/new");
  return { ok: true as const };
}

export async function connectPayment(formData: FormData) {
  const provider = String(formData.get("provider") ?? "") as PaymentProvider;
  const handle = String(formData.get("handle") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (provider !== "cashapp" && provider !== "robinhood") {
    return { error: "Pick Cash App or Robinhood." };
  }
  if (!handle) return { error: "Handle is required." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("connect_payment", {
    p_provider: provider,
    p_handle: handle,
    p_display_name: displayName || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/portfolio");
  return { ok: true as const };
}

export async function disconnectPayment(formData: FormData) {
  const provider = String(formData.get("provider") ?? "") as PaymentProvider;
  if (provider !== "cashapp" && provider !== "robinhood") {
    return { error: "Invalid provider." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("disconnect_payment", {
    p_provider: provider,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/portfolio");
  return { ok: true as const };
}
