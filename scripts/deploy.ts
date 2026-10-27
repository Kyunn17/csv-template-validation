/**
 * Layer deploy: membaca deploy.config.json, menghasilkan file konfigurasi
 * sesuai target, lalu (khusus Cloudflare) menjalankan deploy.
 *
 *   npm run deploy:gen      -> hanya hasilkan file (aman)
 *   npm run deploy:dry      -> tampilkan rencana, tidak menulis/menjalankan apa pun
 *   npm run deploy          -> hasilkan file + deploy ke target di config
 *   npm run deploy:gen:aws  -> hasilkan file AWS (tidak deploy)
 *   npm run deploy:secrets  -> kirim env var ke Cloudflare sebagai secret
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const CONFIG_FILE = "deploy.config.json";
const BANNER =
  "GENERATED oleh scripts/deploy.ts dari deploy.config.json. Jangan diedit manual; ubah config lalu jalankan: npm run deploy:gen";

const TargetSchema = z.enum(["cloudflare-workers", "aws-lambda"]);

const ConfigSchema = z.object({
  appName: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "huruf kecil, angka, dan tanda hubung"),
  target: TargetSchema,
  envVars: z
    .array(z.string().regex(/^[A-Z][A-Z0-9_]*$/, "format NAMA_VARIABEL"))
    .min(1),
  cloudflare: z.object({
    compatibilityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format YYYY-MM-DD"),
  }),
  aws: z.object({
    region: z.string().min(1),
    stackName: z.string().regex(/^[A-Za-z][A-Za-z0-9-]{0,127}$/),
    memoryMb: z.number().int().min(128).max(10240),
    timeoutSec: z.number().int().min(1).max(900),
    architecture: z.enum(["x86_64", "arm64"]),
    lambdaAdapterVersion: z.string().min(1),
  }),
});

type Config = z.infer<typeof ConfigSchema>;
type GeneratedFile = { path: string; content: string };

// ---------- util ----------

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const valueOf = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

// Satu string perintah (bukan array args) supaya tidak memicu DEP0190 di Node
function run(cmd: string, dry: boolean) {
  console.log(`\n$ ${cmd}`);
  if (dry) return;
  const r = spawnSync(cmd, { stdio: "inherit", shell: true });
  if (r.status !== 0) fail(`Perintah gagal (exit code ${r.status}).`);
}

function paramName(envKey: string): string {
  return envKey
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) fail(`${CONFIG_FILE} tidak ditemukan di folder ini.`);

  let raw: unknown = undefined;
  try {
    raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch (e) {
    fail(`${CONFIG_FILE} bukan JSON yang valid: ${(e as Error).message}`);
  }

  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`
    );
    fail(`Isi ${CONFIG_FILE} tidak valid:\n${lines.join("\n")}`);
  }

  const config = parsed.data;
  const override = valueOf("--target");
  if (override !== undefined) {
    const t = TargetSchema.safeParse(override);
    if (!t.success) {
      fail(`--target tidak dikenal: "${override}". Pilihan: ${TargetSchema.options.join(", ")}`);
    }
    config.target = t.data;
  }
  return config;
}

// ---------- generator: Cloudflare Workers ----------

function genCloudflare(c: Config): GeneratedFile[] {
  const wrangler = {
    $schema: "./node_modules/wrangler/config-schema.json",
    name: c.appName,
    main: ".open-next/worker.js",
    upload_source_maps: true,
    compatibility_date: c.cloudflare.compatibilityDate,
    compatibility_flags: ["nodejs_compat"],
    assets: { directory: ".open-next/assets", binding: "ASSETS" },
    observability: { enabled: true },
  };
  return [
    {
      path: "wrangler.jsonc",
      content: `// ${BANNER}\n${JSON.stringify(wrangler, null, 2)}\n`,
    },
  ];
}

// ---------- generator: AWS Lambda (Lambda Web Adapter + SAM) ----------

function genAws(c: Config): GeneratedFile[] {
  const { aws } = c;

  const dockerfile = `# ${BANNER}
FROM public.ecr.aws/docker/library/node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

FROM public.ecr.aws/docker/library/node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM public.ecr.aws/docker/library/node:24-slim AS runner
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:${aws.lambdaAdapterVersion} /lambda-adapter /opt/extensions/lambda-adapter
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV AWS_LWA_PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Filesystem Lambda read-only kecuali /tmp, arahkan cache Next.js ke sana
RUN ln -s /tmp/cache ./.next/cache
CMD ["node", "server.js"]
`;

  const params = c.envVars
    .map((k) => `  ${paramName(k)}:\n    Type: String\n    NoEcho: true`)
    .join("\n");
  const envs = c.envVars
    .map((k) => `          ${k}: !Ref ${paramName(k)}`)
    .join("\n");

  const template = `# ${BANNER}
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Description: ${c.appName} (Next.js di AWS Lambda lewat Lambda Web Adapter)

Parameters:
${params}

Resources:
  AppFunction:
    Type: AWS::Serverless::Function
    Properties:
      PackageType: Image
      Architectures:
        - ${aws.architecture}
      MemorySize: ${aws.memoryMb}
      Timeout: ${aws.timeoutSec}
      Environment:
        Variables:
${envs}
      FunctionUrlConfig:
        AuthType: NONE
    Metadata:
      Dockerfile: Dockerfile.lambda
      DockerContext: .
      DockerTag: latest

Outputs:
  AppUrl:
    Description: URL publik aplikasi (Function URL)
    Value: !GetAtt AppFunctionUrl.FunctionUrl
`;

  return [
    { path: "Dockerfile.lambda", content: dockerfile },
    { path: "template.yaml", content: template },
  ];
}

// ---------- deploy ----------

function readEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (key === undefined || val === undefined) continue;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function syncSecrets(c: Config, dry: boolean) {
  const source = [".dev.vars", ".env.local"].find((f) => existsSync(f));
  if (!source) fail("Tidak ada .dev.vars atau .env.local untuk dibaca nilainya.");

  const values = readEnvFile(source);
  const payload: Record<string, string> = {};
  const missing: string[] = [];
  for (const k of c.envVars) {
    const v = values[k];
    if (v) payload[k] = v;
    else missing.push(k);
  }
  console.log(`\nSumber nilai: ${source}`);
  if (missing.length) console.warn(`⚠ Dilewati (kosong/tidak ada): ${missing.join(", ")}`);
  if (Object.keys(payload).length === 0) fail("Tidak ada secret yang bisa dikirim.");

  if (dry) {
    run(`npx wrangler secret bulk <file sementara berisi ${Object.keys(payload).join(", ")}>`, true);
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "cf-secrets-"));
  const file = join(dir, "secrets.json");
  try {
    writeFileSync(file, JSON.stringify(payload));
    run(`npx wrangler secret bulk "${file}"`, false);
  } finally {
    rmSync(dir, { recursive: true, force: true }); // hapus file berisi rahasia
  }
}

function printAwsInstructions(c: Config) {
  const overrides = c.envVars
    .map((k) => `${paramName(k)}="<nilai ${k}>"`)
    .join(" ");
  console.log(`
Deploy otomatis ke AWS sengaja BELUM diaktifkan.
File sudah dihasilkan. Kalau akses AWS sudah ada, jalankan manual:

  sam build
  sam deploy --stack-name ${c.aws.stackName} --region ${c.aws.region} \\
    --resolve-image-repos --resolve-s3 --capabilities CAPABILITY_IAM \\
    --parameter-overrides ${overrides}
`);
}

function main() {
  const config = loadConfig();
  const dry = has("--dry-run");
  console.log(`App    : ${config.appName}`);
  console.log(
    `Target : ${config.target}${dry ? "  (dry-run: tidak ada yang ditulis/dijalankan)" : ""}\n`
  );

  const files =
    config.target === "cloudflare-workers" ? genCloudflare(config) : genAws(config);
  for (const f of files) {
    if (dry) {
      console.log(`[dry-run] akan menulis ${f.path}`);
    } else {
      writeFileSync(f.path, f.content);
      console.log(`✔ ${f.path}`);
    }
  }

  if (has("--generate-only")) {
    console.log("\nSelesai (hanya generate).");
    return;
  }

  if (config.target === "cloudflare-workers") {
    const secretsOnly = has("--secrets-only");
    if (!secretsOnly) {
      run("npx opennextjs-cloudflare build", dry);
      run("npx opennextjs-cloudflare deploy", dry);
    }
    if (secretsOnly || has("--sync-secrets")) syncSecrets(config, dry);
  } else {
    printAwsInstructions(config);
  }
}

main();