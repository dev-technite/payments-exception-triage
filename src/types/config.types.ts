export interface AppConfig {
  port: number;
  settlementFail: boolean;
}

export type Environment = Record<string, string | undefined>;
