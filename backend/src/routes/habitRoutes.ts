import { Router } from "express";
import {
  getAll,
  create,
  reorder,
  update,
  remove,
  setCompletion,
  incrementCompletion,
} from "../controllers/habitController.js";

const router = Router();

router.get("/", getAll);
router.post("/", create);
router.post("/reorder", reorder);

router.put("/:id", update);
router.delete("/:id", remove);
router.patch("/:id/completion/:date", setCompletion);
router.post("/:id/completion/:date/increment", incrementCompletion);

export { router as habitRoutes };
