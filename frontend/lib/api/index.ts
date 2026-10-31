import { httpApi } from "./http";
import { mockApi } from "./mock";
import type { ApiClient } from "./types";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export const api: ApiClient = USE_MOCKS ? mockApi : httpApi;
