import { Router } from "express";
import {
  getAll,
  create,
  reorder,
  update,
  remove,
  setCompletion,
  addReminder,
  removeReminder,
  skipReminder,
  completeReminder,
} from "../controllers/habitController.js";

const router = Router();

router.get("/", getAll);
router.post("/", create);
router.post("/reorder", reorder);

// Antes das rotas com :id — senão "reminders" casaria como id de hábito.
router.delete("/reminders/:reminderId", removeReminder);
router.post("/reminders/:reminderId/skip", skipReminder);

router.put("/:id", update);
router.delete("/:id", remove);
router.patch("/:id/completion/:date", setCompletion);
router.post("/:id/reminders", addReminder);
router.post("/:id/reminders/complete", completeReminder);

export { router as habitRoutes };
