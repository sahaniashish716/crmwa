import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveTemplateSendChannel,
  sendTemplateMessage,
} from "./meta-api";
import type { MessageTemplate } from "@/types";

const BASE = {
  phoneNumberId: "pn-1",
  accessToken: "token",
  to: "919876543210",
  templateName: "promo",
  language: "en_US",
} as const;

function marketingTemplate(): MessageTemplate {
  return {
    id: "t1",
    user_id: "u1",
    name: "promo",
    category: "Marketing",
    body_text: "Hello {{1}}",
    created_at: new Date().toISOString(),
  };
}

describe("resolveTemplateSendChannel", () => {
  it("routes Marketing templates to marketing_messages by default", () => {
    expect(resolveTemplateSendChannel(marketingTemplate())).toBe("marketing_messages");
  });

  it("keeps Utility on messages", () => {
    expect(
      resolveTemplateSendChannel({
        ...marketingTemplate(),
        category: "Utility",
      }),
    ).toBe("messages");
  });

  it("respects WHATSAPP_MARKETING_MESSAGES_API=false", () => {
    vi.stubEnv("WHATSAPP_MARKETING_MESSAGES_API", "false");
    expect(resolveTemplateSendChannel(marketingTemplate())).toBe("messages");
  });
});

describe("sendTemplateMessage — marketing endpoint", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("POSTs to /marketing_messages for Marketing templates", async () => {
    let url = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        url = u;
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.marketing" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await sendTemplateMessage({
      ...BASE,
      template: marketingTemplate(),
      messageParams: { body: ["Ashish"] },
    });

    expect(url).toContain("/pn-1/marketing_messages");
    expect(result.messageId).toBe("wamid.marketing");
  });
});
