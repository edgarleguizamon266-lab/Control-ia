import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAccountsWithBalance,
  getWorkspaceBalance,
  getPeriodReport,
  getBudgetUsage,
  getBusinessSummary,
  getDebtTotals,
  primerYUltimoDiaDelMes,
} from "@/lib/financial-engine";

// =========================================================
// CONTROL IA — Motor de IA central, ÚNICO para todos los canales
// (chat web, WhatsApp texto, WhatsApp audio transcripto).
//
// Nadie más duplica esta lógica: /api/ia/route.ts y
// /api/whatsapp/webhook/route.ts llaman AMBOS a `procesarMensajeIA`.
// Un solo cerebro, un solo lugar para corregir un bug o agregar una
// herramienta — se corrige acá y los tres canales quedan al día.
//
// Regla absoluta: la IA nunca fabrica un dato financiero. Todo sale
// de una consulta real (Motor Financiero Central en financial-engine.ts).
// =========================================================

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODELO = "claude-sonnet-4-5-20250929";

const TOOLS: Anthropic.Tool[] = [
  // ---- Nivel 1: lectura (no requieren confirmación) ----
  { name: "get_accounts", description: "Lista las cuentas reales del usuario en el espacio de trabajo actual, con su saldo.", input_schema: { type: "object", properties: {} } },
  { name: "get_balance", description: "Consulta el saldo total real de todas las cuentas del usuario en el espacio de trabajo actual.", input_schema: { type: "object", properties: {} } },
  {
    name: "get_transactions",
    description: "Lista los últimos movimientos reales del usuario, opcionalmente filtrados por tipo o categoría. Útil para encontrar un movimiento específico antes de editarlo o eliminarlo.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["gasto", "ingreso", "transferencia"] },
        categoria: { type: "string" },
        limite: { type: "number", description: "Cantidad máxima de resultados, por defecto 10." },
      },
    },
  },
  {
    name: "get_report",
    description: "Consulta ingresos, gastos y desglose por categoría reales del usuario para un período. Usar para cualquier pregunta sobre cuánto gastó, ganó o le queda disponible.",
    input_schema: { type: "object", properties: { periodo: { type: "string", enum: ["este_mes", "mes_pasado", "esta_semana"] } }, required: ["periodo"] },
  },
  { name: "get_budget", description: "Consulta el estado real de los presupuestos del usuario (límite vs. gastado) para el mes actual.", input_schema: { type: "object", properties: {} } },
  {
    name: "get_debts",
    description: "Lista las deudas reales del usuario, tanto lo que debe como lo que le deben.",
    input_schema: { type: "object", properties: { tipo: { type: "string", enum: ["yo_debo", "me_deben"] } } },
  },
  { name: "get_business_summary", description: "Consulta ventas, costos, gastos y ganancia neta reales del espacio de Negocio para el mes actual. Usar solo si el workspace actual es de tipo negocio.", input_schema: { type: "object", properties: {} } },
  { name: "get_receivables_payables", description: "Consulta cuánto le deben los clientes al negocio (cuentas por cobrar) y cuánto le debe el negocio a sus proveedores (cuentas por pagar).", input_schema: { type: "object", properties: {} } },
  { name: "get_subscription_status", description: "Consulta el estado real de la suscripción de CONTROL IA del usuario (plan, vencimiento, estado).", input_schema: { type: "object", properties: {} } },

  // ---- Nivel 2: escritura simple ----
  {
    name: "create_transaction",
    description: "Registra un gasto o ingreso real del usuario. Usar SIEMPRE que el usuario describa algo que gastó, compró, cobró o vendió (fuera del contexto de Negocio; para ventas de negocio usar create_sale).",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["gasto", "ingreso"] },
        monto: { type: "number", description: "Monto numérico, sin símbolos ni separadores." },
        categoria: { type: "string", description: "Nombre de categoría, ej. Supermercado, Combustible, Sueldo." },
        cuenta: { type: "string", description: "Nombre de la cuenta si el usuario la menciona (ej. Efectivo, Itaú)." },
        descripcion: { type: "string" },
        fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD. Si no se menciona, usar hoy." },
      },
      required: ["tipo", "monto", "categoria"],
    },
  },
  {
    name: "create_budget",
    description: "Crea un presupuesto mensual para una categoría de gasto.",
    input_schema: { type: "object", properties: { categoria: { type: "string" }, monto_limite: { type: "number" } }, required: ["categoria", "monto_limite"] },
  },
  {
    name: "create_debt",
    description: "Registra una deuda real: algo que el usuario debe o que le deben.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["yo_debo", "me_deben"] },
        persona: { type: "string" },
        monto: { type: "number" },
        fecha_vencimiento: { type: "string", description: "YYYY-MM-DD, opcional" },
      },
      required: ["tipo", "persona", "monto"],
    },
  },
  {
    name: "create_sale",
    description: "Registra una venta real del negocio. Si es al contado, además crea el ingreso real en una cuenta; si es a crédito, aumenta la cuenta por cobrar del cliente en vez de tocar una cuenta.",
    input_schema: {
      type: "object",
      properties: {
        producto: { type: "string" },
        monto: { type: "number" },
        costo: { type: "number", description: "Costo del producto/servicio vendido. 0 si no se menciona." },
        forma_pago: { type: "string", enum: ["contado", "credito"] },
        fecha: { type: "string" },
      },
      required: ["monto"],
    },
  },

  // ---- Nivel 3: modificar/eliminar (SOLO tras confirmación explícita previa del usuario) ----
  {
    name: "update_transaction",
    description: "Corrige un movimiento YA registrado. Requiere haber identificado el movimiento exacto con get_transactions primero, y confirmación explícita previa del usuario si hay ambigüedad.",
    input_schema: {
      type: "object",
      properties: { transaction_id: { type: "string" }, monto: { type: "number" }, categoria: { type: "string" }, descripcion: { type: "string" } },
      required: ["transaction_id"],
    },
  },
  {
    name: "delete_transaction",
    description: "Elimina un movimiento YA registrado. Usar SOLO después de que el usuario confirmó explícitamente que quiere eliminarlo.",
    input_schema: { type: "object", properties: { transaction_id: { type: "string" } }, required: ["transaction_id"] },
  },
];

