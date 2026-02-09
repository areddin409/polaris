import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { inngest } from "@/inngest/client";
import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const requestSchema = z.object({
  projectId: z.string(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId } = requestSchema.parse(body);

  const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
  if (!internalKey) {
    return NextResponse.json(
      { error: "Internal Key not configured" },
      { status: 500 }
    );
  }

  //find all processing messages for the project
  const processingMessages = await convex.query(
    api.system.getProcessingMessages,
    {
      projectId: projectId as Id<"projects">,
      internalKey,
    }
  );

  if (processingMessages.length === 0) {
    return NextResponse.json({
      success: true,
      canceled: false,
    });
  }

  //cancel each processing message
  const canceledIds = await Promise.all(
    processingMessages.map(async (message) => {
      await inngest.send({
        name: "message/cancel",
        data: {
          messageId: message._id,
        },
      });

      await convex.mutation(api.system.updateMessageStatus, {
        internalKey,
        messageId: message._id,
        status: "canceled",
      });

      return message._id;
    })
  );

  return NextResponse.json({
    success: true,
    canceled: true,
    messageIds: canceledIds,
  });
}
