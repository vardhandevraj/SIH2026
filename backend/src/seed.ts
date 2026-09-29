import { start } from "./index";

start().catch((err) => {
  console.error("[CHAINTRACE-SEED]", err);
  process.exit(1);
});