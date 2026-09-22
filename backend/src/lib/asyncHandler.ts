import type { Request, Response } from "express";
import { DomainError } from "../models/errors.js";

type AsyncRoute = (req: Request, res: Response) => Promise<void>;

export function asyncHandler(errorMessage: string, handler: AsyncRoute): AsyncRoute {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof DomainError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      // Loga aqui: este catch intercepta antes do errorHandler do Express, que é quem
      // logava. Sem isto o cliente recebia 500 e o log do container ficava vazio.
      console.error(`[api] ${req.method} ${req.originalUrl} falhou:`, error);
      if (res.headersSent) return;
      res.status(500).json({ error: errorMessage });
    }
  };
}
