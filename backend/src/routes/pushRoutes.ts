import { Router } from "express";
import { getPublicKey, subscribe, unsubscribe, test } from "../controllers/pushController.js";

const router = Router();

router.get("/public-key", getPublicKey);
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);
router.post("/test", test);

export { router as pushRoutes };
