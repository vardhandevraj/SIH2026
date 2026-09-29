import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174",
  databasePath: process.env.DATABASE_PATH || "./data/chaintrace.db",
  alchemyKey: process.env.ALCHEMY_API_KEY || "",
  etherscanKey: process.env.ETHERSCAN_API_KEY || "",
  groqKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  // An explicitly empty value disables the optional Python service; undefined falls back to the local default.
  pythonUrl: process.env.PYTHON_ANALYSIS_URL === undefined ? "http://127.0.0.1:5090" : process.env.PYTHON_ANALYSIS_URL,
  demoMode: bool(process.env.DEMO_MODE, true),
};

export const DEMO_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";