import { Router } from "express";
import {
  getAll,
  getById,
  create,
  update,
  reschedule,
  remove,
  acknowledge,
  snooze,
  cancel,
} from "../controllers/reminderController.js";

const router = Router();

router.get("/", getAll);
router.post("/", create);
router.get("/:id", getById);
router.put("/:id", update);
router.post("/:id/reschedule", reschedule);
router.delete("/:id", remove);
router.post("/:id/acknowledge", acknowledge);
router.post("/:id/snooze", snooze);
router.post("/:id/cancel", cancel);

export { router as reminderRoutes };
