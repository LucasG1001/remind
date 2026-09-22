import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

/**
 * Sem este listener, um cliente **idle** derrubado (restart do Postgres, proxy
 * fechando a conexão) vira `Unhandled 'error' event` e mata o processo — e com ele
 * o setInterval do scheduler, deixando todos os avisos mudos até alguém reiniciar.
 */
pool.on("error", (error) => {
  console.error("[db] erro em cliente idle do pool:", error);
});

export { pool };
