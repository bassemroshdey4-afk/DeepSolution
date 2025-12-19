import { z } from "zod";
import { router, publicProcedure, tenantProcedure } from "./_core/trpc";
import { supabaseAdmin } from "./supabase";
import { TRPCError } from "@trpc/server";

// Super Admin check - uses OWNER_OPEN_ID from env
const superAdminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول" });
  }
  
  const ownerOpenId = process.env.OWNER_OPEN_ID;
  if (ctx.user.openId !== ownerOpenId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "صلاحيات Super Admin مطلوبة" });
  }
  
  return next({ ctx });
});

// Wallet Router - نظام المحفظة
export const walletRouter = router({
  // الحصول على رصيد المحفظة
  getBalance: tenantProcedure.query(async ({ ctx }) => {
    const { data: wallet, error } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("tenant_id", ctx.user.tenantId)
      .single();

    if (error && error.code === "PGRST116") {
      // لا توجد محفظة - إنشاء واحدة جديدة
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from("wallets")
        .insert({
          tenant_id: ctx.user.tenantId,
          balance: 0,
          currency: "SAR",
        })
        .select()
        .single();

      if (createError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create wallet",
        });
      }

      return { wallet: newWallet, balance: 0 };
    }

    if (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }

    return { wallet, balance: parseFloat(wallet.balance) };
  }),

  // شحن المحفظة (Top-up)
  topUp: tenantProcedure
    .input(
      z.object({
        amount: z.number().positive("Amount must be positive"),
        description: z.string().optional(),
        reference_type: z.string().optional(), // e.g., 'manual', 'stripe', 'bank_transfer'
        reference_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { amount, description, reference_type, reference_id } = input;

      // الحصول على المحفظة الحالية أو إنشاء واحدة
      let { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("tenant_id", ctx.user.tenantId)
        .single();

      if (walletError && walletError.code === "PGRST116") {
        // إنشاء محفظة جديدة
        const { data: newWallet, error: createError } = await supabaseAdmin
          .from("wallets")
          .insert({
            tenant_id: ctx.user.tenantId,
            balance: 0,
            currency: "SAR",
          })
          .select()
          .single();

        if (createError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create wallet",
          });
        }
        wallet = newWallet;
      } else if (walletError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: walletError.message,
        });
      }

      const balanceBefore = parseFloat(wallet.balance);
      const balanceAfter = balanceBefore + amount;

      // تحديث الرصيد
      const { error: updateError } = await supabaseAdmin
        .from("wallets")
        .update({ balance: balanceAfter, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);

      if (updateError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update balance",
        });
      }

      // تسجيل المعاملة
      const { data: transaction, error: txError } = await supabaseAdmin
        .from("wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          tenant_id: ctx.user.tenantId,
          type: "credit",
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: description || "Wallet top-up",
          reference_type: reference_type || "manual",
          reference_id: reference_id || null,
          created_by: ctx.user.id,
        })
        .select()
        .single();

      if (txError) {
        console.error("Failed to record transaction:", txError);
      }

      return {
        success: true,
        newBalance: balanceAfter,
        transaction,
      };
    }),

  // خصم من المحفظة (Debit) - مع idempotency key
  debit: tenantProcedure
    .input(
      z.object({
        amount: z.number().positive("Amount must be positive"),
        description: z.string(),
        reference_type: z.string(), // e.g., 'order', 'ai_addon', 'service'
        reference_id: z.string().optional(),
        idempotency_key: z.string().optional(), // مفتاح لمنع الخصم المزدوج
        allow_negative: z.boolean().optional().default(false), // Super Admin override
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { amount, description, reference_type, reference_id, idempotency_key, allow_negative } = input;
      
      // التحقق من idempotency key لمنع الخصم المزدوج
      if (idempotency_key) {
        const { data: existingTx } = await supabaseAdmin
          .from("wallet_transactions")
          .select("id, balance_after")
          .eq("tenant_id", ctx.user.tenantId)
          .eq("idempotency_key", idempotency_key)
          .single();
        
        if (existingTx) {
          // إرجاع نتيجة العملية السابقة بدون خصم مزدوج
          return {
            success: true,
            newBalance: existingTx.balance_after,
            duplicate: true,
            message: "العملية تمت مسبقاً"
          };
        }
      }

      // الحصول على المحفظة
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("tenant_id", ctx.user.tenantId)
        .single();

      if (walletError) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found",
        });
      }

      const balanceBefore = parseFloat(wallet.balance);
      const balanceAfter = balanceBefore - amount;

      // التحقق من الرصيد الكافي (إلا إذا كان Super Admin override)
      if (balanceAfter < 0 && !allow_negative) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient balance",
        });
      }

      // تحديث الرصيد
      const { error: updateError } = await supabaseAdmin
        .from("wallets")
        .update({ balance: balanceAfter, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);

      if (updateError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update balance",
        });
      }

      // تسجيل المعاملة مع idempotency_key
      const { data: transaction, error: txError } = await supabaseAdmin
        .from("wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          tenant_id: ctx.user.tenantId,
          type: "debit",
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description,
          reference_type,
          reference_id: reference_id || null,
          idempotency_key: idempotency_key || null,
          created_by: ctx.user.id,
        })
        .select()
        .single();

      if (txError) {
        console.error("Failed to record transaction:", txError);
      }

      return {
        success: true,
        newBalance: balanceAfter,
        transaction,
      };
    }),

  // سجل المعاملات
  getTransactions: tenantProcedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        type: z.enum(["credit", "debit", "refund", "adjustment"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, type } = input;

      let query = supabaseAdmin
        .from("wallet_transactions")
        .select("*", { count: "exact" })
        .eq("tenant_id", ctx.user.tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (type) {
        query = query.eq("type", type);
      }

      const { data: transactions, error, count } = await query;

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return { transactions, total: count || 0 };
    }),

  // استرداد (Refund)
  refund: tenantProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        description: z.string(),
        original_transaction_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { amount, description, original_transaction_id } = input;

      // الحصول على المحفظة
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("tenant_id", ctx.user.tenantId)
        .single();

      if (walletError) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found",
        });
      }

      const balanceBefore = parseFloat(wallet.balance);
      const balanceAfter = balanceBefore + amount;

      // تحديث الرصيد
      const { error: updateError } = await supabaseAdmin
        .from("wallets")
        .update({ balance: balanceAfter, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);

      if (updateError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update balance",
        });
      }

      // تسجيل المعاملة
      const { data: transaction, error: txError } = await supabaseAdmin
        .from("wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          tenant_id: ctx.user.tenantId,
          type: "refund",
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description,
          reference_type: "refund",
          reference_id: original_transaction_id || null,
          created_by: ctx.user.id,
        })
        .select()
        .single();

      return {
        success: true,
        newBalance: balanceAfter,
        transaction,
      };
    }),

  // === Super Admin APIs ===

  // شحن محفظة أي tenant (Super Admin)
  adminTopUp: superAdminProcedure
    .input(
      z.object({
        tenant_id: z.string().uuid(),
        amount: z.number().positive(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenant_id, amount, description } = input;

      // الحصول على المحفظة أو إنشاء واحدة
      let { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("tenant_id", tenant_id)
        .single();

      if (walletError && walletError.code === "PGRST116") {
        const { data: newWallet, error: createError } = await supabaseAdmin
          .from("wallets")
          .insert({
            tenant_id,
            balance: 0,
            currency: "SAR",
          })
          .select()
          .single();

        if (createError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create wallet",
          });
        }
        wallet = newWallet;
      } else if (walletError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: walletError.message,
        });
      }

      const balanceBefore = parseFloat(wallet.balance);
      const balanceAfter = balanceBefore + amount;

      // تحديث الرصيد
      await supabaseAdmin
        .from("wallets")
        .update({ balance: balanceAfter, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);

      // تسجيل المعاملة
      await supabaseAdmin.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        tenant_id,
        type: "credit",
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: description || "Admin top-up",
        reference_type: "admin_adjustment",
        created_by: ctx.user!.id,
      });

      return { success: true, newBalance: balanceAfter };
    }),

  // عرض محفظة أي tenant (Super Admin)
  adminGetWallet: superAdminProcedure
    .input(z.object({ tenant_id: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data: wallet, error } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("tenant_id", input.tenant_id)
        .single();

      if (error && error.code === "PGRST116") {
        return { wallet: null, balance: 0 };
      }

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return { wallet, balance: parseFloat(wallet.balance) };
    }),

  // تعديل رصيد أي tenant (Super Admin - override)
  adminAdjustBalance: superAdminProcedure
    .input(
      z.object({
        tenant_id: z.string().uuid(),
        new_balance: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenant_id, new_balance, reason } = input;

      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("tenant_id", tenant_id)
        .single();

      if (walletError) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found",
        });
      }

      const balanceBefore = parseFloat(wallet.balance);
      const adjustment = new_balance - balanceBefore;

      // تحديث الرصيد
      await supabaseAdmin
        .from("wallets")
        .update({ balance: new_balance, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);

      // تسجيل المعاملة
      await supabaseAdmin.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        tenant_id,
        type: "adjustment",
        amount: Math.abs(adjustment),
        balance_before: balanceBefore,
        balance_after: new_balance,
        description: `Admin adjustment: ${reason}`,
        reference_type: "admin_override",
        created_by: ctx.user!.id,
      });

      return { success: true, newBalance: new_balance };
    }),
});
