export function hostname(): string {
  return "localhost";
}
export function type(): string {
  return "Linux";
}
export function platform(): string {
  return "linux";
}
export function arch(): string {
  return "x64";
}
export function release(): string {
  return "5.15.0";
}
export function tmpdir(): string {
  return "/tmp";
}
export function homedir(): string {
  return "/";
}
export function userInfo(): {
  username: string;
  uid: number;
  gid: number;
  shell: string;
  homedir: string;
} {
  return {
    username: "user",
    uid: 1000,
    gid: 1000,
    shell: "/bin/sh",
    homedir: "/",
  };
}
export function cpus(): {
  model: string;
  speed: number;
  times: { user: number; nice: number; sys: number; idle: number; irq: number };
}[] {
  const count =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return Array.from({ length: count }, () => ({
    model: "Browser CPU",
    speed: 2400,
    times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
  }));
}
export function totalmem(): number {
  return 8 * 1024 * 1024 * 1024;
}
export function freemem(): number {
  return 4 * 1024 * 1024 * 1024;
}
export function uptime(): number {
  return performance.now() / 1000;
}
export function loadavg(): [number, number, number] {
  return [0, 0, 0];
}
export function networkInterfaces(): Record<string, unknown[]> {
  return {};
}
export function endianness(): "BE" | "LE" {
  return new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? "LE" : "BE";
}
export const EOL = "\n";
export const constants = {
  signals: { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGTERM: 15, SIGKILL: 9 },
  errno: {},
  priority: {
    PRIORITY_LOW: 19,
    PRIORITY_BELOW_NORMAL: 10,
    PRIORITY_NORMAL: 0,
    PRIORITY_ABOVE_NORMAL: -7,
    PRIORITY_HIGH: -14,
    PRIORITY_HIGHEST: -20,
  },
};
export function version(): string {
  return "v20.0.0";
}
export function machine(): string {
  return "x86_64";
}

export default {
  hostname,
  type,
  platform,
  arch,
  release,
  tmpdir,
  homedir,
  userInfo,
  cpus,
  totalmem,
  freemem,
  uptime,
  loadavg,
  networkInterfaces,
  endianness,
  EOL,
  constants,
  version,
  machine,
};
