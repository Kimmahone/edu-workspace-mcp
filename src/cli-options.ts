export const CLIENTS = ["codex", "claude", "claude-desktop", "cursor"] as const;
export type ClientTarget = typeof CLIENTS[number] | "all";
export type CliOptions = { command: string; client?: ClientTarget; legacy: boolean; readAccess: boolean; noBrowser: boolean; help: boolean; localOnly?: boolean };

export function parseCliOptions(argv: string[]): CliOptions {
  if (argv.length === 1 && ["--version", "-v"].includes(argv[0])) return { command: "version", legacy: false, readAccess: false, noBrowser: false, help: false };
  const knownFlags = new Set(["--workspace-readonly", "--legacy", "--read", "--no-browser", "--local-only", "--help", "-h"]);
  for (const arg of argv) if (arg.startsWith("-") && !knownFlags.has(arg)) throw new Error(`알 수 없는 옵션: ${arg.split("=")[0]}. 로그인과 설정 변경을 시작하지 않았습니다.`);
  const positionals = argv.filter(arg => !arg.startsWith("-"));
  const command = positionals[0] ?? "serve";
  if (!["serve", "setup", "install", "login", "doctor", "disconnect", "web", "version"].includes(command)) throw new Error("알 수 없는 명령입니다. --help로 지원 명령을 확인하세요.");
  const help = argv.includes("--help") || argv.includes("-h");
  const legacy = argv.includes("--legacy") || command === "web";
  const readAccess = argv.includes("--read");
  if (argv.includes("--workspace-readonly") && legacy) throw new Error("읽기 전용 Agent 모드와 기존 웹·고급 모드를 함께 선택할 수 없습니다.");
  if (readAccess && !legacy) throw new Error("--read는 Classroom을 포함한 고급 범위입니다. 기본 Agent는 승인된 읽기 5개만 사용합니다. 고급 모드는 --legacy로 명시적으로 선택하세요.");
  if (argv.includes("--no-browser") && command !== "login") throw new Error("--no-browser는 login에만 사용할 수 있습니다.");
  if (argv.includes("--local-only") && command !== "disconnect") throw new Error("--local-only는 disconnect에만 사용할 수 있습니다.");
  if (positionals.length > (command === "install" || command === "setup" ? 2 : 1)) throw new Error("명령 인수가 너무 많습니다.");
  let client = positionals[1];
  if (client === "claude-code") client = "claude";
  if (client && ![...CLIENTS, "all"].includes(client as ClientTarget)) throw new Error("지원하지 않는 앱입니다. codex, claude, claude-desktop, cursor 중 선택하세요.");
  if (command === "install" && !client && !help) throw new Error("설치 앱을 선택하세요: codex, claude, claude-desktop, cursor, all");
  return { command, client: client as ClientTarget | undefined, legacy, readAccess, noBrowser: argv.includes("--no-browser"), localOnly: argv.includes("--local-only"), help };
}
