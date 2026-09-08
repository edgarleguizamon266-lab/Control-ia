import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rangoPeriodoParaguay, hoyParaguay, primerYUltimoDiaDelMesParaguay } from "@/lib/utils/fecha";
import {
  getAccountsWithBalance,
  getWorkspaceBalance,
  getPeriodReport,
  getBudgetUsage,
  getBusinessSummary,
  getDebtTotals,
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
    description: "Registra un gasto o ingreso real del usuario. Usar SIEMPRE que el usuario describa algo que gastó, compró, cobró o vendió (fuera del contexto de Negocio; para ventas de negocio usar create_sale). Si la herramienta responde requiere_confirmacion_categoria o requiere_eleccion_cuenta, preguntá al usuario antes de reintentar.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["gasto", "ingreso"] },
        monto: { type: "number", description: "Monto numérico, sin símbolos ni separadores." },
        categoria: { type: "string", description: "Nombre de categoría, ej. Supermercado, Combustible, Sueldo." },
        categoria_confirmada: { type: "boolean", description: "true SOLO si el usuario ya confirmó explícitamente crear esta categoría nueva en un mensaje anterior." },
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


export type OrigenMensaje = "app" | "whatsapp" | "audio";

// =========================================================
// HALLAZGO DE AUDITORÍA: cuando el proveedor de IA falla (ej. saldo
// insuficiente en la cuenta de Anthropic), el usuario veía el JSON
// crudo del error ("400 invalid_request_error: Your credit balance
// is too low..."). Inaceptable en producción. Ahora todo error del
// proveedor se traduce a un mensaje amigable, y el detalle técnico
// real queda solo en el servidor (console.error → logs de Vercel).
// =========================================================
export class ErrorMotorIA extends Error {
  public amigable: string;
  constructor(amigable: string, causaOriginal?: unknown) {
    super(amigable);
    this.name = "ErrorMotorIA";
    this.amigable = amigable;
    if (causaOriginal) {
      // Detalle técnico completo SOLO en logs del servidor, nunca en la respuesta al cliente.
      console.error("[motor-ia] Error del proveedor de IA:", causaOriginal);
    }
  }
}

async function llamarAnthropicSeguro(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  try {
    return await anthropic.messages.create(params);
  } catch (e: any) {
    // Detectar el caso específico de saldo insuficiente para dar un mensaje más útil.
    const mensaje = String(e?.message ?? "");
    if (e?.status === 400 && /credit balance/i.test(mensaje)) {
      throw new ErrorMotorIA(
        "CONTROL IA está temporalmente sin conexión con el asistente (saldo de la API agotado). Podés registrar tu movimiento manualmente mientras se restablece el servicio.",
        e
      );
    }
    if (e?.status === 401 || e?.status === 403) {
      throw new ErrorMotorIA("CONTROL IA no está configurado correctamente en el servidor todavía. Registrá tu movimiento manualmente por ahora.", e);
    }
    if (e?.status === 429) {
      throw new ErrorMotorIA("Hay mucha demanda en este momento. Esperá unos segundos y probá de nuevo.", e);
    }
    throw new ErrorMotorIA("No pude procesar tu mensaje ahora mismo. Probá de nuevo en un momento o registrá el movimiento manualmente.", e);
  }
}

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
    throw new ErrorMotorIA("CONTROL IA no está configurado correctamente en el servidor todavía. Registrá tu movimiento manualmente por ahora.");
  }

  // Fase 2.3: aplicar el límite real del plan ANTES de llamar al proveedor —
  // antes esto no se verificaba nunca, sin importar cuánto costara.
  const { data: suscripcion } = await supabase.rpc("fn_mi_suscripcion").maybeSingle();
  const limite = (suscripcion as any)?.limite_operaciones_ia ?? 500;
  const { data: usoActual } = await supabase.rpc("fn_uso_ia_este_mes", { p_user_id: userId });
  if ((usoActual ?? 0) >= limite) {
    throw new ErrorMotorIA(
      `Ya usaste tus ${limite} mensajes de IA incluidos este mes. Podés seguir registrando movimientos manualmente, o ampliar tu plan en Suscripción.`
    );
  }

  let accionRealizada: Record<string, unknown> | null = null;

  async function auditar(accion: string, detalle: Record<string, unknown>) {
    await supabase.from("audit_logs").insert({ user_id: userId, accion, detalle });
  }

  // Sección 17: nunca cae en "Otros" en silencio si el nombre no matchea razonablemente.
  // Devuelve la categoría encontrada, o null si no hay match claro (el motor debe preguntar).
  async function resolverCategoria(nombreBuscado: string, tipo: "gasto" | "ingreso") {
    const { data: categorias } = await supabase
      .from("transaction_categories")
      .select("id, nombre")
      .eq("workspace_tipo", workspaceTipo)
      .eq("tipo", tipo);
    return (
      categorias?.find((c: any) => c.nombre.toLowerCase() === nombreBuscado.toLowerCase()) ??
      categorias?.find((c: any) => c.nombre.toLowerCase().includes(nombreBuscado.toLowerCase()) || nombreBuscado.toLowerCase().includes(c.nombre.toLowerCase())) ??
      null
    );
  }

  async function obtenerCuentaPredeterminada(tipo: "gasto" | "ingreso") {
    const { data: pref } = await supabase
      .from("workspace_preferences")
      .select("cuenta_predeterminada_gasto_id, cuenta_predeterminada_ingreso_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return tipo === "gasto" ? pref?.cuenta_predeterminada_gasto_id ?? null : pref?.cuenta_predeterminada_ingreso_id ?? null;
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
        .select("id, tipo, monto, fecha, descripcion, transaction_categories(nombre), accounts!account_id(nombre)")
        .eq("workspace_id", workspaceId)
        .order("fecha", { ascending: false })
        .limit(input.limite ?? 10);
      if (input.tipo) query = query.eq("tipo", input.tipo);
      const { data, error } = await query;
      if (error) {
        console.error("[motor-ia] Error en get_transactions:", error);
        return { error: "No pude consultar los movimientos ahora mismo." };
      }
      let resultados = data ?? [];
      if (input.categoria) {
        resultados = resultados.filter((t: any) => t.transaction_categories?.nombre?.toLowerCase().includes(String(input.categoria).toLowerCase()));
      }
      return { movimientos: resultados };
    }

    if (nombre === "get_report") {
      const { desde, hasta } = rangoPeriodoParaguay(input.periodo === "este_mes" ? "este_mes" : input.periodo === "mes_pasado" ? "mes_pasado" : "esta_semana");
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
      const { desde, hasta } = primerYUltimoDiaDelMesParaguay();
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
      const { data } = await supabase.rpc("fn_mi_suscripcion").maybeSingle();
      return data ?? { estado: "sin_suscripcion" };
    }

    if (nombre === "create_transaction") {
      const categoria = await resolverCategoria(input.categoria, input.tipo);

      // Sección 17: si no hay una categoría que matchee razonablemente, NO caer en "Otros"
      // en silencio — pedirle a la IA que confirme con el usuario antes de crear una nueva.
      if (!categoria && !input.categoria_confirmada) {
        return {
          requiere_confirmacion_categoria: true,
          categoria_sugerida: input.categoria,
          mensaje_para_el_usuario: `No encontré la categoría "${input.categoria}". ¿Querés que cree esa categoría nueva, o preferís usar otra existente?`,
        };
      }

      const { data: cuentas } = await supabase.from("accounts").select("id, nombre").eq("workspace_id", workspaceId).eq("activa", true);
      if (!cuentas || cuentas.length === 0) return { error: "El usuario no tiene ninguna cuenta creada todavía. Pedile que cree una cuenta primero." };

      // Sección 15/18: cuenta predeterminada > cuenta mencionada por el usuario > única cuenta disponible.
      const predeterminadaId = await obtenerCuentaPredeterminada(input.tipo);
      const cuentaPredeterminada = predeterminadaId ? cuentas.find((c: any) => c.id === predeterminadaId) : null;
      const cuentaMencionada = input.cuenta && cuentas.find((c: any) => c.nombre.toLowerCase().includes(String(input.cuenta).toLowerCase()));

      if (!cuentaMencionada && !cuentaPredeterminada && cuentas.length > 1) {
        return {
          requiere_eleccion_cuenta: true,
          cuentas_disponibles: cuentas.map((c: any) => c.nombre),
          mensaje_para_el_usuario: "¿Con qué cuenta fue? " + cuentas.map((c: any) => c.nombre).join(", "),
        };
      }

      const cuenta = cuentaMencionada || cuentaPredeterminada || cuentas[0];

      // Categoría nueva confirmada por el usuario: crearla recién ahora.
      let categoriaFinal = categoria;
      if (!categoriaFinal && input.categoria_confirmada) {
        const { data: nuevaCategoria } = await supabase
          .from("transaction_categories")
          .insert({ user_id: userId, workspace_tipo: workspaceTipo, nombre: input.categoria, tipo: input.tipo })
          .select()
          .single();
        categoriaFinal = nuevaCategoria;
      }

      const { data: nuevoMov, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          account_id: cuenta.id,
          category_id: categoriaFinal?.id ?? null,
          tipo: input.tipo,
          monto: input.monto,
          fecha: input.fecha || hoyParaguay(),
          descripcion: input.descripcion || null,
          origen: origen === "audio" ? "ia_audio" : origen === "whatsapp" ? "ia_whatsapp" : "ia_texto",
        })
        .select()
        .single();

      if (error) return { error: "No se pudo registrar el movimiento." };
      await auditar("ia_creo_transaccion", { transaction_id: nuevoMov.id, monto: input.monto, categoria: categoriaFinal?.nombre, origen });

      accionRealizada = { tipo: "transaccion_creada", monto: input.monto, moneda: "PYG", categoria: categoriaFinal?.nombre ?? input.categoria, cuenta: cuenta.nombre, tipoMovimiento: input.tipo };
      return { ok: true, transaction_id: nuevoMov.id, categoria: categoriaFinal?.nombre ?? input.categoria, cuenta: cuenta.nombre, fecha: nuevoMov.fecha };
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
            fecha: input.fecha || hoyParaguay(),
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
          fecha: input.fecha || hoyParaguay(),
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
- Si create_transaction responde "requiere_confirmacion_categoria": preguntale al usuario si querés crear esa categoría nueva o prefiere usar otra existente. Recién si confirma que sí, volvé a llamar create_transaction con categoria_confirmada: true. NUNCA crees una categoría nueva sin esa confirmación explícita.
- Si create_transaction responde "requiere_eleccion_cuenta": preguntale con cuál de esas cuentas fue, y esperá su respuesta antes de reintentar.
- IMPORTANTE — acciones sensibles: antes de llamar a update_transaction o delete_transaction, si no es 100% claro a qué movimiento se refiere el usuario, usá get_transactions para mostrarle las opciones y esperá su confirmación explícita en un mensaje antes de ejecutar el cambio.
- Sé breve, cercano y en español paraguayo/rioplatense. Usá "Gs." para guaraníes.
- Si acabás de registrar o corregir un movimiento, confirmalo con los datos reales devueltos por la herramienta.

Expresiones de monto en guaraníes que debés interpretar correctamente:
- "85 mil", "85.000", "85000" → 85000
- "200 mil" → 200000
- "1 millón" → 1000000
- "1 palo" es ambiguo (puede ser mil o millón según el contexto/región) — NUNCA lo registres directo, confirmá primero: "¿Te referís a Gs. 1.000.000?"
- Si el monto queda ambiguo por cualquier motivo (ej. "120 de súper" sin aclarar si son 120.000 o 120 mil), confirmá el monto exacto antes de registrar.

Categorías y alias comunes en Paraguay (usalos para entender, pero segui usando resolverCategoria/las categorías reales del usuario — no está hardcodeado, es orientativo):
Super/Súper/Supermercado → Supermercado · Nafta/Combustible → Combustible · ANDE/ESSAP/Internet → Servicios · Delivery → Delivery · Publicidad → Publicidad · Iglesia/Diezmo/Ofrenda → categorías propias del usuario (si no existen, seguí la regla de confirmación de categoría nueva).`;

  let respuesta = await llamarAnthropicSeguro({ model: MODELO, max_tokens: 800, system: systemPrompt, tools: TOOLS, messages });

  let vueltas = 0;
  while (respuesta.stop_reason === "tool_use" && vueltas < 5) {
    vueltas++;
    const usosDeTool = respuesta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const resultados = await Promise.all(
      usosDeTool.map(async (uso) => ({ type: "tool_result" as const, tool_use_id: uso.id, content: JSON.stringify(await ejecutarTool(uso.name, uso.input)) }))
    );
    messages.push({ role: "assistant", content: respuesta.content });
    messages.push({ role: "user", content: resultados });
    respuesta = await llamarAnthropicSeguro({ model: MODELO, max_tokens: 800, system: systemPrompt, tools: TOOLS, messages });
  }

  supabase
    .from("ai_usage")
    .insert({ user_id: userId, workspace_id: workspaceId, tokens_entrada: respuesta.usage?.input_tokens ?? 0, tokens_salida: respuesta.usage?.output_tokens ?? 0, modelo: MODELO, origen })
    .then(() => {});

  const textoFinal = respuesta.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");

  return { respuesta: textoFinal, accion: accionRealizada, historial: messages.concat([{ role: "assistant", content: respuesta.content }]) };
}
