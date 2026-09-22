export interface IsOddOptions {
  /** Defaults to TYPESAFE_API_KEY. */
  apiKey?: string;
  signal?: AbortSignal;
}

/** One Jev request per call. Returns true when its oddness probability exceeds 0.5. */
export declare function isOdd(num: number, options?: IsOddOptions): Promise<boolean>;