function rangoDePeriodo(periodo: string) {
  const hoy = new Date();
  if (periodo === "mes_pasado") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    return { desde: inicio.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) };
  }
  if (periodo === "esta_semana") {
    const dia = hoy.getDay() || 7;
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - dia + 1);
    return { desde: inicio.toISOString().slice(0, 10), hasta: hoy.toISOString().slice(0, 10) };
  }
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { desde: inicio.toISOString().slice(0, 10), hasta: hoy.toISOString().slice(0, 10) };
}

export type OrigenMensaje = "app" | "whatsapp" | "audio";

export interface ParametrosMotorIA {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  workspaceTipo: "personal" | "negocio";
  mensaje: string;
  historial?: Anthropic.MessageParam[];
  origen: OrigenMensaje;
}

export interface ResultadoMotorIA {
  respuesta: string;
  accion: Record<string, unknown> | null;
  historial: Anthropic.MessageParam[];
}

export async function procesarMensajeIA({
  supabase,
  userId,
  workspaceId,
  workspaceTipo,
  mensaje,
  historial,
  origen,
}: ParametrosMotorIA): Promise<ResultadoMotorIA> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Falta configurar ANTHROPIC_API_KEY en el servidor.");
  }

  let accionRealizada: Record<string, unknown> | null = null;

  async function auditar(accion: string, detalle: Record<string, unknown>) {
    await supabase.from("audit_logs").insert({ user_id: userId, accion, detalle });
  }

  async function resolverCategoria(nombreBuscado: string, tipo: "gasto" | "ingreso") {
    const { data: categorias } = await supabase
      .from("transaction_categories")
      .select("id, nombre")
      .eq("workspace_tipo", workspaceTipo)
      .eq("tipo", tipo);
    return (
      categorias?.find((c: any) => c.nombre.toLowerCase() === nombreBuscado.toLowerCase()) ??
      categorias?.find((c: any) => c.nombre.toLowerCase().includes(nombreBuscado.toLowerCase())) ??
      categorias?.find((c: any) => c.nombre === "Otros") ??
      null
    );
  }

  async function ejecutarTool(nombre: string, input: any) {
    if (nombre === "get_accounts") return { cuentas: await getAccountsWithBalance(supabase, workspaceId) };

    if (nombre === "get_balance") {
      const saldo_total = await getWorkspaceBalance(supabase, workspaceId);
      const cuentas = await getAccountsWithBalance(supabase, workspaceId);
      return { saldo_total, cuentas };
    }

    if (nombre === "get_transactions") {
      let query = supabase
        .from("transactions")
        .select("id, tipo, monto, fecha, descripcion, transaction_categories(nombre), accounts(nombre)")
        .eq("workspace_id", workspaceId)
        .order("fecha", { ascending: false })
        .limit(input.limite ?? 10);
      if (input.tipo) query = query.eq("tipo", input.tipo);
      const { data } = await query;
      let resultados = data ?? [];
      if (input.categoria) {
        resultados = resultados.filter((t: any) => t.transaction_categories?.nombre?.toLowerCase().includes(String(input.categoria).toLowerCase()));
      }
      return { movimientos: resultados };
    }

    if (nombre === "get_report") {
      const { desde, hasta } = rangoDePeriodo(input.periodo);
      const reporte = await getPeriodReport(supabase, workspaceId, desde, hasta);
      return { periodo: input.periodo, ingresos: reporte.ingresos, gastos: reporte.gastos, disponible: reporte.ingresos - reporte.gastos, gastos_por_categoria: reporte.gastos_por_categoria };
    }

    if (nombre === "get_budget") {
      const usos = await getBudgetUsage(supabase, workspaceId);
      return { presupuestos: usos.map((u) => ({ categoria: u.categoria, limite: u.limite, gastado: u.gastado })) };
    }

    if (nombre === "get_debts") {
      let query = supabase.from("debts").select("persona, tipo, monto_total, saldo_pendiente, fecha_vencimiento").eq("workspace_id", workspaceId);
      if (input.tipo) query = query.eq("tipo", input.tipo);
      const { data } = await query;
      const totales = await getDebtTotals(supabase, workspaceId);
      return { deudas: data ?? [], totales };
    }

    if (nombre === "get_business_summary") {
      const { desde, hasta } = primerYUltimoDiaDelMes();
      return await getBusinessSummary(supabase, workspaceId, desde, hasta);
    }

    if (nombre === "get_receivables_payables") {
      const { data: clientes } = await supabase.from("customers").select("saldo_pendiente").eq("workspace_id", workspaceId);
      const { data: proveedores } = await supabase.from("suppliers").select("deuda_pendiente").eq("workspace_id", workspaceId);
      const por_cobrar = (clientes ?? []).reduce((a: number, c: any) => a + Number(c.saldo_pendiente), 0);
      const por_pagar = (proveedores ?? []).reduce((a: number, p: any) => a + Number(p.deuda_pendiente), 0);
      return { por_cobrar, por_pagar };
    }

    if (nombre === "get_subscription_status") {
      const { data } = await supabase
        .from("subscriptions")
        .select("estado, fecha_fin, subscription_plans(nombre)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? { estado: "sin_suscripcion" };
    }

    if (nombre === "create_transaction") {
      const categoria = await resolverCategoria(input.categoria, input.tipo);
      const { data: cuentas } = await supabase.from("accounts").select("id, nombre").eq("workspace_id", workspaceId).eq("activa", true);
      if (!cuentas || cuentas.length === 0) return { error: "El usuario no tiene ninguna cuenta creada todavía. Pedile que cree una cuenta primero." };
      const cuenta = (input.cuenta && cuentas.find((c: any) => c.nombre.toLowerCase().includes(String(input.cuenta).toLowerCase()))) ?? cuentas[0];

      const { data: nuevoMov, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          account_id: cuenta.id,
          category_id: categoria?.id ?? null,
          tipo: input.tipo,
          monto: input.monto,
          fecha: input.fecha || new Date().toISOString().slice(0, 10),
          descripcion: input.descripcion || null,
          origen: origen === "audio" ? "ia_audio" : origen === "whatsapp" ? "ia_whatsapp" : "ia_texto",
        })
        .select()
        .single();

      if (error) return { error: "No se pudo registrar el movimiento." };
      await auditar("ia_creo_transaccion", { transaction_id: nuevoMov.id, monto: input.monto, categoria: categoria?.nombre, origen });

      accionRealizada = { tipo: "transaccion_creada", monto: input.monto, moneda: "PYG", categoria: categoria?.nombre ?? "Otros", cuenta: cuenta.nombre, tipoMovimiento: input.tipo };
      return { ok: true, transaction_id: nuevoMov.id, categoria: categoria?.nombre ?? "Otros", cuenta: cuenta.nombre, fecha: nuevoMov.fecha };
    }

    if (nombre === "create_budget") {
      const categoria = await resolverCategoria(input.categoria, "gasto");
      if (!categoria) return { error: "No encontré esa categoría." };
      const { error } = await supabase.from("budgets").insert({ user_id: userId, workspace_id: workspaceId, category_id: categoria.id, monto_limite: input.monto_limite });
      if (error) return { error: "No se pudo crear el presupuesto." };
      await auditar("ia_creo_presupuesto", { categoria: categoria.nombre, monto_limite: input.monto_limite });
      return { ok: true, categoria: categoria.nombre };
    }

    if (nombre === "create_debt") {
      const { error } = await supabase.from("debts").insert({
        user_id: userId,
        workspace_id: workspaceId,
        tipo: input.tipo,
        persona: input.persona,
        monto_total: input.monto,
        saldo_pendiente: input.monto,
        fecha_vencimiento: input.fecha_vencimiento || null,
      });
      if (error) return { error: "No se pudo registrar la deuda." };
      await auditar("ia_creo_deuda", { persona: input.persona, monto: input.monto, tipo: input.tipo });
      accionRealizada = { tipo: "deuda_creada", persona: input.persona, monto: input.monto, tipoDeuda: input.tipo };
      return { ok: true };
    }

    if (nombre === "create_sale") {
      const formaPago = input.forma_pago === "credito" ? "credito" : "contado";
      let transactionId: string | null = null;
      let cuentaUsada: { id: string; nombre: string } | null = null;

      if (formaPago === "contado") {
        const { data: cuentas } = await supabase.from("accounts").select("id, nombre").eq("workspace_id", workspaceId).eq("activa", true);
        if (!cuentas || cuentas.length === 0) return { error: "El negocio no tiene ninguna cuenta creada todavía. Pedile que cree una cuenta primero." };
        cuentaUsada = cuentas[0];
        const categoriaVentas = await resolverCategoria("Ventas", "ingreso");
        const { data: nuevaTx, error: errTx } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            workspace_id: workspaceId,
            account_id: cuentaUsada.id,
            category_id: categoriaVentas?.id ?? null,
            tipo: "ingreso",
            monto: input.monto,
            fecha: input.fecha || new Date().toISOString().slice(0, 10),
            descripcion: input.producto || "Venta",
            origen: origen === "whatsapp" || origen === "audio" ? "ia_whatsapp" : "ia_texto",
          })
          .select()
          .single();
        if (errTx) return { error: "No se pudo registrar el ingreso de la venta." };
        transactionId = nuevaTx.id;
      }

      const { data: nuevaVenta, error } = await supabase
        .from("sales")
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          producto: input.producto || null,
          monto: input.monto,
          costo: input.costo || 0,
          forma_pago: formaPago,
          account_id: cuentaUsada?.id ?? null,
          transaction_id: transactionId,
          estado_pago: formaPago === "contado" ? "pagado" : "pendiente",
          fecha: input.fecha || new Date().toISOString().slice(0, 10),
        })
        .select()
        .single();
      if (error) return { error: "No se pudo registrar la venta." };

      await auditar("ia_creo_venta", { venta_id: nuevaVenta.id, monto: input.monto, forma_pago: formaPago });
      accionRealizada = { tipo: "venta_creada", monto: input.monto, producto: input.producto };
      return { ok: true, ganancia_estimada: input.monto - (input.costo || 0), cuenta: cuentaUsada?.nombre ?? null, forma_pago: formaPago };
    }

    if (nombre === "update_transaction") {
      const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof input.monto === "number") cambios.monto = input.monto;
      if (input.descripcion) cambios.descripcion = input.descripcion;
      if (input.categoria) {
        const { data: mov } = await supabase.from("transactions").select("tipo").eq("id", input.transaction_id).single();
        if (mov) {
          const categoria = await resolverCategoria(input.categoria, mov.tipo as "gasto" | "ingreso");
          if (categoria) cambios.category_id = categoria.id;
        }
      }
      const { data: actualizado, error } = await supabase.from("transactions").update(cambios).eq("id", input.transaction_id).eq("workspace_id", workspaceId).select().single();
      if (error || !actualizado) return { error: "No se pudo actualizar ese movimiento." };
      await auditar("ia_actualizo_transaccion", { transaction_id: input.transaction_id, cambios });
      accionRealizada = { tipo: "transaccion_actualizada", monto: actualizado.monto };
      return { ok: true, monto: actualizado.monto };
    }

    if (nombre === "delete_transaction") {
      const { error } = await supabase.from("transactions").delete().eq("id", input.transaction_id).eq("workspace_id", workspaceId);
      if (error) return { error: "No se pudo eliminar ese movimiento." };
      await auditar("ia_elimino_transaccion", { transaction_id: input.transaction_id });
      accionRealizada = { tipo: "transaccion_eliminada" };
      return { ok: true };
    }

    return { error: "Herramienta desconocida" };
  }

  const messages: Anthropic.MessageParam[] = [...(historial ?? []), { role: "user", content: mensaje }];

  const canalTexto = origen === "whatsapp" ? " (por WhatsApp, texto)" : origen === "audio" ? " (por WhatsApp, nota de voz transcripta — puede tener errores de transcripción, usá el sentido común)" : "";

  const systemPrompt = `Sos el asistente financiero de CONTROL IA${canalTexto}. Ayudás al usuario a registrar y entender su dinero, en el espacio de trabajo "${workspaceTipo}".
Reglas estrictas:
- NUNCA inventes montos, saldos, porcentajes ni comparaciones. Para cualquier dato financiero, llamá siempre a la herramienta correspondiente y explicá el resultado real devuelto.
- Si no hay datos suficientes para responder algo, decilo explícitamente.
- Para registrar un movimiento, presupuesto, deuda o venta, llamá a la herramienta correspondiente. Si falta un dato esencial, preguntá antes de inventarlo.
- IMPORTANTE — acciones sensibles: antes de llamar a update_transaction o delete_transaction, si no es 100% claro a qué movimiento se refiere el usuario, usá get_transactions para mostrarle las opciones y esperá su confirmación explícita en un mensaje antes de ejecutar el cambio.
- Sé breve, cercano y en español paraguayo/rioplatense. Usá "Gs." para guaraníes.
- Si acabás de registrar o corregir un movimiento, confirmalo con los datos reales devueltos por la herramienta.`;

  let respuesta = await anthropic.messages.create({ model: MODELO, max_tokens: 800, system: systemPrompt, tools: TOOLS, messages });

  let vueltas = 0;
  while (respuesta.stop_reason === "tool_use" && vueltas < 5) {
    vueltas++;
    const usosDeTool = respuesta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const resultados = await Promise.all(
      usosDeTool.map(async (uso) => ({ type: "tool_result" as const, tool_use_id: uso.id, content: JSON.stringify(await ejecutarTool(uso.name, uso.input)) }))
    );
    messages.push({ role: "assistant", content: respuesta.content });
    messages.push({ role: "user", content: resultados });
    respuesta = await anthropic.messages.create({ model: MODELO, max_tokens: 800, system: systemPrompt, tools: TOOLS, messages });
  }

  supabase
    .from("ai_usage")
    .insert({ user_id: userId, workspace_id: workspaceId, tokens_entrada: respuesta.usage?.input_tokens ?? 0, tokens_salida: respuesta.usage?.output_tokens ?? 0, modelo: MODELO, origen })
    .then(() => {});

  const textoFinal = respuesta.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");

  return { respuesta: textoFinal, accion: accionRealizada, historial: messages.concat([{ role: "assistant", content: respuesta.content }]) };
}
